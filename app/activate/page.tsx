import { getInvitationPreview } from "@/lib/admin/invitations";
import { Brand } from "@/components/layout/brand";
import { ActivateForm } from "./activate-form";

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const rawToken = token?.trim() || "";

  if (!rawToken) {
    return (
      <ActivateShell>
        <p className="text-sm text-muted-foreground">
          Lien d’activation manquant ou invalide. Demandez une nouvelle
          invitation à un administrateur.
        </p>
      </ActivateShell>
    );
  }

  const invite = await getInvitationPreview(rawToken);
  if (!invite) {
    return (
      <ActivateShell>
        <p className="text-sm text-muted-foreground">
          Ce lien d’activation a expiré. Demandez une nouvelle invitation.
        </p>
      </ActivateShell>
    );
  }

  return (
    <ActivateShell>
      <ActivateForm token={rawToken} email={invite.user.email} />
    </ActivateShell>
  );
}

function ActivateShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-5 py-12">
      <Brand />
      <div>
        <p className="page-eyebrow">Activation du compte</p>
        <h1 className="page-title mt-2 text-[1.75rem]">
          Choisir votre mot de passe
        </h1>
        <p className="page-lede mt-2">
          Définissez un mot de passe d’au moins 6 caractères pour activer votre
          accès à ARCHERITAGE Docs.
        </p>
      </div>
      <div className="border border-border bg-surface p-5 shadow-[var(--shadow-panel)] sm:p-6">
        {children}
      </div>
    </main>
  );
}
