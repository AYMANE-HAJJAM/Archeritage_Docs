-- A nullable source hash makes controlled local imports idempotent while leaving
-- normal uploads and existing records unaffected.
ALTER TABLE "File" ADD COLUMN "sourceHash" TEXT;
CREATE UNIQUE INDEX "File_sourceHash_key" ON "File"("sourceHash");
