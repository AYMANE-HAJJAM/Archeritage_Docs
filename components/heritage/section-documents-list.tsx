"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";

import { DocumentFileGlyph } from "@/components/documents/document-file-glyph";
import { DocumentRowActions } from "@/components/documents/document-row-actions";
import { FilePreviewModal } from "@/components/documents/file-preview";
import {
  ContextualUpload,
  type UploadContextPayload,
} from "@/components/heritage/contextual-upload";
import type { SectionFile } from "@/lib/structure/queries";
import { formatSize } from "@/lib/utils";

export function SectionDocumentsList({
  documents: initialDocuments,
  title = "Documents",
  uploadContext,
  canDownload = true,
  canDelete = false,
  /** True when current location has no direct files but descendant folders do. */
  hasDocumentsInChildFolders = false,
  locationLabel = "cette rubrique",
}: {
  documents: SectionFile[];
  title?: string;
  uploadContext?: UploadContextPayload;
  canDownload?: boolean;
  canDelete?: boolean;
  hasDocumentsInChildFolders?: boolean;
  /** e.g. "cette rubrique" or "ce dossier" */
  locationLabel?: string;
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [docsSource, setDocsSource] = useState(initialDocuments);
  if (initialDocuments !== docsSource) {
    setDocsSource(initialDocuments);
    setDocuments(initialDocuments);
  }
  const [preview, setPreview] = useState<SectionFile | null>(null);

  function appendDocument(doc: SectionFile) {
    setDocuments((prev) => {
      if (prev.some((d) => d.id === doc.id)) return prev;
      return [doc, ...prev];
    });
  }

  function removeDocument(fileId: string) {
    setDocuments((prev) => {
      const index = prev.findIndex((d) => d.id === fileId);
      const next = prev.filter((d) => d.id !== fileId);
      setPreview((current) => {
        if (!current || current.id !== fileId) return current;
        if (next.length === 0) return null;
        if (index >= 0 && index < next.length) return next[index];
        return next[next.length - 1] ?? null;
      });
      return next;
    });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {documents.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {documents.length} fichier{documents.length > 1 ? "s" : ""}{" "}
              directement ici
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
        <div className="border border-dashed border-border bg-surface px-5 py-10 text-center">
          <FileText
            className="mx-auto mb-3 size-8 text-muted-foreground/60"
            aria-hidden
          />
          {hasDocumentsInChildFolders ? (
            <>
              <p className="text-sm font-medium text-foreground">
                Aucun document directement dans {locationLabel}
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                Les documents sont classés dans les dossiers ci-dessus. Ouvrez un
                dossier pour les consulter.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                Aucun document directement dans {locationLabel}
              </p>
              {uploadContext ? (
                <>
                  <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                    Importez vos premiers fichiers pour commencer à documenter{" "}
                    {locationLabel}.
                  </p>
                  <div className="mt-4 flex justify-center">
                    <ContextualUpload
                      context={uploadContext}
                      onDocumentUploaded={appendDocument}
                    />
                  </div>
                </>
              ) : (
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                  Les documents classés ici s&apos;afficheront dès qu&apos;ils
                  seront ajoutés.
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="overflow-hidden border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[32rem]">
              <thead>
                <tr>
                  <th>Nom du fichier</th>
                  <th className="hidden w-24 text-right sm:table-cell">Taille</th>
                  <th className="hidden w-36 md:table-cell">Ajouté par</th>
                  <th className="hidden w-28 sm:table-cell">Ajouté le</th>
                  <th className="w-12 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((file) => (
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
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground sm:hidden">
                            {formatSize(file.size)}
                            {file.uploadedByName ? ` · ${file.uploadedByName}` : ""}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="hidden whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground sm:table-cell">
                      {formatSize(file.size)}
                    </td>
                    <td className="hidden max-w-36 truncate text-xs text-muted-foreground md:table-cell">
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
        files={documents}
        onClose={() => setPreview(null)}
        onNavigate={setPreview}
        canDownload={canDownload}
      />
    </div>
  );
}
