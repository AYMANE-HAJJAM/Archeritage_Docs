/**
 * Logical heritage classification via File.docCategorie = section code.
 * Metadata only — never moves folders or storage objects.
 *
 * Confidence:
 * - CERTAIN → safe to apply automatically
 * - REVIEW REQUIRED → leave unclassified
 *
 * Section codes must match lib/heritage/config/structure.ts.
 */
import { validateProjectSectionCategoryAgainstDefaults } from "@/lib/heritage/config/validate-category";

export type ClassificationConfidence = "CERTAIN" | "REVIEW REQUIRED";

export type ClassificationRow = {
  projectSlug: string;
  displayName: string;
  currentFolder: string;
  proposedSection: string | null;
  proposedLabel: string | null;
  confidence: ClassificationConfidence;
  reason: string;
};

export const CLASSIFICATION_PLAN: ClassificationRow[] = [
  // ─── Murailles — CERTAIN ───────────────────────────────────────────────
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "Atlas des pathologies.docx",
    currentFolder: "03 — Diagnostic et analyses",
    proposedSection: "02.12",
    proposedLabel: "Pathologies",
    confidence: "CERTAIN",
    reason: "Explicit pathology atlas",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "Analyse comparative et recommandations.docx",
    currentFolder: "03 — Diagnostic et analyses",
    proposedSection: "02.13",
    proposedLabel: "Causes & risques",
    confidence: "CERTAIN",
    reason: "Comparative analysis and recommendations",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "Plan — Bab El Kasbah.pdf",
    currentFolder: "02 — Plans et relevés",
    proposedSection: "02.9",
    proposedLabel: "Bab El Kasbah",
    confidence: "CERTAIN",
    reason: "Named Bab El Kasbah plan",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "Muraille portugaise — Tranche III.pdf",
    currentFolder: "02 — Plans et relevés",
    proposedSection: "02.5",
    proposedLabel: "Relevés",
    confidence: "CERTAIN",
    reason: "Plan/relevé tranche in plans folder",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "Muraille portugaise — Tranche IV.pdf",
    currentFolder: "02 — Plans et relevés",
    proposedSection: "02.5",
    proposedLabel: "Relevés",
    confidence: "CERTAIN",
    reason: "Plan/relevé tranche in plans folder",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "Muraille portugaise — Tranche V.pdf",
    currentFolder: "02 — Plans et relevés",
    proposedSection: "02.5",
    proposedLabel: "Relevés",
    confidence: "CERTAIN",
    reason: "Plan/relevé tranche in plans folder",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "Muraille portugaise — Tranche VI.pdf",
    currentFolder: "02 — Plans et relevés",
    proposedSection: "02.5",
    proposedLabel: "Relevés",
    confidence: "CERTAIN",
    reason: "Plan/relevé tranche in plans folder",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "Muraille portugaise — Tranche IX.pdf",
    currentFolder: "02 — Plans et relevés",
    proposedSection: "02.5",
    proposedLabel: "Relevés",
    confidence: "CERTAIN",
    reason: "Plan/relevé tranche in plans folder",
  },

  // ─── Château — CERTAIN ─────────────────────────────────────────────────
  {
    projectSlug: "chateau-de-mer-safi",
    displayName: "Bulletin officiel n° 560 — 17 juillet 1923.pdf",
    currentFolder: "03 — Documentation et archives",
    proposedSection: "01.3",
    proposedLabel: "Protection juridique",
    confidence: "CERTAIN",
    reason: "Official legal classification bulletin",
  },
  {
    projectSlug: "chateau-de-mer-safi",
    displayName: "Bulletin officiel n° 596 — 25 mars 1924.pdf",
    currentFolder: "03 — Documentation et archives",
    proposedSection: "01.3",
    proposedLabel: "Protection juridique",
    confidence: "CERTAIN",
    reason: "Official legal classification bulletin",
  },
  {
    projectSlug: "chateau-de-mer-safi",
    displayName:
      "Dossier juridique — Château de Mer — Textes de classement 1922–1924.docx",
    currentFolder: "03 — Documentation et archives",
    proposedSection: "01.3",
    proposedLabel: "Protection juridique",
    confidence: "CERTAIN",
    reason: "Explicit legal classification dossier",
  },
  {
    projectSlug: "chateau-de-mer-safi",
    displayName:
      "Répertoire des dahirs de classement du patrimoine marocain — 1912–1956.pdf",
    currentFolder: "03 — Documentation et archives",
    proposedSection: "01.3",
    proposedLabel: "Protection juridique",
    confidence: "CERTAIN",
    reason: "Legal dahir repertoire for heritage protection",
  },
  {
    projectSlug: "chateau-de-mer-safi",
    displayName: "Rapport provisoire d’expertise — Ksar El Bahr — Safi.pdf",
    currentFolder: "02 — Études et expertise",
    proposedSection: "01.8",
    proposedLabel: "Diagnostic",
    confidence: "CERTAIN",
    reason: "Provisional expertise report = diagnostic",
  },

  // ─── REVIEW REQUIRED — do not auto-classify ────────────────────────────
  {
    projectSlug: "chateau-de-mer-safi",
    displayName: "Château de Mer — Documentation historique.docx",
    currentFolder: "03 — Documentation et archives",
    proposedSection: null,
    proposedLabel: "01.2 ou 01.4",
    confidence: "REVIEW REQUIRED",
    reason: "Historical documentation could be Histoire or Atlas",
  },
  {
    projectSlug: "chateau-de-mer-safi",
    displayName: "Le Château de mer de Safi en péril — Article.docx",
    currentFolder: "03 — Documentation et archives",
    proposedSection: null,
    proposedLabel: "01.1 / 01.2",
    confidence: "REVIEW REQUIRED",
    reason: "Press article — présentation vs histoire unclear",
  },
  {
    projectSlug: "chateau-de-mer-safi",
    displayName: "Le Château de mer de Safi en péril — Article 2.docx",
    currentFolder: "03 — Documentation et archives",
    proposedSection: null,
    proposedLabel: "01.1 / 01.2",
    confidence: "REVIEW REQUIRED",
    reason: "Press article — présentation vs histoire unclear",
  },
  {
    projectSlug: "chateau-de-mer-safi",
    displayName: "lecture 1.docx",
    currentFolder: "03 — Documentation et archives",
    proposedSection: null,
    proposedLabel: null,
    confidence: "REVIEW REQUIRED",
    reason: "Generic filename, content unknown",
  },
  {
    projectSlug: "chateau-de-mer-safi",
    displayName: "Documentation portuaire — Safi.pdf",
    currentFolder: "03 — Documentation et archives",
    proposedSection: null,
    proposedLabel: "01.1 / 01.10 / territoire",
    confidence: "REVIEW REQUIRED",
    reason: "Port context spans château and territory",
  },
  {
    projectSlug: "chateau-de-mer-safi",
    displayName: "Pack de consultation — Château de Mer — Safi.docx",
    currentFolder: "01 — Consultation",
    proposedSection: null,
    proposedLabel: null,
    confidence: "REVIEW REQUIRED",
    reason: "Consultation pack — not a heritage section",
  },
  {
    projectSlug: "chateau-de-mer-safi",
    displayName: "Étapes de préparation de la consultation.docx",
    currentFolder: "01 — Consultation",
    proposedSection: null,
    proposedLabel: null,
    confidence: "REVIEW REQUIRED",
    reason: "Consultation workflow document",
  },
  {
    projectSlug: "chateau-de-mer-safi",
    displayName: "Lettre d’intention — Équipe.docx",
    currentFolder: "01 — Consultation",
    proposedSection: null,
    proposedLabel: null,
    confidence: "REVIEW REQUIRED",
    reason: "Consultation workflow document",
  },
  {
    projectSlug: "chateau-de-mer-safi",
    displayName: "Modèle CV — Mission Château de Mer.docx",
    currentFolder: "01 — Consultation",
    proposedSection: null,
    proposedLabel: null,
    confidence: "REVIEW REQUIRED",
    reason: "Consultation workflow document",
  },
  {
    projectSlug: "chateau-de-mer-safi",
    displayName: "Mémoire technique.docx",
    currentFolder: "01 — Consultation",
    proposedSection: null,
    proposedLabel: null,
    confidence: "REVIEW REQUIRED",
    reason: "Could be diagnostic or project — needs review",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "Synthèse des données des plans.docx",
    currentFolder: "03 — Diagnostic et analyses",
    proposedSection: null,
    proposedLabel: "02.5 / 02.12",
    confidence: "REVIEW REQUIRED",
    reason: "Plan synthesis sitting in diagnostic folder",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "Synthèse des données des plans — Variante.docx",
    currentFolder: "03 — Diagnostic et analyses",
    proposedSection: null,
    proposedLabel: "02.5 / 02.12",
    confidence: "REVIEW REQUIRED",
    reason: "Plan synthesis sitting in diagnostic folder",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "CPS — Étude des murailles portugaises de Safi.docx",
    currentFolder: "01 — Consultation",
    proposedSection: null,
    proposedLabel: "02.15 ?",
    confidence: "REVIEW REQUIRED",
    reason: "CPS may belong to conservation project later",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "CPS — Version 2.docx",
    currentFolder: "04 — Documents de travail",
    proposedSection: null,
    proposedLabel: "02.15 ?",
    confidence: "REVIEW REQUIRED",
    reason: "Working CPS draft — versioning/section unclear",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "CPS — Version 4 révisée.docx",
    currentFolder: "04 — Documents de travail",
    proposedSection: null,
    proposedLabel: "02.15 ?",
    confidence: "REVIEW REQUIRED",
    reason: "Working CPS draft — versioning/section unclear",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "CPS — Version 5.docx",
    currentFolder: "04 — Documents de travail",
    proposedSection: null,
    proposedLabel: "02.15 ?",
    confidence: "REVIEW REQUIRED",
    reason: "Working CPS draft — versioning/section unclear",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "CPS — Version 6 — PERP.docx",
    currentFolder: "04 — Documents de travail",
    proposedSection: null,
    proposedLabel: "02.15 ?",
    confidence: "REVIEW REQUIRED",
    reason: "Working CPS draft — versioning/section unclear",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "Règlement de consultation.docx",
    currentFolder: "01 — Consultation",
    proposedSection: null,
    proposedLabel: null,
    confidence: "REVIEW REQUIRED",
    reason: "Consultation procedure document",
  },
  {
    projectSlug: "murailles-portugaises-de-safi",
    displayName: "Trois pièces complémentaires.docx",
    currentFolder: "01 — Consultation",
    proposedSection: null,
    proposedLabel: null,
    confidence: "REVIEW REQUIRED",
    reason: "Consultation procedure document",
  },
];

export function certainClassifications() {
  return CLASSIFICATION_PLAN.filter(
    (row) => row.confidence === "CERTAIN" && row.proposedSection,
  );
}

/**
 * Ensures CERTAIN rows point at official section codes from structure.ts.
 * Call from tests / ops scripts — does not mutate data.
 */
export function assertCertainClassificationsMatchStructure(): void {
  for (const row of certainClassifications()) {
    const result = validateProjectSectionCategoryAgainstDefaults(
      row.projectSlug,
      row.proposedSection!,
    );
    if (!result.ok) {
      throw new Error(
        `${row.displayName}: ${result.reason} (${row.proposedSection})`,
      );
    }
    if (row.proposedLabel && row.proposedLabel !== result.label) {
      throw new Error(
        `${row.displayName}: label drift — plan says "${row.proposedLabel}", structure says "${result.label}"`,
      );
    }
  }
}

