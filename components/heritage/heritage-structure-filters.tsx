"use client";

import { X } from "lucide-react";
import { HeritageProjectSearch } from "@/components/heritage/heritage-project-search";
import type {
  DocumentsFilter,
  StatusFilter,
  StructureFilterState,
} from "@/lib/heritage/structure-filters";
import { hasActiveStructureFilters } from "@/lib/heritage/structure-filters";

const selectClass =
  "h-9 min-w-[8.5rem] flex-1 border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none";

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
    <div className="space-y-2">
      <div
        role="search"
        aria-label="Recherche et filtres du dossier"
        className="flex flex-col gap-3 border border-border bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-0 flex-1 sm:min-w-[14rem]">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Recherche
          </p>
          <HeritageProjectSearch projectSlug={projectSlug} />
        </div>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Statut
          </span>
          <select
            aria-label="Filtrer par statut"
            value={value.status}
            onChange={(e) =>
              onChange({
                ...value,
                status: e.target.value as StatusFilter,
              })
            }
            className={selectClass}
          >
            <option value="all">Tous les statuts</option>
            <option value="documented">Documentées</option>
            <option value="empty">Vides</option>
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Documents
          </span>
          <select
            aria-label="Filtrer par documents"
            value={value.documents}
            onChange={(e) =>
              onChange({
                ...value,
                documents: e.target.value as DocumentsFilter,
              })
            }
            className={selectClass}
          >
            <option value="all">Tous</option>
            <option value="with">Avec documents</option>
            <option value="without">Sans documents</option>
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Groupe
          </span>
          <select
            aria-label="Filtrer par groupe"
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
            className="inline-flex h-9 items-center gap-1.5 border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
            Réinitialiser les filtres
          </button>
        ) : null}
      </div>

      <p className="text-[11px] text-muted-foreground" aria-live="polite">
        {active
          ? matchCount === 0
            ? "Aucune rubrique ne correspond aux filtres."
            : matchCount === 1
              ? "1 rubrique affichée"
              : `${matchCount} rubriques affichées`
          : totalCount === 1
            ? "1 rubrique"
            : `${totalCount} rubriques`}
      </p>
    </div>
  );
}
