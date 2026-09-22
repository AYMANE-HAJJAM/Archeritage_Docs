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
          code: true,
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

export async function listUserTerritoireAccess(userId: string) {
  return db.territoireMember.findMany({
    where: { userId },
    include: {
      territoire: { select: { id: true, name: true, code: true } },
    },
  });
}

function toStoredFlags(input: ProjectAccessInput): ProjectPermissionFlags {
  return normalizeProjectPermissions({
    canView: input.canView,
    canUpload: input.canUpload,
    canDownload: input.canDownload,
    canManageStructure: input.canManageStructure,
    canEditDossier: false,
    canReclassifyDocuments: false,
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
      role: "CONSULTANT",
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
      canView: flags.canView,
      canUpload: flags.canUpload,
      canDownload: flags.canDownload,
      canManageStructure: flags.canManageStructure,
    },
  });

  return row;
}

export async function upsertUserTerritoireAccess(
  actor: AccessUser,
  targetUserId: string,
  territoireId: string,
  canCreateDossier: boolean,
) {
  requireAdminApi(actor);
  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new HttpError(404, "Utilisateur introuvable.");
  if (target.role === "ADMIN") {
    throw new HttpError(400, "Les administrateurs ont déjà un accès complet.");
  }

  const territoire = await db.territoire.findUnique({ where: { id: territoireId } });
  if (!territoire) throw new HttpError(404, "Projet introuvable.");

  const row = await db.territoireMember.upsert({
    where: {
      userId_territoireId: { userId: targetUserId, territoireId },
    },
    create: {
      userId: targetUserId,
      territoireId,
      canCreateDossier,
    },
    update: { canCreateDossier },
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: AuditActions.USER_ACCESS_UPDATED,
    entityType: "TerritoireMember",
    entityId: row.id,
    metadata: { targetUserId, territoireId, canCreateDossier },
  });

  return row;
}

/** Apply access matrix for a newly invited USER (no-op for ADMIN). */
export async function applyInviteAccessMatrix(
  actor: AccessUser,
  targetUserId: string,
  projectAccess: ProjectAccessInput[],
  territoireAccess: { territoireId: string; canCreateDossier: boolean }[],
) {
  requireAdminApi(actor);
  for (const row of projectAccess) {
    if (
      row.canView ||
      row.canUpload ||
      row.canDownload ||
      row.canManageStructure
    ) {
      await upsertUserProjectAccess(actor, targetUserId, row);
    }
  }
  for (const row of territoireAccess) {
    if (row.canCreateDossier) {
      await upsertUserTerritoireAccess(
        actor,
        targetUserId,
        row.territoireId,
        true,
      );
    }
  }
}
