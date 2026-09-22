/** Shared client helpers for Users live UI (no server secrets). */

export type DossierFlags = {
  canView: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canManageStructure: boolean;
};

export type UsersTableRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN" | "USER";
  status: "INVITED" | "ACTIVE" | "DISABLED";
  accessLabels: string[];
  projectAccess: Record<string, DossierFlags>;
  territoireAccess: Record<string, { canCreateDossier: boolean }>;
};

export function shortDossierLabel(name: string): string {
  const trimmed = name.trim();
  const beforeDash = trimmed.split(/\s+[—–-]\s+/)[0]?.trim();
  if (beforeDash && beforeDash.length < trimmed.length) return beforeDash;
  if (/^murailles/i.test(trimmed)) return "Murailles";
  return trimmed;
}

export function accessLabelsFromMap(
  role: "ADMIN" | "USER",
  projectAccess: Record<string, DossierFlags>,
  dossierNames: Map<string, string> | Record<string, string>,
): string[] {
  if (role === "ADMIN") return [];
  const getName = (id: string) =>
    dossierNames instanceof Map
      ? dossierNames.get(id) || id
      : dossierNames[id] || id;
  return Object.entries(projectAccess)
    .filter(([, flags]) => flags.canView)
    .map(([id]) => shortDossierLabel(getName(id)));
}
