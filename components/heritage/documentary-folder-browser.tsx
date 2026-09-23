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
import {
  folderMetaLine,
} from "@/components/heritage/documentary-folder-tree";
import type { DocumentaryFolderCard } from "@/lib/heritage/documentary-folder-types";
import type { SectionDocument } from "@/lib/heritage/queries/section-documents";
import { sectionFolderPath } from "@/lib/heritage/config/structure";
import { cn } from "@/lib/utils";

type MoveTarget = { id: string | null; label: string };

async function apiJson<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & T;
  if (!res.ok) {
    throw new Error(payload.error || "L’opération a échoué.");
  }
  return payload;
}

function FolderFormDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  initialName = "",
  initialDescription = "",
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel: string;
  initialName?: string;
  initialDescription?: string;
  pending: boolean;
  onSubmit: (values: { name: string; description: string }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [source, setSource] = useState({ initialName, initialDescription });
  if (
    initialName !== source.initialName ||
    initialDescription !== source.initialDescription
  ) {
    setSource({ initialName, initialDescription });
    setName(initialName);
    setDescription(initialDescription);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="pr-8 text-base font-semibold tracking-tight">
          {title}
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">
          Le dossier sera créé à l’emplacement actuel.
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name: name.trim(), description: description.trim() });
          }}
        >
          <label className="block text-xs">
            <span className="text-muted-foreground">Nom</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              autoFocus
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Description (optionnel)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
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
  projectId,
  projectSlug,
  sectionCode,
  heritageSectionId,
  currentFolderId,
  folders,
  documents,
  moveTargets,
  canManage,
  canUpload,
  canDownload,
  canDelete,
}: {
  projectId: string;
  projectSlug: string;
  sectionCode: string;
  heritageSectionId: string;
  currentFolderId: string | null;
  folders: DocumentaryFolderCard[];
  documents: SectionDocument[];
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
  const [renameTarget, setRenameTarget] = useState<DocumentaryFolderCard | null>(
    null,
  );
  const [moveTarget, setMoveTarget] = useState<DocumentaryFolderCard | null>(
    null,
  );
  const [moveParentId, setMoveParentId] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<DocumentaryFolderCard | null>(
    null,
  );

  const [localFolders, setLocalFolders] = useState(folders);
  const [foldersSource, setFoldersSource] = useState(folders);
  if (folders !== foldersSource) {
    setFoldersSource(folders);
    setLocalFolders(folders);
  }

  const sortedFolders = useMemo(
    () =>
      [...localFolders].sort((a, b) =>
        a.name.localeCompare(b.name, "fr", { sensitivity: "base" }),
      ),
    [localFolders],
  );

  function openCreate(parentId: string | null = currentFolderId) {
    setCreateParentId(parentId);
    setCreateOpen(true);
  }

  async function createFolder(values: { name: string; description: string }) {
    setPending(true);
    try {
      await apiJson("/api/folders", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          description: values.description || null,
          projectId,
          parentId: createParentId,
          heritageSectionId,
        }),
      });
      setCreateOpen(false);
      pushToast("Dossier créé.", "success");
      router.refresh();
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "Création impossible.",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  async function renameFolder(values: { name: string; description: string }) {
    if (!renameTarget) return;
    setPending(true);
    try {
      await apiJson(`/api/folders/${renameTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name,
          description: values.description || null,
        }),
      });
      setRenameTarget(null);
      pushToast("Dossier renommé.", "success");
      router.refresh();
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "Renommage impossible.",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  async function moveFolder() {
    if (!moveTarget) return;
    setPending(true);
    try {
      await apiJson(`/api/folders/${moveTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          parentId: moveParentId === "" ? null : moveParentId,
        }),
      });
      setMoveTarget(null);
      pushToast("Dossier déplacé.", "success");
      router.refresh();
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "Déplacement impossible.",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  async function deleteFolder() {
    if (!deleteTarget) return;
    setPending(true);
    try {
      await apiJson(`/api/folders/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      pushToast("Dossier supprimé.", "success");
      router.refresh();
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "Suppression impossible.",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  const filteredMoveTargets = moveTargets.filter(
    (t) => t.id !== moveTarget?.id,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canManage ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openCreate(currentFolderId)}
          >
            <FolderPlus />
            Nouveau dossier
          </Button>
        ) : null}
      </div>

      {sortedFolders.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Dossiers
          </h3>
          <ul className="divide-y divide-border border border-border bg-surface">
            {sortedFolders.map((folder) => {
              const href = sectionFolderPath(
                projectSlug,
                sectionCode,
                folder.id,
              );
              const meta = folderMetaLine(folder);
              return (
                <li key={folder.id} className="group/folder relative">
                  <Link
                    href={href}
                    scroll={false}
                    className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40"
                  >
                    <Folder
                      className="mt-0.5 size-4 shrink-0 text-accent"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground group-hover/folder:text-accent">
                        {folder.name}
                      </span>
                      {meta ? (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {meta}
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          Vide
                        </span>
                      )}
                    </span>
                  </Link>
                  {canManage ? (
                    <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition-opacity group-hover/folder:opacity-100 focus-within:opacity-100">
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
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <SectionDocumentsList
        documents={documents}
        title="Documents"
        canDownload={canDownload}
        canDelete={canDelete}
        uploadContext={
          canUpload
            ? {
                documentScope: "PROJECT_SECTION",
                docCategorie: sectionCode,
                projectId,
                folderId: currentFolderId,
              }
            : undefined
        }
      />

      <FolderFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nouveau dossier"
        confirmLabel="Créer"
        pending={pending}
        onSubmit={createFolder}
      />

      <FolderFormDialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        title="Renommer le dossier"
        confirmLabel="Enregistrer"
        initialName={renameTarget?.name ?? ""}
        initialDescription={renameTarget?.description ?? ""}
        pending={pending}
        onSubmit={renameFolder}
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
              onClick={() => void moveFolder()}
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
            (deleteTarget.childFolderCount > 0 ||
              deleteTarget.documentCount > 0)
          )
        }
        pending={pending}
        onConfirm={() => {
          if (
            deleteTarget &&
            (deleteTarget.childFolderCount > 0 ||
              deleteTarget.documentCount > 0)
          ) {
            setDeleteTarget(null);
            return;
          }
          void deleteFolder();
        }}
      />
    </div>
  );
}

export function DocumentaryBreadcrumb({
  parts,
}: {
  parts: { name: string; href: string | null }[];
}) {
  return (
    <nav aria-label="Fil d’Ariane" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {parts.map((part, index) => {
          const last = index === parts.length - 1;
          return (
            <li key={`${part.name}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <span aria-hidden>/</span> : null}
              {part.href && !last ? (
                <Link
                  href={part.href}
                  scroll={false}
                  className="hover:text-foreground hover:underline"
                >
                  {part.name}
                </Link>
              ) : (
                <span
                  className={cn(last && "font-medium text-foreground")}
                  aria-current={last ? "page" : undefined}
                >
                  {part.name}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
