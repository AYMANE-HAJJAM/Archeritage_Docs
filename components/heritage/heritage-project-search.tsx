"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Folder,
  Layers,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { FilePreviewModal } from "@/components/documents/file-preview";
import type { HeritageProjectSearchResult } from "@/lib/heritage/queries/project-search";
import { cn } from "@/lib/utils";

type PreviewFile = {
  id: string;
  displayName: string;
  extension: string;
  mimeType: string;
  size: number;
  storageProvider: "CLOUDINARY" | "BACKBLAZE_B2";
};

type FlatItem =
  | { kind: "section"; id: string; href: string; label: string; meta?: string }
  | {
      kind: "document";
      id: string;
      href: string;
      label: string;
      meta?: string;
      preview: PreviewFile;
    }
  | { kind: "folder"; id: string; href: string; label: string };

type HeritageProjectSearchProps = {
  projectSlug: string;
};

const DEBOUNCE_MS = 300;

function buildFlatItems(result: HeritageProjectSearchResult | null): FlatItem[] {
  if (!result) return [];
  const items: FlatItem[] = [];
  for (const s of result.sections) {
    items.push({
      kind: "section",
      id: s.id,
      href: s.href,
      label: `${s.code} ${s.title}`,
      meta: s.groupLabel ?? undefined,
    });
  }
  for (const d of result.documents) {
    items.push({
      kind: "document",
      id: d.id,
      href: d.href,
      label: d.displayName,
      meta: d.sectionCode
        ? `${d.sectionCode}${d.sectionTitle ? ` · ${d.sectionTitle}` : ""}`
        : undefined,
      preview: {
        id: d.id,
        displayName: d.displayName,
        extension: d.extension,
        mimeType: d.mimeType,
        size: d.size,
        storageProvider: d.storageProvider,
      },
    });
  }
  for (const f of result.folders) {
    items.push({
      kind: "folder",
      id: f.id,
      href: f.href,
      label: f.name,
    });
  }
  return items;
}

