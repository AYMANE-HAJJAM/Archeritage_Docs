import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { ActivatedToastListener } from "@/components/auth/activated-toast-listener";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-background focus:p-3"
      >
        Aller au contenu
      </a>
      <AppShell user={user}>
        <Suspense fallback={null}>
          <ActivatedToastListener />
        </Suspense>
        {children}
      </AppShell>
    </>
  );
}

