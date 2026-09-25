import { notFound } from "next/navigation";

import { HeritageCard } from "@/components/heritage/heritage-card";
import {
  canManagePlatform,
  listViewableProjectIds,
  requireActiveUser,
} from "@/lib/access";
import { CreateDossierDialogGate } from "@/components/manage/create-dossier-gate";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { db } from "@/lib/db";

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
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          _count: { select: { groups: true, parts: true } },
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

  const fileCounts = await db.file.groupBy({
    by: ["sectionId"],
    where: {
      section: {
        group: { projectId: { in: visibleProjects.map((p) => p.id) } },
      },
    },
    _count: { _all: true },
  });
  const sectionOwners = await db.section.findMany({
    where: { id: { in: fileCounts.map((row) => row.sectionId) } },
    select: { id: true, group: { select: { projectId: true } } },
  });
  const projectFileCount = new Map<string, number>();
  for (const row of fileCounts) {
    const owner = sectionOwners.find((s) => s.id === row.sectionId);
    if (!owner) continue;
    const projectId = owner.group.projectId;
    projectFileCount.set(
      projectId,
      (projectFileCount.get(projectId) ?? 0) + row._count._all,
    );
  }

  const canCreate = canManagePlatform(user);

  return (
    <section className="pb-4">
      <PageHeader
        eyebrow={`${territoire.code} · Plateforme patrimoniale`}
        title={territoire.name}
        description={
          territoire.description?.trim() ||
          "Consultez les dossiers patrimoniaux de cette plateforme."
        }
        actions={
          canCreate ? (
            <CreateDossierDialogGate territoireId={territoire.id} />
          ) : undefined
        }
      />

      {visibleProjects.length === 0 ? (
        <EmptyState
          title="Aucun dossier patrimonial accessible"
          description="Votre compte n’a pas encore accès à un dossier de cette plateforme. Contactez un administrateur."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleProjects.map((project) => {
            const docs = projectFileCount.get(project.id) ?? 0;
            const groups = project._count.groups;
            const meta = [
              project._count.parts > 0
                ? `${project._count.parts} partie${project._count.parts > 1 ? "s" : ""}`
                : null,
              groups > 0 ? `${groups} groupe${groups > 1 ? "s" : ""}` : null,
              `${docs} document${docs > 1 ? "s" : ""}`,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <HeritageCard
                key={project.id}
                href={`/projects/${project.slug}`}
                title={project.name}
                description={project.description || "Dossier patrimonial"}
                meta={meta}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
