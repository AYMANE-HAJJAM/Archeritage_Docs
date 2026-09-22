"use client";

import dynamic from "next/dynamic";
import { ArrowDownToLine, ArrowLeft, FileText, ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { LibraryData } from "@/lib/documents/library";
import { formatSize, isOfficeDocument } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PreviewErrorBoundary } from "@/components/documents/preview-error-boundary";

const DocumentViewer = dynamic(
  () =>
    import("@/components/documents/document-viewer").then(
      (mod) => mod.DocumentViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 bg-zinc-900 text-zinc-300">
        <Loader2 className="size-8 animate-spin text-zinc-400" />
        <p className="text-sm">Chargement du lecteur de documents…</p>
      </div>
    ),
  }
);

type ArchiveFile = LibraryData["files"][number];

interface FilePreviewModalProps {
  file: Pick<
    ArchiveFile,
    | "id"
    | "displayName"
    | "extension"
    | "mimeType"
    | "size"
    | "storageProvider"
  > | null;
  onClose: () => void;
}

export function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  if (!file) return null;

  const isImage = file.storageProvider === "CLOUDINARY";
  const isDocument =
    file.mimeType === "application/pdf" ||
    file.extension.toLowerCase() === "pdf" ||
    isOfficeDocument(file.extension);

  const downloadUrl = `/api/files/${file.id}/content?download=1`;

  const handleDownload = () => {
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  return (
    <Dialog open={!!file} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="flex h-[92vh] max-h-[92vh] w-[94vw] max-w-[94vw] flex-col overflow-hidden p-0 gap-0 border-zinc-700 bg-background shadow-2xl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b bg-card px-5 py-3 pr-14">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <DialogTitle className="truncate text-base font-medium">
                {file.displayName}
              </DialogTitle>
              <span className="shrink-0 rounded-xs bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {file.extension.toUpperCase() || "FICHIER"}
              </span>
            </div>
            <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
              {formatSize(file.size)}
            </DialogDescription>
          </div>
        </div>

        {/* Modal Main Viewport */}
        <div className="relative flex-1 min-h-0 overflow-hidden bg-zinc-900">
          {isImage ? (
            <div className="flex size-full items-center justify-center p-4 bg-muted/30">
              <ArchiveImageView
                src={`/api/files/${file.id}/content`}
                alt={file.displayName}
              />
            </div>
          ) : isDocument ? (
            <PreviewErrorBoundary
              displayName={file.displayName}
              onDownload={handleDownload}
            >
              <DocumentPreviewGate
                fileId={file.id}
                displayName={file.displayName}
                extension={file.extension}
                onDownload={handleDownload}
              />
            </PreviewErrorBoundary>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center text-zinc-300">
              <FileText className="size-14 stroke-1 text-zinc-500" />
              <div>
                <p className="text-base font-medium">
                  Aperçu non pris en charge pour ce type de fichier.
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Téléchargez ce document pour l’ouvrir sur votre poste de travail.
                </p>
              </div>
              <Button onClick={handleDownload} className="mt-2">
                <ArrowDownToLine className="mr-2 size-4" />
                Télécharger l’original ({formatSize(file.size)})
              </Button>
            </div>
          )}
        </div>

        {/* Modal Footer (for non-document or image viewers, toolbar has its own controls) */}
        {isImage && (
          <div className="flex items-center justify-between border-t bg-card px-5 py-2.5">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ArrowLeft className="mr-1.5 size-4" />
              Fermer
            </Button>
            <Button size="sm" asChild>
              <a href={downloadUrl}>
                <ArrowDownToLine className="mr-1.5 size-4" />
                Télécharger
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Probes the preview endpoint before mounting pdf.js so a 422 from missing
 * LibreOffice (Office docs) never surfaces as a route-level crash.
 */
function DocumentPreviewGate({
  fileId,
  displayName,
  extension,
  onDownload,
}: {
  fileId: string;
  displayName: string;
  extension: string;
  onDownload: () => void;
}) {
  const [status, setStatus] = useState<"checking" | "ready" | "unavailable">(
    "checking",
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function probe() {
      setStatus("checking");
      try {
        const response = await fetch(`/api/files/${fileId}/preview`, {
          method: "GET",
          credentials: "include",
          headers: { Range: "bytes=0-1023" },
          signal: controller.signal,
        });

        if (cancelled) return;

        if (response.ok || response.status === 206) {
          setStatus("ready");
          return;
        }

        setStatus("unavailable");
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("unavailable");
      }
    }

    void probe();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fileId]);

  if (status === "checking") {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 bg-zinc-900 text-zinc-300">
        <Loader2 className="size-8 animate-spin text-zinc-400" />
        <p className="text-sm">
          {isOfficeDocument(extension)
            ? "Préparation de l’aperçu…"
            : "Chargement du document…"}
        </p>
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center text-zinc-300">
        <FileText className="size-14 stroke-1 text-zinc-500" aria-hidden />
        <div>
          <p className="text-base font-medium">
            Aperçu indisponible pour ce fichier.
          </p>
          <p className="mt-1 max-w-sm text-xs text-zinc-400">
            {isOfficeDocument(extension)
              ? "La conversion Office → PDF n’est pas disponible sur cet environnement. Téléchargez le document original pour l’ouvrir."
              : "Vous pouvez télécharger le document original pour le consulter."}
          </p>
        </div>
        <Button onClick={onDownload} className="mt-2">
          <ArrowDownToLine className="mr-2 size-4" />
          Télécharger l’original
        </Button>
      </div>
    );
  }

  return (
    <DocumentViewer
      fileId={fileId}
      displayName={displayName}
      onDownload={onDownload}
    />
  );
}

function ArchiveImageView({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        <ImageIcon className="mx-auto mb-2 size-8 text-muted-foreground" />
        <p>Aperçu indisponible. Vous pouvez télécharger le fichier.</p>
      </div>
    );
  }

  // Authenticated byte proxy: Next image optimization must not cache private images publicly.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="max-h-full max-w-full object-contain"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
