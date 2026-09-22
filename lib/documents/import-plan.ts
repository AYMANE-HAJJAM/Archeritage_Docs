export type ImportProject = "chateau-de-mer" | "muraille-portugaise";
export type ImportItem = {
  project: ImportProject;
  relativePath: string;
  folder: string | null;
  displayName: string;
  review?: string;
};

const chateau = (relativePath: string, folder: string | null, displayName: string, review?: string): ImportItem => ({ project: "chateau-de-mer", relativePath, folder, displayName, review });
const murailles = (relativePath: string, folder: string | null, displayName: string, review?: string): ImportItem => ({ project: "muraille-portugaise", relativePath, folder, displayName, review });

// Exact relative paths make classification deterministic. Unknown source files
// abort execution so a new document is never silently assigned by filename guess.
export const importPlan: ImportItem[] = [
  chateau("Pack_consultation_Chateau_de_Mer_Safi_V2_enrichi.docx", "01 — Consultation", "Pack de consultation — Château de Mer — Safi.docx"),
  chateau("rapport provisoire expertise kssar lebhar safi envoyé.pdf", "02 — Études et expertise", "Rapport provisoire d’expertise — Ksar El Bahr — Safi.pdf"),
  chateau("chateau de mer 2/les étapes a prtéparer pour la consultation.docx", "01 — Consultation", "Étapes de préparation de la consultation.docx"),
  chateau("chateau de mer 2/mlettre d'intention equipe.docx", "01 — Consultation", "Lettre d’intention — Équipe.docx"),
  chateau("chateau de mer 2/model CV mission chateau de mer.docx", "01 — Consultation", "Modèle CV — Mission Château de Mer.docx"),
  chateau("chateau de mer 2/Mémoire technique.docx", "01 — Consultation", "Mémoire technique.docx"),
  chateau("lecture chateau de mer/article.docx", "03 — Documentation et archives", "Le Château de mer de Safi en péril — Article.docx"),
  chateau("lecture chateau de mer/article2.docx", "03 — Documentation et archives", "Le Château de mer de Safi en péril — Article 2.docx"),
  chateau("lecture chateau de mer/chateau de mer.docx", "03 — Documentation et archives", "Château de Mer — Documentation historique.docx"),
  chateau("lecture chateau de mer/lecture 1.docx", "03 — Documentation et archives", "lecture 1.docx"),
  chateau("lecture chateau de mer/portuaire safi.pdf", "03 — Documentation et archives", "Documentation portuaire — Safi.pdf"),
  chateau("LES textes de classement/Dossier juridique — Château de Mer (textes de classement 1922-1924).docx", "03 — Documentation et archives", "Dossier juridique — Château de Mer — Textes de classement 1922–1924.docx"),
  chateau("LES textes de classement/ma-bulletin-officiel-dated-1923-07-17-no-560.pdf", "03 — Documentation et archives", "Bulletin officiel n° 560 — 17 juillet 1923.pdf"),
  chateau("LES textes de classement/ma-bulletin-officiel-dated-1924-03-25-no-596.pdf", "03 — Documentation et archives", "Bulletin officiel n° 596 — 25 mars 1924.pdf"),
  chateau("LES textes de classement/Répertoire des dahirs de classement du patrimoine marocain (1912-1956).pdf", "03 — Documentation et archives", "Répertoire des dahirs de classement du patrimoine marocain — 1912–1956.pdf"),

  murailles("Atlas des pathologies.docx", "03 — Diagnostic et analyses", "Atlas des pathologies.docx"),
  murailles("Docs récents/CPS etude.docx", "01 — Consultation", "CPS — Étude des murailles portugaises de Safi.docx"),
  murailles("Docs récents/CPS 2.docx", "04 — Documents de travail", "CPS — Version 2.docx"),
  murailles("Docs récents/les 3 pieces complémentaires.docx", "01 — Consultation", "Trois pièces complémentaires.docx"),
  murailles("Docs récents/RC.docx", "01 — Consultation", "Règlement de consultation.docx"),
  murailles("les plans et photos/ANALYSE_COMPARATIVE_ET_RECOMMANDATIONS.docx", "03 — Diagnostic et analyses", "Analyse comparative et recommandations.docx"),
  murailles("les plans et photos/CPS 6 PERP.docx", "04 — Documents de travail", "CPS — Version 6 — PERP.docx"),
  murailles("les plans et photos/CPS_4 SAFI_REVISÉ_COMPLET.docx", "04 — Documents de travail", "CPS — Version 4 révisée.docx"),
  murailles("les plans et photos/CPS_5 SAFI_FINAL_EXCELLENCE_INEGALEE MANUS.docx", "04 — Documents de travail", "CPS — Version 5.docx"),
  murailles("les plans et photos/Muraille portugaise tranche III-Objet.pdf", "02 — Plans et relevés", "Muraille portugaise — Tranche III.pdf"),
  murailles("les plans et photos/Muraille portugaise tranche IV-Objet.pdf", "02 — Plans et relevés", "Muraille portugaise — Tranche IV.pdf"),
  murailles("les plans et photos/Muraille portugaise tranche IX-Objet.pdf", "02 — Plans et relevés", "Muraille portugaise — Tranche IX.pdf"),
  murailles("les plans et photos/Muraille portugaise tranche VI-Objet.pdf", "02 — Plans et relevés", "Muraille portugaise — Tranche VI.pdf"),
  murailles("les plans et photos/Muraille portugaise tranche VI-Objet (1).pdf", "02 — Plans et relevés", "Muraille portugaise — Tranche VI — Copie.pdf"),
  murailles("les plans et photos/Muraille porturaise tranche V-Objet.pdf", "02 — Plans et relevés", "Muraille portugaise — Tranche V.pdf"),
  murailles("les plans et photos/Plan Bab EL Kasbah-Objet.pdf", "02 — Plans et relevés", "Plan — Bab El Kasbah.pdf"),
  murailles("les plans et photos/synthese_donnees_plans.docx", "03 — Diagnostic et analyses", "Synthèse des données des plans.docx"),
  murailles("les plans et photos/synthese_donnees_plans (1).docx", "03 — Diagnostic et analyses", "Synthèse des données des plans — Variante.docx"),
  murailles("muraille de safi Photos 1ere tranche/Muraille portugaise tranche IX-Objet.pdf", "02 — Plans et relevés", "Muraille portugaise — Tranche IX — Copie.pdf"),
  murailles("muraille de safi Photos 1ere tranche/Plan Bab EL Kasbah-Objet.pdf", "02 — Plans et relevés", "Plan — Bab El Kasbah — Copie.pdf"),
];

export const importProjects = {
  "chateau-de-mer": { slug: "chateau-de-mer-safi", label: "Château de Mer — Safi" },
  "muraille-portugaise": { slug: "murailles-portugaises-de-safi", label: "Murailles portugaises de Safi" },
} as const;
