import { HeritageCard } from "@/components/heritage/heritage-card";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { PlatformsManager } from "@/components/manage/platforms-manager";
import {
  canManagePlatform,
  listViewableProjectIds,
  requireActiveUser,
} from "@/lib/access";
import { listAdminTerritoires } from "@/lib/admin/territoires";
import { db } from "@/lib/db";

export const metadata = {
  title: "Projets",
};

export default async function ProjectsPage() {
  const user = await requireActiveUser();

  // ADMIN: management landing with create / archive / structure actions.
  if (canManagePlatform(user)) {
    const platforms = await listAdminTerritoires();
    return (
      <PlatformsManager
        cardHrefMode="browse"
        eyebrow="ARCHERITAGE Docs"
        description="Sélectionnez une plateforme patrimoniale ou créez un nouveau projet."
        platforms={platforms.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          description: p.description,
          isActive: p.isActive,
          dossierCount: p.dossierCount,
          sectionCount: p.sectionCount,
          fileCount: p.fileCount,
          lastActivityAt: p.lastActivityAt.toISOString(),
        }))}
      />
    );
  }

  // USER: browsable platforms they can access — no create action.
  const viewable = await listViewableProjectIds(user);

  const territoires = await db.territoire.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      projects: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  const fileRows = await db.file.groupBy({
    by: ["sectionId"],
    _count: { _all: true },
  });
  const sectionOwners = await db.section.findMany({
    select: { id: true, group: { select: { projectId: true } } },
  });
  const filesByProject = new Map<string, number>();
  for (const row of fileRows) {
    const owner = sectionOwners.find((s) => s.id === row.sectionId);
    if (!owner) continue;
    filesByProject.set(
      owner.group.projectId,
      (filesByProject.get(owner.group.projectId) ?? 0) + row._count._all,
    );
  }

  const visibleTerritoires = territoires
    .map((territoire) => {
      const projects =
        viewable === "ALL"
          ? territoire.projects
          : territoire.projects.filter((p) => viewable.includes(p.id));
      if (projects.length === 0) return null;
      const fileCount = projects.reduce(
        (n, p) => n + (filesByProject.get(p.id) ?? 0),
        0,
      );
      return {
        id: territoire.id,
        code: territoire.code,
        name: territoire.name,
        description: territoire.description,
        dossierCount: projects.length,
        fileCount,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <section className="pb-4">
      <PageHeader
        eyebrow="ARCHERITAGE Docs"
        title="Projets"
        description="Sélectionnez une plateforme patrimoniale pour accéder à ses dossiers, rubriques et documents."
      />

      {visibleTerritoires.length === 0 ? (
        <EmptyState
          title="Aucun projet accessible"
          description="Votre compte n’a pas encore accès à une plateforme. Contactez un administrateur si vous pensez devoir en avoir un."
        />
      ) : (
        <div
          className={
            visibleTerritoires.length === 1
              ? "grid max-w-xl grid-cols-1 gap-4"
              : "grid gap-4 lg:grid-cols-2"
          }
        >
          {visibleTerritoires.map((territoire) => {
            const dossierLabel =
              territoire.dossierCount === 1
                ? "1 dossier patrimonial"
                : `${territoire.dossierCount} dossiers patrimoniaux`;
            const description =
              territoire.description?.trim() ||
              "Plateforme de connaissance et de suivi patrimonial.";

            return (
              <HeritageCard
                key={territoire.id}
                href={`/territoires/${territoire.code.toLowerCase()}`}
                code={territoire.code}
                title={territoire.name}
                description={description}
                meta={`${dossierLabel}${
                  territoire.fileCount
                    ? ` · ${territoire.fileCount} document${
                        territoire.fileCount > 1 ? "s" : ""
                      }`
                    : ""
                } · Actif`}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
