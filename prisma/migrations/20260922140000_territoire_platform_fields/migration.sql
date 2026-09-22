-- Top-level platform fields on Territoire (admin « Projets » hierarchy).
ALTER TABLE "Territoire" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Territoire" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Backfill existing SAF row
UPDATE "Territoire"
SET
  "name" = CASE WHEN "code" = 'SAF' THEN 'Safi Patrimoine' ELSE "name" END,
  "slug" = CASE
    WHEN "code" = 'SAF' THEN 'safi-patrimoine'
    WHEN "slug" IS NULL OR "slug" = '' THEN lower(replace("code", ' ', '-'))
    ELSE "slug"
  END
WHERE "slug" IS NULL OR "slug" = '' OR ("code" = 'SAF' AND "name" = 'Safi');

-- Ensure every row has a slug before unique constraint
UPDATE "Territoire"
SET "slug" = lower("code") || '-' || substr("id", 1, 6)
WHERE "slug" IS NULL OR "slug" = '';

ALTER TABLE "Territoire" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Territoire_slug_key" ON "Territoire"("slug");
