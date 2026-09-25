/**
 * Resolve upload context from server-trusted identifiers only.
 * Client must NOT supply: uploadedById, storageKey, storageProvider.
 */
import "server-only";

import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { getFolderAncestry } from "@/lib/structure/folders";

export type UploadContext = {
  sectionId: string;
  folderId: string | null;
  projectId: string;
  projectSlug: string;
  territoireCode: string;
  partId: string | null;
  partSlug: string | null;
  sectionSegment: string;
  folderNames: string[];
};

export async function resolveUploadContext(input: {
  sectionId: string;
  folderId?: string | null;
}): Promise<UploadContext> {
  const section = await db.section.findUnique({
    where: { id: input.sectionId },
    include: {
      group: {
        include: {
          project: {
            include: {
              territoire: { select: { code: true } },
            },
          },
          part: { select: { id: true, slug: true } },
        },
      },
    },
  });
  if (!section || !section.isActive) {
    throw new HttpError(404, "Section introuvable.");
  }

  const project = section.group.project;
  if (!project.isActive) {
    throw new HttpError(403, "Ce projet n’est pas accessible.");
  }
  if (!project.territoire) {
    throw new HttpError(400, "Le projet n’est rattaché à aucun territoire.");
  }

  const folderId: string | null = input.folderId ?? null;
  let folderNames: string[] = [];

  if (folderId) {
    const folder = await db.folder.findUnique({
      where: { id: folderId },
      select: { id: true, sectionId: true },
    });
    if (!folder) throw new HttpError(404, "Dossier introuvable.");
    if (folder.sectionId !== section.id) {
      throw new HttpError(
        400,
        "Le dossier n’appartient pas à cette section.",
      );
    }
    const ancestry = await getFolderAncestry(folderId);
    folderNames = ancestry.map((f) => f.name);
  }

  return {
    sectionId: section.id,
    folderId,
    projectId: project.id,
    projectSlug: project.slug,
    territoireCode: project.territoire.code,
    partId: section.group.part?.id ?? null,
    partSlug: section.group.part?.slug ?? null,
    sectionSegment: section.code || section.id,
    folderNames,
  };
}
