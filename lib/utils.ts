import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}
export function normalizeSearchText(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr-FR").replace(/[^\p{Letter}\p{Number}]+/gu, " ").trim().replace(/\s+/g, " ");
}
export type FolderRef = { id: string; name: string; parentId: string | null };
export function folderTrail(id: string | null, folders: FolderRef[]) {
  const map = new Map(folders.map((f) => [f.id, f]));
  const trail: FolderRef[] = [];
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const folder = map.get(id);
    if (!folder) break;
    trail.push(folder); id = folder.parentId;
  }
  return trail.reverse();
}

export const OFFICE_EXTENSIONS = new Set([
  "docx",
  "doc",
  "xlsx",
  "xls",
  "pptx",
  "ppt",
  "odt",
  "ods",
  "odp",
  "rtf",
]);

export function isOfficeDocument(extension: string): boolean {
  return OFFICE_EXTENSIONS.has(extension.toLowerCase().replace(/^\./, "").trim());
}
