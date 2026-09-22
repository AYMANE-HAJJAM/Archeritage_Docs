import { db } from "@/lib/db";
import { authenticate, apiError, HttpError, readLimitedBody } from "@/lib/http";
import { assertCanUpload } from "@/lib/access";
import { maxUploadBytes, validateFile } from "@/lib/validation/file";
import { uploadObject, deleteObject } from "@/lib/storage";
import { resolveUploadContext } from "@/lib/heritage/upload-context";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const user = await authenticate(request, true);
    const type = request.headers.get("content-type") || "";
    if (!type.startsWith("multipart/form-data;")) {
      throw new HttpError(400, "Format d’envoi invalide.");
    }

    const body = await readLimitedBody(request, maxUploadBytes() + 64 * 1024);
    let form: FormData;
    try {
      form = await new Response(new Uint8Array(body), {
        headers: { "content-type": type },
      }).formData();
    } catch {
      throw new HttpError(400, "Envoi invalide.");
    }

    const file = form.get("file");
    if (!(file instanceof File) || form.getAll("file").length !== 1) {
      throw new HttpError(400, "Sélectionnez un fichier.");
    }

    const documentScope = String(form.get("documentScope") || "").trim();
    const docCategorie = String(form.get("docCategorie") || "").trim();
    const projectIdField = String(form.get("projectId") || "").trim();
    const folderIdField = String(form.get("folderId") || "").trim();

    let projectId: string;
    let folderId: string;
    let scope: "PROJECT_SECTION" | null = null;
    let category: string | null = null;
    let confidentialite: "PROJET" | "CONFIDENTIEL" = "PROJET";

    if (documentScope && docCategorie) {
      // Contextual SAFI upload — folder resolved server-side.
      const resolved = await resolveUploadContext({
        documentScope,
        docCategorie,
        projectId: projectIdField || undefined,
      });
      projectId = resolved.projectId;
      folderId = resolved.folderId;
      scope = resolved.documentScope;
      category = resolved.docCategorie;
      confidentialite = resolved.confidentialite;
    } else {
      // Legacy Explorer upload — requires explicit folderId + projectId.
      projectId = projectIdField;
      folderId = folderIdField;
      if (!projectId || !folderId) {
        throw new HttpError(400, "Projet ou dossier manquant.");
      }
      if (!(await db.folder.findFirst({ where: { id: folderId, projectId } }))) {
        throw new HttpError(404, "Dossier introuvable dans ce projet.");
      }
    }

    await assertCanUpload(user, projectId);
    const bytes = Buffer.from(await file.arrayBuffer());
    let metadata;
    try {
      metadata = validateFile(file.name, file.type, bytes);
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Fichier invalide.",
      );
    }

    const object = await uploadObject(
      bytes,
      metadata.storageProvider,
      metadata.mimeType,
    );

    try {
      const record = await db.file.create({
        data: {
          ...metadata,
          ...object,
          originalName: file.name,
          displayName: file.name,
          size: bytes.length,
          projectId,
          folderId,
          uploadedById: user.id,
          ...(scope && category
            ? {
                documentScope: scope,
                docCategorie: category,
                confidentialite,
              }
            : {}),
        },
        select: {
          id: true,
          displayName: true,
          originalName: true,
          extension: true,
          mimeType: true,
          size: true,
          storageProvider: true,
          folderId: true,
          createdAt: true,
          docStatut: true,
          docVersion: true,
          documentScope: true,
          docCategorie: true,
          uploadedById: true,
          uploadedBy: { select: { name: true } },
        },
      });
      return Response.json(
        {
          id: record.id,
          displayName: record.displayName,
          originalName: record.originalName,
          extension: record.extension,
          mimeType: record.mimeType,
          size: record.size,
          storageProvider: record.storageProvider,
          folderId: record.folderId,
          createdAt: record.createdAt.toISOString(),
          docStatut: record.docStatut,
          docVersion: record.docVersion,
          documentScope: record.documentScope,
          docCategorie: record.docCategorie,
          uploadedById: record.uploadedById,
          uploadedByName: record.uploadedBy?.name ?? null,
          location: "",
        },
        { status: 201 },
      );
    } catch (error) {
      try {
        await deleteObject({
          ...object,
          storageProvider: metadata.storageProvider,
        });
      } catch {
        console.error("Orphaned upload requires cleanup", object.storageKey);
      }
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}
