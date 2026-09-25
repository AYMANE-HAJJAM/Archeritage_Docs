/**
 * Structure queries — DB is the only source of truth.
 * Rename policy: display name changes do NOT rewrite storage keys.
 */
import "server-only";

import { db } from "@/lib/db";

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
  uploadedBy: { select: { name: true } },
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
  uploadedBy: { name: string } | null;
  folder: { name: string } | null;
  section: { name: string; code: string | null };
};

function toSectionFile(file: RawFile): SectionFile {
  const sectionLabel = file.section.code
    ? `${file.section.code} ${file.section.name}`
    : file.section.name;
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
    uploadedByName: file.uploadedBy?.name ?? null,
    location: [sectionLabel, file.folder?.name].filter(Boolean).join(" › "),
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

/** File counts keyed by sectionId, for structure tables. */
export async function countFilesBySection(
  projectId: string,
): Promise<Record<string, number>> {
  await noStore();
  const rows = await db.file.groupBy({
    by: ["sectionId"],
    where: { section: { group: { projectId } } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.sectionId, r._count._all]));
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
