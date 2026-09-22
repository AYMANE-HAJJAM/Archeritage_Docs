"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  Landmark,
  Layers,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  X,
} from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  hint: string;
  icon: typeof Landmark;
  match: (pathname: string) => boolean;
};

const SAFI_ITEM: NavItem = {
  href: "/territoires/saf",
  label: "Safi Patrimoine",
  hint: "Ouvrir les dossiers patrimoniaux",
  icon: Landmark,
  match: (p) =>
    p.startsWith("/territoires") ||
    (p.startsWith("/projects") && !p.startsWith("/projects/manage")) ||
    p === "/projects",
};

const ADMIN_ITEMS: NavItem[] = [
  {
    href: "/projects/manage",
    label: "Projets",
    hint: "Gérer les plateformes et dossiers",
    icon: FolderKanban,
    match: (p) =>
      p.startsWith("/projects/manage") || p.startsWith("/admin/projects"),
  },
  {
    href: "/structure",
    label: "Structure",
    hint: "Organiser groupes et rubriques",
    icon: Layers,
    match: (p) => p.startsWith("/structure"),
  },
  {
    href: "/users",
    label: "Utilisateurs",
    hint: "Inviter et gérer les accès",
    icon: Users,
    match: (p) => p.startsWith("/users") || p.startsWith("/admin/users"),
  },
];

export function buildNavItems(role: "ADMIN" | "USER"): NavItem[] {
  return role === "ADMIN" ? ADMIN_ITEMS : [SAFI_ITEM];
}

export function pageTitleFromPath(pathname: string): string {
  if (pathname.startsWith("/projects/manage/")) return "Détail du projet";
  if (pathname.startsWith("/projects/manage")) return "Projets";
  if (pathname.startsWith("/structure")) return "Structure des dossiers";
  if (pathname.startsWith("/users")) return "Utilisateurs";
  if (pathname.startsWith("/admin")) return "Administration";
  if (pathname.includes("/documents")) return "Documents du dossier";
  if (
    pathname.startsWith("/territoires") ||
    pathname.startsWith("/projects") ||
    pathname === "/projects"
  ) {
    return "Safi Patrimoine";
  }
  return "ARCHERITAGE Docs";
}

function NavList({
  items,
  pathname,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Navigation principale" className="flex flex-col gap-1 px-2">
      {items.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? `${item.label} — ${item.hint}` : item.hint}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-sm px-2.5 py-2.5 text-[13px] font-medium tracking-wide transition-colors duration-150",
              collapsed && "justify-center px-0",
              active
                ? "bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] text-sidebar-foreground"
                : "text-[color-mix(in_srgb,var(--sidebar-foreground)_70%,transparent)] hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_8%,transparent)] hover:text-sidebar-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-[1.05rem] shrink-0",
                active
                  ? "text-accent"
                  : "text-sidebar-muted group-hover:text-sidebar-foreground",
              )}
              aria-hidden
            />
            {!collapsed ? (
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            ) : null}
            {active && !collapsed ? (
              <span
                className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                aria-hidden
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppSidebar({
  role,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileOpenChange,
}: {
  role: "ADMIN" | "USER";
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const items = buildNavItems(role);

  const sidebarInner = (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-14 items-center border-b border-[color-mix(in_srgb,var(--sidebar-foreground)_12%,transparent)] px-3",
          collapsed && "justify-center px-2",
        )}
      >
        <Link
          href={role === "ADMIN" ? "/projects/manage" : "/territoires/saf"}
          aria-label="ARCHERITAGE Docs"
          className={cn("min-w-0", collapsed && "scale-90")}
          onClick={() => onMobileOpenChange(false)}
        >
          {collapsed ? (
            <span className="flex size-8 items-center justify-center border border-white/20 bg-white/5 text-[11px] font-semibold tracking-[0.14em] text-accent">
              A
            </span>
          ) : (
            <Brand compact inverse />
          )}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {!collapsed ? (
          <p className="mb-2.5 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted">
            {role === "ADMIN" ? "Administration" : "Dossiers"}
          </p>
        ) : null}
        <NavList
          items={items}
          pathname={pathname}
          collapsed={collapsed}
          onNavigate={() => onMobileOpenChange(false)}
        />
      </div>

      <div className="hidden border-t border-[color-mix(in_srgb,var(--sidebar-foreground)_12%,transparent)] p-2 lg:block">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            "flex w-full items-center gap-2 rounded-sm px-2.5 py-2.5 text-[12px] text-sidebar-muted transition-colors hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_8%,transparent)] hover:text-sidebar-foreground",
            collapsed && "justify-center px-0",
          )}
          title={collapsed ? "Élargir le menu" : "Réduire le menu"}
          aria-label={collapsed ? "Élargir le menu" : "Réduire le menu"}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <>
              <PanelLeftClose className="size-4" />
              <span>Réduire le menu</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        aria-label="Menu principal"
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-[color-mix(in_srgb,var(--sidebar-foreground)_14%,transparent)] bg-sidebar text-sidebar-foreground lg:flex lg:flex-col",
          collapsed ? "w-[4.5rem]" : "w-[15rem]",
        )}
      >
        {sidebarInner}
      </aside>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal
          aria-label="Menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-foreground/35"
            aria-label="Fermer le menu"
            onClick={() => onMobileOpenChange(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(16.5rem,88vw)] flex-col bg-sidebar text-sidebar-foreground shadow-lg">
            <div className="flex h-14 items-center justify-between border-b border-[color-mix(in_srgb,var(--sidebar-foreground)_12%,transparent)] px-3">
              <Brand compact inverse />
              <button
                type="button"
                onClick={() => onMobileOpenChange(false)}
                className="inline-flex size-9 items-center justify-center rounded-sm text-sidebar-muted hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_10%,transparent)] hover:text-sidebar-foreground"
                aria-label="Fermer le menu"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
              <NavList
                items={items}
                pathname={pathname}
                collapsed={false}
                onNavigate={() => onMobileOpenChange(false)}
              />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function MobileNavTrigger({
  open,
  onOpen,
}: {
  open: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex size-9 items-center justify-center rounded-sm border border-border bg-surface text-foreground transition-colors hover:bg-muted lg:hidden"
      aria-label="Ouvrir le menu"
      aria-expanded={open}
    >
      <Menu className="size-4" />
    </button>
  );
}
