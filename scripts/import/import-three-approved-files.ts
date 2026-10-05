/**
 * Import three approved Safi files through the UI upload service.
 * Reads source files only. Does not import CPS. Does not touch existing files.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { db } from "../../lib/db";
import { createSection, createSectionGroup } from "../../lib/structure/mutations";
import { createFolder } from "../../lib/structure/folders";
import { createUploadedFile } from "../../lib/files/create-uploaded-file";

const ADMIN_EMAIL = "naciri@archeritage.ma";
const PROJECT_NAME = "Murailles portugaises de Safi";
const TERRITOIRE_NAME = "Safi Patrimoine";
const PART_NAME = "Tranche IX";
const SOURCE_DIR = path.resolve("source_import/documents");

type Job = {
  filename: string;
  mimeType: string;
  partName: string | null;
  group: string;
  section: string;
  folders: string[];
};

const JOBS: Job[] = [
  {
    filename: "charte-Finale-30.09.09.pdf",
    mimeType: "application/pdf",
    partName: null,
    group: "RÉFÉRENCES & CADRE PATRIMONIAL",
    section: "Charte architecturale & urbanisme",
    folders: [],
  },
  {
    filename: "PLAQUETTE_MURAILLES_MEDINA_TRANCHE_IX_.pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    partName: PART_NAME,
    group: "CONSULTATION & PROJET",
    section: "Présentation & plaquette",
    folders: [],
  },
  {
    filename: "SAFI VU DU CIEL-اسفي من أعلى-SAFI from the sky.mp4",
    mimeType: "video/mp4",
    partName: null,
    group: "DOCUMENTATION VISUELLE",
    section: "Documentation vidéo",
    folders: ["Vues aériennes", "Médina de Safi"],
  },
];

async function tolerateRevalidate<T>(
  run: () => Promise<T>,
  reload: () => Promise<T | null>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const existing = await reload();
    if (existing) return existing;
    throw error;
  }
}

async function main() {
  const actor = await db.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true, status: true, role: true },
  });
  if (!actor || actor.status === "DISABLED") {
    throw new Error(`Importing user not found or disabled: ${ADMIN_EMAIL}`);
  }

  const project = await db.project.findFirst({
    where: { name: PROJECT_NAME, territoire: { name: TERRITOIRE_NAME } },
    select: { id: true, name: true, slug: true },
  });
  if (!project) throw new Error(`Project not found: ${PROJECT_NAME}`);

  const part = await db.part.findFirst({
    where: { projectId: project.id, name: PART_NAME },
    select: { id: true, name: true, slug: true },
  });
  if (!part) throw new Error(`Part not found: ${PART_NAME}`);

  const before = await db.file.findMany({ select: { id: true } });
  const beforeIds = new Set(before.map((file) => file.id));

  const structure: Record<string, "created" | "reused"> = {};

  async function ensureGroup(name: string, partId: string | null) {
    const existing = await db.sectionGroup.findFirst({
      where: { projectId: project!.id, name, partId },
    });
    const key = `group:${partId ? PART_NAME : "GLOBAL"}:${name}`;
    if (existing) {
      structure[key] = "reused";
      return existing;
    }
    const created = await tolerateRevalidate(
      () => createSectionGroup({ projectId: project!.id, partId, name }, actor!.id),
      () =>
        db.sectionGroup.findFirst({
          where: { projectId: project!.id, name, partId },
        }),
    );
    structure[key] = "created";
    return created;
  }

  async function ensureSection(groupId: string, name: string, scope: string) {
    const existing = await db.section.findFirst({ where: { groupId, name } });
    const key = `section:${scope}:${name}`;
    if (existing) {
      structure[key] = "reused";
      return existing;
    }
    const created = await tolerateRevalidate(
      () => createSection({ groupId, name }, actor!.id),
      () => db.section.findFirst({ where: { groupId, name } }),
    );
    structure[key] = "created";
    return created;
  }

  async function ensureFolder(sectionId: string, parentId: string | null, name: string) {
    const existing = await db.folder.findFirst({
      where: { sectionId, parentId, name },
    });
    const key = `folder:${sectionId}:${parentId ?? "root"}:${name}`;
    if (existing) {
      structure[key] = "reused";
      return existing;
    }
    const created = await createFolder({ sectionId, parentId, name }, actor!.id);
    structure[key] = "created";
    return created;
  }

  const results: Array<Record<string, unknown>> = [];

  for (const job of JOBS) {
    const absolute = path.join(SOURCE_DIR, job.filename);
    const info = await stat(absolute);
    const bytes = await readFile(absolute);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const partId = job.partName ? part.id : null;
    const group = await ensureGroup(job.group, partId);
    const scope = job.partName ?? "GLOBAL";
    const section = await ensureSection(group.id, job.section, scope);

    let folderId: string | null = null;
    for (const folderName of job.folders) {
      const folder = await ensureFolder(section.id, folderId, folderName);
      folderId = folder.id;
    }

    const duplicate = await db.file.findFirst({
      where: {
        sectionId: section.id,
        folderId,
        OR: [
          { sourceHash: sha256 },
          { originalName: job.filename, size: info.size },
        ],
      },
      select: {
        id: true,
        originalName: true,
        size: true,
        storageProvider: true,
        sourceHash: true,
      },
    });
    if (duplicate) {
      results.push({
        filename: job.filename,
        status: "skipped_duplicate",
        sha256,
        sizeBytes: info.size,
        fileId: duplicate.id,
        storageProvider: duplicate.storageProvider,
        scope,
        group: job.group,
        section: job.section,
        folders: job.folders,
      });
      continue;
    }

    const record = await createUploadedFile({
      userId: actor.id,
      projectId: project.id,
      partId,
      sectionId: section.id,
      folderId,
      originalName: job.filename,
      mimeType: job.mimeType,
      sizeBytes: info.size,
      source: bytes,
    });
    results.push({
      filename: job.filename,
      status: "uploaded",
      sha256,
      sizeBytes: info.size,
      fileId: record.id,
      storageProvider: record.storageProvider,
      storageKey: record.storageKey,
      uploadedById: record.uploadedById,
      createdAt: record.createdAt.toISOString(),
      scope,
      group: job.group,
      section: job.section,
      folders: job.folders,
    });
    console.log(`uploaded ${job.filename} → ${record.storageProvider}`);
  }

  const after = await db.file.findMany({ select: { id: true, originalName: true } });
  const afterIds = new Set(after.map((file) => file.id));
  const missing = [...beforeIds].filter((id) => !afterIds.has(id));
  const cps = after.filter((file) => /CPS_final/i.test(file.originalName));

  console.log(
    JSON.stringify(
      {
        actorEmail: actor.email,
        project: project.name,
        part: part.name,
        beforeCount: beforeIds.size,
        afterCount: after.length,
        missingExistingIds: missing.length,
        cpsMatches: cps.map((file) => file.originalName),
        structure,
        results,
      },
      null,
      2,
    ),
  );

  await db.$disconnect();
  if (missing.length > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
  await db.$disconnect().catch(() => undefined);
});
