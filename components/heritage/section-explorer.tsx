"use client";

import Link from "next/link";
import { FolderOpen } from "lucide-react";
import type { SectionOperationalStats, StructureGroup } from "@/lib/structure/queries";
import { formatShortDate, formatSize } from "@/lib/utils";

const EMPTY_STATS: SectionOperationalStats = {
  folderCount: 0,
  fileCount: 0,
  totalBytes: 0,
  createdAt: "",
  createdByName: "—",
  lastActivityAt: "",
};

/** Groups → sections table, driven entirely by the DB structure. */
export function SectionExplorer({
  projectSlug,
  groups,
  sectionStats,
  sectionBasePath,
}: {
  projectSlug: string;
  groups: StructureGroup[];
  sectionStats: Record<string, SectionOperationalStats>;
  /** Path that keeps the current Part when opening a rubrique. */
  sectionBasePath?: string;
}) {
  const visibleGroups = groups.filter((group) => group.sections.length > 0);

  if (visibleGroups.length === 0) {
    return (
      <div className="border border-dashed border-border bg-surface px-5 py-10 text-center">
        <p className="text-sm font-medium text-foreground">
          Aucune rubrique pour l&apos;instant
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          La table des matières de ce dossier est encore vide. Un administrateur
          peut la créer depuis la page Structure.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {visibleGroups.map((group) => (
        <div key={group.id}>
          <h2 className="section-label mb-2.5">{group.name}</h2>

          <div className="overflow-hidden border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="data-table min-w-[56rem]">
                <thead>
                  <tr>
                    <th>Rubrique</th>
                    <th className="w-24 text-right">Dossiers</th>
                    <th className="w-20 text-right">Fichiers</th>
                    <th className="w-24 text-right">Taille</th>
                    <th className="w-52">Créé par</th>
                    <th className="w-28">Créé le</th>
                    <th className="w-36">Dernière activité</th>
                  </tr>
                </thead>
                <tbody>
                  {group.sections.map((section) => {
                    const stats = sectionStats[section.id] ?? EMPTY_STATS;
                    const href = `${sectionBasePath ?? `/projects/${projectSlug}`}?sectionId=${section.id}`;
                    return (
                      <tr key={section.id} className="group/row">
                        <td className="max-w-64">
                          <Link
                            href={href}
                            scroll={false}
                            className="block truncate text-[13px] font-medium text-foreground group-hover/row:text-accent"
                          >
                            {section.name}
                          </Link>
                        </td>
                        <td className="text-right text-[13px] tabular-nums text-muted-foreground">
                          {stats.folderCount}
                        </td>
                        <td className="text-right">
                          <Link
                            href={href}
                            scroll={false}
                            className="block text-[13px] tabular-nums text-muted-foreground"
                          >
                            {stats.fileCount}
                          </Link>
                        </td>
                        <td className="text-right text-[13px] tabular-nums text-muted-foreground">
                          {formatSize(stats.totalBytes)}
                        </td>
                        <td
                          className="max-w-52 truncate text-[13px] text-muted-foreground"
                          title={stats.createdByName}
                        >
                          {stats.createdByName}
                        </td>
                        <td className="whitespace-nowrap text-[13px] tabular-nums text-muted-foreground">
                          {stats.createdAt ? formatShortDate(stats.createdAt) : "—"}
                        </td>
                        <td className="whitespace-nowrap text-[13px] tabular-nums text-muted-foreground">
                          {stats.lastActivityAt
                            ? formatShortDate(stats.lastActivityAt)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectWorkspaceHeader({
  projectSlug,
  eyebrow,
  title,
  summaryLine,
}: {
  projectSlug: string;
  eyebrow: string;
  title: string;
  summaryLine?: string | null;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-2">
        <p className="page-eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {summaryLine && (
          <p className="text-xs leading-5 text-muted-foreground sm:text-[13px]">
            {summaryLine}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Link
          href={`/projects/${projectSlug}/documents`}
          className="inline-flex h-9 items-center gap-2 border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] hover:bg-muted/50"
        >
          <FolderOpen className="size-3.5" aria-hidden />
          Voir tous les documents
        </Link>
      </div>
    </header>
  );
}
