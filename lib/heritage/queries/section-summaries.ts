import "server-only";

import { db } from "@/lib/db";
import {
  allHeritageSections,
  type HeritageSection,
  type HeritageStructure,
  type SectionContentTrack,
} from "@/lib/heritage/config/structure";

export type SectionMetricKey =
  | "documents"
  | "photos"
  | "sequences"
  | "tours"
  | "portes"
  | "babElKasbah"
  | "observations"
  | "investigations"
  | "decisions"
  | "interventions";

export type SectionMetrics = Record<SectionMetricKey, number>;

export type SectionStatus = "Vide" | "Documentée";

export type SectionSummary = {
  code: string;
  metrics: SectionMetrics;
  hasContent: boolean;
  /** Compact content labels, e.g. "4 documents" or "12 séquences · 4 documents". */
  labels: string[];
  /** Associated files via docCategorie (documents + photos). */
  fileCount: number;
  /** Always 0 — no section-level Folder association in the data model. */
  subfolderCount: number;
  totalBytes: number;
  lastUpdatedAt: string | null;
  status: SectionStatus;
};

export type ProjectHeritageSummary = {
  sectionCount: number;
  totalFiles: number;
  documentedSections: number;
  sequenceCount: number;
  totalBytes: number;
  lastActivityAt: string | null;
  sections: Record<string, SectionSummary>;
};

type FileAgg = {
  documents: number;
  photos: number;
  totalBytes: number;
  lastUpdatedAt: Date | null;
};

type StructuredAgg = {
  count: number;
  lastUpdatedAt: Date | null;
};

const EMPTY_METRICS: SectionMetrics = {
  documents: 0,
  photos: 0,
  sequences: 0,
  tours: 0,
  portes: 0,
  babElKasbah: 0,
  observations: 0,
  investigations: 0,
  decisions: 0,
  interventions: 0,
};

function trackToMetric(track: SectionContentTrack): SectionMetricKey {
  switch (track) {
    case "bab-el-kasbah":
      return "babElKasbah";
    default:
      return track;
  }
}

function formatLabel(key: SectionMetricKey, count: number): string | null {
  if (count <= 0) return null;
  switch (key) {
    case "documents":
      return count === 1 ? "1 document" : `${count} documents`;
    case "photos":
      return count === 1 ? "1 photo" : `${count} photos`;
    case "sequences":
      return count === 1 ? "1 séquence" : `${count} séquences`;
    case "tours":
      return count === 1 ? "1 tour" : `${count} tours`;
    case "portes":
      return count === 1 ? "1 porte" : `${count} portes`;
    case "babElKasbah":
      return count === 1 ? "1 unité" : `${count} unités`;
    case "observations":
      return count === 1 ? "1 observation" : `${count} observations`;
    case "investigations":
      return count === 1 ? "1 investigation" : `${count} investigations`;
    case "decisions":
      return count === 1 ? "1 décision" : `${count} décisions`;
    case "interventions":
      return count === 1 ? "1 intervention" : `${count} interventions`;
  }
}

function maxDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function toIso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

