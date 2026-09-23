import { db } from "@/lib/db";
import { authenticate, apiError, HttpError } from "@/lib/http";
import { assertCanUpload } from "@/lib/access";
import {
  assertWithinUploadLimit,
  maxUploadBytes,
  resolveMaxUploadMb,
  validateFile,
} from "@/lib/validation/file";
import {
  deleteObject,
  uploadObject,
  uploadWebFileToB2,
} from "@/lib/storage";
import { resolveUploadContext } from "@/lib/heritage/upload-context";

export const runtime = "nodejs";
/** Large video uploads (hundreds of MB) need more than the default. */
export const maxDuration = 600;

let loggedUploadLimit = false;

function logUploadLimitOnce() {
  if (loggedUploadLimit) return;
  loggedUploadLimit = true;
  try {
    const mb = resolveMaxUploadMb();
    console.info("[upload] runtime MAX_UPLOAD_MB resolved", {
      mb,
      bytes: mb * 1024 * 1024,
      rawEnv: process.env.MAX_UPLOAD_MB ?? "(unset → default)",
    });
  } catch (error) {
    console.error("[upload] runtime MAX_UPLOAD_MB invalid", {
      rawEnv: process.env.MAX_UPLOAD_MB ?? "(unset)",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function stageLog(
  stage: string,
  fields: Record<string, string | number | boolean | null | undefined>,
) {
  console.info("[upload]", { stage, ...fields });
}

function stageError(
  stage: string,
  fields: Record<string, string | number | boolean | null | undefined>,
  error: unknown,
) {
  console.error("[upload]", {
    stage,
    ...fields,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage:
      error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let fileName: string | undefined;
  let fileSize: number | undefined;

  try {
    logUploadLimitOnce();

    const user = await authenticate(request, true);
    stageLog("authentication", { durationMs: Date.now() - startedAt });

    const type = request.headers.get("content-type") || "";
    if (!type.startsWith("multipart/form-data")) {
      throw new HttpError(400, "Format d’envoi invalide.");
    }

    // Early reject from Content-Length when the client provides it.
    let maxBytes: number;
    try {
      maxBytes = maxUploadBytes();
    } catch (error) {
      stageError("config", { fileName, fileSize }, error);
      throw new HttpError(
        500,
        "Configuration d’upload invalide. Contactez un administrateur.",
      );
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > maxBytes + 256 * 1024) {
      stageLog("content_length_reject", {
        contentLength,
        maxBytes,
        durationMs: Date.now() - startedAt,
      });
      throw new HttpError(413, "Le fichier dépasse la taille autorisée.");
    }

    // Single multipart parse — avoid readLimitedBody + re-FormData + arrayBuffer triple copy.
    const formStarted = Date.now();
    let form: FormData;
    try {
      form = await request.formData();
    } catch (error) {
      stageError("formData_parse", { contentLength, durationMs: Date.now() - formStarted }, error);
      throw new HttpError(400, "Envoi invalide.");
    }
    stageLog("formData_parse", {
      contentLength: contentLength || null,
      durationMs: Date.now() - formStarted,
    });

    const file = form.get("file");
    if (!(file instanceof File) || form.getAll("file").length !== 1) {
      throw new HttpError(400, "Sélectionnez un fichier.");
    }

    fileName = file.name;
    fileSize = file.size;

    try {
      assertWithinUploadLimit(file.size);
    } catch (error) {
      stageError("file_size_check", { fileName, fileSize }, error);
      throw new HttpError(413, "Le fichier dépasse la taille autorisée.");
    }

    const documentScope = String(form.get("documentScope") || "").trim();
    const docCategorie = String(form.get("docCategorie") || "").trim();
    const projectIdField = String(form.get("projectId") || "").trim();
    const folderIdField = String(form.get("folderId") || "").trim();

    let projectId: string;
    let folderId: string | null;
    let scope: "PROJECT_SECTION" | null = null;
    let category: string | null = null;
    let confidentialite: "PROJET" | "CONFIDENTIEL" = "PROJET";

    const metaStarted = Date.now();
    if (documentScope && docCategorie) {
      const resolved = await resolveUploadContext({
        documentScope,
        docCategorie,
        projectId: projectIdField || undefined,
        folderId: folderIdField || null,
      });
      projectId = resolved.projectId;
      folderId = resolved.folderId;
      scope = resolved.documentScope;
      category = resolved.docCategorie;
      confidentialite = resolved.confidentialite;
    } else {
      projectId = projectIdField;
      folderId = folderIdField || null;
      if (!projectId || !folderId) {
        throw new HttpError(400, "Projet ou dossier manquant.");
      }
      if (!(await db.folder.findFirst({ where: { id: folderId, projectId } }))) {
        throw new HttpError(404, "Dossier introuvable dans ce projet.");
      }
    }
    stageLog("metadata_validation", {
      fileName,
      fileSize,
      projectId,
      folderId,
      durationMs: Date.now() - metaStarted,
    });

    const permStarted = Date.now();
    await assertCanUpload(user, projectId);
    stageLog("permission_check", {
      fileName,
      fileSize,
      projectId,
      durationMs: Date.now() - permStarted,
    });

    // Peek a short head for magic-byte checks without buffering the whole video.
    const headStarted = Date.now();
    const headBytes = Buffer.from(await file.slice(0, 64).arrayBuffer());
    let metadata;
    try {
      metadata = validateFile(file.name, file.type, headBytes, file.size);
    } catch (error) {
      stageError("file_validation", { fileName, fileSize }, error);
      const message =
        error instanceof Error ? error.message : "Fichier invalide.";
      if (/trop volumineux/i.test(message)) {
        throw new HttpError(413, "Le fichier dépasse la taille autorisée.");
      }
      throw new HttpError(400, message);
    }
    stageLog("file_validation", {
      fileName,
      fileSize,
      storageProvider: metadata.storageProvider,
      mimeType: metadata.mimeType,
      durationMs: Date.now() - headStarted,
    });

    const storageStarted = Date.now();
    stageLog("storage_upload_start", {
      fileName,
      fileSize,
      storageProvider: metadata.storageProvider,
    });

    let object: { storageKey: string; storageVersion: string | null };
    try {
      if (metadata.storageProvider === "CLOUDINARY") {
        // Images stay buffered (small); Cloudinary stream API needs bytes.
        const bytes = Buffer.from(await file.arrayBuffer());
        object = await uploadObject(
          bytes,
          metadata.storageProvider,
          metadata.mimeType,
        );
      } else {
        // Stream large videos/documents straight to B2.
        object = await uploadWebFileToB2(file, metadata.mimeType);
      }
    } catch (error) {
      stageError(
        "storage_upload",
        {
          fileName,
          fileSize,
          storageProvider: metadata.storageProvider,
          durationMs: Date.now() - storageStarted,
        },
        error,
      );
      throw new HttpError(
        502,
        "Impossible d’enregistrer le fichier dans le stockage. Réessayez plus tard.",
      );
    }

    stageLog("storage_upload_result", {
      fileName,
      fileSize,
      storageProvider: metadata.storageProvider,
      storageKey: object.storageKey,
      durationMs: Date.now() - storageStarted,
    });

    try {
      const dbStarted = Date.now();
      const record = await db.file.create({
        data: {
          ...metadata,
          ...object,
          originalName: file.name,
          displayName: file.name,
          size: file.size,
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
      stageLog("prisma_create", {
        fileName,
        fileSize,
        fileId: record.id,
        durationMs: Date.now() - dbStarted,
        totalDurationMs: Date.now() - startedAt,
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
      stageError(
        "prisma_create",
        { fileName, fileSize, storageKey: object.storageKey },
        error,
      );
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
    if (!(error instanceof HttpError)) {
      stageError(
        "unhandled",
        {
          fileName,
          fileSize,
          totalDurationMs: Date.now() - startedAt,
        },
        error,
      );
    }
    return apiError(error);
  }
}
