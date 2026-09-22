"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { AppSidebar, pageTitleFromPath } from "@/components/layout/sidebar";
import { AppTopbar } from "@/components/layout/topbar";
import { cn } from "@/lib/utils";

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: "ADMIN" | "USER" };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem("archeritage.sidebar.collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = pageTitleFromPath(pathname);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.sessionStorage.setItem(
          "archeritage.sidebar.collapsed",
          next ? "1" : "0",
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="min-h-dvh bg-background">
      <AppSidebar
        role={user.role}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />

      <div
        className={cn(
          "flex min-h-dvh flex-col transition-[padding] duration-200 ease-out",
          collapsed ? "lg:pl-[4.5rem]" : "lg:pl-[15rem]",
        )}
      >
        <AppTopbar
          title={title}
          user={user}
          mobileOpen={mobileOpen}
          onMobileOpen={() => setMobileOpen(true)}
        />

        <main
          id="main"
          className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
