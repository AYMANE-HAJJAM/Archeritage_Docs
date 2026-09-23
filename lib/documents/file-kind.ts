/**
 * Client-safe file kind helpers for document lists and preview.
 */

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

/** All recognized video extensions (icons + classification). */
export const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mov",
  "m4v",
  "webm",
  "avi",
  "mts",
  "m2ts",
  "mpeg",
  "mpg",
  "mkv",
]);

/**
 * Formats HTML5 `<video>` can usually play without a server-side derivative.
 * MTS/AVI/MPEG/MOV/MKV often need H.264 MP4 conversion.
 */
const BROWSER_PLAYABLE_VIDEO_EXTENSIONS = new Set(["mp4", "webm", "m4v"]);

/** Canonical MIME for known video extensions (upload + streaming Content-Type). */
export const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  webm: "video/webm",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mts: "video/MP2T",
  m2ts: "video/MP2T",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  mkv: "video/x-matroska",
};

export type PreviewableFile = {
  id: string;
  displayName: string;
  extension: string;
  mimeType: string;
  size: number;
  storageProvider: "CLOUDINARY" | "BACKBLAZE_B2";
};

export function normalizeExtension(extension: string): string {
  return extension.toLowerCase().replace(/^\./, "").trim();
}

export function isImageFile(file: {
  extension?: string | null;
  mimeType?: string | null;
  storageProvider?: string | null;
}): boolean {
  if (file.storageProvider === "CLOUDINARY") return true;
  const ext = normalizeExtension(file.extension ?? "");
  if (IMAGE_EXTENSIONS.has(ext)) return true;
  return Boolean(file.mimeType?.startsWith("image/"));
}

export function isVideoFile(file: {
  extension?: string | null;
  mimeType?: string | null;
}): boolean {
  const ext = normalizeExtension(file.extension ?? "");
  if (VIDEO_EXTENSIONS.has(ext)) return true;
  return Boolean(file.mimeType?.startsWith("video/"));
}

/**
 * True when the browser can reasonably play the original bytes via `<video>`.
 * Prefer extension over MIME — uploads often arrive as application/octet-stream.
 */
export function isBrowserPlayableVideo(file: {
  extension?: string | null;
  mimeType?: string | null;
}): boolean {
  if (!isVideoFile(file)) return false;
  const ext = normalizeExtension(file.extension ?? "");
  if (BROWSER_PLAYABLE_VIDEO_EXTENSIONS.has(ext)) return true;
  // MIME-only videos without a known extension: only trust common playable types.
  const mime = (file.mimeType ?? "").toLowerCase();
  return (
    mime === "video/mp4" ||
    mime === "video/webm" ||
    mime === "video/x-m4v"
  );
}

/** Formats that need an H.264 MP4 preview derivative for in-browser playback. */
export function needsVideoPreviewDerivative(file: {
  extension?: string | null;
  mimeType?: string | null;
}): boolean {
  return isVideoFile(file) && !isBrowserPlayableVideo(file);
}

/** Resolve a streaming Content-Type for video (extension first, then stored MIME). */
export function videoContentType(file: {
  extension?: string | null;
  mimeType?: string | null;
}): string {
  const ext = normalizeExtension(file.extension ?? "");
  if (VIDEO_MIME_BY_EXTENSION[ext]) return VIDEO_MIME_BY_EXTENSION[ext];
  if (file.mimeType?.startsWith("video/")) return file.mimeType;
  return "video/mp4";
}

export function fileTypeBadge(file: {
  extension?: string | null;
  mimeType?: string | null;
}): string {
  const ext = normalizeExtension(file.extension ?? "");
  if (ext) return ext.toUpperCase();
  if (file.mimeType?.startsWith("image/")) return "IMAGE";
  if (file.mimeType?.startsWith("video/")) return "VIDEO";
  if (file.mimeType === "application/pdf") return "PDF";
  return "FICHIER";
}

/** Thumbnail URL for Cloudinary images (optimized transform on the server). */
export function fileThumbnailUrl(fileId: string): string {
  return `/api/files/${fileId}/content?thumbnail=1`;
}

export function fileContentUrl(fileId: string): string {
  return `/api/files/${fileId}/content`;
}

export function fileDownloadUrl(fileId: string): string {
  return `/api/files/${fileId}/content?download=1`;
}

/** Authenticated MP4 preview derivative (H.264) for non-browser-native formats. */
export function fileVideoPreviewUrl(fileId: string): string {
  return `/api/files/${fileId}/video-preview`;
}
