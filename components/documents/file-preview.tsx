"use client";

import dynamic from "next/dynamic";
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  FileText,
  ImageIcon,
  Loader2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PreviewErrorBoundary } from "@/components/documents/preview-error-boundary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fileContentUrl,
  fileDownloadUrl,
  fileTypeBadge,
  fileVideoPreviewUrl,
  isBrowserPlayableVideo,
  isImageFile,
  isVideoFile,
  type PreviewableFile,
} from "@/lib/documents/file-kind";
import { formatSize, isOfficeDocument } from "@/lib/utils";

const DocumentViewer = dynamic(
  () =>
    import("@/components/documents/document-viewer").then(
      (mod) => mod.DocumentViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 bg-zinc-900 text-zinc-300">
        <Loader2 className="size-8 animate-spin text-zinc-400" />
        <p className="text-sm">Chargement du lecteur de documents…</p>
      </div>
    ),
  },
);

export type { PreviewableFile };

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true']"));
}

/**
 * Full-screen document preview with optional previous/next navigation over
 * the currently visible file list (any mix of images, PDF, Office, video).
 */
export function FilePreviewModal<T extends PreviewableFile>({
  file,
  files,
  onClose,
  onNavigate,
  canDownload = true,
}: {
  file: T | null;
  /** Visible list order — navigation stays within this array. */
  files?: T[];
  onClose: () => void;
  /** Called when user moves to another file in `files`. */
  onNavigate?: (next: T) => void;
  canDownload?: boolean;
}) {
  const list = useMemo(() => {
    if (files && files.length > 0) return files;
    return file ? [file] : [];
  }, [files, file]);

  const index = file ? list.findIndex((f) => f.id === file.id) : -1;
  const canPrev = Boolean(onNavigate && list.length > 1 && index > 0);
  const canNext = Boolean(
    onNavigate && list.length > 1 && index >= 0 && index < list.length - 1,
  );

  useEffect(() => {
    if (!file) return;

    function onKey(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (!onNavigate || list.length <= 1 || index < 0) return;
      if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        onNavigate(list[index - 1]);
      } else if (event.key === "ArrowRight" && index < list.length - 1) {
        event.preventDefault();
        onNavigate(list[index + 1]);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [file, list, index, onClose, onNavigate]);

  if (!file) return null;

  const image = isImageFile(file);
  const video = isVideoFile(file);
  const isDocumentFile =
    file.mimeType === "application/pdf" ||
    file.extension.toLowerCase() === "pdf" ||
    isOfficeDocument(file.extension);

  const downloadUrl = fileDownloadUrl(file.id);
  const positionLabel =
    index >= 0 && list.length > 0 ? `${index + 1} / ${list.length}` : null;

  const handleDownload = () => {
    const anchor = globalThis.document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "";
    globalThis.document.body.appendChild(anchor);
    anchor.click();
    globalThis.document.body.removeChild(anchor);
  };

  return (
    <Dialog
      open={!!file}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="flex h-[92vh] max-h-[92vh] w-[94vw] max-w-[94vw] flex-col gap-0 overflow-hidden border-zinc-700 bg-background p-0 shadow-2xl"
        aria-describedby={undefined}
        hideCloseButton
      >
        <div className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <DialogTitle className="truncate text-base font-medium">
                {file.displayName}
              </DialogTitle>
              <span className="shrink-0 rounded-xs bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {fileTypeBadge(file)}
              </span>
            </div>
            <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
              {[formatSize(file.size), positionLabel].filter(Boolean).join(" · ")}
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {canDownload ? (
              <Button size="sm" variant="outline" asChild>
                <a href={downloadUrl}>
                  <ArrowDownToLine className="size-4" />
                  <span className="hidden sm:inline">Télécharger</span>
                </a>
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Fermer l’aperçu"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-zinc-900">
          {canPrev ? (
            <button
              type="button"
              aria-label="Document précédent"
              onClick={() => onNavigate?.(list[index - 1])}
              className="absolute left-2 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65 sm:left-3 sm:size-11"
            >
              <ChevronLeft className="size-5" />
            </button>
          ) : null}
          {canNext ? (
            <button
              type="button"
              aria-label="Document suivant"
              onClick={() => onNavigate?.(list[index + 1])}
              className="absolute right-2 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65 sm:right-3 sm:size-11"
            >
              <ChevronRight className="size-5" />
            </button>
          ) : null}

          {image ? (
            <div className="flex size-full items-center justify-center bg-muted/20 p-4 sm:p-6">
              <ArchiveImageView
                key={file.id}
                src={fileContentUrl(file.id)}
                alt={file.displayName}
              />
            </div>
          ) : video ? (
            <VideoPreviewGate
              key={file.id}
              file={file}
              onDownload={handleDownload}
              canDownload={canDownload}
            />
          ) : isDocumentFile ? (
            <PreviewErrorBoundary
              displayName={file.displayName}
              onDownload={canDownload ? handleDownload : undefined}
            >
              <DocumentPreviewGate
                key={file.id}
                fileId={file.id}
                displayName={file.displayName}
                extension={file.extension}
                onDownload={handleDownload}
                canDownload={canDownload}
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
                  Téléchargez ce document pour l’ouvrir sur votre poste de
                  travail.
                </p>
              </div>
              {canDownload ? (
                <Button onClick={handleDownload} className="mt-2">
                  <ArrowDownToLine className="mr-2 size-4" />
                  Télécharger l’original ({formatSize(file.size)})
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VideoPreviewGate({
  file,
  onDownload,
  canDownload,
}: {
  file: PreviewableFile;
  onDownload: () => void;
  canDownload: boolean;
}) {
  if (isBrowserPlayableVideo(file)) {
    return (
      <div className="flex size-full items-center justify-center p-3 sm:p-6">
        <video
          key={file.id}
          src={fileContentUrl(file.id)}
          controls
          playsInline
          className="max-h-full max-w-full rounded-sm bg-black"
          preload="metadata"
        >
          <track kind="captions" />
        </video>
      </div>
    );
  }

  return (
    <VideoDerivativePlayer
      key={file.id}
      fileId={file.id}
      onDownload={onDownload}
      canDownload={canDownload}
    />
  );
}

function VideoDerivativePlayer({
  fileId,
  onDownload,
  canDownload,
}: {
  fileId: string;
  onDownload: () => void;
  canDownload: boolean;
}) {
  const [status, setStatus] = useState<"checking" | "ready" | "unavailable">(
    "checking",
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function prepareDerivative() {
      try {
        const response = await fetch(fileVideoPreviewUrl(fileId), {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
          cache: "no-store",
          headers: { Range: "bytes=0-1" },
        });

        if (cancelled) return;

        if (response.ok || response.status === 206) {
          setStatus("ready");
          return;
        }

        // Expected: 415/422 when ffmpeg is missing or conversion fails.
        // Do not console.error — that surfaces as a Next.js "Issue" overlay.
        setStatus("unavailable");
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("unavailable");
      }
    }

    void prepareDerivative();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fileId]);

  if (status === "checking") {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 bg-zinc-900 text-zinc-300">
        <Loader2 className="size-8 animate-spin text-zinc-400" />
        <p className="text-sm">Préparation de l’aperçu vidéo…</p>
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center text-zinc-300">
        <FileText className="size-14 stroke-1 text-zinc-500" aria-hidden />
        <div>
          <p className="text-base font-medium">
            Aperçu vidéo indisponible pour ce fichier.
          </p>
          <p className="mt-1 max-w-sm text-xs text-zinc-400">
            Téléchargez l’original pour le lire avec un lecteur compatible.
          </p>
        </div>
        {canDownload ? (
          <Button onClick={onDownload} className="mt-2">
            <ArrowDownToLine className="mr-2 size-4" />
            Télécharger l’original
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex size-full items-center justify-center p-3 sm:p-6">
      <video
        key={fileId}
        src={fileVideoPreviewUrl(fileId)}
        controls
        playsInline
        className="max-h-full max-w-full rounded-sm bg-black"
        preload="metadata"
      >
        <track kind="captions" />
      </video>
    </div>
  );
}

function DocumentPreviewGate({
  fileId,
  displayName,
  extension,
  onDownload,
  canDownload,
}: {
  fileId: string;
  displayName: string;
  extension: string;
  onDownload: () => void;
  canDownload: boolean;
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
          signal: controller.signal,
          cache: "no-store",
        });

        if (cancelled) return;

        if (response.ok || response.status === 206) {
          setStatus("ready");
          return;
        }

        try {
          const body = (await response.json()) as {
            code?: string;
            error?: string;
          };
          console.error("[preview] unavailable", {
            fileId,
            status: response.status,
            code: body.code,
            error: body.error,
          });
        } catch {
          console.error("[preview] unavailable", {
            fileId,
            status: response.status,
          });
        }

        setStatus("unavailable");
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("[preview] probe failed", { fileId, error });
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
            Impossible de générer l’aperçu de ce document.
          </p>
          <p className="mt-1 max-w-sm text-xs text-zinc-400">
            {isOfficeDocument(extension)
              ? "Téléchargez le document original pour l’ouvrir sur votre poste."
              : "Vous pouvez télécharger le document original pour le consulter."}
          </p>
        </div>
        {canDownload ? (
          <Button onClick={onDownload} className="mt-2">
            <ArrowDownToLine className="mr-2 size-4" />
            Télécharger l’original
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <DocumentViewer
      fileId={fileId}
      displayName={displayName}
      onDownload={canDownload ? onDownload : undefined}
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

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="max-h-full max-w-full object-contain"
      loading="eager"
      onError={() => setFailed(true)}
    />
  );
}
