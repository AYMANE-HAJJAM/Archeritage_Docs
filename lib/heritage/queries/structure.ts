import "server-only";

import {
  unstable_cache,
  revalidateTag,
} from "next/cache";
import { db } from "@/lib/db";
import {
  type HeritageFamily,
  type HeritageSection,
  type HeritageSectionKind,
  type HeritageStructure,
  type SectionContentTrack,
  CHATEAU_SLUG,
  MURAILLES_SLUG,
  findHeritageSection,
  allHeritageSections,
} from "@/lib/heritage/config/structure";

export { findHeritageSection, allHeritageSections };

function parseTracks(raw: unknown): SectionContentTrack[] {
  if (!Array.isArray(raw)) return ["documents", "photos"];
  return raw.filter((t): t is SectionContentTrack => typeof t === "string") as SectionContentTrack[];
}

function parseKind(raw: string): HeritageSectionKind {
  if (raw === "structured" || raw === "sequences" || raw === "documentary") {
    return raw;
  }
  return "documentary";
}

type DbSectionRow = {
  code: string;
  slug: string;
  title: string;
  kind: string;
  tracks: unknown;
  sortOrder: number;
  isActive: boolean;
  group: { id: string; label: string; sortOrder: number } | null;
};

function rowsToStructure(
  project: { slug: string; name: string; description: string | null; code: string | null },
  rows: DbSectionRow[],
  activeOnly: boolean,
): HeritageStructure {
  const filtered = activeOnly ? rows.filter((r) => r.isActive) : rows;
  const groupMap = new Map<
    string,
    { title: string; sortOrder: number; sections: HeritageSection[] }
  >();
  const ungrouped: HeritageSection[] = [];

  for (const row of filtered) {
    const section: HeritageSection = {
      code: row.code,
      slug: row.slug,
      name: row.title,
      kind: parseKind(row.kind),
      tracks: parseTracks(row.tracks),
    };
    if (row.group) {
      const key = row.group.id;
      const existing = groupMap.get(key);
      if (existing) existing.sections.push(section);
      else {
        groupMap.set(key, {
          title: row.group.label,
          sortOrder: row.group.sortOrder,
          sections: [section],
        });
      }
    } else {
      ungrouped.push(section);
    }
  }

  const families: HeritageFamily[] = [...groupMap.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => ({ title: g.title, sections: g.sections }));

  if (ungrouped.length) {
    families.push({ title: "Autres", sections: ungrouped });
  }

  const dossierCode =
    project.code === "CDM" || project.slug === CHATEAU_SLUG
      ? "01"
      : project.code === "MUR" || project.slug === MURAILLES_SLUG
        ? "02"
        : (() => {
            const fromCodes = rows
              .map((r) => r.code.match(/^(\d+)\./)?.[1])
              .filter((p): p is string => Boolean(p));
            if (fromCodes.length) return fromCodes[0];
            return "00";
          })();

  return {
    dossierCode,
    title: project.name,
    description: project.description || "",
    projectSlug: project.slug,
    families,
  };
}

async function loadStructureFromDb(
  projectSlug: string,
  activeOnly: boolean,
): Promise<HeritageStructure | null> {
  const project = await db.project.findUnique({
    where: { slug: projectSlug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      code: true,
      isActive: true,
    },
  });
  if (!project) return null;
  if (activeOnly && !project.isActive) return null;

  const rows = await db.heritageSection.findMany({
    where: { projectId: project.id },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: {
      code: true,
      slug: true,
      title: true,
      kind: true,
      tracks: true,
      sortOrder: true,
      isActive: true,
      group: { select: { id: true, label: true, sortOrder: true } },
    },
  });

  if (!rows.length) return null;
  return rowsToStructure(project, rows, activeOnly);
}

/** Runtime SoT for user-facing heritage UI — active sections only. */
export async function getHeritageStructure(
  projectSlug: string,
): Promise<HeritageStructure | null> {
  return loadStructureFromDb(projectSlug, true);
}

/** Admin view — includes inactive sections. */
export async function getHeritageStructureAdmin(
  projectSlug: string,
): Promise<HeritageStructure | null> {
  return loadStructureFromDb(projectSlug, false);
}

export async function getCachedHeritageStructure(projectSlug: string) {
  const cached = unstable_cache(
    () => getHeritageStructure(projectSlug),
    [`heritage-structure:${projectSlug}`],
    { tags: [`heritage-structure:${projectSlug}`], revalidate: 60 },
  );
  return cached();
}

export function revalidateHeritageStructure(projectSlug: string) {
  revalidateTag(`heritage-structure:${projectSlug}`, "max");
}

/** Validate that a section code is an active heritage rubrique for the project. */
export async function assertActiveHeritageSection(
  projectId: string,
  code: string,
): Promise<{ id: string; code: string; title: string }> {
  const section = await db.heritageSection.findFirst({
    where: { projectId, code, isActive: true },
    select: { id: true, code: true, title: true },
  });
  if (!section) {
    const { HttpError } = await import("@/lib/http");
    throw new HttpError(400, "Rubrique patrimoniale invalide ou inactive.");
  }
  return section;
}

export async function listActiveSectionCodes(projectSlug: string): Promise<string[]> {
  const structure = await getHeritageStructure(projectSlug);
  if (!structure) return [];
  return allHeritageSections(structure).map((s) => s.code);
}

export async function sectionHasLinkedContent(
  projectId: string,
  code: string,
): Promise<{ hasDocuments: boolean; hasStructured: boolean; total: number }> {
  const documents = await db.file.count({
    where: { projectId, documentScope: "PROJECT_SECTION", docCategorie: code },
  });
  return {
    hasDocuments: documents > 0,
    hasStructured: false,
    total: documents,
  };
}
