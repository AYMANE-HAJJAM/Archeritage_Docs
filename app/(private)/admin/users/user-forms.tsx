"use client";

import { useActionState, useState } from "react";
import {
  createUserAction,
  resendInviteAction,
  toggleUserDisabledAction,
  updateUserAction,
  type ManageUserActionState as AdminActionState,
} from "@/app/(private)/manage/user-actions";
import {
  UserAccessPanel,
  type AccessPlatform,
  type ProjectAccessFlags,
} from "@/components/admin/user-access-panel";

const initial: AdminActionState = {};

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, initial);

  return (
    <form action={action} className="space-y-3 border border-border p-4">
      <h3 className="text-sm font-medium">Créer un compte</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field name="firstName" label="Prénom" required />
        <Field name="lastName" label="Nom" required />
        <Field name="email" label="E-mail" type="email" required />
        <label className="block text-xs">
          <span className="text-muted-foreground">Rôle</span>
          <select
            name="role"
            defaultValue="USER"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </label>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.inviteUrl ? <InviteLink url={state.inviteUrl} /> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Création…" : "Créer et générer l’invitation"}
      </button>
    </form>
  );
}

export function UserRowActions({
  user,
  platforms,
  projectAccess,
  territoireAccess,
}: {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: "ADMIN" | "USER";
    status: "INVITED" | "ACTIVE" | "DISABLED";
  };
  platforms: AccessPlatform[];
  projectAccess: Record<string, ProjectAccessFlags>;
  territoireAccess: Record<string, { canCreateDossier: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const [updateState, updateAction, updating] = useActionState(
    updateUserAction,
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

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
      >
        {open ? "Fermer" : "Modifier"}
      </button>

      {open ? (
        <form action={updateAction} className="space-y-2 rounded border border-border p-2">
          <input type="hidden" name="userId" value={user.id} />
          <Field name="firstName" label="Prénom" defaultValue={user.firstName} required />
          <Field name="lastName" label="Nom" defaultValue={user.lastName} required />
          <Field name="email" label="E-mail" type="email" defaultValue={user.email} required />
          <label className="block text-xs">
            <span className="text-muted-foreground">Rôle</span>
            <select
              name="role"
              defaultValue={user.role}
              className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
          {updateState.error ? (
            <p className="text-xs text-destructive">{updateState.error}</p>
          ) : null}
          <button
            type="submit"
            disabled={updating}
            className="h-8 rounded-md border border-border px-2 text-xs hover:bg-muted"
          >
            Enregistrer
          </button>
        </form>
      ) : null}

      {open ? (
        <UserAccessPanel
          userId={user.id}
          userRole={user.role}
          platforms={platforms}
          projectAccess={projectAccess}
          territoireAccess={territoireAccess}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {user.status !== "DISABLED" ? (
          <form
            action={disableAction}
            onSubmit={(e) => {
              if (
                !confirm(
                  `Désactiver ${user.firstName} ${user.lastName} ? La session sera révoquée.`,
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="disabled" value="1" />
            <button
              type="submit"
              disabled={disabling}
              className="text-xs text-destructive underline-offset-2 hover:underline"
            >
              Désactiver
            </button>
          </form>
        ) : (
          <form action={disableAction}>
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="disabled" value="0" />
            <button
              type="submit"
              disabled={disabling}
              className="text-xs underline-offset-2 hover:underline"
            >
              Réactiver
            </button>
          </form>
        )}

        {user.status !== "ACTIVE" ? (
          <form action={inviteAction}>
            <input type="hidden" name="userId" value={user.id} />
            <button
              type="submit"
              disabled={inviting}
              className="text-xs underline-offset-2 hover:underline"
            >
              Lien d’invitation
            </button>
          </form>
        ) : null}
      </div>

      {disableState.error ? (
        <p className="text-xs text-destructive">{disableState.error}</p>
      ) : null}
      {inviteState.error ? (
        <p className="text-xs text-destructive">{inviteState.error}</p>
      ) : null}
      {inviteState.inviteUrl ? <InviteLink url={inviteState.inviteUrl} /> : null}
    </div>
  );
}

function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded border border-border bg-muted/30 p-2 text-xs">
      <p className="mb-1 font-medium">Lien d’invitation (à transmettre manuellement)</p>
      <code className="block break-all text-[11px] text-muted-foreground">{url}</code>
      <button
        type="button"
        className="mt-2 underline-offset-2 hover:underline"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        }}
      >
        {copied ? "Copié" : "Copier le lien"}
      </button>
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
        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
      />
    </label>
  );
}
