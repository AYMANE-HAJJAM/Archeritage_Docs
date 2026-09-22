import type { HeritageStructure } from "@/lib/heritage/config/structure";
import type { ProjectHeritageSummary } from "@/lib/heritage/queries/section-summaries";

export type StatusFilter = "all" | "documented" | "empty";
export type DocumentsFilter = "all" | "with" | "without";

/** Table filters only — project-wide search is handled separately. */
export type StructureFilterState = {
  status: StatusFilter;
  documents: DocumentsFilter;
  group: string; // "" = all, otherwise family title
};

export const DEFAULT_STRUCTURE_FILTERS: StructureFilterState = {
  status: "all",
  documents: "all",
  group: "",
};

export function hasActiveStructureFilters(state: StructureFilterState): boolean {
  return (
    state.status !== "all" ||
    state.documents !== "all" ||
    Boolean(state.group)
  );
}

export type FilteredFamily = {
  title: string;
  sections: HeritageStructure["families"][number]["sections"];
};

export function filterHeritageStructure(
  structure: HeritageStructure,
  summary: ProjectHeritageSummary,
  filters: StructureFilterState,
): { families: FilteredFamily[]; matchCount: number; totalCount: number } {
  const totalCount = structure.families.reduce(
    (n, f) => n + f.sections.length,
    0,
  );
  let matchCount = 0;
  const families: FilteredFamily[] = [];

  for (const family of structure.families) {
    if (filters.group && family.title !== filters.group) continue;

    const sections = family.sections.filter((section) => {
      const row = summary.sections[section.code];
      const documented =
        row?.status === "Documentée" || Boolean(row?.hasContent);
      const fileCount = row?.fileCount ?? 0;

      if (filters.status === "documented" && !documented) return false;
      if (filters.status === "empty" && documented) return false;
      if (filters.documents === "with" && fileCount <= 0) return false;
      if (filters.documents === "without" && fileCount > 0) return false;

      return true;
    });

    if (sections.length) {
      matchCount += sections.length;
      families.push({ title: family.title, sections });
    }
  }

  return { families, matchCount, totalCount };
}

export function structureGroupOptions(structure: HeritageStructure): string[] {
  return structure.families.map((f) => f.title);
}
