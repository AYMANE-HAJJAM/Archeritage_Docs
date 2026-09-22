"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  pushToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const pushToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((current) => [...current.slice(-4), { id, message, tone }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 sm:bottom-5 sm:right-5"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  const Icon =
    item.tone === "success"
      ? CheckCircle2
      : item.tone === "error"
        ? XCircle
        : Info;

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-start gap-2.5 border bg-surface px-3 py-2.5 text-sm shadow-[var(--shadow-panel)]",
        item.tone === "success" &&
          "border-[color-mix(in_srgb,var(--success)_28%,var(--border))]",
        item.tone === "error" &&
          "border-[color-mix(in_srgb,var(--destructive)_32%,var(--border))]",
        item.tone === "info" && "border-border",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          item.tone === "success" && "text-[var(--success)]",
          item.tone === "error" && "text-destructive",
          item.tone === "info" && "text-muted-foreground",
        )}
        aria-hidden
      />
      <p className="min-w-0 flex-1 leading-5 text-foreground">{item.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Fermer la notification"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      pushToast: (message: string, tone?: ToastTone) => {
        void tone;
        if (process.env.NODE_ENV !== "production") {
          console.warn("[toast] ToastProvider missing:", message);
        }
      },
    };
  }
  return ctx;
}
