import "server-only";

import { db } from "@/lib/db";
import { assertProjectAccess, requireActiveUser } from "@/lib/access";
import { resolvePlacement } from "@/lib/heritage/document-placement";
import {
  allHeritageSections,
} from "@/lib/heritage/config/structure";
import { getHeritageStructure } from "@/lib/heritage/queries/structure";

export type ProjectDocumentRow = {
  id: string;
  displayName: string;
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  storageProvider: "CLOUDINARY" | "BACKBLAZE_B2";
  folderId: string;
  createdAt: string;
  updatedAt: string;
  location: string;
  docCategorie: string | null;
  documentScope: "PROJECT_SECTION" | "TERRITORY" | "SHARED_RESOURCE" | null;
  docStatut: string | null;
  docVersion: string | null;
  confidentialite: string;
  sectionCode: string | null;
  sectionLabel: string;
  placementGroup: "heritage" | "project";
};

export type ProjectDocumentsData = {
  project: {
    id: string;
    slug: string;
    name: string;
    territoireCode: string | null;
  };
  summary: {
    total: number;
    totalBytes: number;
    heritage: number;
    projectLevel: number;
    classified: number;
    lastActivityAt: string | null;
  };
  documents: ProjectDocumentRow[];
  sectionOptions: { code: string; name: string }[];
  typeOptions: string[];
  statusOptions: string[];
  versionOptions: string[];
  hasAnyStatus: boolean;
  hasAnyVersion: boolean;
};

export async function getProjectDocumentsIndex(
  slug: string,
): Promise<ProjectDocumentsData | null> {
  const user = await requireActiveUser();

  const project = await db.project.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      territoire: { select: { code: true } },
    },
  });
  if (!project) return null;

  await assertProjectAccess(user, project.id);

  const structure = await getHeritageStructure(slug);
  const sectionMap = new Map(
    structure
      ? allHeritageSections(structure).map((section) => [
          section.code,
          `${section.code} ${section.name}`,
        ])
      : [],
  );
  const sectionOptions = structure
    ? allHeritageSections(structure).map((section) => ({
        code: section.code,
        name: section.name,
      }))
    : [];

  const [files, agg] = await Promise.all([
    db.file.findMany({
      where: { projectId: project.id },
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
        updatedAt: true,
        docCategorie: true,
        documentScope: true,
        docStatut: true,
        docVersion: true,
        confidentialite: true,
      },
    }),
    db.file.aggregate({
      where: { projectId: project.id },
      _sum: { size: true },
      _max: { updatedAt: true },
      _count: true,
    }),
  ]);

  let heritage = 0;
  let projectLevel = 0;
  const typeSet = new Set<string>();
  const statusSet = new Set<string>();
  const versionSet = new Set<string>();

  const documents: ProjectDocumentRow[] = files.map((file) => {
    const heritageLabel =
      file.docCategorie && sectionMap.has(file.docCategorie)
        ? sectionMap.get(file.docCategorie)!
        : null;
    const placement = resolvePlacement(
      file.documentScope,
      file.docCategorie,
      heritageLabel,
    );

    if (placement.group === "heritage") heritage += 1;
    else projectLevel += 1;

    const ext = (file.extension || "").toLowerCase();
    if (ext) typeSet.add(ext);
    if (file.docStatut) statusSet.add(file.docStatut);
    if (file.docVersion) versionSet.add(file.docVersion);

    return {
      id: file.id,
      displayName: file.displayName,
      originalName: file.originalName,
      extension: file.extension,
      mimeType: file.mimeType,
      size: file.size,
      storageProvider: file.storageProvider,
      folderId: file.folderId,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      location: "",
      docCategorie: file.docCategorie,
      documentScope: file.documentScope,
      docStatut: file.docStatut,
      docVersion: file.docVersion,
      confidentialite: file.confidentialite,
      sectionCode:
        placement.group === "heritage" ? placement.category : null,
      sectionLabel: placement.label,
      placementGroup: placement.group,
    };
  });

  return {
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      territoireCode: project.territoire?.code ?? null,
    },
    summary: {
      total: agg._count,
      totalBytes: agg._sum.size ?? 0,
      heritage,
      projectLevel,
      classified: heritage,
      lastActivityAt: agg._max.updatedAt?.toISOString() ?? null,
    },
    documents,
    sectionOptions,
    typeOptions: [...typeSet].sort(),
    statusOptions: [...statusSet].sort(),
    versionOptions: [...versionSet].sort(),
    hasAnyStatus: statusSet.size > 0,
    hasAnyVersion: versionSet.size > 0,
  };
}
