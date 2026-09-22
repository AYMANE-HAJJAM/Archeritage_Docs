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
      <div ref={rootRef} className="relative min-w-0 flex-1 sm:min-w-[14rem]">
        <label className="relative block">
          <span className="sr-only">Rechercher dans le dossier</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="text"
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
            placeholder="Rechercher dans le dossier…"
            autoComplete="off"
            className="h-9 w-full border border-border bg-background pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center">
            {loading ? (
              <Loader2
                className="size-3.5 animate-spin text-muted-foreground"
                aria-label="Recherche en cours"
              />
            ) : query ? (
              <button
                type="button"
                className="pointer-events-auto rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Effacer la recherche"
                onClick={clearSearch}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </span>
        </label>

        {showPanel ? (
          <div
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 z-40 mt-1 max-h-[min(24rem,70vh)] overflow-y-auto border border-border bg-surface shadow-md"
          >
            {loading && !result ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">
                Recherche…
              </p>
            ) : !hasHits ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">
                Aucun résultat
              </p>
            ) : (
              <>
                {result!.sections.length > 0 ? (
                  <ResultGroup title="Rubriques">
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
                          onSelect={() => activate(flatItems[idx]!)}
                          onHover={() => setActiveIndex(idx)}
                        />
                      );
                    })}
                  </ResultGroup>
                ) : null}

                {result!.documents.length > 0 ? (
                  <ResultGroup title="Documents">
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
                          onSelect={() => activate(flatItems[idx]!)}
                          onHover={() => setActiveIndex(idx)}
                        />
                      );
                    })}
                  </ResultGroup>
                ) : null}

                {result!.folders.length > 0 ? (
                  <ResultGroup title="Dossiers">
                    {result!.folders.map((f, i) => {
                      const idx = folderOffset + i;
                      return (
                        <ResultRow
                          key={`f-${f.id}`}
                          id={`${listId}-opt-${idx}`}
                          active={activeIndex === idx}
                          icon={<Folder className="size-3.5" />}
                          label={f.name}
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
                    className="block w-full border-t border-border px-3 py-2 text-left text-xs font-medium text-accent hover:bg-muted/50"
                    onClick={() => {
                      setOpen(false);
                      router.push(
                        `/projects/${projectSlug}/documents?q=${encodeURIComponent(query.trim())}`,
                      );
                    }}
                  >
                    Voir tous les résultats
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/80 last:border-0">
      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </p>
      <ul className="pb-1">{children}</ul>
    </div>
  );
}

function ResultRow({
  id,
  active,
  icon,
  label,
  meta,
  onSelect,
  onHover,
}: {
  id: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  meta?: string | null;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <li role="option" id={id} aria-selected={active}>
      <button
        type="button"
        className={`flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
          active ? "bg-muted" : "hover:bg-muted/60"
        }`}
        onMouseEnter={onHover}
        onClick={onSelect}
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-foreground">
            {label}
          </span>
          {meta ? (
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
              {meta}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
