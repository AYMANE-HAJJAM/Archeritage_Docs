"use server";

import { requireAdmin } from "@/lib/access";
import {
  getDocumentaryFolderTree,
  type DocumentaryFolderTreeNode,
} from "@/lib/heritage/documentary-folders";

export type DocumentaryFolderTreePayload = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  heritageSectionId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  childFolderCount: number;
  documentCount: number;
  totalBytes: number;
  lastActivityAt: string | null;
  children: DocumentaryFolderTreePayload[];
};

function serialize(
  nodes: DocumentaryFolderTreeNode[],
): DocumentaryFolderTreePayload[] {
  return nodes.map((n) => ({
    id: n.id,
    name: n.name,
    description: n.description,
    parentId: n.parentId,
    heritageSectionId: n.heritageSectionId,
    projectId: n.projectId,
    createdAt:
      n.createdAt instanceof Date
        ? n.createdAt.toISOString()
        : String(n.createdAt),
    updatedAt:
      n.updatedAt instanceof Date
        ? n.updatedAt.toISOString()
        : String(n.updatedAt),
    childFolderCount: n.childFolderCount,
    documentCount: n.documentCount,
    totalBytes: n.totalBytes,
    lastActivityAt: n.lastActivityAt,
    children: serialize(n.children),
  }));
}

export async function loadDocumentaryFolderTreeAction(
  heritageSectionId: string,
): Promise<{ tree?: DocumentaryFolderTreePayload[]; error?: string }> {
  try {
    await requireAdmin();
    if (!heritageSectionId) {
      return { error: "Rubrique manquante." };
    }
    const tree = await getDocumentaryFolderTree(heritageSectionId);
    return { tree: serialize(tree) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Impossible de charger les dossiers.",
    };
  }
}
