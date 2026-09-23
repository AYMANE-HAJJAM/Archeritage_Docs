/**
 * Shared documentary-folder types and pure helpers (safe for client + server).
 */

export type DocumentaryFolderRow = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  heritageSectionId: string;
  projectId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type FolderStats = {
  childFolderCount: number;
  documentCount: number;
  totalBytes: number;
  lastActivityAt: string | null;
};

export type DocumentaryFolderCard = DocumentaryFolderRow & FolderStats;

export type DocumentaryFolderTreeNode = DocumentaryFolderCard & {
  children: DocumentaryFolderTreeNode[];
};

export type DocumentaryBreadcrumbPart = {
  id: string | null;
  name: string;
  href: string | null;
};

/**
 * Pure cycle check: moving `folderId` under `newParentId` would create a cycle
 * if `newParentId` is the folder itself or any of its descendants.
 */
export function wouldCreateFolderCycle(
  folderId: string,
  newParentId: string | null,
  folders: { id: string; parentId: string | null }[],
): boolean {
  if (!newParentId) return false;
  if (newParentId === folderId) return true;
  const byId = new Map(folders.map((f) => [f.id, f]));
  let current: string | null = newParentId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    if (current === folderId) return true;
    seen.add(current);
    current = byId.get(current)?.parentId ?? null;
  }
  return false;
}

function maxDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

type FileLite = {
  folderId: string | null;
  size: number;
  updatedAt: Date;
  createdAt: Date;
};

function buildChildrenMap(
  folders: { id: string; parentId: string | null }[],
): Map<string | null, string[]> {
  const map = new Map<string | null, string[]>();
  for (const folder of folders) {
    const key = folder.parentId;
    const list = map.get(key) ?? [];
    list.push(folder.id);
    map.set(key, list);
  }
  return map;
}

function collectDescendantIds(
  rootId: string,
  childrenMap: Map<string | null, string[]>,
): Set<string> {
  const out = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const child of childrenMap.get(id) ?? []) {
      if (!out.has(child)) {
        out.add(child);
        stack.push(child);
      }
    }
  }
  return out;
}

export function computeFolderStats(
  folderId: string,
  folders: { id: string; parentId: string | null }[],
  files: FileLite[],
): FolderStats {
  const childrenMap = buildChildrenMap(folders);
  const descendantIds = collectDescendantIds(folderId, childrenMap);
  const directChildren = childrenMap.get(folderId) ?? [];
  let documentCount = 0;
  let totalBytes = 0;
  let lastActivityAt: Date | null = null;
  for (const file of files) {
    if (!file.folderId || !descendantIds.has(file.folderId)) continue;
    documentCount += 1;
    totalBytes += file.size;
    lastActivityAt = maxDate(
      lastActivityAt,
      maxDate(file.updatedAt, file.createdAt),
    );
  }
  return {
    childFolderCount: directChildren.length,
    documentCount,
    totalBytes,
    lastActivityAt: toIso(lastActivityAt),
  };
}
