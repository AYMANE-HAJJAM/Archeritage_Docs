"use client";

import { useState } from "react";
import { X } from "lucide-react";

/** Compact fallback when invitation email cannot be delivered. */
export function ActivationLinkFallbackDialog({
  open,
  url,
  onClose,
}: {
  open: boolean;
  url: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--foreground)_40%,transparent)] p-4 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-fallback-title"
        className="w-full max-w-sm border border-border bg-surface p-5 shadow-[0_16px_48px_rgba(28,27,25,0.12)]"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2
              id="invite-fallback-title"
              className="text-sm font-semibold text-foreground"
            >
              Impossible d’envoyer l’e-mail
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Copiez le lien d’activation et transmettez-le manuellement.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-full items-center justify-center border border-border bg-background text-sm font-medium text-foreground transition-colors hover:bg-muted"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? "Lien copié" : "Copier le lien d’activation"}
        </button>
      </div>
    </div>
  );
}
