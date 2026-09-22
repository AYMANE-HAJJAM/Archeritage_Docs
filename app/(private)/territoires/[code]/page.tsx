import { notFound } from "next/navigation";

import { HeritageCard } from "@/components/heritage/heritage-card";
import {
  canCreateDossierOnTerritoire,
  listViewableProjectIds,
  requireActiveUser,
} from "@/lib/access";
import { CreateDossierDialogGate } from "@/components/manage/create-dossier-gate";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { db } from "@/lib/db";
import { SAFI_PROJECTS } from "@/lib/heritage/config/structure";

export const metadata = {
  title: "Safi Patrimoine",
};

export default async function TerritoryPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const user = await requireActiveUser();

  const { code } = await params;

  const territoire = await db.territoire.findUnique({
    where: { code: code.toUpperCase() },
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      projects: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          _count: { select: { files: true, heritageSections: true } },
        },
      },
    },
  });

  if (!territoire) notFound();

  const viewable = await listViewableProjectIds(user);
  const visibleProjects =
    viewable === "ALL"
      ? territoire.projects
      : territoire.projects.filter((p) => viewable.includes(p.id));

  const projectsBySlug = new Map(
    visibleProjects.map((project) => [project.slug, project]),
  );

  const tiles = SAFI_PROJECTS.map((entry) => {
    const project = projectsBySlug.get(entry.projectSlug);
    if (!project) return null;
    return { entry, project };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  const catalogSlugs = new Set<string>(SAFI_PROJECTS.map((p) => p.projectSlug));
  const extraTiles = visibleProjects
    .filter((p) => !catalogSlugs.has(p.slug))
    .map((project) => ({
      entry: {
        projectSlug: project.slug,
        title: project.name,
        description: project.description || "",
      },
      project,
    }));

  const allTiles = [...tiles, ...extraTiles];
  const canCreate = await canCreateDossierOnTerritoire(user, territoire.id);

  return (
    <section className="pb-4">
      <PageHeader
        eyebrow={`${territoire.code} · Plateforme patrimoniale`}
        title={territoire.name}
        description={
          territoire.description?.trim() ||
          "Consultez les dossiers patrimoniaux — Château de Mer et Murailles portugaises."
        }
        actions={
          canCreate ? (
            <CreateDossierDialogGate territoireId={territoire.id} />
          ) : undefined
        }
      />

      {allTiles.length === 0 ? (
        <EmptyState
          title="Aucun dossier patrimonial accessible"
          description="Votre compte n’a pas encore accès à un dossier de cette plateforme. Contactez un administrateur."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {allTiles.map(({ entry, project }) => {
            const docs = project._count.files;
            const sections = project._count.heritageSections;
            const meta = [
              sections > 0
                ? `${sections} rubrique${sections > 1 ? "s" : ""}`
                : null,
              `${docs} document${docs > 1 ? "s" : ""}`,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <HeritageCard
                key={entry.projectSlug}
                href={`/projects/${project.slug}`}
                title={entry.title}
                description={
                  entry.description ||
                  project.description ||
                  "Dossier patrimonial"
                }
                meta={meta}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
