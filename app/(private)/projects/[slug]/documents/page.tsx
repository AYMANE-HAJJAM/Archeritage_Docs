import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { ProjectDocumentsIndex } from "@/components/heritage/project-documents-index";
import { getProjectDocumentsIndex } from "@/lib/heritage/queries/project-documents";
import {
  CHATEAU_SLUG,
  MURAILLES_SLUG,
  documentsPath,
  isHeritageProject,
} from "@/lib/heritage/config/structure";

type DocumentsQuery = {
  view?: string;
  folder?: string;
  q?: string;
  type?: string;
  page?: string;
};

export default async function ProjectDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<DocumentsQuery>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  // Legacy folder/archive query params no longer expose a competing UX.
  if (isHeritageProject(slug) && (query.view === "folders" || query.folder)) {
    redirect(documentsPath(slug));
  }

  const index = await getProjectDocumentsIndex(slug);
  if (!index) notFound();

  const overviewLabel =
    slug === MURAILLES_SLUG
      ? "Murailles"
      : slug === CHATEAU_SLUG
        ? "Château de Mer"
        : index.project.name;

  const initialQuery = (query.q || "").trim().slice(0, 180);

  return (
    <section className="mx-auto max-w-6xl pb-10 pt-2 sm:pt-4">
      <nav
        aria-label="Fil d’Ariane"
        className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link href="/territoires/saf" className="hover:text-primary">
          Safi Patrimoine
        </Link>
        <ChevronRight className="size-3 shrink-0" />
        <Link href={`/projects/${slug}`} className="hover:text-primary">
          {overviewLabel}
        </Link>
        <ChevronRight className="size-3 shrink-0" />
        <span className="text-foreground">Tous les documents</span>
      </nav>

      <header className="mb-6 border-b border-border pb-5">
        <p className="page-eyebrow">
          {index.project.territoireCode
            ? `${index.project.territoireCode} · ${overviewLabel}`
            : overviewLabel}
        </p>
        <h1 className="page-title mt-1">Tous les documents</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Consultez, filtrez et téléchargez l&apos;ensemble des fichiers du dossier{" "}
          {overviewLabel}, classés par rubrique.
        </p>
      </header>

      <ProjectDocumentsIndex data={index} initialQuery={initialQuery} />
    </section>
  );
}
