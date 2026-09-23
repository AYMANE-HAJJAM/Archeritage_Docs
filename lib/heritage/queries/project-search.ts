import "server-only";

import { db } from "@/lib/db";
import {
  assertProjectAccess,
  canManagePlatform,
  type AccessUser,
} from "@/lib/access";
import { HttpError } from "@/lib/http";
import { folderTrail, normalizeSearchText } from "@/lib/utils";
import {
  sectionFolderPath,
  sectionQueryPath,
} from "@/lib/heritage/config/structure";

const SECTION_LIMIT = 5;
const DOCUMENT_LIMIT = 10;
const FOLDER_LIMIT = 5;

export type HeritageSearchSectionHit = {
  type: "section";
  id: string;
  code: string;
  title: string;
  groupLabel: string | null;
  href: string;
};

export type HeritageSearchDocumentHit = {
  type: "document";
  id: string;
  displayName: string;
  extension: string;
  mimeType: string;
  size: number;
  storageProvider: "CLOUDINARY" | "BACKBLAZE_B2";
  sectionCode: string | null;
  sectionTitle: string | null;
  pathLabel: string | null;
  href: string;
};

export type HeritageSearchFolderHit = {
  type: "folder";
  id: string;
  name: string;
  pathLabel: string | null;
  href: string;
};

export type HeritageProjectSearchResult = {
  q: string;
  sections: HeritageSearchSectionHit[];
  documents: HeritageSearchDocumentHit[];
  folders: HeritageSearchFolderHit[];
  totals: {
    sections: number;
    documents: number;
    folders: number;
  };
};

/**
 * In-project search for heritage dossiers (Château / Murailles).
 * Searches sections, documentary folders (any depth), and documents.
 */
export async function searchHeritageProject(
  user: AccessUser,
  projectSlug: string,
  rawQuery: string,
): Promise<HeritageProjectSearchResult> {
  const q = rawQuery.trim().slice(0, 180);
  const empty: HeritageProjectSearchResult = {
    q,
    sections: [],
    documents: [],
    folders: [],
    totals: { sections: 0, documents: 0, folders: 0 },
  };
  if (q.length < 2) return empty;

  const project = await db.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true, slug: true, isActive: true, name: true },
  });
  if (!project || !project.isActive) {
    throw new HttpError(404, "Projet introuvable.");
  }

  await assertProjectAccess(user, project.id);

  const needle = normalizeSearchText(q);
  const isAdmin = canManagePlatform(user);

  const [sectionRows, fileRows, folderRows] = await Promise.all([
    db.heritageSection.findMany({
      where: { projectId: project.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        group: { select: { label: true } },
      },
    }),
    db.file.findMany({
      where: {
        projectId: project.id,
        ...(isAdmin ? {} : { confidentialite: { not: "CONFIDENTIEL" } }),
      },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: 400,
      select: {
        id: true,
        displayName: true,
        originalName: true,
        extension: true,
        mimeType: true,
        size: true,
        storageProvider: true,
        folderId: true,
        docTitle: true,
        docAuteur: true,
        docSource: true,
        docCategorie: true,
        documentScope: true,
        confidentialite: true,
      },
    }),
    db.folder.findMany({
      where: {
        projectId: project.id,
        heritageSectionId: { not: null },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        parentId: true,
        heritageSectionId: true,
        heritageSection: { select: { code: true, title: true } },
      },
    }),
  ]);

  const sectionTitleByCode = new Map(
    sectionRows.map((s) => [s.code, s.title] as const),
  );

  const folderRefs = folderRows.map((f) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
  }));

  const matchedSections = sectionRows.filter((section) => {
    const haystack = normalizeSearchText(
      [
        section.code,
        section.title,
        section.description ?? "",
        section.group?.label ?? "",
      ].join(" "),
    );
    return haystack.includes(needle);
  });

  const matchedDocuments = fileRows.filter((file) => {
    const haystack = normalizeSearchText(
      [
        file.displayName,
        file.originalName,
        file.docTitle ?? "",
        file.docAuteur ?? "",
        file.docSource ?? "",
        file.docCategorie ?? "",
      ].join(" "),
    );
    return haystack.includes(needle);
  });

  const matchedFolders = folderRows.filter((folder) =>
    normalizeSearchText(folder.name).includes(needle),
  );

  const sections: HeritageSearchSectionHit[] = matchedSections
    .slice(0, SECTION_LIMIT)
    .map((section) => ({
      type: "section" as const,
      id: section.id,
      code: section.code,
      title: section.title,
      groupLabel: section.group?.label ?? null,
      href: sectionQueryPath(project.slug, section.code),
    }));

  const documents: HeritageSearchDocumentHit[] = matchedDocuments
    .slice(0, DOCUMENT_LIMIT)
    .map((file) => {
      const sectionCode =
        file.documentScope === "PROJECT_SECTION" && file.docCategorie
          ? file.docCategorie
          : null;
      const sectionTitle = sectionCode
        ? (sectionTitleByCode.get(sectionCode) ?? null)
        : null;

      const trail = file.folderId
        ? folderTrail(file.folderId, folderRefs)
        : [];
      const pathParts = [
        project.name,
        sectionCode && sectionTitle
          ? `${sectionCode} ${sectionTitle}`
          : sectionCode,
        ...trail.map((p) => p.name),
      ].filter(Boolean) as string[];

      let href: string;
      if (sectionCode && file.folderId && trail.length) {
        href = `${sectionFolderPath(project.slug, sectionCode, file.folderId)}&preview=${encodeURIComponent(file.id)}`;
      } else if (sectionCode) {
        href = `${sectionQueryPath(project.slug, sectionCode)}&preview=${encodeURIComponent(file.id)}`;
      } else {
        href = `/projects/${project.slug}/documents`;
      }

      return {
        type: "document" as const,
        id: file.id,
        displayName: file.displayName,
        extension: file.extension,
        mimeType: file.mimeType,
        size: file.size,
        storageProvider: file.storageProvider,
        sectionCode,
        sectionTitle,
        pathLabel: pathParts.join(" › ") || null,
        href,
      };
    });

  const folders: HeritageSearchFolderHit[] = matchedFolders
    .slice(0, FOLDER_LIMIT)
    .map((folder) => {
      const sectionCode = folder.heritageSection?.code;
      const sectionTitle = folder.heritageSection?.title;
      const trail = folderTrail(folder.id, folderRefs);
      const pathParts = [
        project.name,
        sectionCode && sectionTitle
          ? `${sectionCode} ${sectionTitle}`
          : sectionCode,
        ...trail.map((p) => p.name),
      ].filter(Boolean) as string[];

      const href =
        sectionCode
          ? sectionFolderPath(project.slug, sectionCode, folder.id)
          : `/projects/${project.slug}/documents`;

      return {
        type: "folder" as const,
        id: folder.id,
        name: folder.name,
        pathLabel: pathParts.join(" › ") || null,
        href,
      };
    });

  return {
    q,
    sections,
    documents,
    folders,
    totals: {
      sections: matchedSections.length,
      documents: matchedDocuments.length,
      folders: matchedFolders.length,
    },
  };
}
