import { notFound } from "next/navigation";

import { ProjectDocumentsIndex } from "@/components/heritage/project-documents-index";
import { StickyContextNav } from "@/components/heritage/sticky-context-nav";
import {
  assertProjectAccess,
  getProjectPermissionsForUser,
  requireActiveUser,
} from "@/lib/access";
import { buildProjectBreadcrumb } from "@/lib/structure/breadcrumb";
import {
  getProjectBySlug,
  getProjectStructure,
  listProjectFiles,
} from "@/lib/structure/queries";

export default async function ProjectDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
  const user = await requireActiveUser();

  const project = await getProjectBySlug(slug);
  if (!project || !project.isActive) notFound();
  await assertProjectAccess(user, project.id);
  const permissions = await getProjectPermissionsForUser(user, project.id);

  const [structure, documents] = await Promise.all([
    getProjectStructure(project.id),
    listProjectFiles(project.id),
  ]);
  if (!structure) notFound();

  const sections = structure.groups.flatMap((group) =>
    group.sections.map((section) => ({
      id: section.id,
      label: `${group.name} · ${section.name}`,
    })),
  );

  const breadcrumb = [
    ...buildProjectBreadcrumb({
      territoire: structure.project.territoire,
      project: { slug, name: project.name },
    }),
    { label: "Tous les documents" },
  ];

  return (
    <>
      <StickyContextNav items={breadcrumb} />
      <section className="mx-auto max-w-6xl pb-10 pt-1 sm:pt-2">
        <header className="mb-6 border-b border-border pb-5">
          <p className="page-eyebrow">
            {structure.project.territoire
              ? `${structure.project.territoire.code} · ${project.name}`
              : project.name}
          </p>
          <h1 className="page-title mt-1">Tous les documents</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Consultez, filtrez et téléchargez l&apos;ensemble des fichiers du
            dossier {project.name}, classés par rubrique.
          </p>
        </header>

        <ProjectDocumentsIndex
          documents={documents}
          sections={sections}
          initialQuery={(q || "").trim().slice(0, 180)}
          canDownload={permissions.canDownload}
          canDelete={permissions.canDeleteDocuments}
        />
      </section>
    </>
  );
}
