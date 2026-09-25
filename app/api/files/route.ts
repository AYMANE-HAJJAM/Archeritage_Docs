import { authenticate, apiError, HttpError } from "@/lib/http";
import {
  maxUploadBytes,
  resolveMaxUploadMb,
} from "@/lib/validation/file";
import { createUploadedFile } from "@/lib/files/create-uploaded-file";
import { formatPersonName } from "@/lib/users/display-name";

export const runtime = "nodejs";
export const maxDuration = 600;

let loggedUploadLimit = false;

function logUploadLimitOnce() {
  if (loggedUploadLimit) return;
  loggedUploadLimit = true;
  try {
    const mb = resolveMaxUploadMb();
    console.info("[upload] MAX_UPLOAD_MB", { mb, bytes: mb * 1024 * 1024 });
  } catch (error) {
    console.error("[upload] MAX_UPLOAD_MB invalid", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    logUploadLimitOnce();
    const user = await authenticate(request, true);

    const type = request.headers.get("content-type") || "";
    if (!type.startsWith("multipart/form-data")) {
      throw new HttpError(400, "Format d’envoi invalide.");
    }

    let maxBytes: number;
    try {
      maxBytes = maxUploadBytes();
    } catch {
      throw new HttpError(
        500,
        "Configuration d’upload invalide. Contactez un administrateur.",
      );
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > maxBytes + 256 * 1024) {
      throw new HttpError(413, "Le fichier dépasse la taille autorisée.");
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new HttpError(400, "Envoi invalide.");
    }

    const file = form.get("file");
    if (!(file instanceof File) || form.getAll("file").length !== 1) {
      throw new HttpError(400, "Sélectionnez un fichier.");
    }

    // Client must never choose storage identity.
    if (form.get("storageKey") || form.get("storageProvider") || form.get("uploadedById")) {
      throw new HttpError(400, "Paramètres de stockage non autorisés.");
    }

    const sectionId = String(form.get("sectionId") || "").trim();
    const folderIdField = String(form.get("folderId") || "").trim();
    const projectIdField = String(form.get("projectId") || "").trim();
    const partIdField = String(form.get("partId") || "").trim();
    if (!sectionId) {
      throw new HttpError(400, "Section manquante.");
    }

    const headBytes = Buffer.from(await file.slice(0, 64).arrayBuffer());
    const record = await createUploadedFile({
      userId: user.id,
      projectId: projectIdField || null,
      partId: partIdField || null,
      sectionId,
      folderId: folderIdField || null,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      source: file,
      headBytes,
    });

    console.info("[upload] ok", {
      fileId: record.id,
      durationMs: Date.now() - startedAt,
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
        sectionId: record.sectionId,
        folderId: record.folderId,
        createdAt: record.createdAt.toISOString(),
        uploadedByName: formatPersonName(record.uploadedBy),
        location: [record.section.name, record.folder?.name]
          .filter(Boolean)
          .join(" › "),
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
