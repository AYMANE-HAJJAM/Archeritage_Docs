/**
 * Application-level authorization.
 * ADMIN = full platform. USER = scoped ProjectMember flags.
 */
import "server-only";

import { getUser, type SessionUser } from "@/lib/auth";
import { HttpError } from "@/lib/http";

async function redirectTo(pathname: string): Promise<never> {
  const { redirect } = await import("next/navigation");
  redirect(pathname);
  throw new Error("redirect");
}
import { db } from "@/lib/db";
import { canManagePlatform, type AccessUser } from "@/lib/access/roles";
import {
  FULL_PROJECT_PERMISSIONS,
  resolveCanCreateProject,
  resolveProjectPermissions,
  type ProjectPermissionFlags,
} from "@/lib/access/permissions";

export type { AccessUser, ProjectPermissionFlags };
export { canManagePlatform };
export {
  EMPTY_PROJECT_PERMISSIONS,
  FULL_PROJECT_PERMISSIONS,
  normalizeProjectPermissions,
  resolveCanCreateProject,
  resolveProjectPermissions,
} from "@/lib/access/permissions";

export async function requireActiveUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) return redirectTo("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireActiveUser();
  if (!canManagePlatform(user)) return redirectTo("/projects");
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
  return db.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: {
      canView: true,
      canUpload: true,
      canDownload: true,
      canDeleteDocuments: true,
      canManageStructure: true,
    },
  });
}

export async function getProjectPermissionsForUser(
  user: AccessUser,
  projectId: string,
): Promise<ProjectPermissionFlags> {
  if (canManagePlatform(user)) return FULL_PROJECT_PERMISSIONS;
  const membership = await getProjectMembership(user.id, projectId);
  return resolveProjectPermissions(user, membership);
}

/** Resolve projectId from a section (Section → SectionGroup → Project). */
export async function getProjectIdForSection(sectionId: string): Promise<string> {
  const section = await db.section.findUnique({
    where: { id: sectionId },
    select: { group: { select: { projectId: true } } },
  });
  if (!section) throw new HttpError(404, "Section introuvable.");
  return section.group.projectId;
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

export async function assertCanCreateProject(user: AccessUser): Promise<void> {
  if (!resolveCanCreateProject(user)) {
    throw new HttpError(403, "Permission insuffisante pour créer un dossier.");
  }
}

/** Preview / consultation — requires canView. */
export async function assertFileReadable(
  user: AccessUser,
  file: { sectionId: string; confidentialite: string | null },
): Promise<void> {
  const projectId = await getProjectIdForSection(file.sectionId);
  await assertProjectAccess(user, projectId);
  if (canManagePlatform(user)) return;
  if (file.confidentialite === "CONFIDENTIEL") {
    throw new HttpError(403, "Document confidentiel — accès refusé.");
  }
}

/** Original file download — requires canDownload. */
export async function assertFileDownloadable(
  user: AccessUser,
  file: { sectionId: string; confidentialite: string | null },
): Promise<void> {
  const projectId = await getProjectIdForSection(file.sectionId);
  await assertCanDownload(user, projectId);
  if (canManagePlatform(user)) return;
  if (file.confidentialite === "CONFIDENTIEL") {
    throw new HttpError(403, "Document confidentiel — téléchargement refusé.");
  }
}

/** List project IDs the user may view (ADMIN → ALL). */
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
