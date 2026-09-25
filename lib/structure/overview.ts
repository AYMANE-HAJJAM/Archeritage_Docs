/**
 * Pure helpers for project overview totals.
 * File counts and sizes come from aggregated rows, never from loaded File records.
 */

export function latestTimestamp(
  dates: Array<Date | null | undefined>,
): Date | null {
  let latest: Date | null = null;
  for (const date of dates) {
    if (!date) continue;
    if (!latest || date.getTime() > latest.getTime()) latest = date;
  }
  return latest;
}

export type PartFileRollup = {
  fileCount: number;
  totalBytes: number;
};

export type FolderStatNode = {
  id: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FolderFileAggregate = {
  folderId: string | null;
  fileCount: number;
  totalBytes: number;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type FolderSubtreeStats = {
  fileCount: number;
  totalBytes: number;
  /** Immediate child folders, not the full descendant count. */
  childFolderCount: number;
  lastActivityAt: Date;
};

/**
 * File count and size for each folder, including nested descendants.
 * Files with no folder stay out of every folder total.
 */
export function rollupFolderSubtrees(
  folders: FolderStatNode[],
  files: FolderFileAggregate[],
): Map<string, FolderSubtreeStats> {
  const children = new Map<string | null, FolderStatNode[]>();
  for (const folder of folders) {
    const siblings = children.get(folder.parentId) ?? [];
    siblings.push(folder);
    children.set(folder.parentId, siblings);
  }
  const filesByFolder = new Map(
    files
      .filter((row) => row.folderId)
      .map((row) => [row.folderId as string, row]),
  );
  const cache = new Map<string, FolderSubtreeStats>();

  function visit(folder: FolderStatNode): FolderSubtreeStats {
    const cached = cache.get(folder.id);
    if (cached) return cached;
    const direct = filesByFolder.get(folder.id);
    const kids = children.get(folder.id) ?? [];
    let fileCount = direct?.fileCount ?? 0;
    let totalBytes = direct?.totalBytes ?? 0;
    let lastActivityAt = latestTimestamp([
      folder.createdAt,
      folder.updatedAt,
      direct?.createdAt,
      direct?.updatedAt,
    ]) ?? folder.updatedAt;
    for (const child of kids) {
      const nested = visit(child);
      fileCount += nested.fileCount;
      totalBytes += nested.totalBytes;
      if (nested.lastActivityAt.getTime() > lastActivityAt.getTime()) {
        lastActivityAt = nested.lastActivityAt;
      }
    }
    const stats = {
      fileCount,
      totalBytes,
      childFolderCount: kids.length,
      lastActivityAt,
    };
    cache.set(folder.id, stats);
    return stats;
  }

  for (const folder of folders) visit(folder);
  return cache;
}

/**
 * Sum file aggregates onto their Part.
 * Sections with no Part (project-level / global) are skipped.
 */
export function rollupFilesByPart(
  rows: { sectionId: string; fileCount: number; totalBytes: number }[],
  partIdBySection: ReadonlyMap<string, string | null>,
): Record<string, PartFileRollup> {
  const rollup: Record<string, PartFileRollup> = {};
  for (const row of rows) {
    const partId = partIdBySection.get(row.sectionId);
    if (!partId) continue;
    const current = rollup[partId] ?? { fileCount: 0, totalBytes: 0 };
    current.fileCount += row.fileCount;
    current.totalBytes += row.totalBytes;
    rollup[partId] = current;
  }
  return rollup;
}
