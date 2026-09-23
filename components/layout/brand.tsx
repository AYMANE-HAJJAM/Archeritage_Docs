import Link from "next/link";

import { cn } from "@/lib/utils";

export function Brand({
  compact = false,
  inverse = false,
}: {
  compact?: boolean;
  /** Light mark on dark surfaces (sidebar). */
  inverse?: boolean;
}) {
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-md font-semibold tracking-[0.14em] text-accent",
          compact ? "h-8 w-8 text-[11px]" : "h-9 w-9 text-xs",
          inverse
            ? "border border-white/15 bg-white/5"
            : "border border-border bg-surface",
        )}
      >
        A
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[11px] font-semibold tracking-[0.16em]",
            inverse ? "text-[#f6f3ec]" : "text-foreground",
          )}
        >
          ARCHERITAGE
        </span>
        <span
          className={cn(
            "mt-1 text-[10px] tracking-[0.2em]",
            inverse ? "text-white/55" : "text-muted-foreground",
          )}
        >
          DOCS
        </span>
      </span>
    </span>
  );
}

export function BrandLink({
  href = "/projects",
  compact = true,
}: {
  href?: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} aria-label="ARCHERITAGE Docs — Accueil">
      <Brand compact={compact} />
    </Link>
  );
}
