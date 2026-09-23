"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { HeritageProjectSearch } from "@/components/heritage/heritage-project-search";
import type {
  DocumentsFilter,
  StatusFilter,
  StructureFilterState,
} from "@/lib/heritage/structure-filters";
import { hasActiveStructureFilters } from "@/lib/heritage/structure-filters";
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 min-w-[8.5rem] flex-1 border border-border bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none";

const labelClass =
  "text-xs font-medium text-foreground";

type HeritageStructureFiltersProps = {
  projectSlug: string;
  value: StructureFilterState;
  onChange: (next: StructureFilterState) => void;
  groups: string[];
  matchCount: number;
  totalCount: number;
};

export function HeritageStructureFilters({
  projectSlug,
  value,
  onChange,
  groups,
  matchCount,
  totalCount,
}: HeritageStructureFiltersProps) {
  const active = hasActiveStructureFilters(value);

  return (
    <div className="space-y-2.5">
      <div
        role="search"
        aria-label="Recherche et filtres du dossier"
        className="overflow-visible border border-border bg-surface p-4 shadow-[var(--shadow-panel)]"
      >
        <div className="mb-3 flex items-center gap-2 text-muted-foreground">
          <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden />
          <p className="text-xs font-medium text-foreground">
            Rechercher et filtrer les rubriques
          </p>
        </div>

        <div className="flex flex-col gap-4 overflow-visible sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 overflow-visible sm:min-w-[14rem]">
            <p className={cn(labelClass, "mb-1.5")}>Recherche rapide</p>
            <HeritageProjectSearch projectSlug={projectSlug} />
          </div>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={labelClass}>État de la rubrique</span>
            <select
              aria-label="Filtrer par état de la rubrique"
              value={value.status}
              onChange={(e) =>
                onChange({
                  ...value,
                  status: e.target.value as StatusFilter,
                })
              }
              className={selectClass}
            >
              <option value="all">Toutes les rubriques</option>
              <option value="documented">Rubriques documentées</option>
              <option value="empty">Rubriques vides</option>
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={labelClass}>Présence de documents</span>
            <select
              aria-label="Filtrer par présence de documents"
              value={value.documents}
              onChange={(e) =>
                onChange({
                  ...value,
                  documents: e.target.value as DocumentsFilter,
                })
              }
              className={selectClass}
            >
              <option value="all">Avec ou sans documents</option>
              <option value="with">Avec au moins un document</option>
              <option value="without">Sans document</option>
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={labelClass}>Groupe thématique</span>
            <select
              aria-label="Filtrer par groupe thématique"
              value={value.group}
              onChange={(e) => onChange({ ...value, group: e.target.value })}
              className={`${selectClass} sm:min-w-[11rem]`}
            >
              <option value="">Tous les groupes</option>
              {groups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>

          {active ? (
            <button
              type="button"
              onClick={() =>
                onChange({
                  status: "all",
                  documents: "all",
                  group: "",
                })
              }
              className="inline-flex h-9 items-center gap-1.5 self-end border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
              Effacer les filtres
            </button>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {active
          ? matchCount === 0
            ? "Aucune rubrique ne correspond aux filtres sélectionnés."
            : matchCount === 1
              ? "1 rubrique correspond aux filtres."
              : `${matchCount} rubriques correspondent aux filtres.`
          : totalCount === 1
            ? "1 rubrique dans ce dossier."
            : `${totalCount} rubriques dans ce dossier.`}
      </p>
    </div>
  );
}
