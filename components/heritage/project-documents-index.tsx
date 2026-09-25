"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DocumentFileGlyph } from "@/components/documents/document-file-glyph";
import { DocumentRowActions } from "@/components/documents/document-row-actions";
import { FilePreviewModal } from "@/components/documents/file-preview";
import { Input } from "@/components/ui/input";
import type { SectionFile } from "@/lib/structure/queries";
import { formatSize, normalizeSearchText } from "@/lib/utils";

export type DocumentsIndexSection = {
  id: string;
  label: string;
};

export function ProjectDocumentsIndex({
  documents: initialDocuments,
  sections,
  initialQuery = "",
  canDownload = true,
  canDelete = false,
}: {
  documents: SectionFile[];
  sections: DocumentsIndexSection[];
  /** Prefill search from URL (e.g. in-project search “Voir tous”). */
  initialQuery?: string;
  canDownload?: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [docsSource, setDocsSource] = useState(initialDocuments);
  if (initialDocuments !== docsSource) {
    setDocsSource(initialDocuments);
    setDocuments(initialDocuments);
  }

  const [preview, setPreview] = useState<SectionFile | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [sectionId, setSectionId] = useState("all");

  const filtered = useMemo(() => {
    const needle = normalizeSearchText(query.trim());
    return documents.filter((doc) => {
      if (sectionId !== "all" && doc.sectionId !== sectionId) return false;
      if (!needle) return true;
      return normalizeSearchText(
        `${doc.displayName} ${doc.originalName} ${doc.location}`,
      ).includes(needle);
    });
  }, [documents, query, sectionId]);

  function removeDocument(fileId: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== fileId));
    setPreview((current) => (current?.id === fileId ? null : current));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[14rem] flex-1 text-xs">
          <span className="text-muted-foreground">Rechercher</span>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom de fichier, rubrique, dossier…"
            className="mt-1"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Rubrique</span>
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className="mt-1 h-9 w-full min-w-[12rem] rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="all">Toutes les rubriques</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </select>
        </label>
        <p className="pb-2 text-xs tabular-nums text-muted-foreground">
          {filtered.length} / {documents.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-border bg-surface px-5 py-10 text-center">
          <p className="text-sm font-medium text-foreground">Aucun document</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            Modifiez la recherche ou le filtre de rubrique.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[36rem]">
              <thead>
                <tr>
                  <th>Nom du fichier</th>
                  <th className="hidden md:table-cell">Emplacement</th>
                  <th className="hidden w-24 text-right sm:table-cell">Taille</th>
                  <th className="hidden w-36 lg:table-cell">Ajouté par</th>
                  <th className="hidden w-28 sm:table-cell">Ajouté le</th>
                  <th className="w-12 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((file) => (
                  <tr key={file.id} className="group/row">
                    <td className="max-w-80">
                      <button
                        type="button"
                        onClick={() => setPreview(file)}
                        className="flex max-w-full items-center gap-3 text-left"
                        aria-label={`Aperçu ${file.displayName}`}
                      >
                        <DocumentFileGlyph file={file} />
                        <span className="min-w-0">
                          <span
                            className="block truncate text-[13px] font-medium text-foreground group-hover/row:text-accent"
                            title={file.displayName}
                          >
                            {file.displayName}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground md:hidden">
                            {file.location}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="hidden max-w-64 truncate text-xs text-muted-foreground md:table-cell">
                      {file.location}
                    </td>
                    <td className="hidden whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground sm:table-cell">
                      {formatSize(file.size)}
                    </td>
                    <td className="hidden max-w-36 truncate text-xs text-muted-foreground lg:table-cell">
                      {file.uploadedByName ?? "—"}
                    </td>
                    <td className="hidden whitespace-nowrap text-xs tabular-nums text-muted-foreground sm:table-cell">
                      {new Date(file.createdAt).toLocaleDateString("fr-FR", {
                        timeZone: "UTC",
                      })}
                    </td>
                    <td className="text-right">
                      <DocumentRowActions
                        file={file}
                        canDownload={canDownload}
                        canDelete={canDelete}
                        onPreview={() => setPreview(file)}
                        onDeleted={removeDocument}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FilePreviewModal
        file={preview}
        files={filtered}
        onClose={() => setPreview(null)}
        onNavigate={setPreview}
        canDownload={canDownload}
      />
    </div>
  );
}
