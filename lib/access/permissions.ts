/**
 * Pure permission evaluation (no DB) — unit-testable.
 *
 * Business permissions exposed in USER access UI:
 * - canView (Voir)
 * - canUpload (Importer)
 * - canDownload (Télécharger)
 * - canManageStructure (Gérer la structure)
 * - canCreateDossier on TerritoireMember (Créer des dossiers)
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
  canEditDossier: boolean;
  canManageStructure: boolean;
  canReclassifyDocuments: boolean;
};

/** Normalize flags so view is required for upload/download/structure. */
export function normalizeProjectPermissions(
  flags: ProjectPermissionFlags,
): ProjectPermissionFlags {
  if (!flags.canView) {
    return {
      canView: false,
      canUpload: false,
      canDownload: false,
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
    canEditDossier: false,
    canManageStructure: false,
    canReclassifyDocuments: false,
  });

export const FULL_PROJECT_PERMISSIONS: ProjectPermissionFlags = {
  canView: true,
  canUpload: true,
  canDownload: true,
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
    canEditDossier: membership.canEditDossier,
    canManageStructure: membership.canManageStructure,
    canReclassifyDocuments: membership.canReclassifyDocuments,
  });
}

export function resolveCanCreateDossier(
  user: AccessUser,
  territoireMembership: { canCreateDossier: boolean } | null,
): boolean {
  if (canManagePlatform(user)) return true;
  return Boolean(territoireMembership?.canCreateDossier);
}
