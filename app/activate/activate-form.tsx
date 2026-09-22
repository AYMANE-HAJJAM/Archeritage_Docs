"use client";

import { useActionState } from "react";
import { activateAccountAction, type ActivateState } from "./actions";

const initial: ActivateState = {};

export function ActivateForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(activateAccountAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <label className="block text-xs">
        <span className="text-muted-foreground">E-mail</span>
        <input
          type="email"
          value={email}
          readOnly
          className="mt-1 h-10 w-full rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground"
        />
      </label>
      <label className="block text-xs">
        <span className="text-muted-foreground">Mot de passe</span>
        <input
          name="password"
          type="password"
          required
          minLength={14}
          maxLength={72}
          autoComplete="new-password"
          className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        />
      </label>
      <label className="block text-xs">
        <span className="text-muted-foreground">Confirmer le mot de passe</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={14}
          maxLength={72}
          autoComplete="new-password"
          className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Activation…" : "Activer mon compte"}
      </button>
    </form>
  );
}
