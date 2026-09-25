-- Foundation rebuild: simplify business schema, drop CDC domain graph.
-- Preserves User, Session, LoginAttempt, InvitationToken, AuditLog.

-- ─── Drop CDC / legacy tables (FKs first) ───────────────────────────────────

DROP TABLE IF EXISTS "Preuve" CASCADE;
DROP TABLE IF EXISTS "Gate" CASCADE;
DROP TABLE IF EXISTS "Intervention" CASCADE;
DROP TABLE IF EXISTS "Decision" CASCADE;
DROP TABLE IF EXISTS "Investigation" CASCADE;
DROP TABLE IF EXISTS "Observation" CASCADE;
DROP TABLE IF EXISTS "Element" CASCADE;
DROP TABLE IF EXISTS "Sequence" CASCADE;
DROP TABLE IF EXISTS "Secteur" CASCADE;
DROP TABLE IF EXISTS "TerritoireMember" CASCADE;

-- Business content is empty — rebuild File/Folder/heritage tables cleanly.
DROP TABLE IF EXISTS "File" CASCADE;
DROP TABLE IF EXISTS "Folder" CASCADE;
DROP TABLE IF EXISTS "HeritageSection" CASCADE;
DROP TABLE IF EXISTS "HeritageSectionGroup" CASCADE;
DROP TABLE IF EXISTS "HeritagePart" CASCADE;
DROP TABLE IF EXISTS "ProjectMember" CASCADE;
DROP TABLE IF EXISTS "Project" CASCADE;
DROP TABLE IF EXISTS "Territoire" CASCADE;

-- ─── Drop unused enums ──────────────────────────────────────────────────────

DROP TYPE IF EXISTS "ProjectRole" CASCADE;
DROP TYPE IF EXISTS "SequenceType" CASCADE;
DROP TYPE IF EXISTS "EtatGeneral" CASCADE;
DROP TYPE IF EXISTS "NiveauRisque" CASCADE;
DROP TYPE IF EXISTS "EvidenceStatus" CASCADE;
DROP TYPE IF EXISTS "InvestigationStatus" CASCADE;
DROP TYPE IF EXISTS "DecisionType" CASCADE;
DROP TYPE IF EXISTS "GateNumber" CASCADE;
DROP TYPE IF EXISTS "GateStatus" CASCADE;
DROP TYPE IF EXISTS "ProjectType" CASCADE;
DROP TYPE IF EXISTS "DocumentStatus" CASCADE;
DROP TYPE IF EXISTS "DocumentScope" CASCADE;

-- Slim Confidentialite to PROJET | CONFIDENTIEL
DO $$ BEGIN
  CREATE TYPE "Confidentialite_new" AS ENUM ('PROJET', 'CONFIDENTIEL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP TYPE IF EXISTS "Confidentialite" CASCADE;
ALTER TYPE "Confidentialite_new" RENAME TO "Confidentialite";

-- ─── Recreate core business tables ──────────────────────────────────────────

CREATE TABLE "Territoire" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Territoire_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Territoire_code_key" ON "Territoire"("code");

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "territoireId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
CREATE INDEX "Project_territoireId_idx" ON "Project"("territoireId");
CREATE INDEX "Project_isActive_idx" ON "Project"("isActive");
ALTER TABLE "Project" ADD CONSTRAINT "Project_territoireId_fkey"
  FOREIGN KEY ("territoireId") REFERENCES "Territoire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canUpload" BOOLEAN NOT NULL DEFAULT false,
    "canDownload" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteDocuments" BOOLEAN NOT NULL DEFAULT false,
    "canManageStructure" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectMember_userId_projectId_key" ON "ProjectMember"("userId", "projectId");
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Part_projectId_slug_key" ON "Part"("projectId", "slug");
CREATE INDEX "Part_projectId_sortOrder_idx" ON "Part"("projectId", "sortOrder");
CREATE INDEX "Part_projectId_isActive_idx" ON "Part"("projectId", "isActive");
ALTER TABLE "Part" ADD CONSTRAINT "Part_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SectionGroup" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "partId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SectionGroup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SectionGroup_projectId_sortOrder_idx" ON "SectionGroup"("projectId", "sortOrder");
CREATE INDEX "SectionGroup_partId_idx" ON "SectionGroup"("partId");
ALTER TABLE "SectionGroup" ADD CONSTRAINT "SectionGroup_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectionGroup" ADD CONSTRAINT "SectionGroup_partId_fkey"
  FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Section_groupId_sortOrder_idx" ON "Section"("groupId", "sortOrder");
CREATE INDEX "Section_groupId_isActive_idx" ON "Section"("groupId", "isActive");
ALTER TABLE "Section" ADD CONSTRAINT "Section_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "SectionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Folder_id_sectionId_key" ON "Folder"("id", "sectionId");
CREATE INDEX "Folder_sectionId_parentId_idx" ON "Folder"("sectionId", "parentId");
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_sectionId_fkey"
  FOREIGN KEY ("parentId", "sectionId") REFERENCES "Folder"("id", "sectionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageProvider" "StorageProvider" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageVersion" TEXT,
    "sourceHash" TEXT,
    "sectionId" TEXT NOT NULL,
    "folderId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "confidentialite" "Confidentialite" NOT NULL DEFAULT 'PROJET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "File_storageKey_key" ON "File"("storageKey");
CREATE UNIQUE INDEX "File_sourceHash_key" ON "File"("sourceHash");
CREATE INDEX "File_sectionId_folderId_idx" ON "File"("sectionId", "folderId");
CREATE INDEX "File_folderId_idx" ON "File"("folderId");
CREATE INDEX "File_uploadedById_idx" ON "File"("uploadedById");
CREATE INDEX "File_sectionId_createdAt_idx" ON "File"("sectionId", "createdAt");
ALTER TABLE "File" ADD CONSTRAINT "File_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "File" ADD CONSTRAINT "File_folderId_sectionId_fkey"
  FOREIGN KEY ("folderId", "sectionId") REFERENCES "Folder"("id", "sectionId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "File" ADD CONSTRAINT "File_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Part must belong to same project as SectionGroup when partId is set
CREATE OR REPLACE FUNCTION check_section_group_part_project()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."partId" IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM "Part" p
      WHERE p.id = NEW."partId" AND p."projectId" = NEW."projectId"
    ) THEN
      RAISE EXCEPTION 'SectionGroup.partId must belong to the same project';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_section_group_part_project ON "SectionGroup";
CREATE TRIGGER trg_section_group_part_project
  BEFORE INSERT OR UPDATE ON "SectionGroup"
  FOR EACH ROW EXECUTE FUNCTION check_section_group_part_project();
