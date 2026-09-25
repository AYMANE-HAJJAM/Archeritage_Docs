import "server-only";

import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { AuditActions, writeAuditLog } from "@/lib/admin/audit";
import {
  normalizeProjectPermissions,
  requireAdminApi,
  type AccessUser,
  type ProjectPermissionFlags,
} from "@/lib/access";

export type ProjectAccessInput = {
  projectId: string;
  canView: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canDeleteDocuments: boolean;
  canManageStructure: boolean;
};

export async function listUserProjectAccess(userId: string) {
  return db.projectMember.findMany({
    where: { userId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          territoireId: true,
          territoire: { select: { id: true, name: true, code: true } },
        },
      },
    },
    orderBy: { project: { name: "asc" } },
  });
}

function toStoredFlags(input: ProjectAccessInput): ProjectPermissionFlags {
  return normalizeProjectPermissions({
    canView: input.canView,
    canUpload: input.canUpload,
    canDownload: input.canDownload,
    canDeleteDocuments: input.canDeleteDocuments,
    canManageStructure: input.canManageStructure,
  });
}

export async function upsertUserProjectAccess(
  actor: AccessUser,
  targetUserId: string,
  input: ProjectAccessInput,
) {
  requireAdminApi(actor);
  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new HttpError(404, "Utilisateur introuvable.");
  if (target.role === "ADMIN") {
    throw new HttpError(400, "Les administrateurs ont déjà un accès complet.");
  }

  const project = await db.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw new HttpError(404, "Dossier introuvable.");

  const flags = toStoredFlags(input);

  const row = await db.projectMember.upsert({
    where: {
      userId_projectId: { userId: targetUserId, projectId: input.projectId },
    },
    create: {
      userId: targetUserId,
      projectId: input.projectId,
      ...flags,
    },
    update: { ...flags },
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: AuditActions.USER_ACCESS_UPDATED,
    entityType: "ProjectMember",
    entityId: row.id,
    metadata: {
      targetUserId,
      projectId: input.projectId,
      ...flags,
    },
  });

  return row;
}

/** Apply the invite dialog matrix in one pass (rows without canView skipped). */
export async function applyInviteAccessMatrix(
  actor: AccessUser,
  targetUserId: string,
  rows: ProjectAccessInput[],
) {
  requireAdminApi(actor);
  for (const row of rows) {
    if (!row.canView) continue;
    await upsertUserProjectAccess(actor, targetUserId, row);
  }
}

export async function removeUserProjectAccess(
  actor: AccessUser,
  targetUserId: string,
  projectId: string,
) {
  requireAdminApi(actor);
  const existing = await db.projectMember.findUnique({
    where: { userId_projectId: { userId: targetUserId, projectId } },
  });
  if (!existing) return;

  await db.projectMember.delete({
    where: { userId_projectId: { userId: targetUserId, projectId } },
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: AuditActions.USER_ACCESS_UPDATED,
    entityType: "ProjectMember",
    entityId: existing.id,
    metadata: { targetUserId, projectId, removed: true },
  });
}
