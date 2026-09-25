/**
 * Server-side loader shared by the project root page and the Part pages.
 * Resolves the optional ?sectionId / ?folderId selection into everything the
 * workspace UI needs.
 */
import "server-only";

import { db } from "@/lib/db";
import {
  getFolderAncestry,
  listFolderChildren,
  listSectionFolderPaths,
} from "@/lib/structure/folders";
import {
  countFilesBySection,
  getProjectStructure,
  listSectionFiles,
  type ProjectStructure,
  type SectionFile,
  type StructureGroup,
} from "@/lib/structure/queries";
import type { FolderCard, MoveTarget } from "@/components/heritage/documentary-folder-browser";

export type WorkspaceSelection = {
  section: { id: string; name: string; code: string | null; groupId: string };
  group: { id: string; name: string; partId: string | null };
  folderTrail: { id: string; name: string }[];
  currentFolderId: string | null;
  folders: FolderCard[];
  documents: SectionFile[];
  moveTargets: MoveTarget[];
};

export type WorkspaceData = {
  structure: ProjectStructure;
  groups: StructureGroup[];
  fileCounts: Record<string, number>;
  summary: { sectionCount: number; fileCount: number; totalBytes: number };
  selection: WorkspaceSelection | null;
};

/**
 * @param partId  `undefined` loads every group, `null` only project-level
 *                groups, a string only that Part's groups.
 */
export async function loadWorkspace(
  projectId: string,
  options: {
    partId?: string | null;
    sectionId?: string | null;
    folderId?: string | null;
  } = {},
): Promise<WorkspaceData | null> {
  const structure = await getProjectStructure(projectId, {
    ...(options.partId !== undefined ? { partId: options.partId } : {}),
  });
  if (!structure) return null;

  const [fileCounts, totals] = await Promise.all([
    countFilesBySection(projectId),
    db.file.aggregate({
      where: {
        section: {
          group: {
            projectId,
            ...(options.partId !== undefined ? { partId: options.partId } : {}),
          },
        },
      },
      _count: { _all: true },
      _sum: { size: true },
    }),
  ]);

  const groups = structure.groups;
  const summary = {
    sectionCount: groups.reduce((n, g) => n + g.sections.length, 0),
    fileCount: totals._count._all,
    totalBytes: totals._sum.size ?? 0,
  };

  let selection: WorkspaceSelection | null = null;
  if (options.sectionId) {
    const section = await db.section.findUnique({
      where: { id: options.sectionId },
      select: {
        id: true,
        name: true,
        code: true,
        groupId: true,
        isActive: true,
        group: {
          select: { id: true, name: true, partId: true, projectId: true },
        },
      },
    });
    if (!section || !section.isActive || section.group.projectId !== projectId) {
      return { structure, groups, fileCounts, summary, selection: null };
    }

    let currentFolderId: string | null = null;
    let folderTrail: { id: string; name: string }[] = [];
    if (options.folderId) {
      const trail = await getFolderAncestry(options.folderId);
      const last = trail[trail.length - 1];
      if (last && last.sectionId === section.id) {
        currentFolderId = last.id;
        folderTrail = trail.map((f) => ({ id: f.id, name: f.name }));
      }
    }

    const [children, documents, folderPaths] = await Promise.all([
      listFolderChildren(section.id, currentFolderId),
      listSectionFiles(section.id, currentFolderId),
      listSectionFolderPaths(section.id),
    ]);

    selection = {
      section: {
        id: section.id,
        name: section.name,
        code: section.code,
        groupId: section.groupId,
      },
      group: {
        id: section.group.id,
        name: section.group.name,
        partId: section.group.partId,
      },
      folderTrail,
      currentFolderId,
      folders: children.map((folder) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        childFolderCount: folder._count.children,
        documentCount: folder._count.files,
      })),
      documents,
      moveTargets: [
        { id: null, label: "Racine de la rubrique" },
        ...folderPaths.filter((f) => f.id !== currentFolderId),
      ],
    };
  }

  return { structure, groups, fileCounts, summary, selection };
}

/** Number of files under every section of a Part. */
export function partFileCount(
  groups: StructureGroup[],
  partId: string,
  fileCounts: Record<string, number>,
): number {
  return groups
    .filter((group) => group.partId === partId)
    .flatMap((group) => group.sections)
    .reduce((n, section) => n + (fileCounts[section.id] ?? 0), 0);
}
