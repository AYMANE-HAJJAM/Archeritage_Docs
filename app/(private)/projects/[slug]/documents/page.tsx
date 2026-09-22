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
    <div>
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
        <span className="text-foreground">Tous les documents du projet</span>
      </nav>

      <ProjectDocumentsIndex data={index} initialQuery={initialQuery} />
    </div>
  );
}
