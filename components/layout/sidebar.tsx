"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
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
  icon: typeof FolderKanban;
  match: (pathname: string) => boolean;
};

/** True for the browse/manage project tree (not Structure / Utilisateurs). */
export function isProjectsNavPath(pathname: string): boolean {
  if (
    pathname.startsWith("/structure") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/admin/users")
  ) {
    return false;
  }
  return (
    pathname === "/projects" ||
    pathname.startsWith("/projects/") ||
    pathname.startsWith("/territoires") ||
    pathname.startsWith("/admin/projects")
  );
}

const PROJECTS_ITEM: NavItem = {
  href: "/projects",
  label: "Projets",
  hint: "Accéder aux plateformes et dossiers patrimoniaux",
  icon: FolderKanban,
  match: isProjectsNavPath,
};

const ADMIN_ITEMS: NavItem[] = [
  PROJECTS_ITEM,
  {
    href: "/structure",
    label: "Structure",
    hint: "Organiser les groupes et rubriques",
    icon: Layers,
    match: (p) => p.startsWith("/structure"),
  },
  {
    href: "/users",
    label: "Utilisateurs",
    hint: "Inviter des collaborateurs et définir les accès",
    icon: Users,
    match: (p) => p.startsWith("/users") || p.startsWith("/admin/users"),
  },
];

export function buildNavItems(role: "ADMIN" | "USER"): NavItem[] {
  return role === "ADMIN" ? ADMIN_ITEMS : [PROJECTS_ITEM];
}

export function pageTitleFromPath(pathname: string): string {
  if (pathname.startsWith("/projects/manage/")) return "Détail du projet";
  if (pathname.startsWith("/projects/manage")) return "Projets";
  if (pathname.startsWith("/structure")) return "Structure des dossiers";
  if (pathname.startsWith("/users")) return "Utilisateurs";
  if (pathname.startsWith("/admin")) return "Administration";
  if (pathname.includes("/documents")) return "Tous les documents";
  if (pathname.includes("/sections/")) return "Rubrique";
  if (pathname.startsWith("/territoires/")) return "Plateforme patrimoniale";
  if (pathname.startsWith("/projects/") || pathname === "/projects") {
    return "Projets";
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
    <nav aria-label="Navigation principale" className="flex flex-col gap-0.5 px-2.5">
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
              "group relative flex items-center gap-3 rounded-md px-2.5 py-2.5 text-[13px] font-medium tracking-wide transition-colors duration-150",
              collapsed && "justify-center px-0",
              active
                ? "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-sidebar-foreground"
                : "text-[color-mix(in_srgb,var(--sidebar-foreground)_68%,transparent)] hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_7%,transparent)] hover:text-sidebar-foreground",
            )}
          >
            {active ? (
              <span
                className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent"
                aria-hidden
              />
            ) : null}
            <Icon
              className={cn(
                "size-[1.05rem] shrink-0 transition-colors",
                active
                  ? "text-accent"
                  : "text-sidebar-muted group-hover:text-sidebar-foreground",
              )}
              aria-hidden
            />
            {!collapsed ? (
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
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
          "flex h-14 items-center border-b border-[color-mix(in_srgb,var(--sidebar-foreground)_10%,transparent)] px-3.5",
          collapsed && "justify-center px-2",
        )}
      >
        <Link
          href="/projects"
          aria-label="ARCHERITAGE Docs"
          className={cn("min-w-0", collapsed && "scale-90")}
          onClick={() => onMobileOpenChange(false)}
        >
          {collapsed ? (
            <span className="flex size-8 items-center justify-center rounded-md border border-white/15 bg-white/5 text-[11px] font-semibold tracking-[0.14em] text-accent">
              A
            </span>
          ) : (
            <Brand compact inverse />
          )}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-5">
        {!collapsed ? (
          <p className="mb-3 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
            {role === "ADMIN" ? "Administration" : "Navigation"}
          </p>
        ) : null}
        <NavList
          items={items}
          pathname={pathname}
          collapsed={collapsed}
          onNavigate={() => onMobileOpenChange(false)}
        />
      </div>

      <div className="hidden border-t border-[color-mix(in_srgb,var(--sidebar-foreground)_10%,transparent)] p-2.5 lg:block">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2.5 py-2.5 text-[12px] text-sidebar-muted transition-colors hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_7%,transparent)] hover:text-sidebar-foreground",
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
              <span>Réduire</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-[color-mix(in_srgb,var(--sidebar-foreground)_8%,transparent)] bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out lg:block",
          collapsed ? "w-[4.5rem]" : "w-[15rem]",
        )}
      >
        {sidebarInner}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--foreground)_45%,transparent)] backdrop-blur-[2px]"
            aria-label="Fermer le menu"
            onClick={() => onMobileOpenChange(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[16.5rem] bg-sidebar text-sidebar-foreground shadow-[var(--shadow-panel)]">
            <div className="flex h-14 items-center justify-between border-b border-white/10 px-3">
              <Brand compact inverse />
              <button
                type="button"
                onClick={() => onMobileOpenChange(false)}
                className="inline-flex size-9 items-center justify-center rounded-md text-sidebar-muted hover:bg-white/10 hover:text-sidebar-foreground"
                aria-label="Fermer"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="py-4">
              <p className="mb-3 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
                {role === "ADMIN" ? "Administration" : "Navigation"}
              </p>
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
      className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground lg:hidden"
      aria-label="Ouvrir le menu"
      aria-expanded={open}
      onClick={onOpen}
    >
      <Menu className="size-4" />
    </button>
  );
}
