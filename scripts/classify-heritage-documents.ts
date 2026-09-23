/**
 * Apply CERTAIN heritage classifications to File.docCategorie.
 * Metadata-only: never moves folders, storageKey, or sourceHash.
 *
 * Usage:
 *   npx tsx scripts/classify-heritage-documents.ts          # dry-run
 *   npx tsx scripts/classify-heritage-documents.ts --execute
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { certainClassifications } from "../lib/heritage/classification";

const execute = process.argv.includes("--execute");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const plan = certainClassifications();
  console.log(
    execute
      ? `Applying ${plan.length} CERTAIN classifications…`
      : `Dry-run: ${plan.length} CERTAIN classifications (pass --execute to apply)`,
  );
  console.log("");

  let applied = 0;
  let skipped = 0;
  let missing = 0;

  for (const row of plan) {
    const file = await db.file.findFirst({
      where: {
        displayName: row.displayName,
        project: { slug: row.projectSlug },
      },
      select: {
        id: true,
        displayName: true,
        docCategorie: true,
        storageKey: true,
        sourceHash: true,
        folder: { select: { name: true } },
      },
    });

    if (!file) {
      missing += 1;
      console.log(`MISSING\t${row.projectSlug}\t${row.displayName}`);
      continue;
    }

    if (file.docCategorie === row.proposedSection) {
      skipped += 1;
      console.log(
        `SKIP\t${file.displayName}\talready ${file.docCategorie}\t(storage unchanged)`,
      );
      continue;
    }

    if (file.docCategorie && file.docCategorie !== row.proposedSection) {
      skipped += 1;
      console.log(
        `SKIP\t${file.displayName}\thas ${file.docCategorie}, not overwriting → ${row.proposedSection}`,
      );
      continue;
    }

    console.log(
      `${execute ? "SET" : "WOULD SET"}\t${file.displayName}\t${file.folder?.name ?? "(racine)"}\t→\t${row.proposedSection} (${row.proposedLabel})`,
    );

    if (execute) {
      await db.file.update({
        where: { id: file.id },
        data: { docCategorie: row.proposedSection },
      });
      applied += 1;
    }
  }

  console.log("");
  console.log(
    JSON.stringify(
      {
        mode: execute ? "execute" : "dry-run",
        certain: plan.length,
        applied,
        skipped,
        missing,
        note: "storageKey/sourceHash/folderId untouched",
      },
      null,
      2,
    ),
  );
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
