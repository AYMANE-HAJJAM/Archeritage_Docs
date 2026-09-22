import { HeritageCard } from "@/components/heritage/heritage-card";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Choisir un projet",
};

export default async function ProjectsPage() {
  await requireUser();

  const territoires = await db.territoire.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      _count: { select: { projects: true } },
      projects: {
        select: { _count: { select: { files: true } } },
      },
    },
  });

  return (
    <section className="pb-4">
      <PageHeader
        eyebrow="ARCHERITAGE Docs"
        title="Choisir un projet"
        description="Ouvrez une plateforme patrimoniale pour consulter ses dossiers et documents."
      />

      {territoires.length === 0 ? (
        <EmptyState
          title="Aucun projet accessible"
          description="Contactez un administrateur si vous pensez devoir avoir accès à un projet."
        />
      ) : (
        <div
          className={
            territoires.length === 1
              ? "grid max-w-xl grid-cols-1 gap-4"
              : "grid gap-4 lg:grid-cols-2"
          }
        >
          {territoires.map((territoire) => {
            const fileCount = territoire.projects.reduce(
              (n, p) => n + p._count.files,
              0,
            );
            const dossiers = territoire._count.projects;
            const dossierLabel =
              dossiers === 1
                ? "1 dossier patrimonial"
                : `${dossiers} dossiers patrimoniaux`;
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
                meta={`${dossierLabel}${fileCount ? ` · ${fileCount} document${fileCount > 1 ? "s" : ""}` : ""} · Actif`}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
