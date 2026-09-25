-- Additive creator traceability for groups, sections, and folders.
-- Existing rows stay NULL: historical creators are not invented.

ALTER TABLE "SectionGroup" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Section" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Folder" ADD COLUMN "createdById" TEXT;

ALTER TABLE "SectionGroup"
  ADD CONSTRAINT "SectionGroup_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Section"
  ADD CONSTRAINT "Section_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Folder"
  ADD CONSTRAINT "Folder_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SectionGroup_createdById_idx" ON "SectionGroup"("createdById");
CREATE INDEX "Section_createdById_idx" ON "Section"("createdById");
CREATE INDEX "Folder_createdById_idx" ON "Folder"("createdById");
