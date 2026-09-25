-- Explicit Murailles (and future dossier) parts + optional scope on Folder/File.
CREATE TABLE "HeritagePart" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'PRIMARY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeritagePart_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HeritagePart_projectId_code_key" ON "HeritagePart"("projectId", "code");
CREATE UNIQUE INDEX "HeritagePart_projectId_slug_key" ON "HeritagePart"("projectId", "slug");
CREATE INDEX "HeritagePart_projectId_sortOrder_idx" ON "HeritagePart"("projectId", "sortOrder");
CREATE INDEX "HeritagePart_projectId_isActive_idx" ON "HeritagePart"("projectId", "isActive");

ALTER TABLE "HeritagePart" ADD CONSTRAINT "HeritagePart_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Folder" ADD COLUMN "heritagePartId" TEXT;
ALTER TABLE "File" ADD COLUMN "heritagePartId" TEXT;

CREATE INDEX "Folder_heritagePartId_idx" ON "Folder"("heritagePartId");
CREATE INDEX "Folder_projectId_heritagePartId_idx" ON "Folder"("projectId", "heritagePartId");
CREATE INDEX "File_heritagePartId_idx" ON "File"("heritagePartId");
CREATE INDEX "File_projectId_heritagePartId_idx" ON "File"("projectId", "heritagePartId");

ALTER TABLE "Folder" ADD CONSTRAINT "Folder_heritagePartId_fkey" FOREIGN KEY ("heritagePartId") REFERENCES "HeritagePart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "File" ADD CONSTRAINT "File_heritagePartId_fkey" FOREIGN KEY ("heritagePartId") REFERENCES "HeritagePart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
