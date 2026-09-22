"use client";

import { useActionState, useEffect, useState } from "react";
import { activateAccountAction, type ActivateState } from "./actions";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
} from "@/lib/auth/password";
import { useToast } from "@/components/ui/toast";

const initial: ActivateState = {};

export function ActivateForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const { pushToast } = useToast();
  const [state, action, pending] = useActionState(activateAccountAction, initial);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState({ password: false, confirm: false });

  const passwordError =
    touched.password && password.length > 0 && password.length < MIN_PASSWORD_LENGTH
      ? PASSWORD_TOO_SHORT_MESSAGE
      : state.fieldErrors?.password;
  const confirmError =
    touched.confirm && confirm.length > 0 && password !== confirm
      ? PASSWORD_MISMATCH_MESSAGE
      : state.fieldErrors?.confirm;

  useEffect(() => {
    if (!state.error || state.fieldErrors) return;
    const timer = window.setTimeout(() => {
      pushToast(state.error!, "error");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [state, pushToast]);

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
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={72}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        />
        {passwordError ? (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {passwordError}
          </p>
        ) : null}
      </label>
      <label className="block text-xs">
        <span className="text-muted-foreground">Confirmer le mot de passe</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={72}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
          className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        />
        {confirmError ? (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {confirmError}
          </p>
        ) : null}
      </label>
      {state.error && !passwordError && !confirmError ? (
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
