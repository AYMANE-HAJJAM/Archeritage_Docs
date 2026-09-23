import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("documentary folder migration adds heritageSectionId and nullable File.folderId", async () => {
  const database = new PGlite();
  try {
    await database.exec(
      await readFile("prisma/migrations/20260915000000_init/migration.sql", "utf8"),
    );
    await database.exec(
      await readFile(
        "prisma/migrations/20260916120000_add_territoire_and_heritage_models/migration.sql",
        "utf8",
      ),
    );
    await database.exec(
      await readFile(
        "prisma/migrations/20260918150000_add_document_scope/migration.sql",
        "utf8",
      ),
    );
    await database.exec(
      await readFile(
        "prisma/migrations/20260922120000_admin_and_heritage_structure/migration.sql",
        "utf8",
      ),
    );
    await database.exec(
      await readFile(
        "prisma/migrations/20260923140000_documentary_folders/migration.sql",
        "utf8",
      ),
    );

    await database.exec(`
      INSERT INTO "User" (id,name,email,"passwordHash","updatedAt")
      VALUES ('u','Test','test@example.invalid','hash',NOW());
      INSERT INTO "Project" (id,name,slug,"updatedAt")
      VALUES ('p','Test','test',NOW());
      INSERT INTO "HeritageSection" (id,"projectId",code,slug,title,"sortOrder","updatedAt")
      VALUES ('sec','p','02.1','presentation','Présentation',1,NOW());
      INSERT INTO "Folder" (id,name,"projectId","parentId","heritageSectionId","updatedAt")
      VALUES
        ('f1','Présentations & plaquettes','p',NULL,'sec',NOW()),
        ('f2','Gouverneur','p','f1','sec',NOW()),
        ('f3','Tranche IX','p','f2','sec',NOW()),
        ('f4','2026','p','f3','sec',NOW()),
        ('legacy','01 — Consultation','p',NULL,NULL,NOW());
      INSERT INTO "File" (id,"originalName","displayName",extension,"mimeType",size,"storageProvider","storageKey","projectId","folderId","uploadedById","docCategorie","documentScope","updatedAt")
      VALUES
        ('doc1','plaquette.pptx','plaquette.pptx','pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation',10,'BACKBLAZE_B2','k1','p','f4','u','02.1','PROJECT_SECTION',NOW()),
        ('doc2','root.pdf','root.pdf','pdf','application/pdf',5,'BACKBLAZE_B2','k2','p',NULL,'u','02.1','PROJECT_SECTION',NOW());
    `);

    const nested = await database.query<{ folderId: string; docCategorie: string }>(
      `SELECT "folderId","docCategorie" FROM "File" WHERE id='doc1'`,
    );
    assert.equal(nested.rows[0].folderId, "f4");
    assert.equal(nested.rows[0].docCategorie, "02.1");

    const root = await database.query<{ folderId: string | null }>(
      `SELECT "folderId" FROM "File" WHERE id='doc2'`,
    );
    assert.equal(root.rows[0].folderId, null);

    await assert.rejects(
      database.exec(`DELETE FROM "Folder" WHERE id='f1'`),
      /foreign key|restrict/i,
    );

    // Empty leaf can be deleted after removing its file.
    await database.exec(`DELETE FROM "File" WHERE id='doc1'`);
    await database.exec(`DELETE FROM "Folder" WHERE id='f4'`);
    const remaining = await database.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM "Folder" WHERE "heritageSectionId"='sec'`,
    );
    assert.equal(remaining.rows[0].count, 3);

    // Legacy folder remains unmarked.
    const legacy = await database.query<{ heritageSectionId: string | null }>(
      `SELECT "heritageSectionId" FROM "Folder" WHERE id='legacy'`,
    );
    assert.equal(legacy.rows[0].heritageSectionId, null);
  } finally {
    await database.close();
  }
});
