import { z } from "zod";

export const nameSchema = z.string().trim().min(1).max(180).refine((s) => !/[\u0000-\u001f\u007f/\\]/.test(s) && s !== "." && s !== "..", "Nom invalide");
const imageExtensions: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
export function maxUploadBytes() {
  const mb = Number(process.env.MAX_UPLOAD_MB || 25);
  if (!Number.isInteger(mb) || mb < 1 || mb > 100) throw new Error("MAX_UPLOAD_MB must be between 1 and 100.");
  return mb * 1024 * 1024;
}
export function validateFile(name: string, declaredMime: string, bytes: Buffer) {
  nameSchema.parse(name);
  if (!bytes.length || bytes.length > maxUploadBytes()) throw new Error("Fichier vide ou trop volumineux.");
  const extension = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (!/^[a-z0-9]{0,16}$/.test(extension)) throw new Error("Extension de fichier invalide.");
  const detected = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? "image/jpeg"
    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
    : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP" ? "image/webp" : null;
  const expectedImage = imageExtensions[extension];
  if (expectedImage || detected || declaredMime.startsWith("image/")) {
    if (!expectedImage || expectedImage !== detected || (declaredMime && declaredMime !== "application/octet-stream" && declaredMime !== detected)) throw new Error("Image invalide. Utilisez JPG, PNG ou WebP.");
    return { extension, mimeType: detected!, storageProvider: "CLOUDINARY" as const };
  }
  if (extension === "pdf" && bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("Le contenu du fichier PDF est invalide.");
  // Arbitrary office/CAD/archive files are downloads only. Never trust their supplied MIME for inline rendering.
  return { extension, mimeType: extension === "pdf" ? "application/pdf" : "application/octet-stream", storageProvider: "BACKBLAZE_B2" as const };
}
export function contentDisposition(name: string, inline = false) {
  const fallback = name.replace(/[^a-zA-Z0-9._ -]/g, "_");
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
