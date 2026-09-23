import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Consistent page header for operational screens.
 * Answers in under 5 seconds: where am I, what is this page for, main action.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        "mb-8 flex flex-col gap-5 border-b border-border/80 pb-8 sm:mb-10 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 max-w-2xl space-y-2.5">
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-lede">{description}</p> : null}
        {children}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export function PageBreadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav
      aria-label="Fil d’Ariane"
      className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
    >
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span
            key={`${item.label}-${index}`}
            className="inline-flex items-center gap-1.5"
          >
            {index > 0 ? <span aria-hidden>›</span> : null}
            {item.href && !last ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-foreground hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span className={last ? "font-medium text-foreground" : undefined}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface px-5 py-12 text-center shadow-[var(--shadow-panel)]">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Compact horizontal metrics under a heritage/dossier header. */
export function MetaStrip({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  if (!items.length) return null;
  return (
    <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-muted-foreground">
      {items.map((item) => (
        <div key={item.label} className="inline-flex items-baseline gap-1.5">
          <dt className="font-medium text-foreground/80">{item.value}</dt>
          <dd>{item.label}</dd>
        </div>
      ))}
    </dl>
  );
}
