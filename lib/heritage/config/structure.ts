/**
 * Default heritage IA templates for SAFI PATRIMOINE (bootstrap / seed only).
 *
 * Runtime source of truth is the database (HeritageSection + HeritageSectionGroup),
 * loaded via `lib/heritage/queries/structure.ts`. Do not drive user-facing UI from
 * these constants after seeding — admin edits would drift.
 *
 * Families are visual grouping only. `tracks` describe presentation content types.
 */

export type HeritageSectionKind =
  | "documentary"
  | "structured"
  | "sequences";

/** Content types a section may display — used for summaries and workspace queries. */
export type SectionContentTrack =
  | "documents"
  | "photos"
  | "sequences"
  | "tours"
  | "portes"
  | "bab-el-kasbah"
  | "observations"
  | "investigations"
  | "decisions"
  | "interventions";

export type HeritageSection = {
  code: string;
  slug: string;
  name: string;
  kind: HeritageSectionKind;
  tracks: SectionContentTrack[];
};

export type HeritageFamily = {
  title: string;
  sections: HeritageSection[];
};

export type HeritageStructure = {
  dossierCode: string;
  title: string;
  description: string;
  projectSlug: string;
  families: HeritageFamily[];
};

export const MURAILLES_SLUG = "murailles-portugaises-de-safi";
export const CHATEAU_SLUG = "chateau-de-mer-safi";

const DOC: SectionContentTrack[] = ["documents", "photos"];
/** Pathologies is the primary home for Observation records. */
const PATHOLOGIES: SectionContentTrack[] = ["documents", "photos", "observations"];
const INVESTIGATIONS: SectionContentTrack[] = ["documents", "photos", "investigations"];
const DECISIONS: SectionContentTrack[] = ["documents", "photos", "decisions"];
const INTERVENTIONS: SectionContentTrack[] = ["documents", "photos", "interventions"];

export const MURAILLES_STRUCTURE: HeritageStructure = {
  dossierCode: "02",
  title: "Murailles",
  description:
    "Documentation, diagnostic, conservation et suivi patrimonial des murailles.",
  projectSlug: MURAILLES_SLUG,
  families: [
    {
      title: "Comprendre",
      sections: [
        { code: "02.1", slug: "presentation", name: "Présentation", kind: "documentary", tracks: DOC },
        { code: "02.2", slug: "histoire-chronologie", name: "Histoire & chronologie", kind: "documentary", tracks: DOC },
        { code: "02.3", slug: "protection-juridique", name: "Protection juridique", kind: "documentary", tracks: DOC },
        { code: "02.4", slug: "plan-general", name: "Plan général", kind: "documentary", tracks: DOC },
      ],
    },
    {
      title: "Relever & localiser",
      sections: [
        { code: "02.5", slug: "releves", name: "Relevés", kind: "documentary", tracks: DOC },
        { code: "02.6", slug: "sequences", name: "Séquences", kind: "sequences", tracks: ["sequences", "documents", "photos"] },
        { code: "02.7", slug: "tours", name: "Tours", kind: "structured", tracks: ["tours", "documents", "photos"] },
        { code: "02.8", slug: "portes", name: "Portes", kind: "structured", tracks: ["portes", "documents", "photos"] },
        { code: "02.9", slug: "bab-el-kasbah", name: "Bab El Kasbah", kind: "structured", tracks: ["bab-el-kasbah", "documents", "photos"] },
      ],
    },
    {
      title: "Diagnostiquer",
      sections: [
        { code: "02.10", slug: "materiaux-systemes-constructifs", name: "Matériaux & systèmes constructifs", kind: "documentary", tracks: DOC },
        { code: "02.11", slug: "valeurs-patrimoniales", name: "Valeurs patrimoniales", kind: "documentary", tracks: DOC },
        { code: "02.12", slug: "pathologies", name: "Pathologies", kind: "structured", tracks: PATHOLOGIES },
        { code: "02.13", slug: "causes-risques", name: "Causes & risques", kind: "structured", tracks: DOC },
        { code: "02.14", slug: "investigations", name: "Investigations", kind: "structured", tracks: INVESTIGATIONS },
      ],
    },
    {
      title: "Conserver & intervenir",
      sections: [
        { code: "02.15", slug: "projet-conservation", name: "Projet de conservation", kind: "documentary", tracks: DOC },
        { code: "02.16", slug: "interventions", name: "Interventions", kind: "structured", tracks: INTERVENTIONS },
      ],
    },
    {
      title: "Chantier & suivi",
      sections: [
        { code: "02.17", slug: "travaux", name: "Travaux", kind: "structured", tracks: DOC },
        { code: "02.18", slug: "suivi", name: "Suivi", kind: "structured", tracks: DOC },
      ],
    },
    {
      title: "Mémoire & maintenance",
      sections: [
        { code: "02.19", slug: "doe-patrimonial", name: "DOE patrimonial", kind: "documentary", tracks: DOC },
        { code: "02.20", slug: "maintenance", name: "Maintenance", kind: "structured", tracks: DOC },
      ],
    },
  ],
};

