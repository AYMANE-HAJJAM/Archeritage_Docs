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
import { formatSize } from "@/lib/utils";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "—";
  return formatSize(bytes);
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
        <div className="border border-dashed border-border bg-surface px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">
            Aucune rubrique ne correspond aux filtres
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Modifiez le statut, les documents ou le groupe, ou réinitialisez les
            filtres.
          </p>
        </div>
      ) : (
        families.map((family) => (
          <div key={family.title}>
            <h2 className="section-label mb-2">{family.title}</h2>

            <div className="overflow-hidden border border-border bg-surface">
              <div className="overflow-x-auto">
                <table className="data-table min-w-[40rem] table-fixed">
                  <thead>
                    <tr>
                      <th className="w-16">Code</th>
                      <th>Rubrique</th>
                      <th className="w-24 text-right">Documents</th>
                      <th className="hidden min-w-[9rem] md:table-cell">
                        Contenu
                      </th>
                      <th className="w-28">Mise à jour</th>
                      <th className="w-24 text-right">Taille</th>
                      <th className="w-28">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {family.sections.map((section) => {
                      const row = summary.sections[section.code];
                      const fileCount = row?.fileCount ?? 0;
                      const contenu = row ? structuredContentLabel(row) : "—";
                      const updated = formatDate(row?.lastUpdatedAt ?? null);
                      const size = formatBytes(row?.totalBytes ?? 0);
                      const status = row?.status ?? "Vide";
                      const href = sectionQueryPath(
                        structure.projectSlug,
                        section.code,
                      );

                      return (
                        <tr key={section.slug} className="group/row">
                          <td className="px-0 py-0">
                            <Link
                              href={href}
                              scroll={false}
                              className="block px-3 py-2.5 text-[12px] font-semibold tabular-nums text-accent"
                            >
                              {section.code}
                            </Link>
                          </td>
                          <td className="px-0 py-0">
                            <Link
                              href={href}
                              scroll={false}
                              className="block truncate px-3 py-2.5 text-[13px] font-medium text-foreground"
                            >
                              {section.name}
                            </Link>
                          </td>
                          <td className="px-0 py-0">
                            <Link
                              href={href}
                              scroll={false}
                              className="block px-3 py-2.5 text-right text-[13px] tabular-nums text-muted-foreground"
                            >
                              {fileCount}
                            </Link>
                          </td>
                          <td className="hidden px-0 py-0 md:table-cell">
                            <Link
                              href={href}
                              scroll={false}
                              className="block truncate px-3 py-2.5 text-[12px] text-muted-foreground"
                            >
                              {contenu}
                            </Link>
                          </td>
                          <td className="px-0 py-0">
                            <Link
                              href={href}
                              scroll={false}
                              className="block px-3 py-2.5 text-[12px] tabular-nums text-muted-foreground"
                            >
                              {updated}
                            </Link>
                          </td>
                          <td className="px-0 py-0">
                            <Link
                              href={href}
                              scroll={false}
                              className="block px-3 py-2.5 text-right text-[12px] tabular-nums text-muted-foreground"
                            >
                              {size}
                            </Link>
                          </td>
                          <td className="px-0 py-0">
                            <Link
                              href={href}
                              scroll={false}
                              className="block px-3 py-2.5"
                            >
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

      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="page-eyebrow">
            Safi Patrimoine · {structure.dossierCode}
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
              Retour aux rubriques
            </Link>
          )}
          <Link
            href={documentsPath(structure.projectSlug)}
            className="inline-flex h-9 items-center gap-2 border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] hover:bg-muted/50"
            title="Voir tous les documents de ce dossier"
          >
            <FolderOpen className="size-3.5" aria-hidden />
            Tous les documents
          </Link>
          {canManageStructure && onToggleStructureEdit ? (
            <button
              type="button"
              onClick={onToggleStructureEdit}
              className="inline-flex h-9 items-center gap-2 border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] hover:bg-muted/50"
            >
              {structureEditActive
                ? "Quitter le mode structure"
                : "Modifier la structure"}
            </button>
          ) : null}
        </div>
      </header>
    </>
  );
}
