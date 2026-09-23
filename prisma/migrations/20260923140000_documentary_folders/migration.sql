-- Documentary folders inside heritage sections (unlimited nesting via parentId).
-- Non-destructive: existing Folder / File rows unchanged; File.folderId becomes nullable.

ALTER TABLE "Folder" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Folder" ADD COLUMN IF NOT EXISTS "heritageSectionId" TEXT;

ALTER TABLE "File" ALTER COLUMN "folderId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "Folder_heritageSectionId_parentId_idx"
  ON "Folder"("heritageSectionId", "parentId");

CREATE INDEX IF NOT EXISTS "Folder_projectId_heritageSectionId_idx"
  ON "Folder"("projectId", "heritageSectionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Folder_heritageSectionId_fkey'
  ) THEN
    ALTER TABLE "Folder"
      ADD CONSTRAINT "Folder_heritageSectionId_fkey"
      FOREIGN KEY ("heritageSectionId") REFERENCES "HeritageSection"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
