"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, Eye, FileText, ImageIcon } from "lucide-react";

import { FilePreviewModal } from "@/components/documents/file-preview";
import type { ProjectDocumentsData } from "@/lib/heritage/queries/project-documents";
import { formatSize, normalizeSearchText } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const STATUT_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon",
  EN_REVISION: "En révision",
  SOUMIS: "Soumis",
  VALIDE: "Validé",
  OBSOLETE: "Obsolète",
};

type Filters = {
  q: string;
  section: string;
  type: string;
  status: string;
  version: string;
};

export function ProjectDocumentsIndex({
  data,
  initialQuery = "",
}: {
  data: ProjectDocumentsData;
  /** Prefill search from URL (e.g. in-project search “Voir tous”). */
  initialQuery?: string;
}) {
  const [preview, setPreview] = useState<
    ProjectDocumentsData["documents"][number] | null
  >(null);
  const [filters, setFilters] = useState<Filters>({
    q: initialQuery,
    section: "all",
    type: "all",
    status: "all",
    version: "all",
  });

  const filtered = useMemo(() => {
    const q = normalizeSearchText(filters.q);
    return data.documents.filter((file) => {
      if (q) {
        const haystack = normalizeSearchText(
          `${file.displayName} ${file.originalName} ${file.sectionLabel}`,
        );
        if (!haystack.includes(q)) return false;
      }
      if (filters.section === "project") {
        if (file.placementGroup !== "project") return false;
      } else if (filters.section !== "all") {
        if (file.sectionCode !== filters.section) return false;
      }
      if (filters.type !== "all") {
        if ((file.extension || "").toLowerCase() !== filters.type) return false;
      }
      if (filters.status !== "all") {
        if (file.docStatut !== filters.status) return false;
      }
      if (filters.version !== "all") {
        if (file.docVersion !== filters.version) return false;
      }
      return true;
    });
  }, [data.documents, filters]);

  const showStatus = data.hasAnyStatus;
  const showVersion = data.hasAnyVersion;

  return (
    <div>
      <p className="mb-4 text-xs text-muted-foreground" aria-live="polite">
          {[
            `${data.summary.total} document${data.summary.total > 1 ? "s" : ""}`,
            data.summary.totalBytes > 0
              ? formatSize(data.summary.totalBytes)
              : null,
            `${data.summary.heritage} rubrique${data.summary.heritage > 1 ? "s" : ""}`,
            data.summary.projectLevel > 0
              ? `${data.summary.projectLevel} document${data.summary.projectLevel > 1 ? "s" : ""} projet`
              : null,
            data.summary.lastActivityAt
              ? `Dernière activité : ${new Date(data.summary.lastActivityAt).toLocaleDateString("fr-FR", { timeZone: "UTC" })}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2 border border-border bg-surface p-2">
        <Input
          value={filters.q}
          onChange={(event) =>
            setFilters((current) => ({ ...current, q: event.target.value }))
          }
          placeholder="Rechercher dans le projet…"
          className="h-8 min-w-48 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />

        <select
          aria-label="Filtrer par rubrique"
          value={filters.section}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              section: event.target.value,
            }))
          }
          className="h-8 border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">Tous les emplacements</option>
          <option value="project">Document projet</option>
          {data.sectionOptions.map((section) => (
            <option key={section.code} value={section.code}>
              {section.code} {section.name}
            </option>
          ))}
        </select>

        {data.typeOptions.length > 0 && (
          <select
            aria-label="Filtrer par type"
            value={filters.type}
            onChange={(event) =>
              setFilters((current) => ({ ...current, type: event.target.value }))
            }
            className="h-8 border border-border bg-background px-2 text-xs text-foreground"
          >
            <option value="all">Tous les types</option>
            {data.typeOptions.map((type) => (
              <option key={type} value={type}>
                {type.toUpperCase()}
              </option>
            ))}
          </select>
        )}

        {showStatus && (
          <select
            aria-label="Filtrer par statut"
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value,
              }))
            }
            className="h-8 border border-border bg-background px-2 text-xs text-foreground"
          >
            <option value="all">Tous les statuts</option>
            {data.statusOptions.map((status) => (
              <option key={status} value={status}>
                {STATUT_LABEL[status] ?? status}
              </option>
            ))}
          </select>
        )}

        {showVersion && (
          <select
            aria-label="Filtrer par version"
            value={filters.version}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                version: event.target.value,
              }))
            }
            className="h-8 border border-border bg-background px-2 text-xs text-foreground"
          >
            <option value="all">Toutes les versions</option>
            {data.versionOptions.map((version) => (
              <option key={version} value={version}>
                {version}
              </option>
            ))}
          </select>
        )}
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
      </p>

      {filtered.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          Aucun document ne correspond aux critères.
        </p>
      ) : (
        <div className="overflow-hidden border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/55 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Nom</th>
                  <th className="px-3 py-2 font-semibold">Emplacement</th>
                  <th className="hidden w-20 px-3 py-2 font-semibold md:table-cell">
                    Type
                  </th>
                  <th className="hidden w-28 px-3 py-2 font-semibold sm:table-cell">
                    Date
                  </th>
                  <th className="hidden w-24 px-3 py-2 text-right font-semibold sm:table-cell">
                    Taille
                  </th>
                  {showStatus && (
                    <th className="hidden w-28 px-3 py-2 font-semibold lg:table-cell">
                      Statut
                    </th>
                  )}
                  {showVersion && (
                    <th className="hidden w-20 px-3 py-2 font-semibold lg:table-cell">
                      Version
                    </th>
                  )}
                  <th className="w-24 px-2 py-2 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((file) => (
                  <tr
                    key={file.id}
                    className="border-b border-border/80 last:border-0 transition-colors duration-150 hover:bg-muted/40"
                  >
                    <td className="max-w-64 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setPreview(file)}
                        className="flex max-w-full items-center gap-2.5 text-left"
                      >
                        {file.storageProvider === "CLOUDINARY" ? (
                          <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span
                          className="truncate text-[13px] font-medium"
                          title={file.displayName}
                        >
                          {file.displayName}
                        </span>
                      </button>
                    </td>
                    <td className="max-w-52 truncate px-3 text-xs text-muted-foreground">
                      {file.sectionLabel}
                    </td>
                    <td className="hidden px-3 text-[11px] uppercase text-muted-foreground md:table-cell">
                      {file.extension || "Fichier"}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 text-xs text-muted-foreground sm:table-cell">
                      {new Date(file.createdAt).toLocaleDateString("fr-FR", {
                        timeZone: "UTC",
                      })}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 text-right text-xs tabular-nums text-muted-foreground sm:table-cell">
                      {formatSize(file.size)}
                    </td>
                    {showStatus && (
                      <td className="hidden px-3 text-xs text-muted-foreground lg:table-cell">
                        {file.docStatut
                          ? (STATUT_LABEL[file.docStatut] ?? file.docStatut)
                          : "—"}
                      </td>
                    )}
                    {showVersion && (
                      <td className="hidden px-3 text-xs text-muted-foreground lg:table-cell">
                        {file.docVersion ?? "—"}
                      </td>
                    )}
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="inline-flex size-7 items-center justify-center text-muted-foreground hover:text-primary"
                          aria-label={`Aperçu ${file.displayName}`}
                          onClick={() => setPreview(file)}
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <a
                          href={`/api/files/${file.id}/content?download=1`}
                          className="inline-flex size-7 items-center justify-center text-muted-foreground hover:text-primary"
                        >
                          <ArrowDownToLine className="size-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FilePreviewModal file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
