/**
 * Pure permission evaluation (no DB) — unit-testable.
 *
 * Business permissions exposed in USER access UI:
 * - canView (Voir)
 * - canUpload (Importer)
 * - canDownload (Télécharger)
 * - canDeleteDocuments (Supprimer des documents)
 * - canManageStructure (Gérer la structure)
 *
 * Dossier creation under a plateforme is ADMIN-only.
 * TerritoireMember.canCreateDossier remains in the schema unused for USERS
 * (future compatibility) and is ignored by authorization.
 *
 * Legacy flags kept for compatibility / future workflows:
 * - canEditDossier, canReclassifyDocuments
 */
import type { AccessUser } from "@/lib/access/roles";
import { canManagePlatform } from "@/lib/access/roles";

export type ProjectPermissionFlags = {
  canView: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canDeleteDocuments: boolean;
  canEditDossier: boolean;
  canManageStructure: boolean;
  canReclassifyDocuments: boolean;
};

/** Normalize flags so view is required for upload/download/delete/structure. */
export function normalizeProjectPermissions(
  flags: ProjectPermissionFlags,
): ProjectPermissionFlags {
  if (!flags.canView) {
    return {
      canView: false,
      canUpload: false,
      canDownload: false,
      canDeleteDocuments: false,
      canEditDossier: false,
      canManageStructure: false,
      canReclassifyDocuments: false,
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
    canEditDossier: false,
    canManageStructure: false,
    canReclassifyDocuments: false,
  });

export const FULL_PROJECT_PERMISSIONS: ProjectPermissionFlags = {
  canView: true,
  canUpload: true,
  canDownload: true,
  canDeleteDocuments: true,
  canEditDossier: true,
  canManageStructure: true,
  canReclassifyDocuments: true,
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
    canEditDossier: membership.canEditDossier,
    canManageStructure: membership.canManageStructure,
    canReclassifyDocuments: membership.canReclassifyDocuments,
  });
}

/**
 * Creating heritage dossiers is ADMIN-only.
 * Membership `canCreateDossier` is ignored (schema field retained unused).
 */
export function resolveCanCreateDossier(
  user: AccessUser,
  territoireMembership?: { canCreateDossier: boolean } | null,
): boolean {
  void territoireMembership;
  return canManagePlatform(user);
}
