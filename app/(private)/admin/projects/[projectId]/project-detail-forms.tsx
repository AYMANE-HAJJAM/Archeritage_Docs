"use client";

import { useActionState } from "react";
import {
  reclassifyDocumentAction,
  updateProjectAction,
  type ProjectActionState,
} from "../actions";

const initial: ProjectActionState = {};

export function ProjectEditForm({
  project,
  territoires,
}: {
  project: {
    id: string;
    name: string;
    slug: string;
    code: string | null;
    description: string | null;
    type: string;
    territoireId: string | null;
  };
  territoires: { id: string; code: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(updateProjectAction, initial);

  return (
    <form action={action} className="space-y-3 border border-border p-4">
      <input type="hidden" name="projectId" value={project.id} />
      <h3 className="text-sm font-medium">Métadonnées</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="text-muted-foreground">Nom</span>
          <input
            name="name"
            defaultValue={project.name}
            required
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Slug</span>
          <input
            name="slug"
            defaultValue={project.slug}
            required
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Code</span>
          <input
            name="code"
            defaultValue={project.code || ""}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Type</span>
          <select
            name="type"
            defaultValue={project.type}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="CHATEAU">CHATEAU</option>
            <option value="MURAILLE">MURAILLE</option>
            <option value="AUTRE">AUTRE</option>
          </select>
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="text-muted-foreground">Description</span>
          <input
            name="description"
            defaultValue={project.description || ""}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Territoire</span>
          <select
            name="territoireId"
            defaultValue={project.territoireId || ""}
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
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-md border border-border px-4 text-sm hover:bg-muted disabled:opacity-60"
      >
        Enregistrer
      </button>
    </form>
  );
}

export function ProjectArchiveForm({
  projectId,
  isActive,
  fileCount,
}: {
  projectId: string;
  isActive: boolean;
  fileCount: number;
}) {
  const [state, action, pending] = useActionState(updateProjectAction, initial);

  return (
    <form
      action={action}
      className="flex flex-wrap items-center gap-3 border border-border p-4"
      onSubmit={(e) => {
        if (
          isActive &&
          !confirm(
            `Archiver ce projet ? (${fileCount} document(s) conservés — pas de suppression)`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="isActive" value={isActive ? "0" : "1"} />
      <p className="flex-1 text-sm text-muted-foreground">
        {isActive
          ? "L’archivage retire le projet de la navigation utilisateur."
          : "Projet archivé — réactivation possible."}
      </p>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-md border border-border px-4 text-sm hover:bg-muted"
      >
        {isActive ? "Archiver" : "Réactiver"}
      </button>
    </form>
  );
}

export function ReclassifyForm({
  fileId,
  projectId,
  currentCode,
  sections,
}: {
  fileId: string;
  projectId: string;
  currentCode: string | null;
  sections: { code: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(reclassifyDocumentAction, initial);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="fileId" value={fileId} />
      <input type="hidden" name="projectId" value={projectId} />
      <select
        name="sectionCode"
        defaultValue={currentCode || ""}
        className="h-8 max-w-[220px] rounded-md border border-border bg-background px-2 text-xs"
      >
        <option value="" disabled>
          Rubrique…
        </option>
        {sections.map((s) => (
          <option key={s.code} value={s.code}>
            {s.code} — {s.title}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="h-8 rounded-md border border-border px-2 text-xs hover:bg-muted"
      >
        OK
      </button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
      {state.ok ? <span className="text-xs text-muted-foreground">Fait</span> : null}
    </form>
  );
}
