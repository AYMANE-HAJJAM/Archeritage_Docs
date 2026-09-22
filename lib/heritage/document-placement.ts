/**
 * Logical SAFI PATRIMOINE document placement (metadata only).
 * Orthogonal to Folder / storageKey / B2 / Cloudinary.
 *
 * Active groups: heritage rubrique | project-level document.
 */
import type { DocumentScopeValue } from "@/lib/heritage/types/document-scope";

export type { DocumentScopeValue };

export type PlacementInfo = {
  scope: DocumentScopeValue | null;
  category: string | null;
  label: string;
  group: "heritage" | "project";
};

export function resolvePlacement(
  documentScope: DocumentScopeValue | null | undefined,
  docCategorie: string | null | undefined,
  heritageLabel?: string | null,
): PlacementInfo {
  const category = docCategorie ?? null;
  const scope = documentScope ?? null;

  if (scope === "PROJECT_SECTION" && category) {
    return {
      scope,
      category,
      label: heritageLabel || `Rubrique ${category}`,
      group: "heritage",
    };
  }

  // Legacy: heritage code without scope yet
  if (!scope && category && /^\d{2}\.\d+$/.test(category)) {
    return {
      scope: "PROJECT_SECTION",
      category,
      label: heritageLabel || `Rubrique ${category}`,
      group: "heritage",
    };
  }

  return {
    scope: null,
    category: null,
    label: "Document projet",
    group: "project",
  };
}
