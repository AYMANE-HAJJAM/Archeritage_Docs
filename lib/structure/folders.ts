/**
 * Folder tree mutations with integrity invariants.
 *
 * - Parent must belong to the same section
 * - Folder cannot parent itself
 * - Folder cannot move under a descendant
 * - Cross-section / cross-project moves rejected
 * - Non-empty folder cannot be deleted
 * - Rename does not change parent/order or storage keys
 */
import "server-only";

import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { AuditActions, writeAuditLog } from "@/lib/admin/audit";
import { formatPersonName } from "@/lib/users/display-name";
import { rollupFolderSubtrees } from "@/lib/structure/overview";
import {
  assertFolderMoveAllowed,
  FolderMoveError,
} from "@/lib/structure/folder-invariants";

export { assertFolderMoveAllowed } from "@/lib/structure/folder-invariants";

export const createFolderSchema = z.object({
  sectionId: z.string().min(1),
  parentId: z.string().optional().nullable(),
  name: z.string().trim().min(1).max(200),
});

async function assertSectionExists(sectionId: string) {
  const section = await db.section.findUnique({
    where: { id: sectionId },
    select: { id: true },
  });
  if (!section) throw new HttpError(404, "Section introuvable.");
}

export async function createFolder(
  input: z.infer<typeof createFolderSchema>,
  actorUserId?: string | null,
) {
  const data = createFolderSchema.parse(input);
  await assertSectionExists(data.sectionId);

  if (data.parentId) {
    const parent = await db.folder.findUnique({
      where: { id: data.parentId },
      select: { id: true, sectionId: true },
    });
    if (!parent) throw new HttpError(404, "Dossier parent introuvable.");
    if (parent.sectionId !== data.sectionId) {
      throw new HttpError(400, "Le dossier parent doit appartenir à la même section.");
    }
  }

  const maxOrder = await db.folder.aggregate({
    where: { sectionId: data.sectionId, parentId: data.parentId ?? null },
    _max: { sortOrder: true },
  });

  const folder = await db.folder.create({
    data: {
      name: data.name,
      sectionId: data.sectionId,
      parentId: data.parentId ?? null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      createdById: actorUserId || null,
    },
  });

  if (actorUserId) {
    await writeAuditLog({
      actorUserId,
      action: AuditActions.FOLDER_CREATED,
      entityType: "Folder",
      entityId: folder.id,
      metadata: { sectionId: data.sectionId, parentId: data.parentId ?? null, name: data.name },
    });
  }

  return folder;
}

export async function renameFolder(
  folderId: string,
  name: string,
  actorUserId?: string | null,
) {
  const trimmed = name.trim();
  if (!trimmed) throw new HttpError(400, "Nom requis.");

  const folder = await db.folder.findUnique({ where: { id: folderId } });
  if (!folder) throw new HttpError(404, "Dossier introuvable.");

  // Display rename only — parentId / sectionId / sortOrder unchanged.
  const updated = await db.folder.update({
    where: { id: folderId },
    data: { name: trimmed },
  });

  if (actorUserId) {
    await writeAuditLog({
      actorUserId,
      action: AuditActions.FOLDER_RENAMED,
      entityType: "Folder",
      entityId: folderId,
      metadata: { name: trimmed, sectionId: folder.sectionId },
    });
  }

  return updated;
}

/** Collect descendant folder IDs (BFS). */
export async function collectDescendantFolderIds(
  folderId: string,
): Promise<Set<string>> {
  const descendants = new Set<string>();
  const queue = [folderId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = await db.folder.findMany({
      where: { parentId: current },
      select: { id: true },
    });
    for (const child of children) {
      if (!descendants.has(child.id)) {
        descendants.add(child.id);
        queue.push(child.id);
      }
    }
  }
  return descendants;
}

export async function moveFolder(
  folderId: string,
  newParentId: string | null,
  actorUserId?: string | null,
) {
  const folder = await db.folder.findUnique({ where: { id: folderId } });
  if (!folder) throw new HttpError(404, "Dossier introuvable.");

  let parentSectionId: string | null | undefined;
  let descendants: Set<string> = new Set();
  if (newParentId) {
    const parent = await db.folder.findUnique({ where: { id: newParentId } });
    if (!parent) throw new HttpError(404, "Dossier parent introuvable.");
    parentSectionId = parent.sectionId;
    descendants = await collectDescendantFolderIds(folderId);
  }

  try {
    assertFolderMoveAllowed({
      folderId,
      newParentId,
      folderSectionId: folder.sectionId,
      parentSectionId,
      descendantIds: descendants,
    });
  } catch (error) {
    if (error instanceof FolderMoveError) {
      throw new HttpError(error.status, error.message);
    }
    throw error;
  }

  const updated = await db.folder.update({
    where: { id: folderId },
    data: { parentId: newParentId },
  });

  if (actorUserId) {
    await writeAuditLog({
      actorUserId,
      action: AuditActions.FOLDER_MOVED,
      entityType: "Folder",
      entityId: folderId,
      metadata: {
        sectionId: folder.sectionId,
        fromParentId: folder.parentId,
        toParentId: newParentId,
      },
    });
  }

  return updated;
}

