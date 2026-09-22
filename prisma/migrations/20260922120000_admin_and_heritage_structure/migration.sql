-- Administration + DB-driven heritage structure (additive, no data loss).

-- Account lifecycle
CREATE TYPE "AccountStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "firstName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "lastName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

-- Existing users keep passwordHash; new invites may have null until activation.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Backfill display name parts when empty (best-effort from name).
UPDATE "User"
SET
  "firstName" = CASE
    WHEN "firstName" = '' AND position(' ' in trim("name")) > 0
      THEN split_part(trim("name"), ' ', 1)
    WHEN "firstName" = '' THEN trim("name")
    ELSE "firstName"
  END,
  "lastName" = CASE
    WHEN "lastName" = '' AND position(' ' in trim("name")) > 0
      THEN trim(substring(trim("name") from position(' ' in trim("name")) + 1))
    ELSE "lastName"
  END
WHERE "firstName" = '' OR "lastName" = '';

-- Project archive flag
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Invitation tokens (hash only)
CREATE TABLE IF NOT EXISTS "InvitationToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvitationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvitationToken_tokenHash_key" ON "InvitationToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "InvitationToken_userId_idx" ON "InvitationToken"("userId");
CREATE INDEX IF NOT EXISTS "InvitationToken_expiresAt_idx" ON "InvitationToken"("expiresAt");

ALTER TABLE "InvitationToken"
  DROP CONSTRAINT IF EXISTS "InvitationToken_userId_fkey";
ALTER TABLE "InvitationToken"
  ADD CONSTRAINT "InvitationToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Audit log
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

ALTER TABLE "AuditLog"
  DROP CONSTRAINT IF EXISTS "AuditLog_actorUserId_fkey";
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Heritage section groups
CREATE TABLE IF NOT EXISTS "HeritageSectionGroup" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HeritageSectionGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HeritageSectionGroup_projectId_sortOrder_idx"
  ON "HeritageSectionGroup"("projectId", "sortOrder");

ALTER TABLE "HeritageSectionGroup"
  DROP CONSTRAINT IF EXISTS "HeritageSectionGroup_projectId_fkey";
ALTER TABLE "HeritageSectionGroup"
  ADD CONSTRAINT "HeritageSectionGroup_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Heritage sections (logical IA — not Folder)
CREATE TABLE IF NOT EXISTS "HeritageSection" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "groupId" TEXT,
  "code" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'documentary',
  "tracks" JSONB NOT NULL DEFAULT '[]',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HeritageSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HeritageSection_projectId_code_key"
  ON "HeritageSection"("projectId", "code");
CREATE INDEX IF NOT EXISTS "HeritageSection_projectId_sortOrder_idx"
  ON "HeritageSection"("projectId", "sortOrder");
CREATE INDEX IF NOT EXISTS "HeritageSection_groupId_idx" ON "HeritageSection"("groupId");
CREATE INDEX IF NOT EXISTS "HeritageSection_projectId_isActive_idx"
  ON "HeritageSection"("projectId", "isActive");

ALTER TABLE "HeritageSection"
  DROP CONSTRAINT IF EXISTS "HeritageSection_projectId_fkey";
ALTER TABLE "HeritageSection"
  ADD CONSTRAINT "HeritageSection_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HeritageSection"
  DROP CONSTRAINT IF EXISTS "HeritageSection_groupId_fkey";
ALTER TABLE "HeritageSection"
  ADD CONSTRAINT "HeritageSection_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "HeritageSectionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
