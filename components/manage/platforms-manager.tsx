"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  updateTerritoireAction,
  type LivePlatform,
  type ProjectActionState,
} from "@/app/(private)/manage/actions";
import { CreatePlatformDialog } from "@/components/manage/create-platform-dialog";
import { HeritageCard } from "@/components/heritage/heritage-card";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const initial: ProjectActionState = {};

export type PlatformRow = LivePlatform;

export function PlatformsManager({
  platforms: initialPlatforms,
  /** manage = admin fiche; browse = open territoire landing */
  cardHrefMode = "manage",
  eyebrow = "Administration",
  description = "Consultez vos plateformes patrimoniales, créez un projet ou organisez leur structure documentaire.",
}: {
  platforms: PlatformRow[];
  cardHrefMode?: "manage" | "browse";
  eyebrow?: string;
  description?: string;
}) {
  const { pushToast } = useToast();
  const [platforms, setPlatforms] = useState(initialPlatforms);
  const [platformsSource, setPlatformsSource] = useState(initialPlatforms);
  if (initialPlatforms !== platformsSource) {
    setPlatformsSource(initialPlatforms);
    setPlatforms(initialPlatforms);
  }
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  function upsertPlatform(row: PlatformRow) {
    setPlatforms((prev) => {
      const idx = prev.findIndex((p) => p.id === row.id);
      if (idx === -1) return [row, ...prev];
      const next = [...prev];
      next[idx] = row;
      return next;
    });
  }

  const single = platforms.length === 1;

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title="Projets"
        description={description}
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            + Ajouter un projet
          </Button>
        }
      />

      <CreatePlatformDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onPlatformCreated={(platform) => {
          upsertPlatform(platform);
          pushToast("Projet créé avec succès.", "success");
        }}
      />

      {platforms.length === 0 ? (
        <EmptyState
          title="Aucun projet patrimonial."
          description="Créez votre première plateforme pour y rattacher des dossiers patrimoniaux et leurs documents."
          action={
            <Button type="button" onClick={() => setCreateOpen(true)}>
              Ajouter un projet
            </Button>
          }
        />
      ) : (
        <div
          className={cn(
            "grid gap-4",
            single
              ? "max-w-xl grid-cols-1"
              : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {platforms.map((platform) => (
            <PlatformHeritageCard
              key={platform.id}
              platform={platform}
              href={
                cardHrefMode === "browse"
                  ? `/territoires/${platform.code.toLowerCase()}`
                  : `/projects/manage/${platform.id}`
              }
              editing={editId === platform.id}
              onEdit={() => setEditId(platform.id)}
              onCloseEdit={() => setEditId(null)}
              onUpdated={upsertPlatform}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlatformHeritageCard({
  platform,
  href,
  editing,
  onEdit,
  onCloseEdit,
  onUpdated,
}: {
  platform: PlatformRow;
  href: string;
  editing: boolean;
  onEdit: () => void;
  onCloseEdit: () => void;
  onUpdated: (row: PlatformRow) => void;
}) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const dossierMeta =
    platform.dossierCount === 1
      ? "1 dossier patrimonial"
      : `${platform.dossierCount} dossiers patrimoniaux`;
  const docMeta =
    platform.fileCount === 1
      ? "1 document"
      : `${platform.fileCount} documents`;
  const activity = new Date(platform.lastActivityAt).toLocaleDateString("fr-FR");
  const status = platform.isActive ? "Actif" : "Archivé";
  const description =
    platform.description?.trim() ||
    "Plateforme de connaissance et de suivi patrimonial.";

  return (
    <>
      <HeritageCard
        href={href}
        code={platform.code}
        title={platform.name}
        description={description}
        meta={`${dossierMeta} · ${docMeta} · ${status} · Mis à jour le ${activity}`}
        adminActions={[
          { id: "edit", label: "Modifier", onSelect: onEdit },
          {
            id: "structure",
            label: "Gérer la structure",
            href: `/structure?territoire=${encodeURIComponent(platform.id)}`,
          },
          {
            id: "archive",
            label: platform.isActive ? "Archiver" : "Réactiver",
            destructive: platform.isActive,
            onSelect: () => {
              if (platform.isActive) {
                setConfirmArchive(true);
                return;
              }
              const form = document.getElementById(
                `archive-platform-${platform.id}`,
              ) as HTMLFormElement | null;
              form?.requestSubmit();
            },
          },
        ]}
        footerExtra={
          <>
            <ArchivePlatformForm platform={platform} onUpdated={onUpdated} />
            {editing ? (
              <EditPlatformForm
                platform={platform}
                onDone={onCloseEdit}
                onUpdated={onUpdated}
              />
            ) : null}
          </>
        }
      />
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Archiver « ${platform.name} » ?`}
        description="Les dossiers et documents sont conservés. Vous pourrez réactiver le projet plus tard."
        confirmLabel="Archiver"
        destructive
        onConfirm={() => {
          setConfirmArchive(false);
          const form = document.getElementById(
            `archive-platform-${platform.id}`,
          ) as HTMLFormElement | null;
          form?.requestSubmit();
        }}
      />
    </>
  );
}

function ArchivePlatformForm({
  platform,
  onUpdated,
}: {
  platform: PlatformRow;
  onUpdated: (row: PlatformRow) => void;
}) {
  const { pushToast } = useToast();
  const [state, action, pending] = useActionState(updateTerritoireAction, initial);
  const wasPending = useRef(false);

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished) return;
    const timer = window.setTimeout(() => {
      if (state.ok && state.platform) {
        onUpdated(state.platform);
        pushToast(
          state.platform.isActive ? "Projet réactivé." : "Projet archivé.",
          "success",
        );
      } else if (state.error) {
        pushToast(state.error, "error");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pending, state, onUpdated, pushToast]);

  return (
    <form
      id={`archive-platform-${platform.id}`}
      action={action}
      className="hidden"
    >
      <input type="hidden" name="territoireId" value={platform.id} />
      <input type="hidden" name="isActive" value={platform.isActive ? "0" : "1"} />
      {state.error ? <span className="sr-only">{state.error}</span> : null}
    </form>
  );
}

function EditPlatformForm({
  platform,
  onDone,
  onUpdated,
}: {
  platform: PlatformRow;
  onDone: () => void;
  onUpdated: (row: PlatformRow) => void;
}) {
  const { pushToast } = useToast();
  const [state, action, pending] = useActionState(updateTerritoireAction, initial);
  const wasPending = useRef(false);

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished) return;
    const timer = window.setTimeout(() => {
      if (state.ok && state.platform) {
        onUpdated(state.platform);
        onDone();
        pushToast("Projet mis à jour.", "success");
      } else if (state.error) {
        pushToast(state.error, "error");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pending, state, onUpdated, onDone, pushToast]);

  return (
    <form
      action={action}
      className="mt-3 space-y-2 border border-border bg-surface p-4"
    >
      <input type="hidden" name="territoireId" value={platform.id} />
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Modifier le projet
      </p>
      <Field name="name" label="Nom" defaultValue={platform.name} required />
      <label className="block text-xs">
        <span className="text-muted-foreground">Description</span>
        <input
          name="description"
          defaultValue={platform.description || ""}
          className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
      </label>
      <label className="block text-xs">
        <span className="text-muted-foreground">Statut</span>
        <select
          name="isActive"
          defaultValue={platform.isActive ? "1" : "0"}
          className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="1">Actif</option>
          <option value="0">Archivé</option>
        </select>
      </label>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="h-8 rounded-md border border-border px-3 text-xs hover:bg-muted"
        >
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
      />
    </label>
  );
}