export function HeritageProjectSearch({ projectSlug }: HeritageProjectSearchProps) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HeritageProjectSearchResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [preview, setPreview] = useState<PreviewFile | null>(null);

  const flatItems = useMemo(() => buildFlatItems(result), [result]);
  const sectionOffset = 0;
  const documentOffset = result?.sections.length ?? 0;
  const folderOffset = documentOffset + (result?.documents.length ?? 0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;

    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectSlug)}/search?mode=heritage&q=${encodeURIComponent(q)}`,
          { credentials: "same-origin", signal: controller.signal },
        );
        if (!res.ok) throw new Error("search_failed");
        const data = (await res.json()) as HeritageProjectSearchResult;
        if (!cancelled) {
          setResult(data);
          setOpen(true);
          setActiveIndex(-1);
        }
      } catch (err) {
        if (
          cancelled ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          return;
        }
        if (!cancelled) {
          setResult({
            q,
            sections: [],
            documents: [],
            folders: [],
            totals: { sections: 0, documents: 0, folders: 0 },
          });
          setOpen(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [projectSlug, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const activate = useCallback(
    (item: FlatItem) => {
      setOpen(false);
      if (item.kind === "document") {
        setPreview(item.preview);
        return;
      }
      router.push(item.href, { scroll: false });
    },
    [router],
  );

  function clearSearch() {
    setQuery("");
    setResult(null);
    setLoading(false);
    setActiveIndex(-1);
    setOpen(false);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (value.trim().length < 2) {
      setResult(null);
      setLoading(false);
      setActiveIndex(-1);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else if (query) {
        clearSearch();
      }
      return;
    }
    if (!open || flatItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? flatItems.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      activate(flatItems[activeIndex]!);
    }
  }

  const showPanel = open && query.trim().length >= 2;
  const hasHits =
    result &&
    (result.sections.length > 0 ||
      result.documents.length > 0 ||
      result.folders.length > 0);
  const hasMore =
    result &&
    (result.totals.sections > result.sections.length ||
      result.totals.documents > result.documents.length ||
      result.totals.folders > result.folders.length);

  return (
    <>
      <div ref={rootRef} className="relative z-30 min-w-0 flex-1 overflow-visible sm:min-w-[14rem]">
        <label htmlFor={`${listId}-input`} className="sr-only">
          Rechercher une rubrique ou un document
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id={`${listId}-input`}
            type="search"
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
            }
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => {
              if (query.trim().length >= 2) setOpen(true);
            }}
            onKeyDown={onKeyDown}
            placeholder="Rechercher une rubrique ou un document…"
            autoComplete="off"
            className="h-9 w-full border border-border bg-background py-2 pl-9 pr-9 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
            {loading ? (
              <Loader2
                className="size-3.5 animate-spin text-muted-foreground"
                aria-label="Recherche en cours"
              />
            ) : query ? (
              <button
                type="button"
                className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Effacer la recherche"
                onClick={clearSearch}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        {showPanel ? (
          <div
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 z-50 mt-1.5 max-h-[min(26rem,70vh)] overflow-y-auto overscroll-contain border border-border bg-surface shadow-[var(--shadow-panel)]"
          >
            {loading && !result ? (
              <p className="px-4 py-4 text-xs text-muted-foreground">
                Recherche en cours…
              </p>
            ) : !hasHits ? (
              <div className="px-4 py-4">
                <p className="text-sm font-medium text-foreground">
                  Aucun résultat pour « {query.trim()} »
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Essayez un autre mot-clé, un code de rubrique ou le nom d&apos;un
                  document.
                </p>
              </div>
            ) : (
              <>
                {result!.sections.length > 0 ? (
                  <ResultGroup title="Rubriques" count={result!.totals.sections}>
                    {result!.sections.map((s, i) => {
                      const idx = sectionOffset + i;
                      return (
                        <ResultRow
                          key={`s-${s.id}`}
                          id={`${listId}-opt-${idx}`}
                          active={activeIndex === idx}
                          icon={<Layers className="size-3.5" />}
                          label={`${s.code} ${s.title}`}
                          meta={s.groupLabel}
                          hint="Ouvrir la rubrique"
                          onSelect={() => activate(flatItems[idx]!)}
                          onHover={() => setActiveIndex(idx)}
                        />
                      );
                    })}
                  </ResultGroup>
                ) : null}

                {result!.documents.length > 0 ? (
                  <ResultGroup title="Documents" count={result!.totals.documents}>
                    {result!.documents.map((d, i) => {
                      const idx = documentOffset + i;
                      return (
                        <ResultRow
                          key={`d-${d.id}`}
                          id={`${listId}-opt-${idx}`}
                          active={activeIndex === idx}
                          icon={<FileText className="size-3.5" />}
                          label={d.displayName}
                          meta={
                            d.sectionCode
                              ? `${d.sectionCode}${d.sectionTitle ? ` · ${d.sectionTitle}` : ""}`
                              : undefined
                          }
                          hint="Aperçu"
                          onSelect={() => activate(flatItems[idx]!)}
                          onHover={() => setActiveIndex(idx)}
                        />
                      );
                    })}
                  </ResultGroup>
                ) : null}

                {result!.folders.length > 0 ? (
                  <ResultGroup title="Dossiers" count={result!.totals.folders}>
                    {result!.folders.map((f, i) => {
                      const idx = folderOffset + i;
                      return (
                        <ResultRow
                          key={`f-${f.id}`}
                          id={`${listId}-opt-${idx}`}
                          active={activeIndex === idx}
                          icon={<Folder className="size-3.5" />}
                          label={f.name}
                          hint="Ouvrir le dossier"
                          onSelect={() => activate(flatItems[idx]!)}
                          onHover={() => setActiveIndex(idx)}
                        />
                      );
                    })}
                  </ResultGroup>
                ) : null}

                {hasMore ? (
                  <button
                    type="button"
                    className="block w-full border-t border-border px-4 py-2.5 text-left text-xs font-semibold text-accent transition-colors hover:bg-muted/50"
                    onClick={() => {
                      setOpen(false);
                      router.push(
                        `/projects/${projectSlug}/documents?q=${encodeURIComponent(query.trim())}`,
                      );
                    }}
                  >
                    Voir tous les résultats dans la liste complète
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>

      <FilePreviewModal file={preview} onClose={() => setPreview(null)} />
    </>
  );
}

function ResultGroup({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/80 last:border-0">
      <div className="flex items-baseline justify-between gap-2 px-4 pt-2.5 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </p>
        {count !== undefined && count > 0 ? (
          <p className="text-[10px] tabular-nums text-muted-foreground">
            {count}
          </p>
        ) : null}
      </div>
      <ul className="pb-1.5">{children}</ul>
    </div>
  );
}

function ResultRow({
  id,
  active,
  icon,
  label,
  meta,
  hint,
  onSelect,
  onHover,
}: {
  id: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  meta?: string | null;
  hint?: string;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <li role="option" id={id} aria-selected={active}>
      <button
        type="button"
        className={cn(
          "flex w-full items-start gap-2.5 px-4 py-2 text-left text-xs transition-colors",
          active ? "bg-muted" : "hover:bg-muted/60",
        )}
        onMouseEnter={onHover}
        onClick={onSelect}
      >
        <span className="mt-0.5 shrink-0 text-accent/80">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-foreground">
            {label}
          </span>
          {meta ? (
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
              {meta}
            </span>
          ) : null}
        </span>
        {hint ? (
          <span className="mt-0.5 shrink-0 text-[10px] font-medium text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </button>
    </li>
  );
}
