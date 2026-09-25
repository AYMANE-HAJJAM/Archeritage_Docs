/**
 * Structure queries — DB is the only source of truth.
 * Rename policy: display name changes do NOT rewrite storage keys.
 */
import "server-only";

import { db } from "@/lib/db";
import { formatPersonName, type PersonNameSource } from "@/lib/users/display-name";
import { latestTimestamp, rollupFilesByPart, type PartFileRollup } from "@/lib/structure/overview";

async function noStore() {
  const { unstable_noStore } = await import("next/cache");
  unstable_noStore();
}

export type StructureSection = {
  id: string;
  name: string;
  code: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type StructureGroup = {
  id: string;
  name: string;
  sortOrder: number;
  partId: string | null;
  sections: StructureSection[];
};

export type StructurePart = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
};

export type ProjectStructure = {
  project: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isActive: boolean;
    territoire: { id: string; code: string; name: string } | null;
  };
  parts: StructurePart[];
  groups: StructureGroup[];
};

export async function getProjectBySlug(slug: string) {
  await noStore();
  return db.project.findUnique({
    where: { slug },
    include: {
      territoire: { select: { id: true, code: true, name: true, isActive: true } },
    },
  });
}

export async function getProjectStructure(
  projectId: string,
  options?: { partId?: string | null },
): Promise<ProjectStructure | null> {
  await noStore();
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      isActive: true,
      territoire: { select: { id: true, code: true, name: true } },
    },
  });
  if (!project) return null;

  const [parts, groups] = await Promise.all([
    db.part.findMany({
      where: { projectId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        sortOrder: true,
        isActive: true,
      },
    }),
    db.sectionGroup.findMany({
      where: {
        projectId,
        ...(options?.partId !== undefined
          ? { partId: options.partId }
          : {}),
      },
      orderBy: { sortOrder: "asc" },
      include: {
        sections: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            code: true,
            sortOrder: true,
            isActive: true,
          },
        },
      },
    }),
  ]);

  return {
    project,
    parts,
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      sortOrder: g.sortOrder,
      partId: g.partId,
      sections: g.sections,
    })),
  };
}

export async function getPartBySlug(projectId: string, slug: string) {
  await noStore();
  return db.part.findFirst({
    where: { projectId, slug },
    select: { id: true, name: true, slug: true, isActive: true },
  });
}

export type SectionFile = {
  id: string;
  displayName: string;
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  storageProvider: "CLOUDINARY" | "BACKBLAZE_B2";
  sectionId: string;
  folderId: string | null;
  createdAt: string;
  uploadedByName: string | null;
  /** Section / folder path shown under the filename. */
  location: string;
};

