"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  updateProjectAction,
  updateTerritoireAction,
  type LiveDossier,
  type ProjectActionState,
} from "@/app/(private)/manage/actions";
import {
  HeritageCard,
  HeritageCardAdminMenu,
} from "@/components/heritage/heritage-card";
import { CreateDossierDialog } from "@/components/manage/create-dossier-dialog";
import { useToast } from "@/components/ui/toast";
import { SAFI_PROJECTS } from "@/lib/heritage/config/structure";

const initial: ProjectActionState = {};

export type DossierRow = LiveDossier;

export type PlatformDetail = {
  id: string;
  name: string;
  code: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  dossiers: DossierRow[];
};

function dossierCatalogCopy(slug: string): { title: string; description: string } | null {
  const entry = SAFI_PROJECTS.find((p) => p.projectSlug === slug);
  if (!entry) return null;
  return { title: entry.title, description: entry.description };
}

export function PlatformDetailView({
  platform: initialPlatform,
}: {
  platform: PlatformDetail;
}) {
  const { pushToast } = useToast();
  const [platform, setPlatform] = useState(initialPlatform);
  const [dossiers, setDossiers] = useState(initialPlatform.dossiers);
  const [createOpen, setCreateOpen] = useState(false);
  const [editPlatform, setEditPlatform] = useState(false);
  const [editDossierId, setEditDossierId] = useState<string | null>(null);
  const [platformState, platformAction, platformPending] = useActionState(
    updateTerritoireAction,
    initial,
  );
  const [archiveState, archivePlatformAction, archiving] = useActionState(
    updateTerritoireAction,
    initial,
  );

  useEffect(() => {
    setPlatform(initialPlatform);
    setDossiers(initialPlatform.dossiers);
  }, [initialPlatform]);

  useEffect(() => {
    if (!platformState.ok || !platformState.platform) return;
    const p = platformState.platform;
    setPlatform((prev) => ({
      ...prev,
      name: p.name,
      code: p.code,
      slug: p.slug,
      description: p.description,
      isActive: p.isActive,
      updatedAt: p.lastActivityAt,
    }));
    setEditPlatform(false);
    pushToast("Projet mis à jour.", "success");
  }, [platformState, pushToast]);

  useEffect(() => {
    if (!archiveState.ok || !archiveState.platform) return;
    const p = archiveState.platform;
    setPlatform((prev) => ({
      ...prev,
      isActive: p.isActive,
      name: p.name,
      code: p.code,
      slug: p.slug,
      description: p.description,
    }));
    pushToast(
      p.isActive ? "Projet réactivé." : "Projet archivé.",
      "success",
    );
  }, [archiveState, pushToast]);

  function upsertDossier(row: DossierRow) {
    setDossiers((prev) => {
      const idx = prev.findIndex((d) => d.id === row.id);
      if (idx === -1) return [row, ...prev];
      const next = [...prev];
      next[idx] = row;
      return next;
    });
  }

  const dossierCount = dossiers.length;
  const fileCount = dossiers.reduce((n, d) => n + d.fileCount, 0);
  const subtleMeta = [
    platform.code,
    platform.isActive ? "Actif" : "Archivé",
    dossierCount === 1 ? "1 dossier" : `${dossierCount} dossiers`,
    fileCount === 1 ? "1 document" : `${fileCount} documents`,
  ].join(" · ");

  return (
    <section className="mx-auto max-w-6xl pb-4 pt-2 sm:pb-8 sm:pt-4">
      <nav className="mb-6 text-xs text-muted-foreground">
        <Link href="/projects/manage" className="hover:text-foreground hover:underline">
          Projets
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-foreground">{platform.name}</span>
      </nav>

      <header className="mb-8 border-b border-border pb-8 sm:mb-10">
        <p className="page-eyebrow mb-3">
          {platform.code} · Plateforme patrimoniale
        </p>

        <div className="flex items-start justify-between gap-3">
          <h1 className="page-title min-w-0">{platform.name}</h1>
          <HeritageCardAdminMenu
            actions={[
              {
                id: "edit",
                label: "Modifier le projet",
                onSelect: () => setEditPlatform(true),
              },
              {
                id: "structure",
                label: "Gérer la structure",
                href: `/structure?territoire=${encodeURIComponent(platform.id)}`,
              },
              {
                id: "archive",
                label: platform.isActive ? "Archiver" : "Réactiver",
                destructive: platform.isActive,
                disabled: archiving,
                onSelect: () => {
                  const form = document.getElementById(
                    `archive-platform-${platform.id}`,
                  ) as HTMLFormElement | null;
                  form?.requestSubmit();
                },
              },
            ]}
          />
        </div>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
          {platform.description?.trim() ||
            "Plateforme de connaissance et de suivi patrimonial — Château de Mer et Murailles portugaises."}
        </p>

        <p className="mt-3 text-[11px] font-medium tracking-wide text-muted-foreground">
          {subtleMeta}
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-9 items-center rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_88%,white)]"
          >
            Ajouter un dossier patrimonial
          </button>
        </div>
      </header>

      <CreateDossierDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        territoireId={platform.id}
        onDossierCreated={upsertDossier}
      />

      <form
        id={`archive-platform-${platform.id}`}
        action={archivePlatformAction}
        className="hidden"
        onSubmit={(e) => {
          if (
            platform.isActive &&
            !confirm(
              `Archiver « ${platform.name} » ? Les dossiers et documents sont conservés.`,
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="territoireId" value={platform.id} />
        <input
          type="hidden"
          name="isActive"
          value={platform.isActive ? "0" : "1"}
        />
      </form>

      {editPlatform ? (
        <form
          action={platformAction}
          className="mb-8 max-w-3xl space-y-3 border border-border bg-surface p-5"
        >
          <input type="hidden" name="territoireId" value={platform.id} />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Modifier le projet</h2>
            <button
              type="button"
              onClick={() => setEditPlatform(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Fermer
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="name" label="Nom" defaultValue={platform.name} required />
            <Field name="code" label="Code" defaultValue={platform.code} required />
            <Field name="slug" label="Slug" defaultValue={platform.slug} required />
            <label className="block text-xs">
              <span className="text-muted-foreground">Statut</span>
              <select
                name="isActive"
                defaultValue={platform.isActive ? "1" : "0"}
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="1">Actif</option>
                <option value="0">Archivé</option>
              </select>
            </label>
            <label className="block text-xs sm:col-span-2">
              <span className="text-muted-foreground">Description</span>
              <input
                name="description"
                defaultValue={platform.description || ""}
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              />
            </label>
          </div>
          {platformState.error ? (
            <p className="text-sm text-destructive">{platformState.error}</p>
          ) : null}
          <button
            type="submit"
            disabled={platformPending}
            className="h-9 rounded-md border border-border px-4 text-sm hover:bg-muted"
          >
            Enregistrer
          </button>
        </form>
      ) : null}

      {dossiers.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          Aucun dossier patrimonial. Ajoutez Château, Murailles, ou un autre
          dossier.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {dossiers.map((dossier) => {
            const catalog = dossierCatalogCopy(dossier.slug);
            const title = catalog?.title ?? dossier.name;
            const description =
              dossier.description?.trim() ||
              catalog?.description ||
              "Dossier patrimonial.";
            const sectionLabel =
              dossier.sectionCount === 1
                ? "1 rubrique"
                : `${dossier.sectionCount} rubriques`;
            const docLabel =
              dossier.fileCount === 1
                ? "1 document"
                : `${dossier.fileCount} documents`;

            return (
              <DossierHeritageCard
                key={dossier.id}
                platformId={platform.id}
                dossier={dossier}
                title={title}
                description={description}
                meta={`${sectionLabel} · ${docLabel}`}
                editing={editDossierId === dossier.id}
                onEdit={() => setEditDossierId(dossier.id)}
                onCloseEdit={() => setEditDossierId(null)}
                onDossierUpdated={upsertDossier}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function DossierHeritageCard({
  platformId,
  dossier,
  title,
  description,
  meta,
  editing,
  onEdit,
  onCloseEdit,
  onDossierUpdated,
}: {
  platformId: string;
  dossier: DossierRow;
  title: string;
  description: string;
  meta: string;
  editing: boolean;
  onEdit: () => void;
  onCloseEdit: () => void;
  onDossierUpdated: (row: DossierRow) => void;
}) {
  return (
    <HeritageCard
      href={`/projects/${dossier.slug}`}
      title={title}
      description={description}
      meta={meta}
      adminActions={[
        { id: "edit", label: "Modifier le dossier", onSelect: onEdit },
        {
          id: "structure",
          label: "Gérer la structure",
          href: `/structure?territoire=${encodeURIComponent(platformId)}&project=${encodeURIComponent(dossier.id)}`,
        },
        {
          id: "archive",
          label: dossier.isActive ? "Archiver" : "Réactiver",
          destructive: dossier.isActive,
          onSelect: () => {
            const form = document.getElementById(
              `archive-dossier-${dossier.id}`,
            ) as HTMLFormElement | null;
            form?.requestSubmit();
          },
        },
      ]}
      footerExtra={
        <>
          <ArchiveDossierForm
            dossier={dossier}
            territoireId={platformId}
            onUpdated={onDossierUpdated}
          />
          {editing ? (
            <EditDossierForm
              dossier={dossier}
              territoireId={platformId}
              onDone={onCloseEdit}
              onUpdated={onDossierUpdated}
            />
          ) : null}
        </>
      }
    />
  );
}

function ArchiveDossierForm({
  dossier,
  territoireId,
  onUpdated,
}: {
  dossier: DossierRow;
  territoireId: string;
  onUpdated: (row: DossierRow) => void;
}) {
  const { pushToast } = useToast();
  const [state, action] = useActionState(updateProjectAction, initial);

  useEffect(() => {
    if (!state.ok || !state.dossier) return;
    onUpdated(state.dossier);
    pushToast(
      state.dossier.isActive ? "Dossier réactivé." : "Dossier archivé.",
      "success",
    );
  }, [state, onUpdated, pushToast]);

  return (
    <form
      id={`archive-dossier-${dossier.id}`}
      action={action}
      className="hidden"
      onSubmit={(e) => {
        if (
          dossier.isActive &&
          !confirm(
            `Archiver « ${dossier.name} » ? Documents et structure sont conservés.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="projectId" value={dossier.id} />
      <input type="hidden" name="territoireId" value={territoireId} />
      <input type="hidden" name="isActive" value={dossier.isActive ? "0" : "1"} />
      {state.error ? <span className="sr-only">{state.error}</span> : null}
    </form>
  );
}

function EditDossierForm({
  dossier,
  territoireId,
  onDone,
  onUpdated,
}: {
  dossier: DossierRow;
  territoireId: string;
  onDone: () => void;
  onUpdated: (row: DossierRow) => void;
}) {
  const { pushToast } = useToast();
  const [state, action, pending] = useActionState(updateProjectAction, initial);

  useEffect(() => {
    if (!state.ok || !state.dossier) return;
    onUpdated(state.dossier);
    onDone();
    pushToast("Dossier mis à jour.", "success");
  }, [state, onUpdated, onDone, pushToast]);

  return (
    <form
      action={action}
      className="mt-3 space-y-2 border border-border bg-surface p-4"
    >
      <input type="hidden" name="projectId" value={dossier.id} />
      <input type="hidden" name="territoireId" value={territoireId} />
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Modifier le dossier
      </p>
      <Field name="name" label="Nom" defaultValue={dossier.name} required />
      <Field name="slug" label="Slug" defaultValue={dossier.slug} required />
      <Field name="code" label="Code" defaultValue={dossier.code || ""} />
      <label className="block text-xs">
        <span className="text-muted-foreground">Type</span>
        <select
          name="type"
          defaultValue={dossier.type}
          className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="CHATEAU">CHATEAU</option>
          <option value="MURAILLE">MURAILLE</option>
          <option value="AUTRE">AUTRE</option>
        </select>
      </label>
      <label className="block text-xs">
        <span className="text-muted-foreground">Description</span>
        <input
          name="description"
          defaultValue={dossier.description || ""}
          className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
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
  pattern,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  pattern?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        pattern={pattern}
        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
      />
    </label>
  );
}
