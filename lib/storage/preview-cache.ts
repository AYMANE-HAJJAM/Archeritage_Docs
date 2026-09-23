import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import * as path from "node:path";
import type { File as StoredFile } from "@/generated/prisma/client";
import {
  convertOfficeToPdf,
  PreviewConversionError,
} from "@/lib/documents/converter";
import {
  getCachedPreviewObject,
  putCachedPreviewObject,
  readRawObjectBytes,
} from "@/lib/storage";

export function computePreviewCacheKey(
  file: Pick<
    StoredFile,
    "id" | "sourceHash" | "storageKey" | "storageVersion" | "updatedAt"
  >,
): string {
  const versionPart =
    file.sourceHash || file.storageVersion || file.updatedAt.toISOString();
  return createHash("sha256")
    .update(`${file.id}_${file.storageKey}_${versionPart}`)
    .digest("hex");
}

const inFlightConversions = new Map<string, Promise<Buffer>>();

function getDiskCacheDir(): string {
  return path.join(process.cwd(), ".cache", "previews");
}

function isValidPdfBuffer(bytes: Buffer): boolean {
  return bytes.length >= 5 && bytes.subarray(0, 5).toString("utf8") === "%PDF-";
}

/** Remove only the derived preview cache for one file (disk + best-effort ignore B2). */
export async function invalidatePreviewCacheForFile(
  file: Pick<
    StoredFile,
    "id" | "sourceHash" | "storageKey" | "storageVersion" | "updatedAt"
  >,
): Promise<{ cacheKey: string; diskRemoved: boolean }> {
  const cacheKey = computePreviewCacheKey(file);
  const diskCachePath = path.join(getDiskCacheDir(), `${cacheKey}.pdf`);
  let diskRemoved = false;
  if (existsSync(diskCachePath)) {
    await fs.unlink(diskCachePath);
    diskRemoved = true;
  }
  inFlightConversions.delete(cacheKey);
  return { cacheKey, diskRemoved };
}

export async function getOrGeneratePreviewPdf(file: StoredFile): Promise<Buffer> {
  const cacheKey = computePreviewCacheKey(file);
  const diskCacheDir = getDiskCacheDir();
  const diskCachePath = path.join(diskCacheDir, `${cacheKey}.pdf`);
  const b2PreviewKey = `archeritage/previews/${cacheKey}.pdf`;

  // 1. Check local disk cache
  if (existsSync(diskCachePath)) {
    try {
      const cached = await fs.readFile(diskCachePath);
      if (isValidPdfBuffer(cached)) {
        return cached;
      }
      console.warn("[preview] Discarding corrupt disk cache", {
        reason: "cache_corrupt",
        fileId: file.id,
        cacheKey,
        size: cached.length,
      });
      await fs.unlink(diskCachePath).catch(() => {});
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
        if (!isValidPdfBuffer(b2CachedBytes)) {
          console.warn("[preview] Ignoring corrupt B2 preview cache", {
            reason: "cache_corrupt",
            fileId: file.id,
            cacheKey,
            size: b2CachedBytes.length,
          });
        } else {
          await fs.mkdir(diskCacheDir, { recursive: true }).catch(() => {});
          await fs.writeFile(diskCachePath, b2CachedBytes).catch(() => {});
          return b2CachedBytes;
        }
      }

      // 3. Read original bytes and perform conversion
      let originalBytes: Buffer;
      try {
        originalBytes = await readRawObjectBytes(file);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new PreviewConversionError(
          "storage_read_failed",
          "Impossible de lire le document original depuis le stockage.",
          detail,
        );
      }

      const generatedPdf = await convertOfficeToPdf(
        originalBytes,
        file.extension,
      );

      await fs.mkdir(diskCacheDir, { recursive: true }).catch(() => {});
      await fs.writeFile(diskCachePath, generatedPdf).catch(() => {});
      void putCachedPreviewObject(b2PreviewKey, generatedPdf);

      return generatedPdf;
    } finally {
      inFlightConversions.delete(cacheKey);
    }
  })();

  inFlightConversions.set(cacheKey, conversionPromise);
  return await conversionPromise;
}
