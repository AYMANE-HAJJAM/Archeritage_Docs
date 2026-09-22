-- Fine-grained USER permissions on ProjectMember + TerritoireMember.
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "canView" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "canUpload" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "canEditDossier" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "canManageStructure" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "canReclassifyDocuments" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Make role optional-safe with default for legacy rows
ALTER TABLE "ProjectMember" ALTER COLUMN "role" SET DEFAULT 'CONSULTANT';

CREATE TABLE IF NOT EXISTS "TerritoireMember" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "territoireId" TEXT NOT NULL,
  "canCreateDossier" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TerritoireMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TerritoireMember_userId_territoireId_key"
  ON "TerritoireMember"("userId", "territoireId");
CREATE INDEX IF NOT EXISTS "TerritoireMember_territoireId_idx" ON "TerritoireMember"("territoireId");
CREATE INDEX IF NOT EXISTS "TerritoireMember_userId_idx" ON "TerritoireMember"("userId");

DO $$ BEGIN
  ALTER TABLE "TerritoireMember"
    ADD CONSTRAINT "TerritoireMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TerritoireMember"
    ADD CONSTRAINT "TerritoireMember_territoireId_fkey"
    FOREIGN KEY ("territoireId") REFERENCES "Territoire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Compatibility: existing ProjectMember rows for ACTIVE USERs keep view+upload
-- (new columns default to false — avoid locking out prior open access).
UPDATE "ProjectMember" pm
SET
  "canView" = true,
  "canUpload" = true,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "User" u
WHERE pm."userId" = u."id"
  AND u."role" = 'USER'
  AND u."status" = 'ACTIVE'
  AND pm."canView" = false
  AND pm."canUpload" = false
  AND pm."canManageStructure" = false
  AND pm."canEditDossier" = false
  AND pm."canReclassifyDocuments" = false;

-- Compatibility backfill: ACTIVE USER × active Project without membership → view+upload.
INSERT INTO "ProjectMember" (
  "id", "userId", "projectId", "role",
  "canView", "canUpload", "canEditDossier", "canManageStructure", "canReclassifyDocuments",
  "createdAt", "updatedAt"
)
SELECT
  'pm_bf_' || substr(md5(u."id" || p."id"), 1, 20),
  u."id",
  p."id",
  'CONSULTANT',
  true,
  true,
  false,
  false,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN "Project" p
WHERE u."role" = 'USER'
  AND u."status" = 'ACTIVE'
  AND p."isActive" = true
  AND NOT EXISTS (
    SELECT 1 FROM "ProjectMember" pm
    WHERE pm."userId" = u."id" AND pm."projectId" = p."id"
  );
