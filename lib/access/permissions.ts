/**
 * Pure permission evaluation (no DB) — unit-testable.
 *
 * USER project flags:
 * - canView
 * - canUpload
 * - canDownload
 * - canDeleteDocuments
 * - canManageStructure
 *
 * canManageStructure does NOT imply canDeleteDocuments.
 * Project creation under a Territoire is ADMIN-only.
 */
import type { AccessUser } from "@/lib/access/roles";
import { canManagePlatform } from "@/lib/access/roles";

export type ProjectPermissionFlags = {
  canView: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canDeleteDocuments: boolean;
  canManageStructure: boolean;
};

/** Normalize flags so view is required for other permissions. */
export function normalizeProjectPermissions(
  flags: ProjectPermissionFlags,
): ProjectPermissionFlags {
  if (!flags.canView) {
    return {
      canView: false,
      canUpload: false,
      canDownload: false,
      canDeleteDocuments: false,
      canManageStructure: false,
    };
  }
  return { ...flags, canView: true };
}

export const EMPTY_PROJECT_PERMISSIONS: ProjectPermissionFlags =
  normalizeProjectPermissions({
    canView: false,
    canUpload: false,
    canDownload: false,
    canDeleteDocuments: false,
    canManageStructure: false,
  });

export const FULL_PROJECT_PERMISSIONS: ProjectPermissionFlags = {
  canView: true,
  canUpload: true,
  canDownload: true,
  canDeleteDocuments: true,
  canManageStructure: true,
};

export function resolveProjectPermissions(
  user: AccessUser,
  membership: ProjectPermissionFlags | null,
): ProjectPermissionFlags {
  if (canManagePlatform(user)) return FULL_PROJECT_PERMISSIONS;
  if (!membership) return EMPTY_PROJECT_PERMISSIONS;
  return normalizeProjectPermissions({
    canView: membership.canView,
    canUpload: membership.canUpload,
    canDownload: membership.canDownload,
    canDeleteDocuments: membership.canDeleteDocuments,
    canManageStructure: membership.canManageStructure,
  });
}

/** Creating projects under a Territoire is ADMIN-only. */
export function resolveCanCreateProject(user: AccessUser): boolean {
  return canManagePlatform(user);
}
