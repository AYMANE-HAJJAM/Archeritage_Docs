import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import * as path from "node:path";
import type { File as StoredFile } from "@/generated/prisma/client";
import { convertOfficeToPdf } from "@/lib/documents/converter";
import { getCachedPreviewObject, putCachedPreviewObject, readRawObjectBytes } from "@/lib/storage";

export function computePreviewCacheKey(
  file: Pick<StoredFile, "id" | "sourceHash" | "storageKey" | "storageVersion" | "updatedAt">
): string {
  const versionPart = file.sourceHash || file.storageVersion || file.updatedAt.toISOString();
  return createHash("sha256")
    .update(`${file.id}_${file.storageKey}_${versionPart}`)
    .digest("hex");
}

const inFlightConversions = new Map<string, Promise<Buffer>>();

function getDiskCacheDir(): string {
  return path.join(process.cwd(), ".cache", "previews");
}

export async function getOrGeneratePreviewPdf(file: StoredFile): Promise<Buffer> {
  const cacheKey = computePreviewCacheKey(file);
  const diskCacheDir = getDiskCacheDir();
  const diskCachePath = path.join(diskCacheDir, `${cacheKey}.pdf`);
  const b2PreviewKey = `archeritage/previews/${cacheKey}.pdf`;

  // 1. Check local disk cache
  if (existsSync(diskCachePath)) {
    try {
      return await fs.readFile(diskCachePath);
    } catch {
      // If corrupted or unreadable, continue to fallback
    }
  }

  // Deduplicate concurrent conversions for the exact same preview
  const pending = inFlightConversions.get(cacheKey);
  if (pending) {
    return await pending;
  }

  const conversionPromise = (async (): Promise<Buffer> => {
    try {
      // 2. Check private B2 preview cache
      const b2CachedBytes = await getCachedPreviewObject(b2PreviewKey);
      if (b2CachedBytes && b2CachedBytes.length > 0) {
        // Save to local disk cache for fast subsequent hits
        await fs.mkdir(diskCacheDir, { recursive: true }).catch(() => {});
        await fs.writeFile(diskCachePath, b2CachedBytes).catch(() => {});
        return b2CachedBytes;
      }

      // 3. Read original bytes and perform conversion
      const originalBytes = await readRawObjectBytes(file);
      const generatedPdf = await convertOfficeToPdf(originalBytes, file.extension);

      // Save to local disk cache
      await fs.mkdir(diskCacheDir, { recursive: true }).catch(() => {});
      await fs.writeFile(diskCachePath, generatedPdf).catch(() => {});

      // Persist to private B2 cache
      void putCachedPreviewObject(b2PreviewKey, generatedPdf);

      return generatedPdf;
    } finally {
      inFlightConversions.delete(cacheKey);
    }
  })();

  inFlightConversions.set(cacheKey, conversionPromise);
  return await conversionPromise;
}
