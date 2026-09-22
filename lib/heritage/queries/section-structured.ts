import "server-only";

import { db } from "@/lib/db";
import type { HeritageSection } from "@/lib/heritage/config/structure";

export type SequenceListItem = {
  id: string;
  code: string;
  name: string;
  type: string;
  tranche: string | null;
  etatGeneral: string | null;
  niveauRisque: string | null;
};

export type ObservationListItem = {
  id: string;
  code: string | null;
  description: string;
  statut: string;
  date: string;
};

export type InvestigationListItem = {
  id: string;
  titre: string;
  bet: string | null;
  statut: string;
};

export type DecisionListItem = {
  id: string;
  type: string;
  description: string | null;
  dateDecision: string | null;
};

export type InterventionListItem = {
  id: string;
  entreprise: string | null;
  description: string | null;
  dateDebut: string | null;
};

export type SectionStructuredData = {
  sequences: SequenceListItem[];
  observations: ObservationListItem[];
  investigations: InvestigationListItem[];
  decisions: DecisionListItem[];
  interventions: InterventionListItem[];
};

const EMPTY: SectionStructuredData = {
  sequences: [],
  observations: [],
  investigations: [],
  decisions: [],
  interventions: [],
};

export async function getSectionStructuredData(
  projectSlug: string,
  section: HeritageSection,
): Promise<SectionStructuredData> {
  const project = await db.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true },
  });
  if (!project) return EMPTY;

  const needsSequences =
    section.tracks.includes("sequences") ||
    section.tracks.includes("tours") ||
    section.tracks.includes("portes") ||
    section.tracks.includes("bab-el-kasbah");

  const needsLinked =
    section.tracks.includes("observations") ||
    section.tracks.includes("investigations") ||
    section.tracks.includes("decisions") ||
    section.tracks.includes("interventions");

  if (!needsSequences && !needsLinked) return EMPTY;

  const result: SectionStructuredData = {
    sequences: [],
    observations: [],
    investigations: [],
    decisions: [],
    interventions: [],
  };

  if (needsSequences) {
    let where;
    if (section.tracks.includes("sequences")) {
      where = { projectId: project.id, type: "SEQUENCE" as const };
    } else if (section.tracks.includes("tours")) {
      where = { projectId: project.id, type: "TOUR" as const };
    } else if (section.tracks.includes("portes")) {
      where = { projectId: project.id, type: "PORTE" as const };
    } else {
      where = {
        projectId: project.id,
        OR: [
          { code: "MUR-BEK" },
          { name: { contains: "Bab El Kasbah", mode: "insensitive" as const } },
        ],
      };
    }

    const rows = await db.sequence.findMany({
      where,
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        tranche: true,
        etatGeneral: true,
        niveauRisque: true,
      },
    });

    result.sequences = rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      tranche: row.tranche,
      etatGeneral: row.etatGeneral,
      niveauRisque: row.niveauRisque,
    }));
  }

  if (needsLinked) {
    const sequenceIds = (
      await db.sequence.findMany({
        where: { projectId: project.id },
        select: { id: true },
      })
    ).map((row) => row.id);

    if (sequenceIds.length === 0) return result;

    if (section.tracks.includes("observations")) {
      const rows = await db.observation.findMany({
        where: { sequenceId: { in: sequenceIds } },
        orderBy: { date: "desc" },
        select: {
          id: true,
          code: true,
          description: true,
          statut: true,
          date: true,
        },
      });
      result.observations = rows.map((row) => ({
        id: row.id,
        code: row.code,
        description: row.description,
        statut: row.statut,
        date: row.date.toISOString(),
      }));
    }

    if (section.tracks.includes("investigations")) {
      const rows = await db.investigation.findMany({
        where: { sequenceId: { in: sequenceIds } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          titre: true,
          bet: true,
          statut: true,
        },
      });
      result.investigations = rows.map((row) => ({
        id: row.id,
        titre: row.titre,
        bet: row.bet,
        statut: row.statut,
      }));
    }

    if (section.tracks.includes("decisions")) {
      const rows = await db.decision.findMany({
        where: { sequenceId: { in: sequenceIds } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          description: true,
          dateDecision: true,
        },
      });
      result.decisions = rows.map((row) => ({
        id: row.id,
        type: row.type,
        description: row.description,
        dateDecision: row.dateDecision?.toISOString() ?? null,
      }));
    }

    if (section.tracks.includes("interventions")) {
      const rows = await db.intervention.findMany({
        where: { sequenceId: { in: sequenceIds } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          entreprise: true,
          description: true,
          dateDebut: true,
        },
      });
      result.interventions = rows.map((row) => ({
        id: row.id,
        entreprise: row.entreprise,
        description: row.description,
        dateDebut: row.dateDebut?.toISOString() ?? null,
      }));
    }
  }

  return result;
}
