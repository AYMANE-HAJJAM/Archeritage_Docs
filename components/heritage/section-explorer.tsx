"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, FolderOpen } from "lucide-react";
import { HeritageStructureFilters } from "@/components/heritage/heritage-structure-filters";
import {
  documentsPath,
  sectionQueryPath,
  type HeritageStructure,
} from "@/lib/heritage/config/structure";
import type {
  ProjectHeritageSummary,
  SectionSummary,
} from "@/lib/heritage/queries/section-summaries";
import {
  DEFAULT_STRUCTURE_FILTERS,
  filterHeritageStructure,
  structureGroupOptions,
  type StructureFilterState,
} from "@/lib/heritage/structure-filters";
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

/** Structured-only labels (exclude documents/photos already shown in Documents). */
export function structuredContentLabel(summary: SectionSummary): string {
  const structured = summary.labels.filter(
    (label) => !label.includes("document") && !label.includes("photo"),
  );
  return structured.length > 0 ? structured.join(" · ") : "—";
}

export function SectionExplorer({
  structure,
  summary,
}: {
  structure: HeritageStructure;
  summary: ProjectHeritageSummary;
}) {
  const [filters, setFilters] = useState<StructureFilterState>(
    DEFAULT_STRUCTURE_FILTERS,
  );

  const groups = useMemo(() => structureGroupOptions(structure), [structure]);
  const { families, matchCount, totalCount } = useMemo(
    () => filterHeritageStructure(structure, summary, filters),
    [structure, summary, filters],
  );

  return (
    <div className="space-y-5">
      <HeritageStructureFilters
        projectSlug={structure.projectSlug}
        value={filters}
        onChange={setFilters}
        groups={groups}
        matchCount={matchCount}
        totalCount={totalCount}
      />

      {families.length === 0 ? (
        <div className="border border-dashed border-border bg-surface px-5 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Aucune rubrique ne correspond aux filtres
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            Modifiez l&apos;état, la présence de documents ou le groupe
            thématique, ou effacez les filtres pour tout réafficher.
          </p>
        </div>
      ) : (
        families.map((family) => (
          <div key={family.title}>
            <h2 className="section-label mb-2.5">{family.title}</h2>

            <div className="overflow-hidden border border-border bg-surface">
              <div className="overflow-x-auto">
                <table className="data-table min-w-[36rem]">
                  <thead>
                    <tr>
                      <th className="w-16">Code</th>
                      <th>Rubrique</th>
                      <th className="w-24 text-right">Fichiers</th>
                      <th className="hidden w-28 md:table-cell">Mise à jour</th>
                      <th className="w-28">État</th>
                      <th className="hidden w-20 lg:table-cell">
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {family.sections.map((section) => {
                      const row = summary.sections[section.code];
                      const fileCount = row?.fileCount ?? 0;
                      const updated = formatDate(row?.lastUpdatedAt ?? null);
                      const status = row?.status ?? "Vide";
                      const href = sectionQueryPath(
                        structure.projectSlug,
                        section.code,
                      );

                      return (
                        <tr key={section.slug} className="group/row">
                          <td>
                            <Link
                              href={href}
                              scroll={false}
                              className="block text-[12px] font-semibold tabular-nums text-accent"
                            >
                              {section.code}
                            </Link>
                          </td>
                          <td>
                            <Link
                              href={href}
                              scroll={false}
                              className="block truncate text-[13px] font-medium text-foreground group-hover/row:text-accent"
                            >
                              {section.name}
                            </Link>
                          </td>
                          <td className="text-right">
                            <Link
                              href={href}
                              scroll={false}
                              className="block text-[13px] tabular-nums text-muted-foreground"
                            >
                              {fileCount}
                            </Link>
                          </td>
                          <td className="hidden md:table-cell">
                            <Link
                              href={href}
                              scroll={false}
                              className="block text-[12px] tabular-nums text-muted-foreground"
                            >
                              {updated}
                            </Link>
                          </td>
                          <td>
                            <Link href={href} scroll={false} className="block">
                              <span
                                className="status-pill"
                                data-tone={
                                  status === "Documentée"
                                    ? "documented"
                                    : "empty"
                                }
                              >
                                {status}
                              </span>
                            </Link>
                          </td>
                          <td className="hidden text-right lg:table-cell">
                            <Link
                              href={href}
                              scroll={false}
                              className="text-[11px] font-semibold text-accent opacity-0 transition-opacity group-hover/row:opacity-100"
                            >
                              Ouvrir →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function HeritageWorkspaceHeader({
  structure,
  selectedSectionLabel,
  summaryLine,
  projectHref,
  territoryHref,
  showBackToRubriques,
  canManageStructure = false,
  structureEditActive = false,
  onToggleStructureEdit,
}: {
  structure: HeritageStructure;
  selectedSectionLabel?: string | null;
  summaryLine?: string | null;
  projectHref: string;
  territoryHref: string;
  showBackToRubriques: boolean;
  canManageStructure?: boolean;
  structureEditActive?: boolean;
  onToggleStructureEdit?: () => void;
}) {
  return (
    <>
      <nav
        aria-label="Fil d’Ariane"
        className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link href={territoryHref} className="hover:text-primary">
          Safi Patrimoine
        </Link>
        <ChevronRight className="size-3 shrink-0" />
        {selectedSectionLabel ? (
          <>
            <Link href={projectHref} className="hover:text-primary">
              {structure.title}
            </Link>
            <ChevronRight className="size-3 shrink-0" />
            <span className="text-foreground">{selectedSectionLabel}</span>
          </>
        ) : (
          <span className="text-foreground">{structure.title}</span>
        )}
      </nav>

      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="page-eyebrow">
            Safi Patrimoine · Dossier {structure.dossierCode}
          </p>
          <h1 className="page-title">{structure.title}</h1>
          {summaryLine && (
            <p className="text-xs leading-5 text-muted-foreground sm:text-[13px]">
              {summaryLine}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {showBackToRubriques && (
            <Link
              href={projectHref}
              className="inline-flex h-9 items-center gap-2 border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] hover:bg-muted/50"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Retour à la liste des rubriques
            </Link>
          )}
          <Link
            href={documentsPath(structure.projectSlug)}
            className="inline-flex h-9 items-center gap-2 border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] hover:bg-muted/50"
          >
            <FolderOpen className="size-3.5" aria-hidden />
            Voir tous les documents
          </Link>
          {canManageStructure && onToggleStructureEdit ? (
            <button
              type="button"
              onClick={onToggleStructureEdit}
              className="inline-flex h-9 items-center gap-2 border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] hover:bg-muted/50"
            >
              {structureEditActive
                ? "Terminer la modification de structure"
                : "Modifier les rubriques et groupes"}
            </button>
          ) : null}
        </div>
      </header>
    </>
  );
}
