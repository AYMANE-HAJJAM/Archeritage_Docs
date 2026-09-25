import "server-only";

import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { deleteObject } from "@/lib/storage";
import { invalidatePreviewCacheForFile } from "@/lib/storage/preview-cache";
import { AuditActions, writeAuditLog } from "@/lib/admin/audit";
import {
  assertCanDeleteDocuments,
  canManagePlatform,
  getProjectIdForSection,
  type AccessUser,
} from "@/lib/access";

/**
 * Hard-delete flow: authorize → delete storage → remove DB → clean previews → audit.
 * Uses File.id + storageKey from the record (never filename alone).
 */
export async function deleteDocumentForUser(
  fileId: string,
  actor: AccessUser,
): Promise<void> {
  const file = await db.file.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      sectionId: true,
      storageKey: true,
      storageProvider: true,
      storageVersion: true,
      mimeType: true,
      sourceHash: true,
      updatedAt: true,
      displayName: true,
    },
  });
  if (!file) throw new HttpError(404, "Fichier introuvable.");

  const projectId = await getProjectIdForSection(file.sectionId);
  if (!canManagePlatform(actor)) {
    await assertCanDeleteDocuments(actor, projectId);
  }

  try {
    await deleteObject({
      storageProvider: file.storageProvider,
      storageKey: file.storageKey,
      storageVersion: file.storageVersion,
      mimeType: file.mimeType,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[deleteDocumentForUser] storage delete failed", {
      fileId,
      storageKey: file.storageKey,
      detail: detail.slice(0, 300),
    });
    throw new HttpError(
      502,
      "Échec de la suppression du fichier dans le stockage.",
    );
  }

  await db.file.delete({ where: { id: fileId } });

  try {
    await invalidatePreviewCacheForFile(file);
  } catch {
    // Preview cleanup is best-effort after DB/storage success.
  }

  await writeAuditLog({
    actorUserId: actor.id,
    action: AuditActions.DOCUMENT_DELETED,
    entityType: "File",
    entityId: fileId,
    metadata: {
      displayName: file.displayName,
      storageKey: file.storageKey,
      projectId,
    },
  });
}
