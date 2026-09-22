"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  resendInviteAction,
  toggleUserDisabledAction,
  updateUserAccessMatrixAction,
  updateUserAction,
  type ManageUserActionState,
} from "@/app/(private)/manage/user-actions";
import { ActivationLinkFallbackDialog } from "@/components/admin/activation-link-fallback";
import {
  PermissionMatrix,
  type AccessPlatform,
  type DossierFlags,
} from "@/components/admin/permission-matrix";
import type { UsersTableRow } from "@/lib/admin/user-row";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { useToast } from "@/components/ui/toast";

const initial: ManageUserActionState = {};

export function UserRowActions({
  user,
  platforms,
  projectAccess,
  territoireAccess,
  onUserUpdated,
}: {
  user: UsersTableRow;
  platforms: AccessPlatform[];
  projectAccess: Record<string, DossierFlags>;
  territoireAccess: Record<string, { canCreateDossier: boolean }>;
  onUserUpdated: (user: UsersTableRow) => void;
}) {
  const { pushToast } = useToast();
  const [panel, setPanel] = useState<"none" | "edit" | "access">("none");
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);

  const [updateState, updateAction, updating] = useActionState(
    updateUserAction,
    initial,
  );
  const [accessState, accessAction, savingAccess] = useActionState(
    updateUserAccessMatrixAction,
    initial,
  );
  const [disableState, disableAction, disabling] = useActionState(
    toggleUserDisabledAction,
    initial,
  );
  const [inviteState, inviteAction, inviting] = useActionState(
    resendInviteAction,
    initial,
  );

  const inviteFormRef = useRef<HTMLFormElement>(null);
  const disableFormRef = useRef<HTMLFormElement>(null);
  const reactivateFormRef = useRef<HTMLFormElement>(null);
  const inviteWasPending = useRef(false);
  const updateWasPending = useRef(false);
  const accessWasPending = useRef(false);
  const disableWasPending = useRef(false);

  useEffect(() => {
    const finished = inviteWasPending.current && !inviting;
    inviteWasPending.current = inviting;
    if (!finished) return;
    const timer = window.setTimeout(() => {
      if (inviteState.ok) {
        if (inviteState.user) onUserUpdated(inviteState.user);
        if (inviteState.emailSent) {
          pushToast("Invitation renvoyée par e-mail.", "success");
        } else {
          pushToast("Impossible d’envoyer l’invitation.", "error");
          if (inviteState.inviteUrl) setFallbackUrl(inviteState.inviteUrl);
        }
      } else if (inviteState.error) {
        pushToast(inviteState.error, "error");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [inviting, inviteState, pushToast, onUserUpdated]);

  useEffect(() => {
    const finished = disableWasPending.current && !disabling;
    disableWasPending.current = disabling;
    if (!finished) return;
    const timer = window.setTimeout(() => {
      if (disableState.ok && disableState.user) {
        onUserUpdated(disableState.user);
        pushToast(
          disableState.user.status === "DISABLED"
            ? "Utilisateur désactivé."
            : "Utilisateur réactivé.",
          "success",
        );
      } else if (disableState.error) {
        pushToast(disableState.error, "error");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [disabling, disableState, pushToast, onUserUpdated]);

  useEffect(() => {
    const finished = updateWasPending.current && !updating;
    updateWasPending.current = updating;
    if (!finished) return;
    const timer = window.setTimeout(() => {
      if (updateState.ok && updateState.user) {
        onUserUpdated(updateState.user);
        setPanel("none");
        pushToast("Profil mis à jour.", "success");
      } else if (updateState.error) {
        pushToast(updateState.error, "error");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [updating, updateState, pushToast, onUserUpdated]);

  useEffect(() => {
    const finished = accessWasPending.current && !savingAccess;
    accessWasPending.current = savingAccess;
    if (!finished) return;
    const timer = window.setTimeout(() => {
      if (accessState.ok && accessState.user) {
        onUserUpdated(accessState.user);
        pushToast("Accès mis à jour.", "success");
        setPanel("none");
      } else if (accessState.error) {
        pushToast(accessState.error, "error");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [savingAccess, accessState, pushToast, onUserUpdated]);

  const menuActions = [
    {
      id: "edit",
      label: "Modifier le profil",
      onSelect: () => setPanel("edit"),
    },
    ...(user.role === "USER"
      ? [
          {
            id: "access",
            label: "Gérer les accès",
            onSelect: () => setPanel("access"),
          },
        ]
      : []),
    ...(user.status === "DISABLED"
      ? [
          {
            id: "reactivate",
            label: "Réactiver",
            onSelect: () => reactivateFormRef.current?.requestSubmit(),
            disabled: disabling,
          },
        ]
      : [
          {
            id: "disable",
            label: "Désactiver",
            destructive: true,
            disabled: disabling,
            onSelect: () => setConfirmDisable(true),
          },
        ]),
  ];

  return (
    <div className="flex items-center justify-end gap-1.5">
      {user.status === "INVITED" ? (
        <form ref={inviteFormRef} action={inviteAction}>
          <input type="hidden" name="userId" value={user.id} />
          <button
            type="submit"
            disabled={inviting}
            className="inline-flex h-8 items-center whitespace-nowrap rounded-sm border border-border bg-surface px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            {inviting ? "Envoi…" : "Renvoyer l’invitation"}
          </button>
        </form>
      ) : null}

      <RowActionsMenu actions={menuActions} label={`Actions pour ${user.email}`} />

      <ConfirmDialog
        open={confirmDisable}
        onOpenChange={setConfirmDisable}
        title="Désactiver cet utilisateur ?"
        description="Il ne pourra plus se connecter tant que son compte n’est pas réactivé."
        confirmLabel="Désactiver"
        destructive
        pending={disabling}
        onConfirm={() => {
          setConfirmDisable(false);
          disableFormRef.current?.requestSubmit();
        }}
      />

      <form ref={disableFormRef} action={disableAction} className="hidden">
        <input type="hidden" name="userId" value={user.id} />
        <input type="hidden" name="disabled" value="1" />
      </form>
      <form ref={reactivateFormRef} action={disableAction} className="hidden">
        <input type="hidden" name="userId" value={user.id} />
        <input type="hidden" name="disabled" value="0" />
      </form>

      {panel === "edit" ? (
        <SidePanel title="Modifier le profil" onClose={() => setPanel("none")}>
          <form action={updateAction} className="space-y-3">
            <input type="hidden" name="userId" value={user.id} />
            <Field
              name="firstName"
              label="Prénom"
              defaultValue={user.firstName}
              required
            />
            <Field
              name="lastName"
              label="Nom"
              defaultValue={user.lastName}
              required
            />
            <Field
              name="email"
              label="E-mail"
              type="email"
              defaultValue={user.email}
              required
            />
            <label className="block text-xs">
              <span className="text-muted-foreground">Rôle</span>
              <select
                name="role"
                defaultValue={user.role}
                className="mt-1 h-9 w-full rounded-sm border border-border bg-background px-2 text-sm"
              >
                <option value="USER">Utilisateur</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </label>
            {updateState.error ? (
              <p className="text-xs text-destructive">{updateState.error}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPanel("none")}
                className="h-8 border border-border px-3 text-xs hover:bg-muted"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={updating}
                className="h-8 bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-60"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </SidePanel>
      ) : null}

      {panel === "access" ? (
        <SidePanel title="Gérer les accès" onClose={() => setPanel("none")}>
          <form action={accessAction} className="space-y-3">
            <input type="hidden" name="userId" value={user.id} />
            <PermissionMatrix
              platforms={platforms}
              projectAccess={projectAccess}
              territoireAccess={territoireAccess}
              formMode
            />
            {accessState.error ? (
              <p className="text-xs text-destructive">{accessState.error}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPanel("none")}
                className="h-8 border border-border px-3 text-xs hover:bg-muted"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={savingAccess}
                className="h-8 bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-60"
              >
                {savingAccess ? "…" : "Enregistrer les accès"}
              </button>
            </div>
          </form>
        </SidePanel>
      ) : null}

      <ActivationLinkFallbackDialog
        open={Boolean(fallbackUrl)}
        url={fallbackUrl || ""}
        onClose={() => setFallbackUrl(null)}
      />
    </div>
  );
}

function SidePanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-[color-mix(in_srgb,var(--foreground)_35%,transparent)]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-[var(--shadow-panel)]"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 h-9 w-full rounded-sm border border-border bg-background px-2 text-sm"
      />
    </label>
  );
}
