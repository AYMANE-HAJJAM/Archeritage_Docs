import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { getUser } from "@/lib/auth";
import { Brand } from "@/components/layout/brand";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Connexion" };

export default async function LoginPage() {
  if (await getUser()) redirect("/projects");

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border px-6 py-5 md:px-12">
        <Brand />
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <section className="w-full max-w-sm border border-border bg-surface p-6 sm:p-8">
          <div className="mb-5 h-0.5 w-10 bg-accent" aria-hidden />
          <p className="mb-3 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
            ESPACE DOCUMENTAIRE PRIVÉ
          </p>
          <h1 className="archive-title text-3xl text-foreground sm:text-4xl">
            Bienvenue.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Connectez-vous pour accéder aux fonds documentaires de l’agence.
          </p>
          <LoginForm />
          <p className="mt-7 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <LockKeyhole className="size-3.5" aria-hidden />
            Accès réservé aux collaborateurs
          </p>
        </section>
      </div>

      <footer className="border-t border-border px-6 py-5 text-center text-[11px] tracking-[0.16em] text-muted-foreground">
        ARCHERITAGE · ARCHITECTURE & PATRIMOINE
      </footer>
    </main>
  );
}