export async function deleteFolderIfEmpty(
  folderId: string,
  actorUserId?: string | null,
) {
  const folder = await db.folder.findUnique({
    where: { id: folderId },
    include: {
      _count: { select: { children: true, files: true } },
    },
  });
  if (!folder) throw new HttpError(404, "Dossier introuvable.");
  if (folder._count.children > 0 || folder._count.files > 0) {
    throw new HttpError(409, "Impossible de supprimer un dossier non vide.");
  }

  await db.folder.delete({ where: { id: folderId } });

  if (actorUserId) {
    await writeAuditLog({
      actorUserId,
      action: AuditActions.FOLDER_DELETED,
      entityType: "Folder",
      entityId: folderId,
      metadata: { sectionId: folder.sectionId, name: folder.name },
    });
  }
}

const PERSON_SELECT = {
  name: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

export type FolderOverview = {
  id: string;
  name: string;
  parentId: string | null;
  childFolderCount: number;
  documentCount: number;
  totalBytes: number;
  createdByName: string;
  createdAt: string;
  lastActivityAt: string;
};

/**
 * Immediate child folders of one location, with subtree file totals.
 * Two queries for the whole section: folder metadata and file aggregates.
 */
export async function listFolderOverviews(
  sectionId: string,
  parentId: string | null,
): Promise<FolderOverview[]> {
  const [folders, fileGroups] = await Promise.all([
    db.folder.findMany({
      where: { sectionId },
      select: {
        id: true,
        name: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: PERSON_SELECT },
      },
    }),
    db.file.groupBy({
      by: ["folderId"],
      where: { sectionId },
      _count: { _all: true },
      _sum: { size: true },
      _max: { createdAt: true, updatedAt: true },
    }),
  ]);

  const stats = rollupFolderSubtrees(
    folders,
    fileGroups.map((row) => ({
      folderId: row.folderId,
      fileCount: row._count._all,
      totalBytes: row._sum.size ?? 0,
      createdAt: row._max.createdAt,
      updatedAt: row._max.updatedAt,
    })),
  );

  return folders
    .filter((folder) => folder.parentId === parentId)
    .map((folder) => {
      const subtree = stats.get(folder.id);
      return {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        childFolderCount: subtree?.childFolderCount ?? 0,
        documentCount: subtree?.fileCount ?? 0,
        totalBytes: subtree?.totalBytes ?? 0,
        createdByName: formatPersonName(folder.createdBy),
        createdAt: folder.createdAt.toISOString(),
        lastActivityAt: (subtree?.lastActivityAt ?? folder.updatedAt).toISOString(),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
}

export async function listFolderChildren(sectionId: string, parentId: string | null) {
  return db.folder.findMany({
    where: { sectionId, parentId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { children: true, files: true } },
    },
  });
}

/** Flat list of every folder in a section with its full path label. */
export async function listSectionFolderPaths(
  sectionId: string,
): Promise<{ id: string; label: string }[]> {
  const folders = await db.folder.findMany({
    where: { sectionId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, parentId: true },
  });

  const byParent = new Map<string | null, typeof folders>();
  for (const folder of folders) {
    const siblings = byParent.get(folder.parentId) ?? [];
    siblings.push(folder);
    byParent.set(folder.parentId, siblings);
  }

  const result: { id: string; label: string }[] = [];
  function walk(parentId: string | null, prefix: string) {
    for (const folder of byParent.get(parentId) ?? []) {
      const label = prefix ? `${prefix} › ${folder.name}` : folder.name;
      result.push({ id: folder.id, label });
      walk(folder.id, label);
    }
  }
  walk(null, "");
  return result;
}

export async function getFolderAncestry(folderId: string) {
  const chain: { id: string; name: string; sectionId: string }[] = [];
  let currentId: string | null = folderId;
  const seen = new Set<string>();

  while (currentId) {
    if (seen.has(currentId)) break;
    seen.add(currentId);
    const folder: {
      id: string;
      name: string;
      sectionId: string;
      parentId: string | null;
    } | null = await db.folder.findUnique({
      where: { id: currentId },
      select: { id: true, name: true, sectionId: true, parentId: true },
    });
    if (!folder) break;
    chain.unshift({
      id: folder.id,
      name: folder.name,
      sectionId: folder.sectionId,
    });
    currentId = folder.parentId;
  }
  return chain;
}
