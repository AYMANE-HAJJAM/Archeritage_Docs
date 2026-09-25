"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Folder, Layers, Loader2, Search, X } from "lucide-react";
import type { SearchHit } from "@/lib/structure/search";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;

const ICONS = {
  part: Layers,
  section: Layers,
  folder: Folder,
  file: FileText,
} as const;

/** In-project search over parts, sections, folders and files. */
export function HeritageProjectSearch({
  projectSlug,
}: {
  projectSlug: string;
}) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;

    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectSlug)}/search?q=${encodeURIComponent(q)}`,
          { credentials: "same-origin", signal: controller.signal },
        );
        if (!res.ok) throw new Error("search_failed");
        const data = (await res.json()) as { hits: SearchHit[] };
        if (!cancelled) {
          setHits(data.hits);
          setOpen(true);
          setActiveIndex(-1);
        }
      } catch (error) {
        if (
          cancelled ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        setHits([]);
        setOpen(true);
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

  function clearSearch() {
    setQuery("");
    setHits(null);
    setLoading(false);
    setActiveIndex(-1);
    setOpen(false);
  }

  function activate(hit: SearchHit) {
    setOpen(false);
    router.push(hit.href, { scroll: false });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const list = hits ?? [];
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else if (query) {
        clearSearch();
      }
      return;
    }
    if (!open || list.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % list.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? list.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      activate(list[activeIndex]!);
    }
  }

  const showPanel = open && query.trim().length >= 2;

  return (
    <div
      ref={rootRef}
      className="relative z-30 min-w-0 flex-1 overflow-visible sm:min-w-[14rem]"
    >
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
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (e.target.value.trim().length < 2) {
              setHits(null);
              setActiveIndex(-1);
            }
          }}
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
              className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
          {loading && !hits ? (
            <p className="px-4 py-4 text-xs text-muted-foreground">
              Recherche en cours…
            </p>
          ) : !hits || hits.length === 0 ? (
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
            <ul className="py-1">
              {hits.map((hit, index) => {
                const Icon = ICONS[hit.type];
                return (
                  <li
                    key={`${hit.type}-${hit.id}`}
                    role="option"
                    aria-selected={activeIndex === index}
                  >
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-2.5 px-4 py-2 text-left text-xs transition-colors",
                        activeIndex === index ? "bg-muted" : "hover:bg-muted/60",
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => activate(hit)}
                    >
                      <Icon className="mt-0.5 size-3.5 shrink-0 text-accent/80" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">
                          {hit.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {hit.path}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
