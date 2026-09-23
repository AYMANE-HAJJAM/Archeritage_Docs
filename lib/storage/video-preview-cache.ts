import "server-only";
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import * as path from "node:path";
import type { File as StoredFile } from "@/generated/prisma/client";
import {
  convertVideoToPreviewMp4,
  VideoPreviewConversionError,
} from "@/lib/documents/video-converter";
import {
  getCachedPreviewObject,
  putCachedPreviewObject,
  readRawObjectBytes,
} from "@/lib/storage";
import { computePreviewCacheKey } from "@/lib/storage/preview-cache";

const inFlightConversions = new Map<string, Promise<Buffer>>();

function getDiskCacheDir(): string {
  return path.join(process.cwd(), ".cache", "video-previews");
}

function isValidMp4Buffer(bytes: Buffer): boolean {
  return bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp";
}

/**
 * Return a cached H.264 MP4 preview for a video file, generating it once
 * via ffmpeg when missing. Original B2 object is never overwritten.
 */
export async function getOrGenerateVideoPreviewMp4(
  file: StoredFile,
): Promise<Buffer> {
  const cacheKey = computePreviewCacheKey(file);
  const diskCacheDir = getDiskCacheDir();
  const diskCachePath = path.join(diskCacheDir, `${cacheKey}.mp4`);
  const b2PreviewKey = `archeritage/previews/${cacheKey}.mp4`;

  if (existsSync(diskCachePath)) {
    try {
      const cached = await fs.readFile(diskCachePath);
      if (isValidMp4Buffer(cached)) {
        return cached;
      }
      console.warn("[video-preview] Discarding corrupt disk cache", {
        reason: "cache_corrupt",
        fileId: file.id,
        cacheKey,
        size: cached.length,
      });
      await fs.unlink(diskCachePath).catch(() => {});
    } catch {
      // Continue to B2 / conversion
    }
  }

  const pending = inFlightConversions.get(cacheKey);
  if (pending) {
    return await pending;
  }

  const conversionPromise = (async (): Promise<Buffer> => {
    try {
      const b2CachedBytes = await getCachedPreviewObject(b2PreviewKey);
      if (b2CachedBytes && b2CachedBytes.length > 0) {
        if (!isValidMp4Buffer(b2CachedBytes)) {
          console.warn("[video-preview] Ignoring corrupt B2 preview cache", {
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

      let originalBytes: Buffer;
      try {
        originalBytes = await readRawObjectBytes(file);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new VideoPreviewConversionError(
          "storage_read_failed",
          "Impossible de lire la vidéo originale depuis le stockage.",
          detail,
        );
      }

      const generatedMp4 = await convertVideoToPreviewMp4(
        originalBytes,
        file.extension,
      );

      await fs.mkdir(diskCacheDir, { recursive: true }).catch(() => {});
      await fs.writeFile(diskCachePath, generatedMp4).catch(() => {});
      void putCachedPreviewObject(b2PreviewKey, generatedMp4, "video/mp4");

      return generatedMp4;
    } finally {
      inFlightConversions.delete(cacheKey);
    }
  })();

  inFlightConversions.set(cacheKey, conversionPromise);
  return await conversionPromise;
}
