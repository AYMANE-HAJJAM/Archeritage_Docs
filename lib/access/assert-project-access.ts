/**
 * Application-level authorization.
 * ADMIN = full platform. USER = scoped ProjectMember / TerritoireMember flags.
 */
import "server-only";

import { redirect } from "next/navigation";
import { getUser, type SessionUser } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { db } from "@/lib/db";
import { canManagePlatform, type AccessUser } from "@/lib/access/roles";
import {
  FULL_PROJECT_PERMISSIONS,
  resolveProjectPermissions,
  type ProjectPermissionFlags,
} from "@/lib/access/permissions";

export type { AccessUser, ProjectPermissionFlags };
export { canManagePlatform };
export {
  EMPTY_PROJECT_PERMISSIONS,
  FULL_PROJECT_PERMISSIONS,
  normalizeProjectPermissions,
  resolveCanCreateDossier,
  resolveProjectPermissions,
} from "@/lib/access/permissions";

export async function requireActiveUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireActiveUser();
  if (!canManagePlatform(user)) redirect("/projects");
  return user;
}

export function requireAdminApi(user: AccessUser): void {
  if (!canManagePlatform(user)) {
    throw new HttpError(403, "Accès réservé aux administrateurs.");
  }
}

export async function getProjectMembership(
  userId: string,
  projectId: string,
): Promise<ProjectPermissionFlags | null> {
  const row = await db.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: {
      canView: true,
      canUpload: true,
      canDownload: true,
      canDeleteDocuments: true,
      canEditDossier: true,
      canManageStructure: true,
      canReclassifyDocuments: true,
    },
  });
  return row;
}

export async function getProjectPermissionsForUser(
  user: AccessUser,
  projectId: string,
): Promise<ProjectPermissionFlags> {
  if (canManagePlatform(user)) {
    return FULL_PROJECT_PERMISSIONS;
  }
  const membership = await getProjectMembership(user.id, projectId);
  return resolveProjectPermissions(user, membership);
}

export async function canCreateDossierOnTerritoire(
  user: AccessUser,
  /* territoireId retained for call-site compatibility */
  territoireId: string,
): Promise<boolean> {
  void territoireId;
  // ADMIN-only. TerritoireMember.canCreateDossier is not consulted.
  return canManagePlatform(user);
}

export async function assertProjectPermission(
  user: AccessUser,
  projectId: string,
  permission: keyof ProjectPermissionFlags,
): Promise<ProjectPermissionFlags> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, isActive: true },
  });
  if (!project) throw new HttpError(404, "Projet introuvable.");
  if (!project.isActive && !canManagePlatform(user)) {
    throw new HttpError(403, "Ce projet n’est pas accessible.");
  }

  const perms = await getProjectPermissionsForUser(user, projectId);
  if (!perms[permission]) {
    throw new HttpError(403, "Permission insuffisante pour cette opération.");
  }
  return perms;
}

/** View / browse / preview access (or ADMIN). */
export async function assertProjectAccess(
  user: AccessUser,
  projectId: string,
): Promise<void> {
  await assertProjectPermission(user, projectId, "canView");
}

export async function assertCanUpload(
  user: AccessUser,
  projectId: string,
): Promise<void> {
  await assertProjectPermission(user, projectId, "canUpload");
}

export async function assertCanDownload(
  user: AccessUser,
  projectId: string,
): Promise<void> {
  await assertProjectPermission(user, projectId, "canDownload");
}

export async function assertCanDeleteDocuments(
  user: AccessUser,
  projectId: string,
): Promise<void> {
  await assertProjectPermission(user, projectId, "canDeleteDocuments");
}

export async function assertCanManageStructure(
  user: AccessUser,
  projectId: string,
): Promise<void> {
  await assertProjectPermission(user, projectId, "canManageStructure");
}

export async function assertCanReclassify(
  user: AccessUser,
  projectId: string,
): Promise<void> {
  await assertProjectPermission(user, projectId, "canReclassifyDocuments");
}

export async function assertCanCreateDossier(
  user: AccessUser,
  territoireId: string,
): Promise<void> {
  const ok = await canCreateDossierOnTerritoire(user, territoireId);
  if (!ok) {
    throw new HttpError(403, "Permission insuffisante pour créer un dossier.");
  }
}

/** Preview / consultation — requires canView. */
export async function assertFileReadable(
  user: AccessUser,
  file: { projectId: string; confidentialite: string | null },
): Promise<void> {
  await assertProjectAccess(user, file.projectId);
  if (canManagePlatform(user)) return;
  if (file.confidentialite === "CONFIDENTIEL") {
    throw new HttpError(403, "Document confidentiel — accès refusé.");
  }
}

/** Original file download — requires canDownload (and view). */
export async function assertFileDownloadable(
  user: AccessUser,
  file: { projectId: string; confidentialite: string | null },
): Promise<void> {
  await assertCanDownload(user, file.projectId);
  if (canManagePlatform(user)) return;
  if (file.confidentialite === "CONFIDENTIEL") {
    throw new HttpError(403, "Document confidentiel — téléchargement refusé.");
  }
}

/** List project IDs the user may view (ADMIN → all active, or all if includeInactive). */
export async function listViewableProjectIds(
  user: AccessUser,
  options?: { includeInactive?: boolean },
): Promise<string[] | "ALL"> {
  if (canManagePlatform(user)) return "ALL";
  const rows = await db.projectMember.findMany({
    where: {
      userId: user.id,
      canView: true,
      project: options?.includeInactive ? undefined : { isActive: true },
    },
    select: { projectId: true },
  });
  return rows.map((r) => r.projectId);
}
