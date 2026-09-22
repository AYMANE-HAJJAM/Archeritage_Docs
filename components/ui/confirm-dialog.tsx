"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive = false,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="pr-8 text-base font-semibold tracking-tight">
          {title}
        </DialogTitle>
        {description ? (
          <DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </DialogDescription>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => onOpenChange(false)}
            className="h-9 border border-border px-3 text-sm hover:bg-muted disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              onConfirm();
            }}
            className={
              destructive
                ? "h-9 bg-destructive px-3 text-sm font-medium text-white disabled:opacity-60"
                : "h-9 bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            }
          >
            {pending ? "…" : confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
