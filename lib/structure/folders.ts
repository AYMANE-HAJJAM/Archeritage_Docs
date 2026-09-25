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

export async function createFolder(input: z.infer<typeof createFolderSchema>) {
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

  return db.folder.create({
    data: {
      name: data.name,
      sectionId: data.sectionId,
      parentId: data.parentId ?? null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
}

export async function renameFolder(folderId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new HttpError(400, "Nom requis.");

  const folder = await db.folder.findUnique({ where: { id: folderId } });
  if (!folder) throw new HttpError(404, "Dossier introuvable.");

  // Display rename only — parentId / sectionId / sortOrder unchanged.
  return db.folder.update({
    where: { id: folderId },
    data: { name: trimmed },
  });
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

export async function moveFolder(folderId: string, newParentId: string | null) {
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

  return db.folder.update({
    where: { id: folderId },
    data: { parentId: newParentId },
  });
}

export async function deleteFolderIfEmpty(folderId: string) {
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
