import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migration enforces folder integrity and metadata-only moves", async () => {
  const database = new PGlite();
  try {
    await database.exec(await readFile("prisma/migrations/20260915000000_init/migration.sql", "utf8"));
    await database.exec(`
      INSERT INTO "User" (id,name,email,"passwordHash","updatedAt") VALUES ('u','Test','test@example.invalid','hash',NOW());
      INSERT INTO "Project" (id,name,slug,"updatedAt") VALUES ('p','Test','test',NOW()), ('other','Other','other',NOW());
      INSERT INTO "Folder" (id,name,"projectId","updatedAt") VALUES ('a','A','p',NOW()),('b','B','p',NOW()),('c','C','other',NOW());
      INSERT INTO "File" (id,"originalName","displayName",extension,"mimeType",size,"storageProvider","storageKey","projectId","folderId","uploadedById","updatedAt")
      VALUES ('f','test.pdf','test.pdf','pdf','application/pdf',10,'BACKBLAZE_B2','immutable-key','p','a','u',NOW());
    `);
    await assert.rejects(database.exec(`DELETE FROM "Folder" WHERE id='a'`), /foreign key/i);
    await assert.rejects(database.exec(`UPDATE "File" SET "folderId"='c' WHERE id='f'`), /foreign key/i);
    await assert.rejects(database.exec(`UPDATE "Folder" SET "parentId"='c' WHERE id='b'`), /foreign key/i);
    await database.exec(`UPDATE "File" SET "folderId"='b',"displayName"='Renamed' WHERE id='f'`);
    const moved = await database.query<{ storageKey: string; folderId: string; displayName: string }>(`SELECT "storageKey","folderId","displayName" FROM "File" WHERE id='f'`);
    assert.deepEqual(moved.rows[0], { storageKey: "immutable-key", folderId: "b", displayName: "Renamed" });
    await database.exec(`UPDATE "Folder" SET "parentId"='a' WHERE id='b'`);
    await assert.rejects(database.exec(`DELETE FROM "Folder" WHERE id='a'`), /foreign key/i);
    await database.exec(`DELETE FROM "File" WHERE id='f'; DELETE FROM "Folder" WHERE id='b'; DELETE FROM "Folder" WHERE id='a';`);
    const remaining = await database.query<{ count: number }>(`SELECT count(*)::int AS count FROM "Folder" WHERE "projectId"='p'`);
    assert.equal(remaining.rows[0].count, 0);
  } finally { await database.close(); }
});
