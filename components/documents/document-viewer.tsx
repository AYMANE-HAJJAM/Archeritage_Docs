"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ArrowDownToLine, ChevronLeft, ChevronRight, FileText, Loader2, Minus, Plus, Scaling } from "lucide-react";
import { Button } from "@/components/ui/button";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

const emptySubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

interface DocumentViewerProps {
  fileId: string;
  displayName: string;
  onDownload?: () => void;
}

export function DocumentViewer({ fileId, displayName, onDownload }: DocumentViewerProps) {
  const mounted = useMounted();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState<number>(1.0);
  const [fitWidth, setFitWidth] = useState<boolean>(true);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [error, setError] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Track container width for Fit Width calculations
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      // Deduct internal padding and scrollbar allowance
      const available = Math.max(320, container.clientWidth - 48);
      setContainerWidth(available);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [mounted]);

  // Track currently visible page during vertical scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !numPages) return;

    const handleScroll = () => {
      const containerTop = container.scrollTop;
      const containerMid = containerTop + container.clientHeight / 3;

      let closestPage = 1;
      let minDistance = Infinity;

      pageRefs.current.forEach((el, pageNum) => {
        const pageTop = el.offsetTop;
        const distance = Math.abs(pageTop - containerMid);
        if (distance < minDistance) {
          minDistance = distance;
          closestPage = pageNum;
        }
      });

      setCurrentPage(closestPage);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [numPages]);

  const handleZoomIn = () => {
    setFitWidth(false);
    setScale((prev) => Math.min(2.5, Math.round((prev + 0.15) * 100) / 100));
  };

  const handleZoomOut = () => {
    setFitWidth(false);
    setScale((prev) => Math.max(0.5, Math.round((prev - 0.15) * 100) / 100));
  };

  const handleFitWidthToggle = () => {
    setFitWidth((prev) => !prev);
    if (!fitWidth) {
      setScale(1.0);
    }
  };

  const scrollToPage = (target: number) => {
    const el = pageRefs.current.get(target);
    if (el && containerRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (!mounted) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center bg-zinc-900 text-zinc-300">
        <Loader2 className="size-7 animate-spin text-zinc-400" />
      </div>
    );
  }

  const previewSource = {
    url: `/api/files/${fileId}/preview`,
    withCredentials: true,
  };

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-zinc-900 select-none"
      aria-label={`Aperçu de ${displayName}`}
    >
      {/* Viewer toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-700/60 bg-zinc-950/80 px-4 py-2 text-xs text-zinc-300">
        {/* Page navigation */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage <= 1 || !numPages}
            onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
            className="size-7 p-0 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            aria-label="Page précédente"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-20 text-center font-mono">
            {numPages ? `${currentPage} / ${numPages}` : "—"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!numPages || currentPage >= numPages}
            onClick={() => numPages && scrollToPage(Math.min(numPages, currentPage + 1))}
            className="size-7 p-0 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            aria-label="Page suivante"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Zoom and display controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={scale <= 0.5 || fitWidth}
            onClick={handleZoomOut}
            className="size-7 p-0 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            aria-label="Zoom arrière"
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="min-w-14 text-center font-mono text-zinc-300">
            {fitWidth ? "Largeur" : `${Math.round(scale * 100)} %`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={scale >= 2.5 || fitWidth}
            onClick={handleZoomIn}
            className="size-7 p-0 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            aria-label="Zoom avant"
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFitWidthToggle}
            className={`h-7 px-2 text-xs transition-colors ${
              fitWidth
                ? "bg-zinc-800 text-white font-medium"
                : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
            title="Ajuster à la largeur de la fenêtre"
          >
            <Scaling className="mr-1 size-3.5" />
            Ajuster
          </Button>
        </div>

        {/* Download original button in toolbar */}
        {onDownload && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownload}
            className="h-7 px-2.5 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            <ArrowDownToLine className="mr-1.5 size-3.5" />
            Télécharger
          </Button>
        )}
      </div>

      {/* Main viewer canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6"
      >
        <div className="flex flex-col items-center">
          <Document
            file={previewSource}
            onLoadSuccess={({ numPages }) => {
              setNumPages(numPages);
              setError(false);
            }}
            onLoadError={(err) => {
              console.error("PDF preview load error:", err);
              setError(true);
            }}
            loading={
              <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-zinc-400">
                <Loader2 className="size-8 animate-spin text-zinc-400" />
                <p className="text-sm">Chargement du document…</p>
              </div>
            }
            error={
              <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center text-zinc-300">
                <FileText className="size-12 stroke-1 text-zinc-500" />
                <div>
                  <p className="text-sm font-medium">
                    Aperçu indisponible pour ce fichier.
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Vous pouvez télécharger le document original pour le consulter.
                  </p>
                </div>
                {onDownload && (
                  <Button
                    onClick={onDownload}
                    className="mt-2 bg-primary text-primary-foreground"
                  >
                    <ArrowDownToLine className="mr-2 size-4" />
                    Télécharger
                  </Button>
                )}
              </div>
            }
          >
            {!error &&
              numPages &&
              Array.from({ length: numPages }, (_, index) => {
                const pageNumber = index + 1;
                return (
                  <div
                    key={`page_${pageNumber}`}
                    ref={(el) => {
                      if (el) pageRefs.current.set(pageNumber, el);
                      else pageRefs.current.delete(pageNumber);
                    }}
                    className="mb-6 overflow-hidden rounded-xs bg-white shadow-2xl transition-transform"
                  >
                    <Page
                      pageNumber={pageNumber}
                      scale={fitWidth ? undefined : scale}
                      width={fitWidth ? containerWidth : undefined}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      loading={
                        <div
                          className="flex items-center justify-center bg-white text-zinc-400"
                          style={{
                            width: fitWidth ? containerWidth : 600 * scale,
                            height: (fitWidth ? containerWidth : 600 * scale) * 1.3,
                          }}
                        >
                          <Loader2 className="size-6 animate-spin text-zinc-300" />
                        </div>
                      }
                    />
                  </div>
                );
              })}
          </Document>
        </div>
      </div>
    </div>
  );
}
