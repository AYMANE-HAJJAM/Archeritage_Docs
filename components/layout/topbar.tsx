"use client";

import { LogOut } from "lucide-react";

import { logout } from "@/app/login/actions";
import { MobileNavTrigger } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";

export function AppTopbar({
  title,
  user,
  mobileOpen,
  onMobileOpen,
}: {
  title: string;
  user: { name: string; email: string };
  mobileOpen: boolean;
  onMobileOpen: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-[color-mix(in_srgb,var(--background)_88%,white)] px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <MobileNavTrigger open={mobileOpen} onOpen={onMobileOpen} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          ARCHERITAGE Docs
        </p>
        <h1 className="truncate font-heading text-[0.95rem] tracking-tight text-foreground sm:text-base">
          {title}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden min-w-0 text-right sm:block">
          <p className="truncate text-xs font-medium text-foreground">{user.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
        </div>
        <form action={logout}>
          <Button
            variant="outline"
            size="sm"
            type="submit"
            className="hidden sm:inline-flex"
          >
            <LogOut className="size-3.5" aria-hidden />
            Se déconnecter
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="submit"
            title="Se déconnecter"
            aria-label="Se déconnecter"
            className="size-9 sm:hidden"
          >
            <LogOut className="size-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
