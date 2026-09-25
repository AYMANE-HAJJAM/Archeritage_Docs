/**
 * Centralized hierarchical storage path builder for B2 / Cloudinary.
 *
 * Policy:
 * - Structural IDs are authoritative in the DB
 * - Display rename does NOT rewrite existing object keys
 * - New uploads use the current hierarchy at upload time
 * - Collision-safe via UUID segment; original filename stored separately in DB
 */
import { randomUUID } from "node:crypto";
import { generateSlug } from "@/lib/admin/identifiers";

export type StoragePathContext = {
  territoireCode: string;
  projectSlug: string;
  partSlug?: string | null;
  /** Stable section segment (prefer section id or slugified name at upload time). */
  sectionSegment: string;
  folderNames?: string[];
  originalFilename: string;
  fileId?: string;
};

const MAX_SEGMENT = 80;
const MAX_FILENAME = 120;

function sanitizeSegment(raw: string, fallback = "item"): string {
  const cleaned = generateSlug(raw).slice(0, MAX_SEGMENT);
  if (!cleaned || cleaned === ".." || cleaned.includes("..")) return fallback;
  return cleaned;
}

function sanitizeFilename(original: string): string {
  const trimmed = original.trim().replace(/\\/g, "/");
  const base = trimmed.split("/").pop() || "file";
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  const safeStem = sanitizeSegment(stem, "file").slice(0, MAX_FILENAME);
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").slice(0, 16);
  return safeExt ? `${safeStem}.${safeExt}` : safeStem;
}

export function buildDocumentStoragePath(ctx: StoragePathContext): string {
  const segments: string[] = [
    sanitizeSegment(ctx.territoireCode, "territoire"),
    sanitizeSegment(ctx.projectSlug, "projet"),
  ];
  if (ctx.partSlug) {
    segments.push(sanitizeSegment(ctx.partSlug, "part"));
  }
  segments.push(sanitizeSegment(ctx.sectionSegment, "section"));
  for (const name of ctx.folderNames ?? []) {
    const seg = sanitizeSegment(name);
    if (seg) segments.push(seg);
  }
  const id = (ctx.fileId || randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = sanitizeFilename(ctx.originalFilename);
  segments.push(`${id}-${filename}`);

  const key = segments.join("/");
  if (key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    throw new Error("Unsafe storage path rejected.");
  }
  return key;
}

export function buildCloudinaryFolderPath(
  ctx: Omit<StoragePathContext, "originalFilename" | "fileId">,
): string {
  const segments: string[] = [
    sanitizeSegment(ctx.territoireCode, "territoire"),
    sanitizeSegment(ctx.projectSlug, "projet"),
  ];
  if (ctx.partSlug) segments.push(sanitizeSegment(ctx.partSlug, "part"));
  segments.push(sanitizeSegment(ctx.sectionSegment, "section"));
  for (const name of ctx.folderNames ?? []) {
    const seg = sanitizeSegment(name);
    if (seg) segments.push(seg);
  }
  return segments.join("/");
}

export function storagePathSegments(key: string): string[] {
  return key.split("/").filter(Boolean);
}