async function structuredAgg(
  where: Record<string, unknown>,
): Promise<StructuredAgg> {
  const [count, latest] = await Promise.all([
    db.sequence.count({ where }),
    db.sequence.findFirst({
      where,
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);
  return {
    count,
    lastUpdatedAt: latest?.updatedAt ?? null,
  };
}

function buildSectionSummary(
  section: HeritageSection,
  projectStructured: {
    sequences: StructuredAgg;
    tours: StructuredAgg;
    portes: StructuredAgg;
    babElKasbah: StructuredAgg;
    observations: StructuredAgg;
    investigations: StructuredAgg;
    decisions: StructuredAgg;
    interventions: StructuredAgg;
  },
  fileBySection: Map<string, FileAgg>,
): SectionSummary {
  const files = fileBySection.get(section.code) ?? {
    documents: 0,
    photos: 0,
    totalBytes: 0,
    lastUpdatedAt: null,
  };

  const metrics: SectionMetrics = {
    ...EMPTY_METRICS,
    documents: files.documents,
    photos: files.photos,
    sequences: projectStructured.sequences.count,
    tours: projectStructured.tours.count,
    portes: projectStructured.portes.count,
    babElKasbah: projectStructured.babElKasbah.count,
    observations: projectStructured.observations.count,
    investigations: projectStructured.investigations.count,
    decisions: projectStructured.decisions.count,
    interventions: projectStructured.interventions.count,
  };

  const scoped: SectionMetrics = { ...EMPTY_METRICS };
  const labels: string[] = [];
  let lastUpdatedAt: Date | null = null;
  let hasContent = false;

  for (const track of section.tracks) {
    const key = trackToMetric(track);
    scoped[key] = metrics[key];
    const label = formatLabel(key, metrics[key]);
    if (label) {
      labels.push(label);
      hasContent = true;
    }

    if (track === "documents" || track === "photos") {
      lastUpdatedAt = maxDate(lastUpdatedAt, files.lastUpdatedAt);
    } else if (track === "sequences") {
      lastUpdatedAt = maxDate(lastUpdatedAt, projectStructured.sequences.lastUpdatedAt);
    } else if (track === "tours") {
      lastUpdatedAt = maxDate(lastUpdatedAt, projectStructured.tours.lastUpdatedAt);
    } else if (track === "portes") {
      lastUpdatedAt = maxDate(lastUpdatedAt, projectStructured.portes.lastUpdatedAt);
    } else if (track === "bab-el-kasbah") {
      lastUpdatedAt = maxDate(lastUpdatedAt, projectStructured.babElKasbah.lastUpdatedAt);
    } else if (track === "observations") {
      lastUpdatedAt = maxDate(lastUpdatedAt, projectStructured.observations.lastUpdatedAt);
    } else if (track === "investigations") {
      lastUpdatedAt = maxDate(lastUpdatedAt, projectStructured.investigations.lastUpdatedAt);
    } else if (track === "decisions") {
      lastUpdatedAt = maxDate(lastUpdatedAt, projectStructured.decisions.lastUpdatedAt);
    } else if (track === "interventions") {
      lastUpdatedAt = maxDate(lastUpdatedAt, projectStructured.interventions.lastUpdatedAt);
    }
  }

  // File size/date only when section tracks documents or photos.
  const tracksFiles =
    section.tracks.includes("documents") || section.tracks.includes("photos");
  const totalBytes = tracksFiles ? files.totalBytes : 0;
  const fileCount = tracksFiles ? files.documents + files.photos : 0;

  return {
    code: section.code,
    metrics: scoped,
    hasContent,
    labels,
    fileCount,
    subfolderCount: 0,
    totalBytes,
    lastUpdatedAt: toIso(lastUpdatedAt),
    status: hasContent ? "Documentée" : "Vide",
  };
}

/**
 * Real project + per-section summaries.
 * File association uses File.docCategorie only (never Folder guesses).
 */
export async function getProjectHeritageSummary(
  structure: HeritageStructure,
): Promise<ProjectHeritageSummary> {
  const project = await db.project.findUnique({
    where: { slug: structure.projectSlug },
    select: { id: true },
  });

  const sections = allHeritageSections(structure);
  const emptySections: Record<string, SectionSummary> = {};
  for (const section of sections) {
    emptySections[section.code] = {
      code: section.code,
      metrics: { ...EMPTY_METRICS },
      hasContent: false,
      labels: [],
      fileCount: 0,
      subfolderCount: 0,
      totalBytes: 0,
      lastUpdatedAt: null,
      status: "Vide",
    };
  }

  if (!project) {
    return {
      sectionCount: sections.length,
      totalFiles: 0,
      documentedSections: 0,
      sequenceCount: 0,
      totalBytes: 0,
      lastActivityAt: null,
      sections: emptySections,
    };
  }

  const sequenceIds = (
    await db.sequence.findMany({
      where: { projectId: project.id },
      select: { id: true },
    })
  ).map((row) => row.id);

  const [
    totalFiles,
    projectFileAgg,
    classifiedFiles,
    sequences,
    tours,
    portes,
    babElKasbah,
    observations,
    investigations,
    decisions,
    interventions,
  ] = await Promise.all([
    db.file.count({ where: { projectId: project.id } }),
    db.file.aggregate({
      where: { projectId: project.id },
      _sum: { size: true },
      _max: { updatedAt: true },
    }),
    db.file.findMany({
      where: {
        projectId: project.id,
        docCategorie: { not: null },
        OR: [{ documentScope: "PROJECT_SECTION" }, { documentScope: null }],
      },
      select: {
        docCategorie: true,
        storageProvider: true,
        size: true,
        updatedAt: true,
      },
    }),
    structuredAgg({ projectId: project.id, type: "SEQUENCE" }),
    structuredAgg({ projectId: project.id, type: "TOUR" }),
    structuredAgg({ projectId: project.id, type: "PORTE" }),
    structuredAgg({
      projectId: project.id,
      OR: [
        { code: "MUR-BEK" },
        { name: { contains: "Bab El Kasbah", mode: "insensitive" } },
      ],
    }),
    sequenceIds.length
      ? Promise.all([
          db.observation.count({ where: { sequenceId: { in: sequenceIds } } }),
          db.observation.findFirst({
            where: { sequenceId: { in: sequenceIds } },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]).then(([count, latest]) => ({
          count,
          lastUpdatedAt: latest?.updatedAt ?? null,
        }))
      : Promise.resolve({ count: 0, lastUpdatedAt: null }),
    sequenceIds.length
      ? Promise.all([
          db.investigation.count({ where: { sequenceId: { in: sequenceIds } } }),
          db.investigation.findFirst({
            where: { sequenceId: { in: sequenceIds } },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]).then(([count, latest]) => ({
          count,
          lastUpdatedAt: latest?.updatedAt ?? null,
        }))
      : Promise.resolve({ count: 0, lastUpdatedAt: null }),
    sequenceIds.length
      ? Promise.all([
          db.decision.count({ where: { sequenceId: { in: sequenceIds } } }),
          db.decision.findFirst({
            where: { sequenceId: { in: sequenceIds } },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]).then(([count, latest]) => ({
          count,
          lastUpdatedAt: latest?.updatedAt ?? null,
        }))
      : Promise.resolve({ count: 0, lastUpdatedAt: null }),
    sequenceIds.length
      ? Promise.all([
          db.intervention.count({ where: { sequenceId: { in: sequenceIds } } }),
          db.intervention.findFirst({
            where: { sequenceId: { in: sequenceIds } },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]).then(([count, latest]) => ({
          count,
          lastUpdatedAt: latest?.updatedAt ?? null,
        }))
      : Promise.resolve({ count: 0, lastUpdatedAt: null }),
  ]);

  const fileBySection = new Map<string, FileAgg>();
  for (const file of classifiedFiles) {
    if (!file.docCategorie) continue;
    const current = fileBySection.get(file.docCategorie) ?? {
      documents: 0,
      photos: 0,
      totalBytes: 0,
      lastUpdatedAt: null,
    };
    if (file.storageProvider === "CLOUDINARY") current.photos += 1;
    else current.documents += 1;
    current.totalBytes += file.size;
    current.lastUpdatedAt = maxDate(current.lastUpdatedAt, file.updatedAt);
    fileBySection.set(file.docCategorie, current);
  }

  const projectStructured = {
    sequences,
    tours,
    portes,
    babElKasbah,
    observations,
    investigations,
    decisions,
    interventions,
  };

  const sectionSummaries: Record<string, SectionSummary> = {};
  let documentedSections = 0;
  let lastActivityAt: Date | null = projectFileAgg._max.updatedAt ?? null;

  for (const section of sections) {
    const summary = buildSectionSummary(section, projectStructured, fileBySection);
    sectionSummaries[section.code] = summary;
    if (summary.hasContent) documentedSections += 1;
    if (summary.lastUpdatedAt) {
      lastActivityAt = maxDate(lastActivityAt, new Date(summary.lastUpdatedAt));
    }
  }

  return {
    sectionCount: sections.length,
    totalFiles,
    documentedSections,
    sequenceCount: sequences.count,
    totalBytes: projectFileAgg._sum.size ?? 0,
    lastActivityAt: toIso(lastActivityAt),
    sections: sectionSummaries,
  };
}
