"use client";

import {
  cloneElement,
  isValidElement,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";
import {
  createUserAction,
  type ManageUserActionState,
} from "@/app/(private)/manage/user-actions";
import { ActivationLinkFallbackDialog } from "@/components/admin/activation-link-fallback";
import {
  PermissionMatrix,
  emptyFlags,
  type AccessPlatform,
  type DossierFlags,
} from "@/components/admin/permission-matrix";
import type { UsersTableRow } from "@/lib/admin/user-row";
import { useToast } from "@/components/ui/toast";

const initial: ManageUserActionState = {};

export function InviteUserDialog({
  platforms,
  onUserCreated,
  trigger,
}: {
  platforms: AccessPlatform[];
  onUserCreated: (user: UsersTableRow) => void;
  trigger?: React.ReactNode;
}) {
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [state, action, pending] = useActionState(createUserAction, initial);
  const wasPending = useRef(false);
  const [projectAccess] = useState<Record<string, DossierFlags>>(() => {
    const map: Record<string, DossierFlags> = {};
    for (const p of platforms) {
      for (const d of p.dossiers) map[d.id] = emptyFlags();
    }
    return map;
  });

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished) return;

    const timer = window.setTimeout(() => {
      if (state.ok) {
        if (state.user) onUserCreated(state.user);
        if (state.emailSent) {
          pushToast(
            state.invitedEmail
              ? `Invitation envoyée à ${state.invitedEmail}`
              : "Invitation envoyée par e-mail.",
            "success",
          );
        } else {
          pushToast("Impossible d’envoyer l’invitation.", "error");
          if (state.inviteUrl) setFallbackUrl(state.inviteUrl);
        }
        setOpen(false);
        setFormKey((k) => k + 1);
      } else if (state.error) {
        pushToast(state.error, "error");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pending, state, pushToast, onUserCreated]);

  return (
    <>
      {trigger && isValidElement<{ onClick?: (e: React.MouseEvent) => void }>(
        trigger,
      ) ? (
        cloneElement(trigger, {
          onClick: (e: React.MouseEvent) => {
            trigger.props.onClick?.(e);
            setOpen(true);
          },
        })
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_88%,white)]"
        >
          Inviter un collaborateur
        </button>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[color-mix(in_srgb,var(--foreground)_40%,transparent)] p-4 backdrop-blur-[1px] sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-user-title"
            className="my-4 w-full max-w-lg border border-border bg-surface p-5 shadow-[0_16px_48px_rgba(28,27,25,0.12)]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="invite-user-title"
                  className="font-heading text-lg tracking-tight"
                >
                  Inviter un collaborateur
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  Saisissez l’identité et les droits d’accès. Un e-mail d’invitation
                  permettra à la personne de choisir son mot de passe.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form key={formKey} action={action} className="space-y-5">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Identité
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field name="firstName" label="Prénom" required />
                  <Field name="lastName" label="Nom" required />
                  <div className="sm:col-span-2">
                    <Field name="email" label="E-mail" type="email" required />
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Accès aux dossiers
                </p>
                <p className="mb-3 text-xs leading-5 text-muted-foreground">
                  Cochez ce que cette personne pourra faire dans chaque dossier.
                  « Voir » est requis pour les autres actions.
                </p>
                <PermissionMatrix
                  platforms={platforms}
                  projectAccess={projectAccess}
                  formMode
                />
              </div>

              {state.error && !pending && !state.ok ? (
                <p className="text-sm text-destructive" role="alert">
                  {state.error}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 border border-border px-3 text-sm hover:bg-muted"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="h-9 bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {pending ? "Envoi…" : "Envoyer l’invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ActivationLinkFallbackDialog
        open={Boolean(fallbackUrl)}
        url={fallbackUrl || ""}
        onClose={() => setFallbackUrl(null)}
      />
    </>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 h-9 w-full rounded-sm border border-border bg-background px-2 text-sm"
      />
    </label>
  );
}
