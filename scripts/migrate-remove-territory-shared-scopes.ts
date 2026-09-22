/**
 * One-shot: migrate TERRITORY / SHARED_RESOURCE metadata after removing
 * 00 Territoire & Vision and 03 Centre de ressources from the product.
 *
 * Metadata only — never touches storageKey, folderId, sourceHash, ids, or blobs.
 *
 *   npx tsx scripts/migrate-remove-territory-shared-scopes.ts
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

type Migration =
  | {
      displayName: string;
      projectSlug: string;
      documentScope: "PROJECT_SECTION";
      docCategorie: string;
      confidentialite?: "PROJET" | "CONFIDENTIEL";
    }
  | {
      displayName: string;
      projectSlug: string;
      documentScope: null;
      docCategorie: null;
      confidentialite?: "PROJET" | "CONFIDENTIEL";
    };

/** Territory → Château 01.10 (littoral / falaise / port context). */
const FROM_TERRITORY: Migration[] = [
  {
    displayName: "Documentation portuaire — Safi.pdf",
    projectSlug: "chateau-de-mer-safi",
    documentScope: "PROJECT_SECTION",
    docCategorie: "01.10",
  },
];

/** CPS family → Murailles 02.15 Projet de conservation. */
const FROM_SHARED_CPS: Migration[] = [
  {
    displayName: "CPS — Étude des murailles portugaises de Safi.docx",
    projectSlug: "murailles-portugaises-de-safi",
    documentScope: "PROJECT_SECTION",
    docCategorie: "02.15",
  },
  {
    displayName: "CPS — Version 2.docx",
    projectSlug: "murailles-portugaises-de-safi",
    documentScope: "PROJECT_SECTION",
    docCategorie: "02.15",
  },
  {
    displayName: "CPS — Version 4 révisée.docx",
    projectSlug: "murailles-portugaises-de-safi",
    documentScope: "PROJECT_SECTION",
    docCategorie: "02.15",
  },
  {
    displayName: "CPS — Version 5.docx",
    projectSlug: "murailles-portugaises-de-safi",
    documentScope: "PROJECT_SECTION",
    docCategorie: "02.15",
  },
  {
    displayName: "CPS — Version 6 — PERP.docx",
    projectSlug: "murailles-portugaises-de-safi",
    documentScope: "PROJECT_SECTION",
    docCategorie: "02.15",
  },
  {
    displayName: "Analyse comparative et recommandations.docx",
    projectSlug: "murailles-portugaises-de-safi",
    documentScope: "PROJECT_SECTION",
    docCategorie: "02.13",
  },
];

/** Consultation / admin → project-level (no heritage section). */
const FROM_SHARED_CONSULTATION: Migration[] = [
  {
    displayName: "Pack de consultation — Château de Mer — Safi.docx",
    projectSlug: "chateau-de-mer-safi",
    documentScope: null,
    docCategorie: null,
  },
  {
    displayName: "Étapes de préparation de la consultation.docx",
    projectSlug: "chateau-de-mer-safi",
    documentScope: null,
    docCategorie: null,
    confidentialite: "CONFIDENTIEL",
  },
  {
    displayName: "Lettre d’intention — Équipe.docx",
    projectSlug: "chateau-de-mer-safi",
    documentScope: null,
    docCategorie: null,
    confidentialite: "CONFIDENTIEL",
  },
  {
    displayName: "Modèle CV — Mission Château de Mer.docx",
    projectSlug: "chateau-de-mer-safi",
    documentScope: null,
    docCategorie: null,
    confidentialite: "CONFIDENTIEL",
  },
  {
    displayName: "Règlement de consultation.docx",
    projectSlug: "murailles-portugaises-de-safi",
    documentScope: null,
    docCategorie: null,
  },
  {
    displayName: "Trois pièces complémentaires.docx",
    projectSlug: "murailles-portugaises-de-safi",
    documentScope: null,
    docCategorie: null,
  },
];

const ALL = [
  ...FROM_TERRITORY,
  ...FROM_SHARED_CPS,
  ...FROM_SHARED_CONSULTATION,
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const report: string[] = [];

  for (const target of ALL) {
    const file = await db.file.findFirst({
      where: {
        displayName: target.displayName,
        project: { slug: target.projectSlug },
      },
      select: {
        id: true,
        displayName: true,
        documentScope: true,
        docCategorie: true,
        confidentialite: true,
        storageKey: true,
        sourceHash: true,
        folderId: true,
      },
    });

    if (!file) {
      throw new Error(`MISSING: ${target.displayName} (${target.projectSlug})`);
    }

    const before = `${file.documentScope ?? "null"}:${file.docCategorie ?? "null"}:${file.confidentialite}`;
    const updated = await db.file.update({
      where: { id: file.id },
      data: {
        documentScope: target.documentScope,
        docCategorie: target.docCategorie,
        ...(target.confidentialite
          ? { confidentialite: target.confidentialite }
          : {}),
      },
      select: {
        id: true,
        displayName: true,
        documentScope: true,
        docCategorie: true,
        confidentialite: true,
        storageKey: true,
        sourceHash: true,
        folderId: true,
      },
    });

    if (
      updated.storageKey !== file.storageKey ||
      updated.sourceHash !== file.sourceHash ||
      updated.folderId !== file.folderId
    ) {
      throw new Error(`STORAGE TOUCHED unexpectedly for ${file.displayName}`);
    }

    const after = `${updated.documentScope ?? "null"}:${updated.docCategorie ?? "null"}:${updated.confidentialite}`;
    report.push(`${updated.displayName}\n  ${before} → ${after}`);
  }

  const leftovers = await db.file.findMany({
    where: {
      OR: [
        { documentScope: "TERRITORY" },
        { documentScope: "SHARED_RESOURCE" },
      ],
    },
    select: { displayName: true, documentScope: true, docCategorie: true },
  });

  console.log(report.join("\n"));
  console.log("");
  console.log(`Migrated: ${ALL.length}`);
  console.log(`Remaining TERRITORY/SHARED_RESOURCE: ${leftovers.length}`);
  if (leftovers.length) {
    console.log(leftovers);
    throw new Error("Leftover TERRITORY/SHARED_RESOURCE rows remain");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
