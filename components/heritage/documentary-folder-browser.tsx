"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Folder, FolderPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { SectionDocumentsList } from "@/components/heritage/section-documents-list";
import type { SectionFile } from "@/lib/structure/queries";
import { formatShortDate, formatSize } from "@/lib/utils";

export type FolderCard = {
  id: string;
  name: string;
  parentId: string | null;
  childFolderCount: number;
  documentCount: number;
  totalBytes: number;
  createdByName: string;
  createdAt: string;
  lastActivityAt: string;
};

export type MoveTarget = { id: string | null; label: string };

async function apiJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });
  const payload = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(payload.error || "L’opération a échoué.");
  return payload;
}

function FolderNameDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  initialName = "",
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel: string;
  initialName?: string;
  pending: boolean;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [source, setSource] = useState(initialName);
  if (initialName !== source) {
    setSource(initialName);
    setName(initialName);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="pr-8 text-base font-semibold tracking-tight">
          {title}
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">
          Le dossier reste dans la rubrique courante.
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(name.trim());
          }}
        >
          <label className="block text-xs">
            <span className="text-muted-foreground">Nom</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              autoFocus
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => onOpenChange(false)}
              className="h-9 border border-border px-3 text-sm hover:bg-muted disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="h-9 bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {pending ? "…" : confirmLabel}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentaryFolderBrowser({
  projectSlug,
  sectionId,
  currentFolderId,
  sectionBasePath,
  folders,
  documents,
  moveTargets,
  canManage,
  canUpload,
  canDownload,
  canDelete,
}: {
  projectSlug: string;
  sectionId: string;
  currentFolderId: string | null;
  sectionBasePath?: string;
  folders: FolderCard[];
  documents: SectionFile[];
  moveTargets: MoveTarget[];
  canManage: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<FolderCard | null>(null);
  const [moveTarget, setMoveTarget] = useState<FolderCard | null>(null);
  const [moveParentId, setMoveParentId] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<FolderCard | null>(null);

  const sortedFolders = useMemo(
    () =>
      [...folders].sort((a, b) =>
        a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
      ),
    [folders],
  );

  function openCreate(parentId: string | null = currentFolderId) {
    setCreateParentId(parentId);
    setCreateOpen(true);
  }

  async function run(operation: () => Promise<unknown>, success: string) {
    setPending(true);
    try {
      await operation();
      pushToast(success, "success");
      router.refresh();
      return true;
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "L’opération a échoué.",
        "error",
      );
      return false;
    } finally {
      setPending(false);
    }
  }

  const filteredMoveTargets = moveTargets.filter((t) => t.id !== moveTarget?.id);
  const hasDocumentsInChildFolders = folders.some((f) => f.documentCount > 0);
  const locationLabel = currentFolderId ? "ce dossier" : "cette rubrique";

  function folderHref(folderId: string) {
    const base = sectionBasePath ?? `/projects/${projectSlug}`;
    return `${base}?sectionId=${sectionId}&folderId=${folderId}`;
  }

  return (
    <div className="space-y-5">
      {canManage ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openCreate(currentFolderId)}
          >
            <FolderPlus />
            Nouveau dossier
          </Button>
        </div>
      ) : null}

      {sortedFolders.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Dossiers</h3>
          <div className="overflow-hidden border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="data-table min-w-[52rem]">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th className="w-24 text-right">Fichiers</th>
                    <th className="w-24 text-right">Taille</th>
                    <th className="w-48">Créé par</th>
                    <th className="w-28">Créé le</th>
                    <th className="w-36">Dernière activité</th>
                    {canManage ? (
                      <th className="w-36 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {sortedFolders.map((folder) => (
                    <tr key={folder.id} className="group/folder">
                      <td className="max-w-64">
                        <Link
                          href={folderHref(folder.id)}
                          scroll={false}
                          className="flex min-w-0 items-center gap-2 text-foreground group-hover/folder:text-accent"
                        >
                          <Folder className="size-3.5 shrink-0 text-accent" aria-hidden />
                          <span className="truncate text-[13px] font-medium">
                            {folder.name}
                          </span>
                        </Link>
                      </td>
                      <td className="text-right text-[13px] tabular-nums text-muted-foreground">
                        {folder.documentCount}
                      </td>
                      <td className="text-right text-[13px] tabular-nums text-muted-foreground">
                        {formatSize(folder.totalBytes)}
                      </td>
                      <td
                        className="max-w-48 truncate text-[13px] text-muted-foreground"
                        title={folder.createdByName}
                      >
                        {folder.createdByName}
                      </td>
                      <td className="whitespace-nowrap text-[13px] tabular-nums text-muted-foreground">
                        {formatShortDate(folder.createdAt)}
                      </td>
                      <td className="whitespace-nowrap text-[13px] tabular-nums text-muted-foreground">
                        {formatShortDate(folder.lastActivityAt)}
                      </td>
                      {canManage ? (
                        <td className="text-right">
                          <div className="flex justify-end gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/folder:opacity-100">
                            <button
                              type="button"
                              className="rounded-sm px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={() => setRenameTarget(folder)}
                            >
                              Renommer
                            </button>
                            <button
                              type="button"
                              className="rounded-sm px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={() => openCreate(folder.id)}
                            >
                              Sous-dossier
                            </button>
                            <button
                              type="button"
                              className="rounded-sm px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                              onClick={() => {
                                setMoveTarget(folder);
                                setMoveParentId(folder.parentId ?? "");
                              }}
                            >
                              Déplacer
                            </button>
                            <button
                              type="button"
                              className="rounded-sm px-1.5 py-1 text-[10px] text-destructive hover:bg-muted"
                              onClick={() => setDeleteTarget(folder)}
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <SectionDocumentsList
        documents={documents}
        title="Documents"
        canDownload={canDownload}
        canDelete={canDelete}
        hasDocumentsInChildFolders={
          documents.length === 0 && hasDocumentsInChildFolders
        }
        locationLabel={locationLabel}
        uploadContext={
          canUpload ? { sectionId, folderId: currentFolderId } : undefined
        }
      />

      <FolderNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nouveau dossier"
        confirmLabel="Créer"
        pending={pending}
        onSubmit={async (name) => {
          const ok = await run(
            () =>
              apiJson("/api/folders", {
                method: "POST",
                body: JSON.stringify({
                  name,
                  sectionId,
                  parentId: createParentId,
                }),
              }),
            "Dossier créé.",
          );
          if (ok) setCreateOpen(false);
        }}
      />

      <FolderNameDialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        title="Renommer le dossier"
        confirmLabel="Enregistrer"
        initialName={renameTarget?.name ?? ""}
        pending={pending}
        onSubmit={async (name) => {
          if (!renameTarget) return;
          const ok = await run(
            () =>
              apiJson(`/api/folders/${renameTarget.id}`, {
                method: "PATCH",
                body: JSON.stringify({ name }),
              }),
            "Dossier renommé.",
          );
          if (ok) setRenameTarget(null);
        }}
      />

      <Dialog
        open={Boolean(moveTarget)}
        onOpenChange={(open) => {
          if (!open) setMoveTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogTitle className="pr-8 text-base font-semibold">
            Déplacer le dossier
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Choisissez un emplacement dans la même rubrique.
          </DialogDescription>
          <label className="mt-4 block text-xs">
            <span className="text-muted-foreground">Destination</span>
            <select
              value={moveParentId}
              onChange={(e) => setMoveParentId(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              {filteredMoveTargets.map((t) => (
                <option key={t.id ?? "root"} value={t.id ?? ""}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setMoveTarget(null)}
              className="h-9 border border-border px-3 text-sm hover:bg-muted"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (!moveTarget) return;
                const ok = await run(
                  () =>
                    apiJson(`/api/folders/${moveTarget.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        parentId: moveParentId === "" ? null : moveParentId,
                      }),
                    }),
                  "Dossier déplacé.",
                );
                if (ok) setMoveTarget(null);
              }}
              className="h-9 bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {pending ? "…" : "Déplacer"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Supprimer ce dossier ?"
        description={
          deleteTarget &&
          (deleteTarget.childFolderCount > 0 || deleteTarget.documentCount > 0)
            ? "Ce dossier n’est pas vide. Videz-le d’abord (documents et sous-dossiers), puis réessayez."
            : "Cette action est définitive. Aucun fichier cloud ne sera touché."
        }
        confirmLabel={
          deleteTarget &&
          (deleteTarget.childFolderCount > 0 || deleteTarget.documentCount > 0)
            ? "Compris"
            : "Supprimer"
        }
        destructive={
          !(
            deleteTarget &&
            (deleteTarget.childFolderCount > 0 || deleteTarget.documentCount > 0)
          )
        }
        pending={pending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (
            deleteTarget.childFolderCount > 0 ||
            deleteTarget.documentCount > 0
          ) {
            setDeleteTarget(null);
            return;
          }
          const ok = await run(
            () =>
              apiJson(`/api/folders/${deleteTarget.id}`, { method: "DELETE" }),
            "Dossier supprimé.",
          );
          if (ok) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
