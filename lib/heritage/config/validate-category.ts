/**
 * Pure + async category validation.
 *
 * Templates in structure.ts are bootstrap defaults only.
 * Runtime validation uses DB-backed active sections.
 */
import type { DocumentScopeValue } from "@/lib/heritage/types/document-scope";
import {
  findHeritageSection,
  getHeritageStructure as getDefaultStructure,
} from "@/lib/heritage/config/structure";
import {
  getHeritageStructure,
  listActiveSectionCodes,
} from "@/lib/heritage/queries/structure";

export type CategoryValidationResult =
  | { ok: true; label: string }
  | { ok: false; reason: string };

/** Sync helper for tests / classification fixtures against default templates. */
export function validateProjectSectionCategoryAgainstDefaults(
  projectSlug: string,
  category: string,
): CategoryValidationResult {
  const structure = getDefaultStructure(projectSlug);
  if (!structure) {
    return { ok: false, reason: "Projet patrimonial inconnu." };
  }
  const section = findHeritageSection(structure, category);
  if (!section) {
    return { ok: false, reason: "Rubrique patrimoniale invalide pour ce projet." };
  }
  return { ok: true, label: section.name };
}

export async function validateProjectSectionCategory(
  projectSlug: string,
  category: string,
): Promise<CategoryValidationResult> {
  const structure = await getHeritageStructure(projectSlug);
  if (!structure) {
    return { ok: false, reason: "Projet patrimonial inconnu ou inactif." };
  }
  const section = findHeritageSection(structure, category);
  if (!section) {
    return { ok: false, reason: "Rubrique patrimoniale invalide ou inactive pour ce projet." };
  }
  return { ok: true, label: section.name };
}

export async function validateDocumentCategory(
  scope: DocumentScopeValue,
  category: string,
  projectSlug?: string,
): Promise<CategoryValidationResult> {
  const trimmed = category.trim();
  if (!trimmed) {
    return { ok: false, reason: "Catégorie documentaire manquante." };
  }

  if (scope !== "PROJECT_SECTION") {
    return {
      ok: false,
      reason: "Seules les rubriques patrimoine (PROJECT_SECTION) sont acceptées.",
    };
  }
  if (!projectSlug) {
    return { ok: false, reason: "Projet manquant pour une rubrique projet." };
  }
  return validateProjectSectionCategory(projectSlug, trimmed);
}

/** Sync official codes from default templates (tests / bootstrap checks). */
export function officialSectionCodesFromDefaults(projectSlug: string): string[] {
  const structure = getDefaultStructure(projectSlug);
  if (!structure) return [];
  return structure.families.flatMap((family) =>
    family.sections.map((section) => section.code),
  );
}

/** Official active section codes for a heritage project (DB). */
export async function officialSectionCodes(projectSlug: string): Promise<string[]> {
  return listActiveSectionCodes(projectSlug);
}
