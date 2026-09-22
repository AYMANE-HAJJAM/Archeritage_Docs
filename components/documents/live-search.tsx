"use client";

import { Search, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type LiveSearchProps = {
  initialValue?: string;
  loading?: boolean;
  placeholder?: string;
  onSearch: (query: string) => void;
};

export function LiveSearch({ initialValue = "", loading = false, placeholder = "Rechercher…", onSearch }: LiveSearchProps) {
  const [value, setValue] = useState(initialValue);
  const searchRef = useRef(onSearch);

  useEffect(() => { searchRef.current = onSearch; }, [onSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => searchRef.current(value.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [value]);

  function clear() {
    setValue("");
    onSearch("");
  }

  return <form className="relative min-w-52 flex-1 lg:max-w-xl" onSubmit={(event) => event.preventDefault()}>
    <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
    <Input value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") clear(); }} placeholder={placeholder} aria-label={placeholder} className="h-8 pr-16 pl-8 text-sm" />
    <span className="absolute right-2.5 top-2.5 flex items-center gap-1 text-muted-foreground">
      {loading && <Loader2 className="size-3.5 animate-spin" aria-label="Recherche en cours" />}
      {value && <button type="button" className="rounded-sm p-0.5 hover:bg-muted hover:text-foreground" onClick={clear} aria-label="Effacer la recherche"><X className="size-3.5" /></button>}
    </span>
  </form>;
}
