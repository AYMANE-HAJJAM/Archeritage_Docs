/**
 * Live media import from the approved dry-run manifest.
 * Classifies nothing: path, size, and SHA-256 only.
 * Uploads go through createUploadedFile.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { v2 as cloudinary } from "cloudinary";
import { db } from "../../lib/db";
import { createPart, createSection, createSectionGroup } from "../../lib/structure/mutations";
import { createFolder } from "../../lib/structure/folders";
import { createUploadedFile } from "../../lib/files/create-uploaded-file";
import { resolveStorageProvider } from "../../lib/storage/provider";
import { resolveMaxUploadMb } from "../../lib/validation/file";
import { VIDEO_MIME_BY_EXTENSION } from "../../lib/documents/file-kind";

const ADMIN_EMAIL = "naciri@archeritage.ma";
const MEDIA_ROOT = path.resolve("import-source/media");
const REPORT_JSON = path.resolve("reports/import/media-live-import-report.json");
const REPORT_TXT = path.resolve("reports/import/media-live-import-summary.txt");
const GROUP = "DOCUMENTATION VISUELLE";
const PHOTO = "Documentation photographique";
const VIDEO = "Documentation vidéo";
const CHATEAU = "Château de Mer";
const MURAILLES = "Murailles portugaises de Safi";

type ManifestFile = {
  sourceRelativePath: string;
  filename: string;
  extension: string;
  sizeBytes: number;
  sha256: string;
  detectedKind: "image" | "video" | "document";
  targetProject: string | null;
  targetPart: string | null;
  targetGroup: string | null;
  targetSection: string | null;
  targetFolders: string[];
  expectedStorageProvider: "CLOUDINARY" | "BACKBLAZE_B2" | null;
  area: string | null;
  status: "READY" | "DUPLICATE" | "UNRESOLVED" | "UNSUPPORTED";
};

const FOLDER_TREES: Array<{
  project: string;
  part: string | null;
  section: string;
  folders: string[][];
}> = [
  { project: CHATEAU, part: null, section: PHOTO, folders: [["Externe"], ["Interne"]] },
  { project: CHATEAU, part: null, section: VIDEO, folders: [["Externe"], ["Interne"]] },
  {
    project: MURAILLES,
    part: "Façade maritime de la Muraille",
    section: PHOTO,
    folders: [["Externe"], ["Interne"]],
  },
  {
    project: MURAILLES,
    part: "Façade maritime de la Muraille",
    section: VIDEO,
    folders: [["Externe"], ["Interne"]],
  },
  {
    project: MURAILLES,
    part: "Muraille — Partie 2",
    section: PHOTO,
    folders: [["Externe"], ["Interne"], ["Potiers"]],
  },
  {
    project: MURAILLES,
    part: "Muraille — Partie 2",
    section: VIDEO,
    folders: [["Externe"], ["Interne"], ["Potiers"]],
  },
  {
    project: MURAILLES,
    part: "Tranche IX",
    section: PHOTO,
    folders: [
      ["Secteur A"],
      ["Secteur B", "Externe"],
      ["Secteur B", "Interne"],
      ["Secteur C", "Externe"],
      ["Secteur C", "Interne"],
      ["Secteur C", "Résidence du Sultan"],
    ],
  },
  {
    project: MURAILLES,
    part: "Tranche IX",
    section: VIDEO,
    folders: [
      ["Secteur A"],
      ["Secteur A", "Interne"],
      ["Secteur B", "Externe"],
      ["Secteur B", "Interne"],
      ["Secteur C", "Externe"],
      ["Secteur C", "Interne"],
      ["Secteur C", "Mosquée du Sultan"],
    ],
  },
];

function hashFile(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function headBytes(file: string): Promise<Buffer> {
  const handle = await open(file, "r");
  try {
    const buf = Buffer.alloc(64);
    await handle.read(buf, 0, 64, 0);
    return buf;
  } finally {
    await handle.close();
  }
}

function mimeFor(extension: string, kind: string): string {
  const ext = extension.toLowerCase();
  if (kind === "image") {
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "webp") return "image/webp";
  }
  return VIDEO_MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

async function tolerate<T>(run: () => Promise<T>, reload: () => Promise<T | null>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const existing = await reload();
    if (existing) return existing;
    throw error;
  }
}

async function cloudinaryByType(prefix: string) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  const counts = { image: 0, video: 0, raw: 0 };
  for (const resource_type of ["image", "video", "raw"] as const) {
    let cursor: string | undefined;
    do {
      try {
        const res = (await cloudinary.api.resources({
          resource_type,
          type: "authenticated",
          prefix,
          max_results: 500,
          next_cursor: cursor,
        })) as { resources?: unknown[]; next_cursor?: string };
        counts[resource_type] += res.resources?.length ?? 0;
        cursor = res.next_cursor;
      } catch {
        cursor = undefined;
      }
    } while (cursor);
  }
  return counts;
}

async function listB2(prefix: string) {
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
  const maxMb = resolveMaxUploadMb();
  console.log(`[media-import] MAX_UPLOAD_MB=${maxMb}`);

  const actor = await db.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true, role: true, status: true },
  });
  if (!actor || actor.role !== "ADMIN" || actor.status === "DISABLED") {
    throw new Error(`ADMIN ${ADMIN_EMAIL} introuvable ou inactif.`);
  }
  const actorId = actor.id;

  const documentIds = (
    await db.file.findMany({
      where: { section: { group: { name: { not: GROUP } } } },
      select: { id: true },
    })
  ).map((row) => row.id);

  const territoire = await db.territoire.findFirst({ where: { name: "Safi Patrimoine" } });
  if (!territoire) throw new Error("Territoire Safi Patrimoine introuvable.");
  const chateau = await db.project.findFirst({
    where: { name: CHATEAU, territoireId: territoire.id },
  });
  const murailles = await db.project.findFirst({
    where: { name: MURAILLES, territoireId: territoire.id },
  });
  if (!chateau || !murailles) throw new Error("Projets existants introuvables.");

  const partRows = await db.part.findMany({ where: { projectId: murailles.id } });
  const parts = new Map(partRows.map((part) => [part.name, part.id]));
  for (const name of ["Façade maritime de la Muraille", "Muraille — Partie 2", "Tranche IX"]) {
    if (!parts.has(name)) {
      const created = await tolerate(
        () => createPart({ projectId: murailles.id, name }, actorId),
        () => db.part.findFirst({ where: { projectId: murailles.id, name } }),
      );
      parts.set(name, created.id);
    }
  }

  const structure: Record<string, "created" | "reused"> = {};
  const sectionIds = new Map<string, string>();

  async function ensureGroup(projectId: string, projectName: string, partId: string | null) {
    const key = `group:${projectName}:${partId ?? "GLOBAL"}`;
    const existing = await db.sectionGroup.findFirst({
      where: { projectId, name: GROUP, partId },
    });
    if (existing) {
      structure[key] = "reused";
      return existing;
    }
    const created = await tolerate(
      () => createSectionGroup({ projectId, partId, name: GROUP }, actorId),
      () => db.sectionGroup.findFirst({ where: { projectId, name: GROUP, partId } }),
    );
    structure[key] = "created";
    return created;
  }

  async function ensureSection(groupId: string, name: string, mapKey: string) {
    const existing = await db.section.findFirst({ where: { groupId, name } });
    if (existing) {
      structure[`section:${mapKey}`] = "reused";
      sectionIds.set(mapKey, existing.id);
      return existing.id;
    }
    const created = await tolerate(
      () => createSection({ groupId, name }, actorId),
      () => db.section.findFirst({ where: { groupId, name } }),
    );
    structure[`section:${mapKey}`] = "created";
    sectionIds.set(mapKey, created.id);
    return created.id;
  }

  const projects = new Map([
    [CHATEAU, chateau],
    [MURAILLES, murailles],
  ]);

  for (const projectName of [CHATEAU, MURAILLES]) {
    const project = projects.get(projectName)!;
    if (projectName === CHATEAU) {
      const group = await ensureGroup(project.id, projectName, null);
      for (const section of [PHOTO, VIDEO]) {
        await ensureSection(group.id, section, `${projectName}|GLOBAL|${section}`);
      }
    }
  }
  for (const partName of ["Façade maritime de la Muraille", "Muraille — Partie 2", "Tranche IX"]) {
    const group = await ensureGroup(murailles.id, MURAILLES, parts.get(partName) ?? null);
    for (const section of [PHOTO, VIDEO]) {
      await ensureSection(group.id, section, `${MURAILLES}|${partName}|${section}`);
    }
  }

  const folderIds = new Map<string, string>();
  async function ensureFolderPath(sectionId: string, names: string[]) {
    let parentId: string | null = null;
    const built: string[] = [];
    for (const name of names) {
      built.push(name);
      const key = `${sectionId}|${built.join("/")}`;
      const cached = folderIds.get(key);
      if (cached) {
        parentId = cached;
        continue;
      }
      const existing: { id: string } | null = await db.folder.findFirst({
        where: { sectionId, parentId, name },
        select: { id: true },
      });
      if (existing) {
        folderIds.set(key, existing.id);
        structure[`folder:${key}`] = structure[`folder:${key}`] ?? "reused";
        parentId = existing.id;
        continue;
      }
      const created = await createFolder({ sectionId, parentId, name });
      folderIds.set(key, created.id);
      structure[`folder:${key}`] = "created";
      parentId = created.id;
    }
    return parentId;
  }

  for (const tree of FOLDER_TREES) {
    const partLabel = tree.part ?? "GLOBAL";
    const sectionId = sectionIds.get(`${tree.project}|${partLabel}|${tree.section}`);
    if (!sectionId) throw new Error(`Section manquante ${tree.project} ${partLabel} ${tree.section}`);
    for (const folders of tree.folders) await ensureFolderPath(sectionId, folders);
  }

  const manifest = JSON.parse(
    await readFile(path.resolve("reports/import/media-import-manifest.json"), "utf8"),
  ) as { files: ManifestFile[] };
  const ready = manifest.files.filter((file) => file.status === "READY");
  const skippedDuplicate = manifest.files.filter((file) => file.status === "DUPLICATE").length;

  let uploaded = 0;
  let alreadyImported = 0;
  let failed = 0;
  let sourceChanged = 0;
  let cloudinaryImages = 0;
  let cloudinaryVideos = 0;
  let b2Videos = 0;
  let bytesUploaded = 0;
  const failures: Array<{ path: string; error: string }> = [];
  const total = ready.length;

  for (let index = 0; index < ready.length; index += 1) {
    const file = ready[index];
    const absolute = path.join(MEDIA_ROOT, ...file.sourceRelativePath.split("/"));
    const done = index + 1;
    try {
      const info = await stat(absolute);
      if (info.size !== file.sizeBytes) {
        sourceChanged += 1;
        failures.push({ path: file.sourceRelativePath, error: "SOURCE_CHANGED size" });
        continue;
      }
      const sha256 = await hashFile(absolute);
      if (sha256 !== file.sha256) {
        sourceChanged += 1;
        failures.push({ path: file.sourceRelativePath, error: "SOURCE_CHANGED hash" });
        continue;
      }

      const partLabel = !file.targetPart || file.targetPart === "GLOBAL" ? "GLOBAL" : file.targetPart;
      const sectionId = sectionIds.get(`${file.targetProject}|${partLabel}|${file.targetSection}`);
      if (!sectionId || !file.targetProject || !file.targetSection) {
        failed += 1;
        failures.push({ path: file.sourceRelativePath, error: "missing_section" });
        continue;
      }
      const folderId = await ensureFolderPath(sectionId, file.targetFolders);
      if (!folderId) {
        failed += 1;
        failures.push({ path: file.sourceRelativePath, error: "missing_folder" });
        continue;
      }

      const existing = await db.file.findFirst({
        where: {
          sectionId,
          folderId,
          originalName: file.filename,
          size: file.sizeBytes,
        },
        select: { id: true, storageProvider: true },
      });
      if (existing) {
        alreadyImported += 1;
        continue;
      }

      const mime = mimeFor(file.extension, file.detectedKind);
      const provider = resolveStorageProvider({
        fileName: file.filename,
        mimeType: mime,
        extension: file.extension,
        sizeBytes: file.sizeBytes,
      });
      if (provider !== file.expectedStorageProvider) {
        failed += 1;
        failures.push({
          path: file.sourceRelativePath,
          error: `provider ${provider} != manifest ${file.expectedStorageProvider}`,
        });
        continue;
      }

      const projectId = file.targetProject === CHATEAU ? chateau.id : murailles.id;
      const partId = partLabel === "GLOBAL" ? null : parts.get(partLabel) ?? null;
      const head = await headBytes(absolute);
      const source =
        provider === "BACKBLAZE_B2"
          ? { stream: createReadStream(absolute), sizeBytes: file.sizeBytes }
          : await readFile(absolute);

      const record = await createUploadedFile({
        userId: actorId,
        projectId,
        partId,
        sectionId,
        folderId,
        originalName: file.filename,
        mimeType: mime,
        sizeBytes: file.sizeBytes,
        source,
        headBytes: head,
      });
      if (record.storageProvider !== provider) {
        failed += 1;
        failures.push({ path: file.sourceRelativePath, error: "provider_mismatch_after_upload" });
        continue;
      }
      uploaded += 1;
      bytesUploaded += file.sizeBytes;
      if (provider === "CLOUDINARY" && file.detectedKind === "image") cloudinaryImages += 1;
      else if (provider === "CLOUDINARY") cloudinaryVideos += 1;
      else b2Videos += 1;
    } catch (error) {
      failed += 1;
      failures.push({
        path: file.sourceRelativePath,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`[media-import] failed ${file.sourceRelativePath}`);
    }
    if (done % 25 === 0 || done === total) {
      console.log(
        `[media-import] ${done}/${total} complete uploaded=${uploaded} already=${alreadyImported} failed=${failed} cloudinary=${cloudinaryImages + cloudinaryVideos} b2=${b2Videos} bytes=${bytesUploaded}`,
      );
    }
  }

  const mediaFiles = await db.file.findMany({
    where: { section: { group: { name: GROUP } } },
    select: {
      id: true,
      size: true,
      storageProvider: true,
      storageKey: true,
      section: {
        select: {
          name: true,
          group: { select: { project: { select: { name: true } }, part: { select: { name: true } } } },
        },
      },
      folder: { select: { name: true, parent: { select: { name: true, parent: { select: { name: true } } } } } },
    },
  });
  const docsStill = await db.file.count({ where: { id: { in: documentIds } } });
  const byArea: Record<string, number> = {};
  for (const file of mediaFiles) {
    const project = file.section.group.project.name;
    const part = file.section.group.part?.name;
    const top = file.folder?.parent?.parent?.name ?? file.folder?.parent?.name ?? file.folder?.name;
    let area = project;
    if (part === "Façade maritime de la Muraille") area = "Façade maritime";
    else if (part === "Muraille — Partie 2") area = "Muraille — Partie 2";
    else if (part === "Tranche IX") area = `Tranche IX / ${top ?? "?"}`;
    else if (project === CHATEAU) area = "Château";
    byArea[area] = (byArea[area] ?? 0) + 1;
  }

  const cloud = await cloudinaryByType("saf/");
  const b2 = await listB2("saf/");
  const dbKeys = new Set(
    (
      await db.file.findMany({ select: { storageKey: true } })
    ).map((row) => row.storageKey),
  );

  const pass = {
    uploaded,
    alreadyImported,
    failed,
    sourceChanged,
    skippedDuplicates: skippedDuplicate,
    cloudinaryImages,
    cloudinaryVideos,
    b2Videos,
    bytesUploaded,
    mediaCount: mediaFiles.length,
    totalFiles: await db.file.count(),
    documentsPreserved: docsStill,
    b2Objects: b2.count,
    cloudinary: cloud,
  };
  let previous: { firstPass?: typeof pass; retry?: typeof pass | null } = {};
  try {
    previous = JSON.parse(await readFile(REPORT_JSON, "utf8"));
  } catch {
    previous = {};
  }
  const firstPass = previous.firstPass ?? pass;
  const retry = previous.firstPass ? pass : null;

  const report = {
    generatedAt: new Date().toISOString(),
    actorEmail: actor.email,
    structure,
    readySourceCount: ready.length,
    firstPass,
    retry,
    byArea,
    failures,
    b2: {
      objectCount: b2.count,
      bytes: b2.bytes,
      keysMissingFromDb: b2.keys.filter((key) => !dbKeys.has(key)).length,
      dbKeysMissingFromB2: [...dbKeys].filter((key) => key.startsWith("saf/") && !b2.keys.includes(key)).length,
    },
    cloudinary: cloud,
  };
  await mkdir(path.dirname(REPORT_JSON), { recursive: true });
  await writeFile(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");
  const lines = [
    "Live media import",
    `READY: ${ready.length}`,
    `This pass uploaded: ${uploaded}`,
    `This pass already imported: ${alreadyImported}`,
    `Cloudinary images this pass: ${cloudinaryImages}`,
    `Cloudinary videos this pass: ${cloudinaryVideos}`,
    `B2 videos this pass: ${b2Videos}`,
    `Skipped duplicates: ${skippedDuplicate}`,
    `Source changed: ${sourceChanged}`,
    `Failed: ${failed}`,
    `Bytes uploaded this pass: ${bytesUploaded}`,
    `DB media files: ${mediaFiles.length}`,
    `DB total files: ${pass.totalFiles}`,
    `Documents preserved: ${docsStill}/${documentIds.length}`,
    `Cloudinary saf/ image=${cloud.image} video=${cloud.video} raw=${cloud.raw}`,
    `B2 saf/ objects: ${b2.count}`,
    `By area: ${JSON.stringify(byArea)}`,
    `Retry: ${retry ? "yes" : "first pass"}`,
    "",
    "Failures:",
    ...failures.map((row) => `- ${row.path}: ${row.error}`),
  ];
  await writeFile(REPORT_TXT, lines.join("\n") + "\n", "utf8");
  console.log(lines.join("\n"));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
