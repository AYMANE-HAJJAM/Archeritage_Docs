/**
 * Server-side loader shared by the project root page and the Part pages.
 * Resolves the optional ?sectionId / ?folderId selection into everything the
 * workspace UI needs.
 */
import "server-only";

import { db } from "@/lib/db";
import {
  getFolderAncestry,
  listFolderOverviews,
  listSectionFolderPaths,
} from "@/lib/structure/folders";
import {
  getProjectStructure,
  getWorkspaceMetrics,
  listSectionFiles,
  type ProjectStructure,
  type SectionFile,
  type SectionOperationalStats,
  type StructureGroup,
} from "@/lib/structure/queries";
import type { PartFileRollup } from "@/lib/structure/overview";
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
  sectionStats: Record<string, SectionOperationalStats>;
  partRollups: Record<string, PartFileRollup>;
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
  const structureFilter =
    options.partId !== undefined ? { partId: options.partId } : {};
  const [structure, metrics] = await Promise.all([
    getProjectStructure(projectId, structureFilter),
    getWorkspaceMetrics(projectId, options.partId),
  ]);
  if (!structure) return null;

  const groups = structure.groups;
  const summary = {
    sectionCount: groups.reduce((n, g) => n + g.sections.length, 0),
    fileCount: metrics.fileCount,
    totalBytes: metrics.totalBytes,
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
      return {
        structure,
        groups,
        sectionStats: metrics.sectionStats,
        partRollups: metrics.partRollups,
        summary,
        selection: null,
      };
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
      listFolderOverviews(section.id, currentFolderId),
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
      folders: children,
      documents,
      moveTargets: [
        { id: null, label: "Racine de la rubrique" },
        ...folderPaths.filter((f) => f.id !== currentFolderId),
      ],
    };
  }

  return {
    structure,
    groups,
    sectionStats: metrics.sectionStats,
    partRollups: metrics.partRollups,
    summary,
    selection,
  };
}
