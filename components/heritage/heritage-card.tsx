"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type HeritageCardAdminAction = {
  id: string;
  label: string;
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
  /** When true, the menu item is non-interactive (e.g. mutation in flight). */
  disabled?: boolean;
};

/**
 * Shared project / dossier card — same visual language for USER and ADMIN.
 * Entire card is the primary link; optional admin menu sits outside the link.
 */
export function HeritageCard({
  href,
  title,
  description,
  meta,
  code,
  adminActions,
  footerExtra,
}: {
  href: string;
  title: string;
  description: string;
  meta: string;
  /** Optional territory/platform code (serif accent), as on the user territory picker. */
  code?: string;
  adminActions?: HeritageCardAdminAction[];
  /** Optional panel (e.g. edit form) rendered under the card. */
  footerExtra?: React.ReactNode;
}) {
  return (
    <div className="space-y-0">
      <div className="group relative">
        {adminActions && adminActions.length > 0 ? (
          <div className="absolute right-3 top-3 z-20 sm:right-4 sm:top-4">
            <HeritageCardAdminMenu actions={adminActions} />
          </div>
        ) : null}

        <Link
          href={href}
          aria-label={`Consulter ${title}`}
          className={cn(
            "relative flex min-h-[12.5rem] flex-col rounded-md border border-border bg-surface p-5 transition-[border-color,background-color,box-shadow] duration-150 sm:min-h-[13.5rem] sm:p-6",
            "hover:border-[color-mix(in_srgb,var(--accent)_38%,var(--border))] hover:bg-[color-mix(in_srgb,var(--surface)_90%,var(--muted))] hover:shadow-[var(--shadow-card-hover)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            adminActions?.length ? "pr-12 sm:pr-14" : null,
          )}
        >
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 rounded-t-md bg-accent transition-transform duration-200 group-hover:scale-x-100"
          />

          {code ? (
            <p className="font-serif text-xl font-medium tabular-nums tracking-tight text-accent/90 sm:text-2xl">
              {code}
            </p>
          ) : null}

          <h2
            className={cn(
              "page-title text-[1.35rem] sm:text-[1.5rem]",
              code ? "mt-2.5" : "mt-0.5",
            )}
          >
            {title}
          </h2>

          <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
            {description}
          </p>

          <div className="mt-auto flex items-end justify-between gap-3 pt-6">
            <p className="text-[11px] font-medium leading-5 tracking-wide text-muted-foreground">
              {meta}
            </p>
            <span
              aria-hidden
              className="shrink-0 text-[11px] font-semibold text-accent opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            >
              Consulter →
            </span>
          </div>
        </Link>
      </div>
      {footerExtra}
    </div>
  );
}

export function HeritageCardAdminMenu({
  actions,
}: {
  actions: HeritageCardAdminAction[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Actions de gestion"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
          className={cn(
          "inline-flex size-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors",
          "hover:border-border hover:bg-background hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "border-border bg-background text-foreground",
        )}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[11rem] rounded-md border border-border bg-surface py-1 shadow-[var(--shadow-panel)]"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {actions.map((action) =>
            action.href ? (
              <Link
                key={action.id}
                role="menuitem"
                href={action.href}
                aria-disabled={action.disabled || undefined}
                tabIndex={action.disabled ? -1 : undefined}
                className={cn(
                  "block px-3 py-2 text-xs font-medium transition-colors hover:bg-muted",
                  action.destructive ? "text-destructive" : "text-foreground",
                  action.disabled && "pointer-events-none opacity-50",
                )}
                onClick={(e) => {
                  if (action.disabled) {
                    e.preventDefault();
                    return;
                  }
                  setOpen(false);
                }}
              >
                {action.label}
              </Link>
            ) : (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                disabled={action.disabled}
                className={cn(
                  "block w-full px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50",
                  action.destructive ? "text-destructive" : "text-foreground",
                )}
                onClick={() => {
                  if (action.disabled) return;
                  setOpen(false);
                  action.onSelect?.();
                }}
              >
                {action.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
