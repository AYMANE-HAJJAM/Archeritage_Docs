import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { Explorer } from "@/components/documents/explorer";
import { HeritageWorkspace } from "@/components/heritage/heritage-workspace";
import {
  assertProjectAccess,
  getProjectPermissionsForUser,
  requireActiveUser,
} from "@/lib/access";
import { listStructureAdmin } from "@/lib/admin/structure";
import { db } from "@/lib/db";
import {
  assertDocumentaryFolder,
  findHeritageSectionId,
  getDocumentaryFolderBreadcrumb,
  getDocumentaryFolderTree,
  listDocumentaryFoldersAt,
} from "@/lib/heritage/documentary-folders";
import { getSectionDocuments } from "@/lib/heritage/queries/section-documents";
import { getProjectHeritageSummary } from "@/lib/heritage/queries/section-summaries";
import { getSectionStructuredData } from "@/lib/heritage/queries/section-structured";
import {
  findHeritageSection,
  isHeritageProject,
  sectionQueryPath,
  type HeritageSection,
} from "@/lib/heritage/config/structure";
import { getHeritageStructure } from "@/lib/heritage/queries/structure";
import { getLibrary, type Query } from "@/lib/documents/library";

type ProjectQuery = Query & { section?: string; edit?: string; folder?: string };

function flattenMoveTargets(
  tree: Awaited<ReturnType<typeof getDocumentaryFolderTree>>,
  excludeId: string | null,
): { id: string | null; label: string }[] {
  const targets: { id: string | null; label: string }[] = [
    { id: null, label: "Racine de la rubrique" },
  ];
  function walk(
    nodes: typeof tree,
    prefix: string,
  ) {
    for (const node of nodes) {
      if (excludeId && node.id === excludeId) continue;
      const label = prefix ? `${prefix} › ${node.name}` : node.name;
      targets.push({ id: node.id, label });
      if (node.children.length) walk(node.children, label);
    }
  }
  walk(tree, "");
  return targets;
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ProjectQuery>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  if (isHeritageProject(slug)) {
    const user = await requireActiveUser();

    const structure = await getHeritageStructure(slug);
    if (!structure) notFound();

    const project = await db.project.findUnique({
      where: { slug },
      select: {
        id: true,
        isActive: true,
        name: true,
        territoire: { select: { name: true } },
      },
    });
    if (!project || !project.isActive) notFound();

    await assertProjectAccess(user, project.id);
    const permissions = await getProjectPermissionsForUser(user, project.id);

    let selectedSection: HeritageSection | null = null;
    if (query.section) {
      selectedSection = findHeritageSection(structure, query.section);
      if (!selectedSection) notFound();
    }

    // Folder deep-link without section → send to documents index (legacy).
    if (query.folder && !selectedSection) {
      redirect(`/projects/${slug}/documents`);
    }

    const editMode =
      query.edit === "1" && permissions.canManageStructure && !selectedSection;

    let heritageSectionId: string | null = null;
    let currentFolderId: string | null = null;
    let folders: Awaited<ReturnType<typeof listDocumentaryFoldersAt>> = [];
    let breadcrumbParts: { name: string; href: string | null }[] = [];
    let moveTargets: { id: string | null; label: string }[] = [
      { id: null, label: "Racine de la rubrique" },
    ];

    if (selectedSection) {
      heritageSectionId = await findHeritageSectionId(
        project.id,
        selectedSection.code,
      );
      if (!heritageSectionId) notFound();

      if (query.folder) {
        const folder = await assertDocumentaryFolder(query.folder, {
          projectId: project.id,
          heritageSectionId,
        }).catch(() => null);
        if (!folder) {
          redirect(sectionQueryPath(slug, selectedSection.code));
        }
        currentFolderId = folder.id;
      }

      const [folderList, tree, crumbs] = await Promise.all([
        listDocumentaryFoldersAt({
          heritageSectionId,
          parentId: currentFolderId,
        }),
        getDocumentaryFolderTree(heritageSectionId),
        getDocumentaryFolderBreadcrumb({
          projectSlug: slug,
          sectionCode: selectedSection.code,
          sectionTitle: selectedSection.name,
          folderId: currentFolderId,
          territoryName: project.territoire?.name ?? "Safi Patrimoine",
          dossierName: structure.title,
        }),
      ]);
      folders = folderList.map((f) => ({
        ...f,
        createdAt:
          f.createdAt instanceof Date
            ? f.createdAt.toISOString()
            : f.createdAt,
        updatedAt:
          f.updatedAt instanceof Date
            ? f.updatedAt.toISOString()
            : f.updatedAt,
      }));
      breadcrumbParts = crumbs.map((p) => ({ name: p.name, href: p.href }));
      moveTargets = flattenMoveTargets(tree, null);
    }

    const [summary, documents, structured, structureAdmin] = await Promise.all([
      getProjectHeritageSummary(structure),
      selectedSection
        ? getSectionDocuments(slug, selectedSection.code, currentFolderId)
        : Promise.resolve([]),
      selectedSection && !currentFolderId
        ? getSectionStructuredData(slug, selectedSection)
        : Promise.resolve(undefined),
      editMode ? listStructureAdmin(project.id) : Promise.resolve(null),
    ]);

    return (
      <Suspense fallback={null}>
        <HeritageWorkspace
          structure={structure}
          selectedSection={selectedSection}
          summary={summary}
          documents={documents}
          structured={structured}
          projectId={project.id}
          heritageSectionId={heritageSectionId}
          currentFolderId={currentFolderId}
          folders={folders}
          breadcrumbParts={breadcrumbParts}
          moveTargets={moveTargets}
          permissions={permissions}
          editMode={editMode}
          structureEdit={
            structureAdmin
              ? {
                  groups: structureAdmin.groups.map((g) => ({
                    id: g.id,
                    label: g.label,
                    sortOrder: g.sortOrder,
                  })),
                  sections: structureAdmin.sections.map((s) => ({
                    id: s.id,
                    code: s.code,
                    slug: s.slug,
                    title: s.title,
                    description: s.description,
                    kind: s.kind,
                    groupId: s.groupId,
                    sortOrder: s.sortOrder,
                    isActive: s.isActive,
                    documentCount: s.documentCount,
                    codeLocked: s.codeLocked,
                    hasLinkedContent: s.hasLinkedContent,
                  })),
                }
              : null
          }
        />
      </Suspense>
    );
  }

  const user = await requireActiveUser();
  const project = await db.project.findUnique({
    where: { slug },
    select: { id: true, isActive: true },
  });
  if (!project || !project.isActive) notFound();
  await assertProjectAccess(user, project.id);
  const permissions = await getProjectPermissionsForUser(user, project.id);

  return (
    <Explorer
      data={await getLibrary(slug, query.folder || null, query)}
      canDeleteDocuments={permissions.canDeleteDocuments}
    />
  );
}
