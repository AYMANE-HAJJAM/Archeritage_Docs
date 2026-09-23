import "server-only";

import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { folderTrail, type FolderRef } from "@/lib/utils";
import { nameSchema } from "@/lib/validation/file";
import {
  computeFolderStats,
  wouldCreateFolderCycle,
  type DocumentaryBreadcrumbPart,
  type DocumentaryFolderCard,
  type DocumentaryFolderRow,
  type DocumentaryFolderTreeNode,
} from "@/lib/heritage/documentary-folder-types";

export {
  computeFolderStats,
  wouldCreateFolderCycle,
  type DocumentaryBreadcrumbPart,
  type DocumentaryFolderCard,
  type DocumentaryFolderRow,
  type DocumentaryFolderTreeNode,
  type FolderStats,
} from "@/lib/heritage/documentary-folder-types";

export const IMPORT_FOLDER_NAME = "__imports__";

async function loadSectionFolderGraph(heritageSectionId: string) {
  const [folders, files] = await Promise.all([
    db.folder.findMany({
      where: { heritageSectionId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        parentId: true,
        heritageSectionId: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.file.findMany({
      where: {
        folder: { heritageSectionId },
      },
      select: {
        folderId: true,
        size: true,
        updatedAt: true,
        createdAt: true,
      },
    }),
  ]);
  return {
    folders: folders.filter(
      (f): f is typeof f & { heritageSectionId: string } =>
        Boolean(f.heritageSectionId),
    ),
    files,
  };
}

export async function getDocumentaryFolder(
  folderId: string,
): Promise<DocumentaryFolderRow | null> {
  const folder = await db.folder.findUnique({
    where: { id: folderId },
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
      heritageSectionId: true,
      projectId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!folder?.heritageSectionId) return null;
  return {
    ...folder,
    heritageSectionId: folder.heritageSectionId,
  };
}

export async function assertDocumentaryFolder(
  folderId: string,
  opts?: { projectId?: string; heritageSectionId?: string },
): Promise<DocumentaryFolderRow> {
  const folder = await getDocumentaryFolder(folderId);
  if (!folder) {
    throw new HttpError(404, "Dossier documentaire introuvable.");
  }
  if (opts?.projectId && folder.projectId !== opts.projectId) {
    throw new HttpError(404, "Dossier documentaire introuvable.");
  }
  if (
    opts?.heritageSectionId &&
    folder.heritageSectionId !== opts.heritageSectionId
  ) {
    throw new HttpError(
      400,
      "Ce dossier n’appartient pas à cette rubrique patrimoniale.",
    );
  }
  return folder;
}

export async function listDocumentaryFoldersAt(input: {
  heritageSectionId: string;
  parentId: string | null;
}): Promise<DocumentaryFolderCard[]> {
  const { folders, files } = await loadSectionFolderGraph(
    input.heritageSectionId,
  );
  const direct = folders.filter((f) => f.parentId === input.parentId);
  return direct.map((folder) => ({
    ...folder,
    ...computeFolderStats(folder.id, folders, files),
  }));
}

export async function getDocumentaryFolderTree(
  heritageSectionId: string,
): Promise<DocumentaryFolderTreeNode[]> {
  const { folders, files } = await loadSectionFolderGraph(heritageSectionId);
  const byParent = new Map<string | null, typeof folders>();
  for (const folder of folders) {
    const list = byParent.get(folder.parentId) ?? [];
    list.push(folder);
    byParent.set(folder.parentId, list);
  }

  function build(parentId: string | null): DocumentaryFolderTreeNode[] {
    return (byParent.get(parentId) ?? []).map((folder) => ({
      ...folder,
      ...computeFolderStats(folder.id, folders, files),
      children: build(folder.id),
    }));
  }

  return build(null);
}

export async function countDocumentaryFoldersInSection(
  heritageSectionId: string,
): Promise<number> {
  return db.folder.count({ where: { heritageSectionId } });
}

export async function createDocumentaryFolder(input: {
  projectId: string;
  heritageSectionId: string;
  parentId: string | null;
  name: string;
  description?: string | null;
}): Promise<DocumentaryFolderRow> {
  const name = nameSchema.parse(input.name.trim());
  const description = input.description?.trim() || null;

  const section = await db.heritageSection.findFirst({
    where: { id: input.heritageSectionId, projectId: input.projectId },
    select: { id: true, projectId: true },
  });
  if (!section) throw new HttpError(404, "Rubrique patrimoniale introuvable.");

  if (input.parentId) {
    await assertDocumentaryFolder(input.parentId, {
      projectId: input.projectId,
      heritageSectionId: input.heritageSectionId,
    });
  }

  const created = await db.folder.create({
    data: {
      name,
      description,
      projectId: input.projectId,
      parentId: input.parentId,
      heritageSectionId: input.heritageSectionId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
      heritageSectionId: true,
      projectId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    ...created,
    heritageSectionId: created.heritageSectionId!,
  };
}

export async function renameDocumentaryFolder(input: {
  folderId: string;
  name: string;
  description?: string | null;
}): Promise<DocumentaryFolderRow> {
  const folder = await assertDocumentaryFolder(input.folderId);
  const name = nameSchema.parse(input.name.trim());
  const description =
    input.description === undefined
      ? folder.description
      : input.description?.trim() || null;

  const updated = await db.folder.update({
    where: { id: folder.id },
    data: { name, description },
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
      heritageSectionId: true,
      projectId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return {
    ...updated,
    heritageSectionId: updated.heritageSectionId!,
  };
}

export async function moveDocumentaryFolder(input: {
  folderId: string;
  /** null = section root */
  parentId: string | null;
}): Promise<DocumentaryFolderRow> {
  const folder = await assertDocumentaryFolder(input.folderId);

  if (input.parentId === folder.parentId) {
    return folder;
  }

  if (input.parentId) {
    await assertDocumentaryFolder(input.parentId, {
      projectId: folder.projectId,
      heritageSectionId: folder.heritageSectionId,
    });
  }

  const siblings = await db.folder.findMany({
    where: { heritageSectionId: folder.heritageSectionId },
    select: { id: true, parentId: true },
  });

  if (wouldCreateFolderCycle(folder.id, input.parentId, siblings)) {
    throw new HttpError(
      400,
      "Impossible de déplacer un dossier dans l’un de ses sous-dossiers.",
    );
  }

  const updated = await db.folder.update({
    where: { id: folder.id },
    data: { parentId: input.parentId },
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
      heritageSectionId: true,
      projectId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return {
    ...updated,
    heritageSectionId: updated.heritageSectionId!,
  };
}

export async function deleteDocumentaryFolder(folderId: string): Promise<void> {
  const folder = await assertDocumentaryFolder(folderId);

  await db.$transaction(async (tx) => {
    const live = await tx.folder.findUnique({
      where: { id: folder.id },
      include: { _count: { select: { files: true, children: true } } },
    });
    if (!live?.heritageSectionId) {
      throw new HttpError(404, "Dossier documentaire introuvable.");
    }
    if (live._count.files || live._count.children) {
      throw new HttpError(
        409,
        "Ce dossier n’est pas vide. Supprimez d’abord ses documents et sous-dossiers.",
      );
    }
    await tx.folder.delete({ where: { id: folder.id } });
  });
}

export async function getDocumentaryFolderBreadcrumb(input: {
  projectSlug: string;
  sectionCode: string;
  sectionTitle: string;
  folderId: string | null;
  territoryName?: string;
  dossierName?: string;
}): Promise<DocumentaryBreadcrumbPart[]> {
  const parts: DocumentaryBreadcrumbPart[] = [];
  if (input.territoryName) {
    parts.push({ id: null, name: input.territoryName, href: null });
  }
  if (input.dossierName) {
    parts.push({
      id: null,
      name: input.dossierName,
      href: `/projects/${input.projectSlug}`,
    });
  }
  parts.push({
    id: null,
    name: `${input.sectionCode} ${input.sectionTitle}`,
    href: `/projects/${input.projectSlug}?section=${encodeURIComponent(input.sectionCode)}`,
  });

  if (!input.folderId) return parts;

  const folder = await assertDocumentaryFolder(input.folderId);
  const sectionFolders = await db.folder.findMany({
    where: { heritageSectionId: folder.heritageSectionId },
    select: { id: true, name: true, parentId: true },
  });
  const trail = folderTrail(folder.id, sectionFolders as FolderRef[]);
  for (const step of trail) {
    parts.push({
      id: step.id,
      name: step.name,
      href: `/projects/${input.projectSlug}?section=${encodeURIComponent(input.sectionCode)}&folder=${encodeURIComponent(step.id)}`,
    });
  }
  return parts;
}

/** Resolve heritage section row id from project + code. */
export async function findHeritageSectionId(
  projectId: string,
  sectionCode: string,
): Promise<string | null> {
  const row = await db.heritageSection.findFirst({
    where: { projectId, code: sectionCode, isActive: true },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Validate an optional upload target folder under a heritage section.
 * Returns null for section-root uploads.
 */
export async function resolveDocumentaryUploadFolder(input: {
  projectId: string;
  heritageSectionId: string;
  folderId: string | null | undefined;
}): Promise<string | null> {
  if (!input.folderId) return null;
  const folder = await assertDocumentaryFolder(input.folderId, {
    projectId: input.projectId,
    heritageSectionId: input.heritageSectionId,
  });
  return folder.id;
}
