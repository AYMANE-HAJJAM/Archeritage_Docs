/**
 * Pure helpers for deciding whether a heritage section may be hard-deleted.
 * Server loads counts; this module maps counts → human-readable blockers.
 */

const SEQUENCE_TRACKS = new Set([
  "sequences",
  "tours",
  "portes",
  "bab-el-kasbah",
]);

export type SectionLinkProfile = {
  code: string;
  kind: string;
  tracks: unknown;
};

export type SectionLinkCounts = {
  documentCount: number;
  sequenceCount: number;
  sequenceFileCount: number;
  elementCount: number;
  gateCount: number;
  observationCount: number;
  investigationCount: number;
  decisionCount: number;
  interventionCount: number;
};

export function parseSectionTracks(tracks: unknown): string[] {
  if (!Array.isArray(tracks)) return [];
  return tracks.filter((t): t is string => typeof t === "string");
}

export function sectionUsesSequences(section: SectionLinkProfile): boolean {
  if (section.kind === "sequences") return true;
  return parseSectionTracks(section.tracks).some((t) => SEQUENCE_TRACKS.has(t));
}

/**
 * Returns a French reason string when hard-delete must be refused, else null.
 */
export function describeSectionLinkedContent(
  section: SectionLinkProfile,
  counts: SectionLinkCounts,
): string | null {
  if (counts.documentCount > 0) {
    return `${counts.documentCount} document(s) classé(s) dans cette rubrique`;
  }

  const tracks = parseSectionTracks(section.tracks);
  const usesSequences = sectionUsesSequences(section);

  if (usesSequences && counts.sequenceCount > 0) {
    return "des séquences / ouvrages liés au projet";
  }

  if (usesSequences && counts.sequenceFileCount > 0) {
    return `${counts.sequenceFileCount} fichier(s) lié(s) aux séquences`;
  }

  if (usesSequences && counts.elementCount > 0) {
    return `${counts.elementCount} élément(s) patrimonial(aux)`;
  }

  if (usesSequences && counts.gateCount > 0) {
    return `${counts.gateCount} gate(s) de validation`;
  }

  if (tracks.includes("observations") && counts.observationCount > 0) {
    return `${counts.observationCount} observation(s)`;
  }
  if (tracks.includes("investigations") && counts.investigationCount > 0) {
    return `${counts.investigationCount} investigation(s)`;
  }
  if (tracks.includes("decisions") && counts.decisionCount > 0) {
    return `${counts.decisionCount} décision(s)`;
  }
  if (tracks.includes("interventions") && counts.interventionCount > 0) {
    return `${counts.interventionCount} intervention(s)`;
  }

  return null;
}

export function canHardDeleteSection(
  section: SectionLinkProfile,
  counts: SectionLinkCounts,
): boolean {
  return describeSectionLinkedContent(section, counts) === null;
}

export function canHardDeleteGroup(sectionCount: number): boolean {
  return sectionCount === 0;
}
