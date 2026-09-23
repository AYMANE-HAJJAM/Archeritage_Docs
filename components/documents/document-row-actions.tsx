"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownToLine,
  Eye,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type DeletableDocument = {
  id: string;
  displayName: string;
};

type DocumentRowActionsProps = {
  file: DeletableDocument;
  canDownload?: boolean;
  canDelete?: boolean;
  onPreview: () => void;
  /** Called after a successful server delete (local list update). */
  onDeleted: (fileId: string) => void;
};

export function DocumentRowActions({
  file,
  canDownload = true,
  canDelete = false,
  onPreview,
  onDeleted,
}: DocumentRowActionsProps) {
  const { pushToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 168;
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.min(rect.right - width, window.innerWidth - width - 8),
    });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(event: MouseEvent) {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function confirmDelete() {
    setBusy(true);
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        let message = "Impossible de supprimer ce document.";
        try {
          const body = (await response.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // keep default
        }
        pushToast(message, "error");
        return;
      }
      setConfirmOpen(false);
      onDeleted(file.id);
      pushToast("Document supprimé.", "success");
    } catch {
      pushToast("Impossible de supprimer ce document.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="relative flex justify-end">
        <button
          ref={triggerRef}
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label={`Actions pour ${file.displayName}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      {menuOpen && menuPos && typeof document !== "undefined"
        ? createPortal(
            <div
              role="menu"
              className="fixed z-50 min-w-[10.5rem] border border-border bg-background py-1 shadow-md"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs hover:bg-muted"
                onClick={() => {
                  setMenuOpen(false);
                  onPreview();
                }}
              >
                <Eye className="size-3.5" aria-hidden />
                Aperçu
              </button>
              {canDownload ? (
                <a
                  role="menuitem"
                  href={`/api/files/${file.id}/content?download=1`}
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs hover:bg-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  <ArrowDownToLine className="size-3.5" aria-hidden />
                  Télécharger
                </a>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-destructive hover:bg-muted"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Supprimer
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}

      <DeleteDocumentDialog
        open={confirmOpen}
        fileName={file.displayName}
        busy={busy}
        onOpenChange={(open) => {
          if (!busy) setConfirmOpen(open);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}

export function DeleteDocumentDialog({
  open,
  fileName,
  busy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  fileName: string;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle className="pr-8 text-xl font-medium">
          Supprimer ce document ?
        </DialogTitle>
        <DialogDescription className="mt-3 text-sm leading-6 text-muted-foreground">
          Cette action supprimera le document de la plateforme.
        </DialogDescription>
        <p
          className={cn(
            "mt-3 break-words rounded-sm border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground",
          )}
          title={fileName}
        >
          {fileName}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Supprimer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
