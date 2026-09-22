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
          "flex items-center justify-center font-semibold tracking-[0.14em] text-accent",
          compact ? "h-8 w-8 text-[11px]" : "h-9 w-9 text-xs",
          inverse
            ? "border border-white/20 bg-white/5"
            : "border border-border bg-surface",
        )}
      >
        A
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-[11px] font-semibold tracking-[0.18em]",
            inverse ? "text-[#f6f3ec]" : "text-foreground",
          )}
        >
          ARCHERITAGE
        </span>
        <span
          className={cn(
            "mt-1 text-[10px] tracking-[0.22em]",
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
  href = "/territoires/saf",
  compact = true,
}: {
  href?: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} aria-label="ARCHERITAGE Docs — Accueil Safi Patrimoine">
      <Brand compact={compact} />
    </Link>
  );
}
