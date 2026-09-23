import { LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { Brand } from "@/components/layout/brand";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Connexion" };

export default async function LoginPage() {
  if (await getUser()) redirect("/projects");

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
      <section className="relative hidden overflow-hidden bg-[var(--sidebar)] text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-12 xl:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(900px 420px at 20% 10%, color-mix(in srgb, var(--accent) 28%, transparent), transparent 60%), radial-gradient(700px 360px at 90% 80%, color-mix(in srgb, white 8%, transparent), transparent 55%)",
          }}
        />
        <div className="relative z-10">
          <Brand inverse />
        </div>
        <div className="relative z-10 max-w-md space-y-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted">
            Espace documentaire privé
          </p>
          <h1 className="archive-title text-[2.35rem] leading-[1.1] text-[#f7f3ec] xl:text-[2.6rem]">
            La mémoire des projets patrimoniaux, organisée.
          </h1>
          <p className="text-[15px] leading-7 text-[color-mix(in_srgb,var(--sidebar-foreground)_72%,transparent)]">
            Accédez aux dossiers, rubriques et documents de Safi Patrimoine —
            Château de Mer et Murailles — dans un environnement sécurisé.
          </p>
        </div>
        <p className="relative z-10 text-[11px] tracking-[0.14em] text-sidebar-muted">
          ARCHERITAGE · Architecture &amp; Patrimoine
        </p>
      </section>

      <section className="flex flex-col bg-background">
        <header className="flex items-center justify-between border-b border-border px-5 py-4 lg:hidden">
          <Brand />
        </header>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[23rem]">
            <div className="mb-8 space-y-2">
              <p className="page-eyebrow">Connexion</p>
              <h2 className="page-title text-[1.75rem]">Se connecter</h2>
              <p className="page-lede">
                Utilisez l’adresse e-mail professionnelle fournie par
                l’administrateur.
              </p>
            </div>

            <div className="border border-border bg-surface p-5 shadow-[var(--shadow-panel)] sm:p-6">
              <LoginForm />
            </div>

            <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <LockKeyhole className="size-3.5" aria-hidden />
              Accès réservé aux collaborateurs autorisés
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
