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
import { getSectionDocuments } from "@/lib/heritage/queries/section-documents";
import { getProjectHeritageSummary } from "@/lib/heritage/queries/section-summaries";
import { getSectionStructuredData } from "@/lib/heritage/queries/section-structured";
import {
  documentsPath,
  findHeritageSection,
  isHeritageProject,
  type HeritageSection,
} from "@/lib/heritage/config/structure";
import { getHeritageStructure } from "@/lib/heritage/queries/structure";
import { getLibrary, type Query } from "@/lib/documents/library";

type ProjectQuery = Query & { section?: string; edit?: string };

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ProjectQuery>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  if (isHeritageProject(slug) && query.folder) {
    redirect(documentsPath(slug));
  }

  if (isHeritageProject(slug)) {
    const user = await requireActiveUser();

    const structure = await getHeritageStructure(slug);
    if (!structure) notFound();

    const project = await db.project.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });
    if (!project || !project.isActive) notFound();

    await assertProjectAccess(user, project.id);
    const permissions = await getProjectPermissionsForUser(user, project.id);

    let selectedSection: HeritageSection | null = null;
    if (query.section) {
      selectedSection = findHeritageSection(structure, query.section);
      if (!selectedSection) notFound();
    }

    const editMode =
      query.edit === "1" && permissions.canManageStructure && !selectedSection;

    const [summary, documents, structured, structureAdmin] = await Promise.all([
      getProjectHeritageSummary(structure),
      selectedSection
        ? getSectionDocuments(slug, selectedSection.code)
        : Promise.resolve([]),
      selectedSection
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
                  })),
                }
              : null
          }
        />
      </Suspense>
    );
  }

  return (
    <Explorer data={await getLibrary(slug, query.folder || null, query)} />
  );
}
