import "server-only";

import type { File as StoredFile } from "@/generated/prisma/client";
import { AuditActions, writeAuditLog } from "@/lib/admin/audit";
import {
  assertCanDeleteDocuments,
  type AccessUser,
} from "@/lib/access";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { deleteObject } from "@/lib/storage";
import { invalidatePreviewCacheForFile } from "@/lib/storage/preview-cache";

export type DeletedDocumentInfo = {
  id: string;
  displayName: string;
  originalName: string;
  projectId: string;
  folderId: string | null;
  heritageSectionId: string | null;
  storageProvider: StoredFile["storageProvider"];
  storageKey: string;
};

/**
 * Hard-delete a document after authorization.
 *
 * Order (safe for consistency):
 * 1. Authorize (ADMIN or canDeleteDocuments)
 * 2. Block if Preuve links exist (FK Restrict)
 * 3. Invalidate preview/video derivative caches (best-effort)
 * 4. Delete original storage object (B2 / Cloudinary) — abort if this fails
 * 5. Delete DB File row
 * 6. Audit DOCUMENT_DELETED
 *
 * Originals are never soft-deleted in this architecture.
 */
export async function deleteDocumentForUser(
  actor: AccessUser,
  fileId: string,
): Promise<DeletedDocumentInfo> {
  const file = await db.file.findUnique({
    where: { id: fileId },
    include: {
      folder: { select: { heritageSectionId: true } },
      _count: { select: { preuves: true } },
    },
  });
  if (!file) {
    throw new HttpError(404, "Fichier introuvable.");
  }

  await assertCanDeleteDocuments(actor, file.projectId);

  if (file._count.preuves > 0) {
    throw new HttpError(
      409,
      "Ce document est lié à des preuves patrimoniales et ne peut pas être supprimé.",
    );
  }

  const snapshot: DeletedDocumentInfo = {
    id: file.id,
    displayName: file.displayName,
    originalName: file.originalName,
    projectId: file.projectId,
    folderId: file.folderId,
    heritageSectionId: file.folder?.heritageSectionId ?? null,
    storageProvider: file.storageProvider,
    storageKey: file.storageKey,
  };

  try {
    await invalidatePreviewCacheForFile(file);
  } catch (error) {
    console.warn("[document-delete] Preview cache invalidation failed", {
      fileId: file.id,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    await deleteObject(file);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[document-delete] Storage deletion failed — DB row kept", {
      fileId: file.id,
      storageKey: file.storageKey,
      storageProvider: file.storageProvider,
      detail,
    });
    throw new HttpError(
      502,
      "Impossible de supprimer le fichier dans le stockage. Réessayez plus tard.",
    );
  }

  try {
    await db.file.delete({ where: { id: file.id } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(
      "[document-delete] CRITICAL: storage object deleted but DB row remains",
      {
        fileId: file.id,
        storageKey: file.storageKey,
        storageProvider: file.storageProvider,
        detail,
      },
    );
    throw new HttpError(
      500,
      "Le fichier a été retiré du stockage mais pas de la base. Contactez un administrateur.",
    );
  }

  await writeAuditLog({
    actorUserId: actor.id,
    action: AuditActions.DOCUMENT_DELETED,
    entityType: "File",
    entityId: snapshot.id,
    metadata: {
      displayName: snapshot.displayName,
      originalName: snapshot.originalName,
      projectId: snapshot.projectId,
      folderId: snapshot.folderId,
      heritageSectionId: snapshot.heritageSectionId,
      storageProvider: snapshot.storageProvider,
      // Key only — never file contents.
      storageKey: snapshot.storageKey,
    },
  });

  return snapshot;
}