const PERSON_SELECT = {
  name: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

const FILE_SELECT = {
  id: true,
  displayName: true,
  originalName: true,
  extension: true,
  mimeType: true,
  size: true,
  storageProvider: true,
  sectionId: true,
  folderId: true,
  createdAt: true,
  uploadedBy: { select: PERSON_SELECT },
  folder: { select: { name: true } },
  section: { select: { name: true, code: true } },
} as const;

type RawFile = {
  id: string;
  displayName: string;
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  storageProvider: "CLOUDINARY" | "BACKBLAZE_B2";
  sectionId: string;
  folderId: string | null;
  createdAt: Date;
  uploadedBy: PersonNameSource | null;
  folder: { name: string } | null;
  section: { name: string; code: string | null };
};

function toSectionFile(file: RawFile): SectionFile {
  const uploader = formatPersonName(file.uploadedBy);
  return {
    id: file.id,
    displayName: file.displayName,
    originalName: file.originalName,
    extension: file.extension,
    mimeType: file.mimeType,
    size: file.size,
    storageProvider: file.storageProvider,
    sectionId: file.sectionId,
    folderId: file.folderId,
    createdAt: file.createdAt.toISOString(),
    uploadedByName: uploader === "—" ? null : uploader,
    location: [file.section.name, file.folder?.name].filter(Boolean).join(" › "),
  };
}

/** Files directly at a location: section root (folderId null) or one folder. */
export async function listSectionFiles(
  sectionId: string,
  folderId: string | null = null,
): Promise<SectionFile[]> {
  await noStore();
  const files = await db.file.findMany({
    where: { sectionId, folderId },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    select: FILE_SELECT,
  });
  return files.map(toSectionFile);
}

/** Every file of a project, ordered by section then name. */
export async function listProjectFiles(
  projectId: string,
): Promise<SectionFile[]> {
  await noStore();
  const files = await db.file.findMany({
    where: { section: { group: { projectId } } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: FILE_SELECT,
  });
  return files.map(toSectionFile);
}

export type SectionOperationalStats = {
  folderCount: number;
  fileCount: number;
  totalBytes: number;
  createdAt: string;
  createdByName: string;
  lastActivityAt: string;
};

export type WorkspaceMetrics = {
  sectionStats: Record<string, SectionOperationalStats>;
  fileCount: number;
  totalBytes: number;
  partRollups: Record<string, PartFileRollup>;
};

const SECTION_CREATED_ACTIONS = ["section.created", "SECTION_CREATED"] as const;

/**
 * Aggregated overview numbers for one project, optionally one Part.
 * When `partId` is null, only project-level (global) groups are included.
 * When omitted, every group of the project is included.
 */
export async function getWorkspaceMetrics(
  projectId: string,
  partId?: string | null,
): Promise<WorkspaceMetrics> {
  await noStore();
  const groupWhere = {
    projectId,
    ...(partId !== undefined ? { partId } : {}),
  };

  const [sections, fileGroups, folderGroups] = await Promise.all([
    db.section.findMany({
      where: { group: groupWhere },
      select: {
        id: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: PERSON_SELECT },
        group: { select: { partId: true } },
      },
    }),
    db.file.groupBy({
      by: ["sectionId"],
      where: { section: { group: groupWhere } },
      _count: { _all: true },
      _sum: { size: true },
      _max: { createdAt: true, updatedAt: true },
    }),
    db.folder.groupBy({
      by: ["sectionId"],
      where: { section: { group: groupWhere } },
      _count: { _all: true },
      _max: { createdAt: true, updatedAt: true },
    }),
  ]);

  const fileBySection = new Map(fileGroups.map((row) => [row.sectionId, row]));
  const folderBySection = new Map(folderGroups.map((row) => [row.sectionId, row]));

  const missingCreatorIds = sections
    .filter((section) => section.isActive && !section.createdBy)
    .map((section) => section.id);

  const creationLogs = missingCreatorIds.length
    ? await db.auditLog.findMany({
        where: {
          entityType: "Section",
          entityId: { in: missingCreatorIds },
          action: { in: [...SECTION_CREATED_ACTIONS] },
        },
        orderBy: { createdAt: "asc" },
        select: {
          entityId: true,
          actor: { select: PERSON_SELECT },
        },
      })
    : [];

  const creatorFromAudit = new Map<string, PersonNameSource | null>();
  for (const log of creationLogs) {
    if (!log.entityId || creatorFromAudit.has(log.entityId)) continue;
    creatorFromAudit.set(log.entityId, log.actor);
  }

  const sectionStats: Record<string, SectionOperationalStats> = {};
  for (const section of sections) {
    if (!section.isActive) continue;
    const files = fileBySection.get(section.id);
    const folders = folderBySection.get(section.id);
    const lastActivity = latestTimestamp([
      section.updatedAt,
      files?._max.createdAt,
      files?._max.updatedAt,
      folders?._max.createdAt,
      folders?._max.updatedAt,
    ]);
    const createdByName = section.createdBy
      ? formatPersonName(section.createdBy)
      : formatPersonName(creatorFromAudit.get(section.id));
    sectionStats[section.id] = {
      folderCount: folders?._count._all ?? 0,
      fileCount: files?._count._all ?? 0,
      totalBytes: files?._sum.size ?? 0,
      createdAt: section.createdAt.toISOString(),
      createdByName,
      lastActivityAt: (lastActivity ?? section.updatedAt).toISOString(),
    };
  }

  let fileCount = 0;
  let totalBytes = 0;
  const fileRows: { sectionId: string; fileCount: number; totalBytes: number }[] = [];
  for (const row of fileGroups) {
    const bytes = row._sum.size ?? 0;
    fileCount += row._count._all;
    totalBytes += bytes;
    fileRows.push({
      sectionId: row.sectionId,
      fileCount: row._count._all,
      totalBytes: bytes,
    });
  }

  return {
    sectionStats,
    fileCount,
    totalBytes,
    partRollups: rollupFilesByPart(
      fileRows,
      new Map(sections.map((section) => [section.id, section.group.partId])),
    ),
  };
}

export async function getSectionById(sectionId: string) {
  await noStore();
  return db.section.findUnique({
    where: { id: sectionId },
    include: {
      group: {
        include: {
          project: {
            include: {
              territoire: { select: { id: true, code: true, name: true } },
            },
          },
          part: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
}

export function revalidateProjectStructure(projectSlug: string) {
  void import("next/cache")
    .then(({ revalidatePath }) => {
      revalidatePath(`/projects/${projectSlug}`);
      revalidatePath(`/projects/${projectSlug}/documents`);
      revalidatePath("/structure");
      revalidatePath("/projects");
    })
    .catch(() => undefined);
}
