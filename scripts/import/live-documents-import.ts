/**
 * Live documents-only import. Reads the approved dry-run manifest.
 * Structure is created through admin helpers. Files go through createUploadedFile.
 * Does not modify source files.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { v2 as cloudinary } from "cloudinary";
import { db } from "../../lib/db";
import { createTerritoire } from "../../lib/admin/territoires";
import { createProject } from "../../lib/admin/projects";
import {
  createPart,
  createSection,
  createSectionGroup,
} from "../../lib/structure/mutations";
import { createUploadedFile } from "../../lib/files/create-uploaded-file";
import { resolveStorageProvider } from "../../lib/storage/provider";

const ADMIN_EMAIL = "naciri@archeritage.ma";
const CHATEAU_ROOT = path.resolve(
  "import-source/dossier chateau de mert SAFI/chateau de mer synthese",
);
const MURAILLES_ROOT = path.resolve("import-source/muraille portugaise");

type ManifestFile = {
  sourceRoot: string;
  relativePath: string;
  filename: string;
  extension: string;
  sizeBytes: number;
  sha256: string;
  targetProject: string | null;
  targetPart: string | null;
  targetGroup: string | null;
  targetSection: string | null;
  status: "READY" | "DUPLICATE" | "UNRESOLVED" | "SKIP_MEDIA";
};

type Manifest = {
  counts: { readyBytes: number };
  files: ManifestFile[];
};

const CHATEAU = "Château de Mer";
const MURAILLES = "Murailles portugaises de Safi";

const CHATEAU_GROUPS: { name: string; sections: string[] }[] = [
  {
    name: "COMPRENDRE",
    sections: [
      "Présentation & histoire",
      "Documentation & articles",
      "Protection juridique",
    ],
  },
  {
    name: "DIAGNOSTIC & ENVIRONNEMENT",
    sections: ["Expertise & diagnostic", "Environnement maritime & littoral"],
  },
  {
    name: "CONSULTATION & PROJET",
    sections: [
      "Dossier de consultation",
      "Mémoire technique",
      "Équipe & pièces de candidature",
    ],
  },
];

const MURAILLES_GLOBAL_GROUPS: { name: string; sections: string[] }[] = [
  {
    name: "RELEVÉS & PLANS",
    sections: [
      "Synthèses",
      "Tranche III",
      "Tranche IV",
      "Tranche V",
      "Tranche VI",
      "Bab El Kasbah",
    ],
  },
  { name: "DIAGNOSTIC", sections: ["Pathologies"] },
  {
    name: "CONSULTATION & PROJET",
    sections: [
      "CPS",
      "Règlement de consultation",
      "Pièces complémentaires",
      "Analyses & recommandations",
    ],
  },
];

const MURAILLES_PARTS = [
  "Façade maritime de la Muraille",
  "Muraille — Partie 2",
  "Tranche IX",
];

const MEDIA = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "tif",
  "tiff",
  "heic",
  "mts",
  "avi",
  "mp4",
  "mov",
  "m4v",
  "webm",
  "m2ts",
  "mpeg",
  "mpg",
]);

function sourcePath(file: ManifestFile): string {
  const root =
    file.sourceRoot === "chateau de mer synthese" ? CHATEAU_ROOT : MURAILLES_ROOT;
  return path.join(root, ...file.relativePath.split("/"));
}

function mimeFor(extension: string): string {
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

async function tolerateRevalidate<T>(run: () => Promise<T>, reload: () => Promise<T | null>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const existing = await reload();
    if (existing) return existing;
    throw error;
  }
}

async function cloudinaryCount(prefix: string): Promise<number> {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  let total = 0;
  for (const resource_type of ["image", "video", "raw"]) {
    for (const type of ["upload", "authenticated"]) {
      let cursor: string | undefined;
      do {
        try {
          const res = (await cloudinary.api.resources({
            resource_type,
            type,
            prefix,
            max_results: 500,
            next_cursor: cursor,
          })) as { resources?: unknown[]; next_cursor?: string };
          total += res.resources?.length ?? 0;
          cursor = res.next_cursor;
        } catch {
          cursor = undefined;
        }
      } while (cursor);
    }
  }
  return total;
}

async function listB2(prefix: string): Promise<{ count: number; bytes: number; keys: string[] }> {
  const client = new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION,
    credentials: {
      accessKeyId: process.env.B2_KEY_ID || "",
      secretAccessKey: process.env.B2_APPLICATION_KEY || "",
    },
  });
  const keys: string[] = [];
  let bytes = 0;
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: process.env.B2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const item of page.Contents ?? []) {
      if (!item.Key) continue;
      keys.push(item.Key);
      bytes += item.Size ?? 0;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return { count: keys.length, bytes, keys };
}

async function main() {
  const actor = await db.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true, role: true, status: true },
  });
  if (!actor || actor.role !== "ADMIN" || actor.status === "DISABLED") {
    throw new Error(`ADMIN ${ADMIN_EMAIL} introuvable ou inactif.`);
  }
  const actorId = actor.id;
  const actorEmail = actor.email;

  const manifest = JSON.parse(
    await readFile(path.resolve("reports/import/documents-import-manifest.json"), "utf8"),
  ) as Manifest;

  const cloudinaryBefore = await cloudinaryCount("saf/");

  const structure: Record<string, "created" | "reused"> = {};

  const territoireExisting = await db.territoire.findFirst({
    where: { name: "Safi Patrimoine" },
  });
  const territoire = territoireExisting
    ? territoireExisting
    : await tolerateRevalidate(
        () =>
          createTerritoire(
            { name: "Safi Patrimoine", description: null, isActive: true },
            actorId,
          ),
        () => db.territoire.findFirst({ where: { name: "Safi Patrimoine" } }),
      );
  structure.territoire = territoireExisting ? "reused" : "created";

  async function ensureProject(name: string) {
    const existing = await db.project.findFirst({
      where: { name, territoireId: territoire.id },
    });
    if (existing) {
      structure[`project:${name}`] = "reused";
      return existing;
    }
    const created = await tolerateRevalidate(
      () =>
        createProject(
          {
            name,
            territoireId: territoire.id,
            description: null,
            isActive: true,
          },
          actorId,
        ),
      () => db.project.findFirst({ where: { name, territoireId: territoire.id } }),
    );
    structure[`project:${name}`] = "created";
    return created;
  }

  const chateau = await ensureProject(CHATEAU);
  const murailles = await ensureProject(MURAILLES);

  async function ensurePart(projectId: string, name: string) {
    const existing = await db.part.findFirst({ where: { projectId, name } });
    if (existing) {
      structure[`part:${name}`] = "reused";
      return existing;
    }
    const created = await tolerateRevalidate(
      () => createPart({ projectId, name }, actorId),
      () => db.part.findFirst({ where: { projectId, name } }),
    );
    structure[`part:${name}`] = "created";
    return created;
  }

  const parts = new Map<string, string>();
  for (const name of MURAILLES_PARTS) {
    const part = await ensurePart(murailles.id, name);
    parts.set(name, part.id);
  }

  const sections = new Map<string, string>();

  async function ensureGroup(
    projectId: string,
    projectName: string,
    name: string,
    partId: string | null,
  ) {
    const existing = await db.sectionGroup.findFirst({
      where: { projectId, name, partId },
    });
    const key = `group:${projectName}:${partId ?? "GLOBAL"}:${name}`;
    if (existing) {
      structure[key] = "reused";
      return existing;
    }
    const created = await tolerateRevalidate(
      () => createSectionGroup({ projectId, partId, name }, actorId),
      () => db.sectionGroup.findFirst({ where: { projectId, name, partId } }),
    );
    structure[key] = "created";
    return created;
  }

  async function ensureSection(groupId: string, name: string, mapKey: string) {
    const existing = await db.section.findFirst({ where: { groupId, name } });
    if (existing) {
      structure[`section:${mapKey}`] = "reused";
      sections.set(mapKey, existing.id);
      return;
    }
    const created = await tolerateRevalidate(
      () => createSection({ groupId, name }, actorId),
      () => db.section.findFirst({ where: { groupId, name } }),
    );
    structure[`section:${mapKey}`] = "created";
    sections.set(mapKey, created.id);
  }

  for (const group of CHATEAU_GROUPS) {
    const row = await ensureGroup(chateau.id, CHATEAU, group.name, null);
    for (const section of group.sections) {
      await ensureSection(row.id, section, `${CHATEAU}|GLOBAL|${group.name}|${section}`);
    }
  }
  for (const group of MURAILLES_GLOBAL_GROUPS) {
    const row = await ensureGroup(murailles.id, MURAILLES, group.name, null);
    for (const section of group.sections) {
      await ensureSection(row.id, section, `${MURAILLES}|GLOBAL|${group.name}|${section}`);
    }
  }
  const trancheGroup = await ensureGroup(
    murailles.id,
    MURAILLES,
    "RELEVÉS & PLANS",
    parts.get("Tranche IX") ?? null,
  );
  await ensureSection(
    trancheGroup.id,
    "Plan topographique — Tranche IX",
    `${MURAILLES}|Tranche IX|RELEVÉS & PLANS|Plan topographique — Tranche IX`,
  );

  const results: Array<Record<string, unknown>> = [];
  let uploaded = 0;
  let skippedDuplicate = 0;
  let failed = 0;
  let alreadyImported = 0;
  let sourceChanged = 0;

  for (const file of manifest.files) {
    if (file.status === "DUPLICATE" || file.status === "UNRESOLVED" || file.status === "SKIP_MEDIA") {
      if (file.status === "DUPLICATE") skippedDuplicate += 1;
      results.push({ relativePath: file.relativePath, status: `skipped_${file.status}` });
      continue;
    }
    if (file.status !== "READY") continue;

    if (MEDIA.has(file.extension.toLowerCase())) {
      failed += 1;
      results.push({
        relativePath: file.relativePath,
        status: "failed",
        error: "media_blocked",
      });
      continue;
    }

    const absolute = sourcePath(file);
    let info;
    try {
      info = await stat(absolute);
    } catch (error) {
      failed += 1;
      results.push({
        relativePath: file.relativePath,
        status: "failed",
        error: error instanceof Error ? error.message : "missing",
      });
      continue;
    }
    const bytes = await readFile(absolute);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== file.sha256 || info.size !== file.sizeBytes) {
      sourceChanged += 1;
      failed += 1;
      results.push({
        relativePath: file.relativePath,
        status: "failed",
        error: "source_changed_since_manifest",
        sha256,
        sizeBytes: info.size,
      });
      continue;
    }

    const mapKey = `${file.targetProject}|${file.targetPart}|${file.targetGroup}|${file.targetSection}`;
    const sectionId = sections.get(mapKey);
    if (!sectionId || !file.targetProject) {
      failed += 1;
      results.push({
        relativePath: file.relativePath,
        status: "failed",
        error: `missing_section:${mapKey}`,
      });
      continue;
    }

    const projectId = file.targetProject === CHATEAU ? chateau.id : murailles.id;
    const partId =
      file.targetPart && file.targetPart !== "GLOBAL"
        ? parts.get(file.targetPart) ?? null
        : null;

    const existing = await db.file.findFirst({
      where: { sectionId, originalName: file.filename, size: file.sizeBytes },
      select: { id: true, storageKey: true, storageProvider: true },
    });
    if (existing) {
      alreadyImported += 1;
      results.push({
        relativePath: file.relativePath,
        status: "already_imported",
        fileId: existing.id,
        storageKey: existing.storageKey,
        storageProvider: existing.storageProvider,
      });
      continue;
    }

    const provider = resolveStorageProvider({
      fileName: file.filename,
      mimeType: mimeFor(file.extension),
      sizeBytes: file.sizeBytes,
    });
    if (provider !== "BACKBLAZE_B2") {
      failed += 1;
      results.push({
        relativePath: file.relativePath,
        status: "failed",
        error: `unexpected_provider:${provider}`,
      });
      continue;
    }

    try {
      const record = await createUploadedFile({
        userId: actorId,
        projectId,
        partId,
        sectionId,
        originalName: file.filename,
        mimeType: mimeFor(file.extension),
        sizeBytes: file.sizeBytes,
        source: bytes,
      });
      uploaded += 1;
      results.push({
        relativePath: file.relativePath,
        status: "uploaded",
        fileId: record.id,
        storageProvider: record.storageProvider,
        storageKey: record.storageKey,
        size: record.size,
      });
      console.log(`uploaded ${file.filename} → ${record.storageProvider}`);
    } catch (error) {
      failed += 1;
      results.push({
        relativePath: file.relativePath,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`failed ${file.filename}`, error instanceof Error ? error.message : error);
    }
  }

  const dbFiles = await db.file.findMany({
    select: {
      id: true,
      originalName: true,
      size: true,
      storageProvider: true,
      storageKey: true,
      section: { select: { name: true, group: { select: { name: true, partId: true, project: { select: { name: true } } } } } },
    },
  });
  const b2 = await listB2("saf/");
  const dbKeys = new Set(dbFiles.map((file) => file.storageKey));
  const cloudinaryAfter = await cloudinaryCount("saf/");
  const counts = {
    territoires: await db.territoire.count({ where: { name: "Safi Patrimoine" } }),
    projects: await db.project.count({ where: { territoireId: territoire.id } }),
    parts: await db.part.count({ where: { projectId: murailles.id } }),
    groups: await db.sectionGroup.count({
      where: { projectId: { in: [chateau.id, murailles.id] } },
    }),
    sections: await db.section.count({
      where: { group: { projectId: { in: [chateau.id, murailles.id] } } },
    }),
    files: dbFiles.length,
    fileBytes: dbFiles.reduce((n, file) => n + file.size, 0),
    b2Providers: dbFiles.filter((file) => file.storageProvider === "BACKBLAZE_B2").length,
    cloudinaryProviders: dbFiles.filter((file) => file.storageProvider === "CLOUDINARY").length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    actorEmail,
    structure,
    uploaded,
    skippedDuplicates: skippedDuplicate,
    alreadyImported,
    failed,
    sourceChanged,
    bytesUploaded: results
      .filter((row) => row.status === "uploaded")
      .reduce((n, row) => n + Number(row.size ?? 0), 0),
    manifestReadyBytes: manifest.counts.readyBytes,
    database: counts,
    b2: {
      prefix: "saf/",
      objectCount: b2.count,
      bytes: b2.bytes,
      keysMissingFromDb: b2.keys.filter((key) => !dbKeys.has(key)),
      dbKeysMissingFromB2: [...dbKeys].filter((key) => !b2.keys.includes(key)),
    },
    cloudinary: {
      prefix: "saf/",
      before: cloudinaryBefore,
      after: cloudinaryAfter,
      unchanged: cloudinaryBefore === cloudinaryAfter,
    },
    results,
  };

  await mkdir(path.resolve("reports/import"), { recursive: true });
  await writeFile(
    path.resolve("reports/import/documents-live-import-report.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );

  const summary = [
    "Live documents import",
    `Actor: ${actor.email}`,
    `Uploaded: ${uploaded}`,
    `Already imported: ${alreadyImported}`,
    `Skipped duplicates: ${skippedDuplicate}`,
    `Failed: ${failed}`,
    `Source changed: ${sourceChanged}`,
    `DB files: ${counts.files}`,
    `DB bytes: ${counts.fileBytes}`,
    `B2 objects under saf/: ${b2.count} (${b2.bytes} bytes)`,
    `Cloudinary saf/ before=${cloudinaryBefore} after=${cloudinaryAfter} unchanged=${cloudinaryBefore === cloudinaryAfter}`,
    `Territoires named Safi Patrimoine: ${counts.territoires}`,
    `Projects: ${counts.projects}`,
    `Murailles parts: ${counts.parts}`,
    "",
    "Failures:",
    ...results
      .filter((row) => row.status === "failed")
      .map((row) => `- ${row.relativePath}: ${row.error}`),
  ].join("\n");
  await writeFile(
    path.resolve("reports/import/documents-live-import-summary.txt"),
    summary + "\n",
    "utf8",
  );
  console.log(summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
