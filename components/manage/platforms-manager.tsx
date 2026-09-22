"use client";

import { useActionState, useState } from "react";
import {
  updateTerritoireAction,
  type ProjectActionState,
} from "@/app/(private)/manage/actions";
import { CreatePlatformDialog } from "@/components/manage/create-platform-dialog";
import { HeritageCard } from "@/components/heritage/heritage-card";
import { EmptyState, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const initial: ProjectActionState = {};

export type PlatformRow = {
  id: string;
  name: string;
  code: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  dossierCount: number;
  sectionCount: number;
  fileCount: number;
  lastActivityAt: string;
};

export function PlatformsManager({ platforms }: { platforms: PlatformRow[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const single = platforms.length === 1;

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Projets"
        description="Gérez les plateformes patrimoniales. Ouvrez une fiche pour ajouter ou organiser les dossiers."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Ajouter un projet
          </Button>
        }
      />

      <CreatePlatformDialog open={createOpen} onOpenChange={setCreateOpen} />

      {platforms.length === 0 ? (
        <EmptyState
          title="Aucun projet pour le moment"
          description="Créez une plateforme patrimoniale pour y rattacher des dossiers et des documents."
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
              editing={editId === platform.id}
              onEdit={() => setEditId(platform.id)}
              onCloseEdit={() => setEditId(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlatformHeritageCard({
  platform,
  editing,
  onEdit,
  onCloseEdit,
}: {
  platform: PlatformRow;
  editing: boolean;
  onEdit: () => void;
  onCloseEdit: () => void;
}) {
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
    <HeritageCard
      href={`/projects/manage/${platform.id}`}
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
            const form = document.getElementById(
              `archive-platform-${platform.id}`,
            ) as HTMLFormElement | null;
            form?.requestSubmit();
          },
        },
      ]}
      footerExtra={
        <>
          <ArchivePlatformForm platform={platform} />
          {editing ? (
            <EditPlatformForm platform={platform} onDone={onCloseEdit} />
          ) : null}
        </>
      }
    />
  );
}

function ArchivePlatformForm({ platform }: { platform: PlatformRow }) {
  const [state, action] = useActionState(updateTerritoireAction, initial);
  return (
    <form
      id={`archive-platform-${platform.id}`}
      action={action}
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
      <input type="hidden" name="isActive" value={platform.isActive ? "0" : "1"} />
      {state.error ? <span className="sr-only">{state.error}</span> : null}
    </form>
  );
}

function EditPlatformForm({
  platform,
  onDone,
}: {
  platform: PlatformRow;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(updateTerritoireAction, initial);
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
      <Field name="code" label="Code" defaultValue={platform.code} required />
      <Field name="slug" label="Slug" defaultValue={platform.slug} required />
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
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
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
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  pattern?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        pattern={pattern}
        placeholder={placeholder}
        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
      />
    </label>
  );
}
