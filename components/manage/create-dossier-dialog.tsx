"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createProjectAction,
  type ProjectActionState,
} from "@/app/(private)/manage/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  generateSlug,
  proposeDossierCode,
} from "@/lib/admin/identifiers";

const initial: ProjectActionState = {};

export function CreateDossierDialog({
  open,
  onOpenChange,
  territoireId,
  onDossierCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  territoireId: string;
  onDossierCreated?: (dossier: NonNullable<ProjectActionState["dossier"]>) => void;
}) {
  const pendingRef = useRef(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && pendingRef.current) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-w-xl"
        onPointerDownOutside={(e) => {
          if (pendingRef.current) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (pendingRef.current) e.preventDefault();
        }}
      >
        <DialogTitle className="pr-10 text-lg font-medium tracking-tight">
          Nouveau dossier patrimonial
        </DialogTitle>
        <DialogDescription className="mt-1.5 text-sm text-muted-foreground">
          Ajoute un dossier sous cette plateforme. Code et URL sont générés
          automatiquement.
        </DialogDescription>
        {open ? (
          <CreateDossierForm
            territoireId={territoireId}
            pendingRef={pendingRef}
            onDossierCreated={onDossierCreated}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => {
              if (!pendingRef.current) onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateDossierForm({
  territoireId,
  pendingRef,
  onDossierCreated,
  onSuccess,
  onCancel,
}: {
  territoireId: string;
  pendingRef: React.MutableRefObject<boolean>;
  onDossierCreated?: (dossier: NonNullable<ProjectActionState["dossier"]>) => void;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(createProjectAction, initial);
  const [name, setName] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const wasPending = useRef(false);

  const previewCode = name.trim() ? proposeDossierCode(name) : "—";
  const previewSlug = name.trim() ? generateSlug(name) : "—";

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending, pendingRef]);

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished || !state.ok) return;
    if (state.dossier) onDossierCreated?.(state.dossier);
    onSuccess();
  }, [pending, state, onDossierCreated, onSuccess]);

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="territoireId" value={territoireId} />

      <label className="block text-xs">
        <span className="text-muted-foreground">Nom</span>
        <input
          name="name"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Château de Mer"
          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
      </label>

      {name.trim() ? (
        <p className="text-[11px] leading-5 text-muted-foreground">
          Code généré : <span className="font-medium text-foreground">{previewCode}</span>
          <span className="mx-2">·</span>
          URL : <span className="font-medium text-foreground">{previewSlug}</span>
        </p>
      ) : null}

      <label className="block text-xs">
        <span className="text-muted-foreground">Description</span>
        <textarea
          name="description"
          rows={3}
          className="mt-1 w-full resize-y rounded-md border border-border bg-background px-2 py-2 text-sm leading-5"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
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
          <span className="text-muted-foreground">Statut</span>
          <select
            name="isActive"
            defaultValue="1"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="1">Actif</option>
            <option value="0">Inactif</option>
          </select>
        </label>
      </div>

      <div className="border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {showAdvanced ? "Masquer les paramètres avancés" : "Paramètres avancés"}
        </button>
        {showAdvanced ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="text-muted-foreground">Code (optionnel)</span>
              <input
                name="code"
                placeholder={previewCode === "—" ? "CDM" : previewCode}
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm uppercase"
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">Slug (optionnel)</span>
              <input
                name="slug"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder={previewSlug === "—" ? "chateau-de-mer" : previewSlug}
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              />
            </label>
          </div>
        ) : null}
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="h-9 rounded-md border border-border px-4 text-sm hover:bg-muted disabled:opacity-60"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Création…" : "Créer"}
        </button>
      </div>
    </form>
  );
}
