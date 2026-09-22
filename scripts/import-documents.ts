import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { DeleteObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { importPlan, importProjects } from "../lib/documents/import-plan";
import { validateFile } from "../lib/validation/file";

const execute = process.argv.includes("--execute");
const sourceRoot = resolve(process.cwd(), "source_import");
const required = (key: string) => { const value = process.env[key]; if (!value) throw new Error(`Configuration manquante : ${key}`); return value; };
const normalize = (value: string) => value.split(sep).join("/");

async function walk(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

async function inspect() {
  const discovered = (await Promise.all(Object.keys(importProjects).map(async (project) =>
    (await walk(join(sourceRoot, project))).map((path) => `${project}:${normalize(relative(join(sourceRoot, project), path))}`)
  ))).flat();
  const planned = new Set(importPlan.map((item) => `${item.project}:${item.relativePath}`));
  const unknown = discovered.filter((path) => !planned.has(path));
  const missing = [...planned].filter((path) => !discovered.includes(path));
  if (unknown.length || missing.length) throw new Error(`Le plan ne correspond plus aux sources. Non classés: ${unknown.join(", ") || "aucun"}. Manquants: ${missing.join(", ") || "aucun"}.`);
  const inspected = [];
  for (const item of importPlan) {
    const path = join(sourceRoot, item.project, ...item.relativePath.split("/"));
    const bytes = await readFile(path);
    inspected.push({ ...item, path, bytes, hash: createHash("sha256").update(bytes).digest("hex") });
  }
  return inspected;
}

async function main() {
  const files = await inspect();
  const firstByHash = new Map<string, string>();
  const rows = files.map((file) => {
    const duplicateOf = firstByHash.get(file.hash);
    if (!duplicateOf) firstByHash.set(file.hash, `${file.project}/${file.relativePath}`);
    return { file, duplicateOf };
  });
  console.log(`Sources vérifiées : ${files.length} fichiers; ${rows.filter((r) => r.duplicateOf).length} copies exactes; ${rows.filter((r) => r.file.review).length} à confirmer.`);
  for (const { file, duplicateOf } of rows) console.log(`${duplicateOf ? "DUPLICATE" : file.review ? "À CONFIRMER" : "PRÊT"}\t${file.project}/${file.relativePath}\t${file.folder ?? "—"}${duplicateOf ? `\tidentique à ${duplicateOf}` : file.review ? `\t${file.review}` : ""}`);
  if (!execute) { console.log("Analyse seulement. Utilisez npm run import:documents:execute après validation du rapport."); return; }
  if (rows.some((row) => row.file.review)) throw new Error("Import annulé : les fichiers marqués « À CONFIRMER » doivent d’abord être classés dans lib/import-plan.ts.");

  const databaseUrl = required("DATABASE_URL");
  cloudinary.config({ cloud_name: required("CLOUDINARY_CLOUD_NAME"), api_key: required("CLOUDINARY_API_KEY"), api_secret: required("CLOUDINARY_API_SECRET"), secure: true });
  const bucket = required("B2_BUCKET_NAME");
  const s3 = new S3Client({ endpoint: required("B2_ENDPOINT"), region: required("B2_REGION"), credentials: { accessKeyId: required("B2_KEY_ID"), secretAccessKey: required("B2_APPLICATION_KEY") }, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    // All services are checked before the first upload, preventing a partial run
    // caused by missing or invalid provider credentials.
    await db.$queryRaw`SELECT 1`;
    await cloudinary.api.ping();
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    const user = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
    if (!user) throw new Error("Aucun administrateur disponible pour uploadedById.");
    const projects = await db.project.findMany({ where: { slug: { in: Object.values(importProjects).map((item) => item.slug) } } });
    const folders = await db.folder.findMany({ where: { projectId: { in: projects.map((project) => project.id) } } });
    const existing = new Set((await db.file.findMany({ where: { sourceHash: { in: rows.map((row) => row.file.hash) } }, select: { sourceHash: true } })).flatMap((file) => file.sourceHash ? [file.sourceHash] : []));
    for (const { file, duplicateOf } of rows) {
      if (duplicateOf || existing.has(file.hash)) { console.log(`IGNORÉ\t${file.relativePath}\t${duplicateOf ? "copie exacte" : "déjà importé"}`); continue; }
      const project = projects.find((candidate) => candidate.slug === importProjects[file.project].slug);
      const folder = folders.find((candidate) => candidate.projectId === project?.id && candidate.name === file.folder);
      if (!project || !folder) throw new Error(`Projet ou dossier seed manquant pour ${file.relativePath}.`);
      const validated = validateFile(basename(file.path), "application/octet-stream", file.bytes);
      const storageKey = `archeritage/${randomUUID()}`;
      let storageVersion: string | null = null;
      try {
        if (validated.storageProvider === "CLOUDINARY") {
          const uploaded = await new Promise<UploadApiResponse>((resolveUpload, rejectUpload) => cloudinary.uploader.upload_stream({ public_id: storageKey, resource_type: "image", type: "authenticated", allowed_formats: ["jpg", "png", "webp"], overwrite: false }, (error, result) => error ? rejectUpload(error) : result ? resolveUpload(result) : rejectUpload(new Error("Échec Cloudinary"))).end(file.bytes));
          storageVersion = String(uploaded.version);
        } else {
          const uploaded = await s3.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: file.bytes, ContentType: validated.mimeType, ContentLength: file.bytes.length }));
          storageVersion = uploaded.VersionId ?? null;
        }
        await db.file.create({ data: { originalName: basename(file.path), displayName: file.displayName, extension: extname(file.path).slice(1).toLowerCase(), mimeType: validated.mimeType, size: file.bytes.length, storageProvider: validated.storageProvider, storageKey, storageVersion, sourceHash: file.hash, projectId: project.id, folderId: folder.id, uploadedById: user.id } });
        existing.add(file.hash);
        console.log(`IMPORTÉ\t${file.displayName}`);
      } catch (error) {
        try {
          if (validated.storageProvider === "CLOUDINARY") await cloudinary.uploader.destroy(storageKey, { resource_type: "image", type: "authenticated", invalidate: true });
          else await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey, VersionId: storageVersion ?? undefined }));
        } catch { console.error(`Nettoyage manuel requis pour ${storageKey}.`); }
        throw error;
      }
    }
  } finally { await db.$disconnect(); s3.destroy(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
