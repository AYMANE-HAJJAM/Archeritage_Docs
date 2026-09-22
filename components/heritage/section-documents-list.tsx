"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, Eye, FileText, ImageIcon } from "lucide-react";

import { FilePreviewModal } from "@/components/documents/file-preview";
import {
  ContextualUpload,
  type UploadContextPayload,
} from "@/components/heritage/contextual-upload";
import type { SectionDocument } from "@/lib/heritage/queries/section-documents";
import { formatSize } from "@/lib/utils";

const STATUT_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon",
  EN_REVISION: "En révision",
  SOUMIS: "Soumis",
  VALIDE: "Validé",
  OBSOLETE: "Obsolète",
};

export function SectionDocumentsList({
  documents: initialDocuments,
  title = "Documents",
  uploadContext,
  canDownload = true,
}: {
  documents: SectionDocument[];
  title?: string;
  uploadContext?: UploadContextPayload;
  canDownload?: boolean;
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [docsSource, setDocsSource] = useState(initialDocuments);
  if (initialDocuments !== docsSource) {
    setDocsSource(initialDocuments);
    setDocuments(initialDocuments);
  }
  const [preview, setPreview] = useState<SectionDocument | null>(null);
  function appendDocument(doc: SectionDocument) {
    setDocuments((prev) => {
      if (prev.some((d) => d.id === doc.id)) return prev;
      return [doc, ...prev];
    });
  }

  const showStatus = useMemo(
    () => documents.some((file) => Boolean(file.docStatut)),
    [documents],
  );
  const showVersion = useMemo(
    () => documents.some((file) => Boolean(file.docVersion)),
    [documents],
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </h3>
          {documents.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {documents.length} fichier{documents.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
        {uploadContext ? (
          <ContextualUpload
            context={uploadContext}
            onDocumentUploaded={appendDocument}
          />
        ) : null}
      </div>

      {documents.length === 0 ? (
        <div className="border border-dashed border-border bg-surface px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">
            Aucun document dans cette rubrique
          </p>
          {uploadContext ? (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Cliquez sur « Importer des documents » pour ajouter des fichiers
              ici.
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Les documents classés dans cette rubrique apparaîtront ici.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/55 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Nom</th>
                  <th className="hidden w-20 px-3 py-2 font-semibold md:table-cell">
                    Type
                  </th>
                  <th className="hidden w-28 px-3 py-2 font-semibold sm:table-cell">
                    Date
                  </th>
                  <th className="hidden w-24 px-3 py-2 text-right font-semibold sm:table-cell">
                    Taille
                  </th>
                  <th className="hidden min-w-[8rem] px-3 py-2 font-semibold lg:table-cell">
                    Importé par
                  </th>
                  {showStatus && (
                    <th className="hidden w-28 px-3 py-2 font-semibold xl:table-cell">
                      Statut
                    </th>
                  )}
                  {showVersion && (
                    <th className="hidden w-20 px-3 py-2 font-semibold xl:table-cell">
                      Version
                    </th>
                  )}
                  <th className="w-24 px-2 py-2 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((file) => (
                  <tr
                    key={file.id}
                    className="group border-b border-border/80 transition-colors duration-150 last:border-0 hover:bg-muted/40"
                  >
                    <td className="max-w-72 px-3 py-2">
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
                        <span className="min-w-0">
                          <span
                            className="block truncate text-[13px] font-medium"
                            title={file.displayName}
                          >
                            {file.displayName}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground sm:hidden">
                            {formatSize(file.size)}
                            {file.uploadedByName
                              ? ` · ${file.uploadedByName}`
                              : ""}
                          </span>
                        </span>
                      </button>
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
                    <td className="hidden px-3 text-xs text-muted-foreground lg:table-cell">
                      {file.uploadedByName ?? "—"}
                    </td>
                    {showStatus && (
                      <td className="hidden px-3 text-xs text-muted-foreground xl:table-cell">
                        {file.docStatut
                          ? (STATUT_LABEL[file.docStatut] ?? file.docStatut)
                          : "—"}
                      </td>
                    )}
                    {showVersion && (
                      <td className="hidden px-3 text-xs text-muted-foreground xl:table-cell">
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
                        {canDownload ? (
                          <a
                            href={`/api/files/${file.id}/content?download=1`}
                            className="inline-flex size-7 items-center justify-center text-muted-foreground hover:text-primary"
                            aria-label={`Télécharger ${file.displayName}`}
                          >
                            <ArrowDownToLine className="size-3.5" />
                          </a>
                        ) : null}
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
