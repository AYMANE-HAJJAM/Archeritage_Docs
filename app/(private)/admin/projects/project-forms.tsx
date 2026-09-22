"use client";

import { useActionState } from "react";
import {
  createProjectAction,
  type ProjectActionState,
} from "./actions";

const initial: ProjectActionState = {};

export function CreateProjectForm({
  territoires,
}: {
  territoires: { id: string; code: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createProjectAction, initial);

  return (
    <form action={action} className="space-y-3 border border-border p-4">
      <h3 className="text-sm font-medium">Créer un projet</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-xs">
          <span className="text-muted-foreground">Nom</span>
          <input
            name="name"
            required
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Slug</span>
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Code</span>
          <input
            name="code"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm uppercase"
          />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="text-muted-foreground">Description</span>
          <input
            name="description"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Type</span>
          <select
            name="type"
            defaultValue="AUTRE"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="CHATEAU">CHATEAU</option>
            <option value="MURAILLE">MURAILLE</option>
            <option value="AUTRE">AUTRE</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Territoire</span>
          <select
            name="territoireId"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">—</option>
            {territoires.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Création…" : "Créer le projet"}
      </button>
    </form>
  );
}
