-- Additive: download permission separate from view/preview.
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "canDownload" BOOLEAN NOT NULL DEFAULT false;

-- Compatibility: users who already had canView keep download access
-- (preview + download were previously the same gate).
UPDATE "ProjectMember"
SET "canDownload" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "canView" = true
  AND "canDownload" = false;
