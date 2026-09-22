import "server-only";

import { db } from "@/lib/db";
import {
  allocateUnique,
  allocateUniqueCode,
  extractSectionPrefixes,
  generateNextSectionCode,
  generateSlug,
  proposeDossierCode,
  proposeProjectCode,
} from "@/lib/admin/identifiers";
import { CHATEAU_SLUG, MURAILLES_SLUG } from "@/lib/heritage/config/structure";

export async function allocateTerritoireSlug(name: string, preferred?: string | null) {
  const base = preferred?.trim() || generateSlug(name);
  return allocateUnique(base, async (candidate) => {
    const hit = await db.territoire.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    return Boolean(hit);
  });
}

export async function allocateTerritoireCode(name: string, preferred?: string | null) {
  const base = preferred?.trim().toUpperCase() || proposeProjectCode(name);
  return allocateUniqueCode(base, async (candidate) => {
    const hit = await db.territoire.findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    return Boolean(hit);
  });
}

export async function allocateProjectSlug(name: string, preferred?: string | null) {
  const base = preferred?.trim() || generateSlug(name);
  return allocateUnique(base, async (candidate) => {
    const hit = await db.project.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    return Boolean(hit);
  });
}

export async function allocateProjectCode(name: string, preferred?: string | null) {
  const base = preferred?.trim().toUpperCase() || proposeDossierCode(name);
  return allocateUniqueCode(base, async (candidate) => {
    const hit = await db.project.findFirst({
      where: { code: candidate },
      select: { id: true },
    });
    return Boolean(hit);
  });
}

export async function allocateSectionSlug(
  projectId: string,
  title: string,
  preferred?: string | null,
) {
  const base = preferred?.trim() || generateSlug(title);
  return allocateUnique(base, async (candidate) => {
    const hit = await db.heritageSection.findFirst({
      where: { projectId, slug: candidate },
      select: { id: true },
    });
    return Boolean(hit);
  });
}

/**
 * Resolve the section numbering prefix for a dossier (e.g. "01", "02", "03").
 * Never renumbers existing sections.
 */
export async function resolveDossierSectionPrefix(projectId: string): Promise<string> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      code: true,
      slug: true,
      territoireId: true,
      heritageSections: { select: { code: true } },
    },
  });
  if (!project) return "00";

  const ownPrefixes = extractSectionPrefixes(
    project.heritageSections.map((s) => s.code),
  );
  if (ownPrefixes.length === 1) return ownPrefixes[0];
  if (ownPrefixes.length > 1) {
    // Prefer the most frequent prefix
    const counts = new Map<string, number>();
    for (const s of project.heritageSections) {
      const p = extractSectionPrefixes([s.code])[0];
      if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  if (project.code === "CDM" || project.slug === CHATEAU_SLUG) return "01";
  if (project.code === "MUR" || project.slug === MURAILLES_SLUG) return "02";

  // Next free numeric prefix among siblings in the same territoire
  const siblingIds = project.territoireId
    ? (
        await db.project.findMany({
          where: { territoireId: project.territoireId },
          select: { id: true },
        })
      ).map((p) => p.id)
    : [project.id];

  const siblingSections = await db.heritageSection.findMany({
    where: { projectId: { in: siblingIds } },
    select: { code: true },
  });
  const used = new Set(
    extractSectionPrefixes(siblingSections.map((s) => s.code)).map(Number),
  );
  let n = 1;
  while (used.has(n) && n < 99) n += 1;
  return String(n).padStart(2, "0");
}

export async function allocateNextSectionCode(projectId: string): Promise<string> {
  const prefix = await resolveDossierSectionPrefix(projectId);
  const sections = await db.heritageSection.findMany({
    where: { projectId },
    select: { code: true },
  });
  return generateNextSectionCode(
    sections.map((s) => s.code),
    prefix,
  );
}
