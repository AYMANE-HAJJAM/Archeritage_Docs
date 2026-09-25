/**
 * Authoritative storage provider decision.
 *
 * IMAGE → CLOUDINARY
 * VIDEO → CLOUDINARY when size <= CLOUDINARY_VIDEO_MAX_MB, else BACKBLAZE_B2
 * DOCUMENT → BACKBLAZE_B2
 *
 * Kind is MIME plus extension fallback. The caller never supplies a provider.
 * Failures of the chosen provider are not retried on the other one.
 */
import type { StorageProvider } from "@/generated/prisma/client";
import {
  normalizeExtension,
  VIDEO_EXTENSIONS,
} from "@/lib/documents/file-kind";
import { cloudinaryVideoMaxBytes } from "@/lib/storage/video-limit";

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "tif",
  "tiff",
  "heic",
  "heif",
]);

export type FileKind = "image" | "video" | "document";

export type StorageProviderInput = {
  fileName?: string | null;
  /** Alias of fileName. */
  filename?: string | null;
  mimeType?: string | null;
  extension?: string | null;
  sizeBytes: number;
};

function extensionOf(input: {
  fileName?: string | null;
  filename?: string | null;
  extension?: string | null;
}): string {
  const explicit = normalizeExtension(input.extension ?? "");
  if (explicit) return explicit;
  const name = input.fileName ?? input.filename ?? "";
  if (!name.includes(".")) return "";
  return normalizeExtension(name.split(".").pop() ?? "");
}

export function detectFileKind(
  input: Omit<StorageProviderInput, "sizeBytes"> & { sizeBytes?: number },
): FileKind {
  const mime = (input.mimeType ?? "").toLowerCase();
  const ext = extensionOf(input);

  if (mime.startsWith("image/") || IMAGE_EXTENSIONS.has(ext)) return "image";
  if (mime.startsWith("video/") || VIDEO_EXTENSIONS.has(ext)) return "video";
  return "document";
}

export function resolveStorageProvider(
  input: StorageProviderInput,
): StorageProvider {
  const kind = detectFileKind(input);
  if (kind === "image") return "CLOUDINARY";
  if (kind === "video") {
    if (!Number.isFinite(input.sizeBytes) || input.sizeBytes < 0) {
      throw new Error("Video size is required to choose a storage provider.");
    }
    if (input.sizeBytes <= cloudinaryVideoMaxBytes()) return "CLOUDINARY";
    return "BACKBLAZE_B2";
  }
  return "BACKBLAZE_B2";
}
