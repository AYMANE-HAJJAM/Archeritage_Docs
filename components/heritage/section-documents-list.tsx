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

function docStatutTone(statut: string | null | undefined): string {
  switch (statut) {
    case "VALIDE":
      return "documented";
    case "EN_REVISION":
    case "SOUMIS":
      return "invited";
    case "OBSOLETE":
      return "archived";
    default:
      return "empty";
  }
}

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

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {documents.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {documents.length} fichier{documents.length > 1 ? "s" : ""} dans
              cette rubrique
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
          <p className="text-sm font-medium text-foreground">
            Aucun document dans cette rubrique
          </p>
          {uploadContext ? (
            <>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                Importez vos premiers fichiers pour commencer à documenter cette
                rubrique.
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
              Les documents classés dans cette rubrique s&apos;afficheront ici
              dès qu&apos;ils seront ajoutés.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[32rem]">
              <thead>
                <tr>
                  <th>Nom du fichier</th>
                  <th className="hidden w-28 sm:table-cell">Ajouté le</th>
                  <th className="hidden w-24 text-right sm:table-cell">Taille</th>
                  {showStatus && (
                    <th className="hidden w-28 lg:table-cell">Statut</th>
                  )}
                  <th className="w-[7.5rem] text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((file) => (
                  <tr key={file.id} className="group/row">
                    <td className="max-w-72">
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
                            className="block truncate text-[13px] font-medium text-foreground group-hover/row:text-accent"
                            title={file.displayName}
                          >
                            {file.displayName}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground sm:hidden">
                            {formatSize(file.size)}
                            {file.extension ? ` · ${file.extension}` : ""}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="hidden whitespace-nowrap text-xs tabular-nums text-muted-foreground sm:table-cell">
                      {new Date(file.createdAt).toLocaleDateString("fr-FR", {
                        timeZone: "UTC",
                      })}
                    </td>
                    <td className="hidden whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground sm:table-cell">
                      {formatSize(file.size)}
                    </td>
                    {showStatus && (
                      <td className="hidden lg:table-cell">
                        {file.docStatut ? (
                          <span
                            className="status-pill"
                            data-tone={docStatutTone(file.docStatut)}
                          >
                            {STATUT_LABEL[file.docStatut] ?? file.docStatut}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="inline-flex h-7 items-center gap-1 border border-transparent px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
                          onClick={() => setPreview(file)}
                        >
                          <Eye className="size-3.5" aria-hidden />
                          <span className="hidden sm:inline">Aperçu</span>
                        </button>
                        {canDownload ? (
                          <a
                            href={`/api/files/${file.id}/content?download=1`}
                            className="inline-flex h-7 items-center gap-1 border border-transparent px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
                          >
                            <ArrowDownToLine className="size-3.5" aria-hidden />
                            <span className="hidden sm:inline">Télécharger</span>
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
