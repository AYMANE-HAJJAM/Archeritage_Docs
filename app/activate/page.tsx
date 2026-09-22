import { getInvitationPreview } from "@/lib/admin/invitations";
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
          Lien d’activation manquant ou invalide.
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-12">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          ARCHERITAGE Docs
        </p>
        <h1 className="mt-2 font-heading text-2xl tracking-tight">
          Activer votre compte
        </h1>
      </div>
      {children}
    </main>
  );
}
