import "server-only";

import { db } from "@/lib/db";
import { folderTrail } from "@/lib/utils";

export type SectionDocument = {
  id: string;
  displayName: string;
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  storageProvider: "CLOUDINARY" | "BACKBLAZE_B2";
  folderId: string | null;
  createdAt: string;
  location: string;
  docStatut: string | null;
  docVersion: string | null;
  uploadedByName: string | null;
};

/**
 * Documents visible at a given level inside a heritage section.
 * - folderId null → section root (not inside a documentary folder)
 * - folderId set → direct children of that documentary folder only
 */
export async function getSectionDocuments(
  projectSlug: string,
  sectionCode: string,
  folderId: string | null = null,
): Promise<SectionDocument[]> {
  const project = await db.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true, name: true },
  });
  if (!project) return [];

  const section = await db.heritageSection.findFirst({
    where: {
      projectId: project.id,
      code: sectionCode,
      isActive: true,
    },
    select: { id: true },
  });

  const documentaryFolderIds = section
    ? (
        await db.folder.findMany({
          where: { heritageSectionId: section.id },
          select: { id: true },
        })
      ).map((f) => f.id)
    : [];

  const [files, folders] = await Promise.all([
    db.file.findMany({
      where: {
        projectId: project.id,
        docCategorie: sectionCode,
        OR: [{ documentScope: "PROJECT_SECTION" }, { documentScope: null }],
        ...(folderId
          ? { folderId }
          : documentaryFolderIds.length
            ? {
                OR: [
                  { folderId: null },
                  { folderId: { notIn: documentaryFolderIds } },
                ],
              }
            : {}),
      },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      select: {
        id: true,
        displayName: true,
        originalName: true,
        extension: true,
        mimeType: true,
        size: true,
        storageProvider: true,
        folderId: true,
        createdAt: true,
        docStatut: true,
        docVersion: true,
        uploadedBy: { select: { name: true } },
      },
    }),
    db.folder.findMany({
      where: { projectId: project.id },
      select: { id: true, name: true, parentId: true },
    }),
  ]);

  return files.map((file) => ({
    id: file.id,
    displayName: file.displayName,
    originalName: file.originalName,
    extension: file.extension,
    mimeType: file.mimeType,
    size: file.size,
    storageProvider: file.storageProvider,
    folderId: file.folderId,
    createdAt: file.createdAt.toISOString(),
    docStatut: file.docStatut,
    docVersion: file.docVersion,
    uploadedByName: file.uploadedBy?.name ?? null,
    location:
      folderTrail(file.folderId, folders)
        .map((part) => part.name.replace(/^\d+\s+—\s+/, ""))
        .filter((name) => name !== "__imports__")
        .join(" › ") || project.name,
  }));
}
