"use client";

import { useActionState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { login } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: "" });

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          Adresse e-mail
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          placeholder="prenom.nom@archeritage.ma"
          className="h-10"
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="password"
          className="text-sm font-medium text-foreground"
        >
          Mot de passe
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={72}
          className="h-10"
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button
        disabled={pending}
        className="h-11 w-full justify-between"
        variant="default"
      >
        {pending ? "Connexion…" : "Se connecter"}
        {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
      </Button>
    </form>
  );
}
