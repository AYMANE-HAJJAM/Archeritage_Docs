"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type PartCardModel = {
  id: string;
  slug: string;
  name: string;
  fileCount: number;
};

/** Grid of Part entry points shown at the root of a subdivided project. */
export function PartsGrid({
  projectSlug,
  parts,
}: {
  projectSlug: string;
  parts: PartCardModel[];
}) {
  if (parts.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="section-label mb-2.5">Parties</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {parts.map((part) => (
          <Link
            key={part.id}
            href={`/projects/${projectSlug}/parts/${part.slug}`}
            className="group flex flex-col border border-border bg-surface p-5 transition-colors hover:border-foreground/25 hover:bg-muted/40"
          >
            <h3 className="font-serif text-xl leading-snug text-foreground">
              {part.name}
            </h3>
            <p className="mt-3 text-xs text-muted-foreground">
              {part.fileCount} document{part.fileCount === 1 ? "" : "s"}
            </p>
            <span className="mt-auto inline-flex items-center gap-1 pt-6 text-xs font-medium text-accent">
              Ouvrir
              <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
