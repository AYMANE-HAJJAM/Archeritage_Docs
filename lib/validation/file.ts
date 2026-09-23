import { z } from "zod";

import { VIDEO_MIME_BY_EXTENSION } from "@/lib/documents/file-kind";

export const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .refine(
    (s) => !/[\u0000-\u001f\u007f/\\]/.test(s) && s !== "." && s !== "..",
    "Nom invalide",
  );

const imageExtensions: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Absolute ceiling for MAX_UPLOAD_MB (env). */
export const MAX_UPLOAD_MB_CEILING = 1024;
export const MAX_UPLOAD_MB_DEFAULT = 25;

/**
 * Resolve configured upload limit in megabytes.
 * Throws a clear Error if the env value is invalid (not silently capped).
 */
export function resolveMaxUploadMb(): number {
  const raw = process.env.MAX_UPLOAD_MB;
  const mb =
    raw === undefined || raw === ""
      ? MAX_UPLOAD_MB_DEFAULT
      : Number(raw);
  if (!Number.isInteger(mb) || mb < 1 || mb > MAX_UPLOAD_MB_CEILING) {
    throw new Error(
      `MAX_UPLOAD_MB must be an integer between 1 and ${MAX_UPLOAD_MB_CEILING} (got ${JSON.stringify(raw ?? "")}).`,
    );
  }
  return mb;
}

export function maxUploadBytes() {
  return resolveMaxUploadMb() * 1024 * 1024;
}

/** Reject empty / oversize payloads before reading file contents. */
export function assertWithinUploadLimit(size: number): void {
  if (!Number.isFinite(size) || size <= 0 || size > maxUploadBytes()) {
    throw new Error("Fichier vide ou trop volumineux.");
  }
}

export type ValidatedUpload = {
  extension: string;
  mimeType: string;
  storageProvider: "CLOUDINARY" | "BACKBLAZE_B2";
};

/**
 * Validate upload metadata.
 * `bytes` may be a full buffer (small images) or only a short head (PDF/video).
 * Size is always checked via `byteLength` (prefer explicit `size` when streaming).
 */
export function validateFile(
  name: string,
  declaredMime: string,
  bytes: Buffer,
  size: number = bytes.length,
): ValidatedUpload {
  nameSchema.parse(name);
  assertWithinUploadLimit(size);
  const extension = name.includes(".")
    ? name.split(".").pop()!.toLowerCase()
    : "";
  if (!/^[a-z0-9]{0,16}$/.test(extension)) {
    throw new Error("Extension de fichier invalide.");
  }

  const detected =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
      ? "image/jpeg"
      : bytes.length >= 8 &&
          bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "image/png"
        : bytes.length >= 12 &&
            bytes.subarray(0, 4).toString() === "RIFF" &&
            bytes.subarray(8, 12).toString() === "WEBP"
          ? "image/webp"
          : null;

  const expectedImage = imageExtensions[extension];
  if (expectedImage || detected || declaredMime.startsWith("image/")) {
    if (
      !expectedImage ||
      expectedImage !== detected ||
      (declaredMime &&
        declaredMime !== "application/octet-stream" &&
        declaredMime !== detected)
    ) {
      throw new Error("Image invalide. Utilisez JPG, PNG ou WebP.");
    }
    return {
      extension,
      mimeType: detected!,
      storageProvider: "CLOUDINARY",
    };
  }

  if (
    extension === "pdf" &&
    (bytes.length < 5 || bytes.subarray(0, 5).toString() !== "%PDF-")
  ) {
    throw new Error("Le contenu du fichier PDF est invalide.");
  }

  const videoMime = VIDEO_MIME_BY_EXTENSION[extension];
  if (videoMime) {
    return {
      extension,
      mimeType: videoMime,
      storageProvider: "BACKBLAZE_B2",
    };
  }

  return {
    extension,
    mimeType: extension === "pdf" ? "application/pdf" : "application/octet-stream",
    storageProvider: "BACKBLAZE_B2",
  };
}

export function contentDisposition(name: string, inline = false) {
  const fallback = name.replace(/[^a-zA-Z0-9._ -]/g, "_");
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
