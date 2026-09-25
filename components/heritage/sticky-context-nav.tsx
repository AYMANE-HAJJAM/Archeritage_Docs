"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { BreadcrumbItem } from "@/lib/structure/breadcrumb";
import { backFromBreadcrumb } from "@/lib/structure/breadcrumb";
import { cn } from "@/lib/utils";

/**
 * Compact sticky context bar under the app topbar.
 * Shows immediate-parent back + full breadcrumb trail while scrolling.
 */
export function StickyContextNav({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  const backTarget = backFromBreadcrumb(items);

  return (
    <div
      className={cn(
        "sticky z-20 -mx-4 -mt-6 mb-5 border-b border-border/70 bg-[color-mix(in_srgb,var(--background)_90%,white)] backdrop-blur-md sm:-mx-6 sm:-mt-8 lg:-mx-8",
        "top-[var(--app-header-height,var(--header-height))]",
        className,
      )}
      style={{ minHeight: "var(--context-nav-height)" }}
    >
      <div className="mx-auto flex h-11 max-w-6xl items-center gap-2.5 px-4 sm:gap-3 sm:px-6 lg:px-8">
        {backTarget ? (
          <Link
            href={backTarget.href}
            aria-label={backTarget.label}
            title={backTarget.label}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm border border-border/80 bg-surface px-2.5 text-xs font-semibold text-foreground transition-colors hover:border-[color-mix(in_srgb,var(--accent)_30%,var(--border))] hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
            <span className="hidden max-w-[14rem] truncate sm:inline">
              {backTarget.label}
            </span>
            <span className="sm:hidden">Retour</span>
          </Link>
        ) : null}

        <nav
          aria-label="Fil d’Ariane"
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ol className="flex w-max max-w-none items-center gap-1 text-xs text-muted-foreground">
            {items.map((item, index) => {
              const last = index === items.length - 1;
              return (
                <li
                  key={`${item.label}-${index}`}
                  className="flex max-w-[12rem] items-center gap-1 sm:max-w-[16rem]"
                >
                  {index > 0 ? (
                    <ChevronRight
                      className="size-3 shrink-0 opacity-60"
                      aria-hidden
                    />
                  ) : null}
                  {item.href && !last ? (
                    <Link
                      href={item.href}
                      className="truncate hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        "truncate",
                        last && "font-medium text-foreground",
                      )}
                      aria-current={last ? "page" : undefined}
                    >
                      {item.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
}
