-- AlterEnum
CREATE TYPE "DocumentScope" AS ENUM ('PROJECT_SECTION', 'TERRITORY', 'SHARED_RESOURCE');

-- AlterTable
ALTER TABLE "File" ADD COLUMN "documentScope" "DocumentScope";

-- CreateIndex
CREATE INDEX "File_documentScope_docCategorie_idx" ON "File"("documentScope", "docCategorie");

-- CreateIndex
CREATE INDEX "File_projectId_documentScope_idx" ON "File"("projectId", "documentScope");
