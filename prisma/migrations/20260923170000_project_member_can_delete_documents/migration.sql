-- Dedicated document deletion permission (independent from canManageStructure).
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "canDeleteDocuments" BOOLEAN NOT NULL DEFAULT false;