export const CHATEAU_STRUCTURE: HeritageStructure = {
  dossierCode: "01",
  title: "Château de Mer",
  description:
    "Documentation patrimoniale, études, diagnostics et archives du Château de Mer.",
  projectSlug: CHATEAU_SLUG,
  families: [
    {
      title: "Comprendre",
      sections: [
        { code: "01.1", slug: "presentation", name: "Présentation", kind: "documentary", tracks: DOC },
        { code: "01.2", slug: "histoire-chronologie", name: "Histoire & chronologie", kind: "documentary", tracks: DOC },
        { code: "01.3", slug: "protection-juridique", name: "Protection juridique", kind: "documentary", tracks: DOC },
        { code: "01.4", slug: "atlas-historique-documentaire", name: "Atlas historique et documentaire", kind: "documentary", tracks: DOC },
      ],
    },
    {
      title: "Relever & caractériser",
      sections: [
        { code: "01.5", slug: "releves-etat-zero", name: "Relevés & état zéro", kind: "documentary", tracks: DOC },
        { code: "01.6", slug: "architecture-systemes-constructifs", name: "Architecture & systèmes constructifs", kind: "documentary", tracks: DOC },
        { code: "01.7", slug: "valeurs-patrimoniales", name: "Valeurs patrimoniales", kind: "documentary", tracks: DOC },
      ],
    },
    {
      title: "Diagnostiquer",
      sections: [
        { code: "01.8", slug: "diagnostic", name: "Diagnostic", kind: "structured", tracks: DOC },
        { code: "01.9", slug: "pathologies", name: "Pathologies", kind: "structured", tracks: PATHOLOGIES },
        { code: "01.10", slug: "falaise-ocean-fondations", name: "Falaise – océan – fondations", kind: "structured", tracks: DOC },
        { code: "01.11", slug: "investigations-laboratoire", name: "Investigations & laboratoire", kind: "structured", tracks: INVESTIGATIONS },
      ],
    },
    {
      title: "Conserver & décider",
      sections: [
        { code: "01.12", slug: "projet-conservation-restauration", name: "Projet de conservation-restauration", kind: "documentary", tracks: DOC },
        { code: "01.13", slug: "decisions-patrimoniales", name: "Décisions patrimoniales", kind: "structured", tracks: DECISIONS },
        { code: "01.14", slug: "plans-details", name: "Plans & détails", kind: "documentary", tracks: DOC },
      ],
    },
    {
      title: "Chantier & suivi",
      sections: [
        { code: "01.15", slug: "travaux", name: "Travaux", kind: "structured", tracks: DOC },
        { code: "01.16", slug: "suivi-photographique", name: "Suivi photographique", kind: "structured", tracks: DOC },
      ],
    },
    {
      title: "Mémoire & maintenance",
      sections: [
        { code: "01.17", slug: "doe-patrimonial", name: "DOE patrimonial", kind: "documentary", tracks: DOC },
        { code: "01.18", slug: "maintenance-surveillance", name: "Maintenance & surveillance", kind: "structured", tracks: DOC },
      ],
    },
  ],
};

/**
 * Safi landing projects — user-facing product is only Château + Murailles.
 * Internal section codes remain 01.x / 02.x.
 */
export const SAFI_PROJECTS = [
  {
    title: CHATEAU_STRUCTURE.title,
    description: CHATEAU_STRUCTURE.description,
    projectSlug: CHATEAU_SLUG,
  },
  {
    title: MURAILLES_STRUCTURE.title,
    description: MURAILLES_STRUCTURE.description,
    projectSlug: MURAILLES_SLUG,
  },
] as const;

/** Default template lookup — prefer `getHeritageStructure` from queries/structure.ts at runtime. */
export function getDefaultHeritageStructure(projectSlug: string): HeritageStructure | null {
  if (projectSlug === MURAILLES_SLUG) return MURAILLES_STRUCTURE;
  if (projectSlug === CHATEAU_SLUG) return CHATEAU_STRUCTURE;
  return null;
}

/** @deprecated Use DB-backed getHeritageStructure from queries/structure.ts */
export function getHeritageStructure(projectSlug: string): HeritageStructure | null {
  return getDefaultHeritageStructure(projectSlug);
}

export function findHeritageSection(
  structure: HeritageStructure,
  sectionKey: string,
): HeritageSection | null {
  const key = sectionKey.trim();
  if (!key) return null;

  for (const family of structure.families) {
    const byCode = family.sections.find((item) => item.code === key);
    if (byCode) return byCode;
  }

  for (const family of structure.families) {
    const bySlug = family.sections.find((item) => item.slug === key);
    if (bySlug) return bySlug;
  }

  return null;
}

export function allHeritageSections(structure: HeritageStructure): HeritageSection[] {
  return structure.families.flatMap((family) => family.sections);
}

export function isHeritageProject(slug: string): boolean {
  return slug === MURAILLES_SLUG || slug === CHATEAU_SLUG;
}

export function documentsPath(projectSlug: string): string {
  return `/projects/${projectSlug}/documents`;
}

/** Preferred same-page section URL using the official section code (e.g. 01.8). */
export function sectionQueryPath(projectSlug: string, sectionCode: string): string {
  return `/projects/${projectSlug}?section=${encodeURIComponent(sectionCode)}`;
}
