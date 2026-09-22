"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SectionDocument } from "@/lib/heritage/queries/section-documents";
import { formatSize } from "@/lib/utils";

export type UploadContextPayload = {
  documentScope: "PROJECT_SECTION";
  docCategorie: string;
  projectId?: string;
};

type UploadItem = {
  name: string;
  size: number;
  progress: number;
  status: "waiting" | "uploading" | "done" | "error";
  error?: string;
};

function statusLabel(item: UploadItem) {
  switch (item.status) {
    case "waiting":
      return "En attente";
    case "uploading":
      return item.progress >= 95 ? "Enregistrement…" : `Envoi… ${item.progress}%`;
    case "done":
      return "Terminé";
    case "error":
      return "Erreur";
  }
}

export function ContextualUpload({
  context,
  label = "Importer des documents",
  className,
  disabled = false,
  onDocumentUploaded,
  onBatchComplete,
  onBusyChange,
}: {
  context: UploadContextPayload;
  label?: string;
  className?: string;
  disabled?: boolean;
  onDocumentUploaded?: (doc: SectionDocument) => void;
  onBatchComplete?: (result: { done: number; failed: number }) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  async function uploadFiles(selected: FileList | File[]) {
    if (busy.current || disabled || !selected.length) return;
    busy.current = true;
    setIsUploading(true);
    onBusyChange?.(true);

    const files = Array.from(selected);
    setUploads(
      files.map((file) => ({
        name: file.name,
        size: file.size,
        progress: 0,
        status: "waiting",
      })),
    );

    const update = (index: number, patch: Partial<UploadItem>) =>
      setUploads((items) =>
        items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      );

    let done = 0;
    let failed = 0;

    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        update(index, { status: "uploading", progress: 0 });
        try {
          const doc = await new Promise<SectionDocument>((resolve, reject) => {
            const request = new XMLHttpRequest();
            request.open("POST", "/api/files");
            request.upload.onprogress = (event) => {
              if (!event.lengthComputable) return;
              const progress = Math.min(
                95,
                Math.round((event.loaded / event.total) * 95),
              );
              update(index, { progress });
            };
            request.onload = () => {
              if (request.status >= 200 && request.status < 300) {
                try {
                  const payload = JSON.parse(
                    request.responseText,
                  ) as SectionDocument;
                  resolve(payload);
                } catch {
                  reject(new Error("Réponse serveur invalide."));
                }
                return;
              }
              let message = "L’envoi a échoué.";
              try {
                const payload = JSON.parse(request.responseText) as {
                  error?: string;
                };
                if (payload.error) message = payload.error;
              } catch {
                /* ignore */
              }
              reject(new Error(message));
            };
            request.onerror = () =>
              reject(new Error("Connexion interrompue pendant l’envoi."));

            const form = new FormData();
            form.append("file", file);
            form.append("documentScope", context.documentScope);
            form.append("docCategorie", context.docCategorie);
            if (context.projectId) form.append("projectId", context.projectId);
            request.send(form);
          });
          onDocumentUploaded?.(doc);
          update(index, { status: "done", progress: 100 });
          done += 1;
        } catch (error) {
          failed += 1;
          update(index, {
            status: "error",
            error:
              error instanceof Error ? error.message : "L’envoi a échoué.",
          });
        }
      }
    } finally {
      busy.current = false;
      setIsUploading(false);
      onBusyChange?.(false);
      if (input.current) input.current.value = "";
      // Background consistency only — UI already updated from response.
      if (done > 0) router.refresh();
      onBatchComplete?.({ done, failed });
    }
  }

  return (
    <div className={className}>
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        aria-label="Sélectionner des fichiers"
        disabled={disabled || isUploading}
        onChange={(event) => {
          if (event.target.files) void uploadFiles(event.target.files);
        }}
      />

      <Button
        type="button"
        size="sm"
        variant="accent"
        disabled={disabled || isUploading}
        onClick={() => input.current?.click()}
      >
        <Upload />
        {label}
      </Button>

      {uploads.length > 0 && (
        <section
          aria-label="File d’envoi"
          className="mt-3 border border-border bg-surface p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-xs font-medium text-foreground">
              {isUploading
                ? "Envoi en cours — gardez cette page ouverte"
                : "Envois terminés"}
            </h4>
            {!isUploading && (
              <button
                type="button"
                className="inline-flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Masquer la file d’envoi"
                onClick={() => setUploads([])}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-48 space-y-2 overflow-y-auto" aria-live="polite">
            {uploads.map((item, index) => (
              <div key={`${item.name}-${index}`} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {item.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatSize(item.size)}
                  </span>
                  <span className="flex w-28 shrink-0 items-center justify-end gap-1 text-[11px] text-muted-foreground">
                    {item.status === "done" ? (
                      <>
                        <Check className="size-3.5 text-foreground" />
                        Terminé
                      </>
                    ) : item.status === "error" ? (
                      <span className="text-destructive">Erreur</span>
                    ) : (
                      statusLabel(item)
                    )}
                  </span>
                </div>
                {item.error ? (
                  <p className="mt-0.5 text-[11px] text-destructive">
                    {item.error}
                  </p>
                ) : null}
                {item.status === "uploading" ? (
                  <div className="mt-1 h-1 overflow-hidden bg-muted">
                    <div
                      className="h-full bg-accent transition-[width] duration-150"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
