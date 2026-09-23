"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { DocumentaryFolderTree } from "@/components/heritage/documentary-folder-tree";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { DocumentaryFolderTreeNode } from "@/lib/heritage/documentary-folder-types";
import {
  loadDocumentaryFolderTreeAction,
  type DocumentaryFolderTreePayload,
} from "@/app/(private)/manage/folder-actions";

async function apiJson<T>(url: string, init: RequestInit): Promise<T> {
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
  if (!res.ok) throw new Error(payload.error || "L’opération a échoué.");
  return payload;
}

function serializeTree(
  nodes: DocumentaryFolderTreePayload[],
): DocumentaryFolderTreeNode[] {
  return nodes.map((n) => ({
    ...n,
    children: serializeTree(n.children),
  }));
}

export function StructureDocumentaryFolders({
  projectId,
  heritageSectionId,
}: {
  projectId: string;
  heritageSectionId: string;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [activeSectionId, setActiveSectionId] = useState(heritageSectionId);
  const [tree, setTree] = useState<DocumentaryFolderTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [moveParentId, setMoveParentId] = useState("");

  if (heritageSectionId !== activeSectionId) {
    setActiveSectionId(heritageSectionId);
    setTree([]);
    setLoading(true);
  }

  const reload = useCallback(async () => {
    const result = await loadDocumentaryFolderTreeAction(heritageSectionId);
    if (result.error) {
      pushToast(result.error, "error");
      setTree([]);
    } else {
      setTree(serializeTree(result.tree ?? []));
    }
    setLoading(false);
  }, [heritageSectionId, pushToast]);

  useEffect(() => {
    let cancelled = false;
    loadDocumentaryFolderTreeAction(heritageSectionId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        pushToast(result.error, "error");
        setTree([]);
      } else {
        setTree(serializeTree(result.tree ?? []));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [heritageSectionId, pushToast]);

  function flatTargets(
    nodes: DocumentaryFolderTreeNode[],
    prefix = "",
    exclude?: string | null,
  ): { id: string | null; label: string }[] {
    const out: { id: string | null; label: string }[] = [];
    if (!prefix) out.push({ id: null, label: "Racine de la rubrique" });
    for (const n of nodes) {
      if (exclude && n.id === exclude) continue;
      const label = prefix ? `${prefix} › ${n.name}` : n.name;
      out.push({ id: n.id, label });
      out.push(...flatTargets(n.children, label, exclude));
    }
    return out;
  }

  async function createFolder() {
    setPending(true);
    try {
      await apiJson("/api/folders", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          projectId,
          parentId: createParentId,
          heritageSectionId,
        }),
      });
      setCreateOpen(false);
      setName("");
      setDescription("");
      pushToast("Dossier créé.", "success");
      await reload();
      startTransition(() => router.refresh());
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "Création impossible.",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  async function renameFolder() {
    if (!renameId) return;
    setPending(true);
    try {
      await apiJson(`/api/folders/${renameId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: renameName.trim() }),
      });
      setRenameId(null);
      pushToast("Dossier renommé.", "success");
      await reload();
      startTransition(() => router.refresh());
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
    if (!moveId) return;
    setPending(true);
    try {
      await apiJson(`/api/folders/${moveId}`, {
        method: "PATCH",
        body: JSON.stringify({
          parentId: moveParentId === "" ? null : moveParentId,
        }),
      });
      setMoveId(null);
      pushToast("Dossier déplacé.", "success");
      await reload();
      startTransition(() => router.refresh());
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
    if (!deleteId) return;
    setPending(true);
    try {
      await apiJson(`/api/folders/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      pushToast("Dossier supprimé.", "success");
      await reload();
      startTransition(() => router.refresh());
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "Suppression impossible.",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-t border-border pt-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Dossiers documentaires
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Organisation flexible des fichiers dans cette rubrique (indépendante
            de la structure patrimoniale).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateParentId(null);
            setCreateOpen(true);
          }}
          className="inline-flex h-8 items-center gap-1.5 border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted"
        >
          <FolderPlus className="size-3.5" />
          Nouveau
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : (
        <DocumentaryFolderTree
          nodes={tree}
          canManage
          actions={{
            onCreateChild: (id) => {
              setCreateParentId(id);
              setCreateOpen(true);
            },
            onRename: (id) => {
              const find = (
                nodes: DocumentaryFolderTreeNode[],
              ): DocumentaryFolderTreeNode | null => {
                for (const n of nodes) {
                  if (n.id === id) return n;
                  const c = find(n.children);
                  if (c) return c;
                }
                return null;
              };
              const node = find(tree);
              setRenameId(id);
              setRenameName(node?.name ?? "");
            },
            onMove: (id) => {
              setMoveId(id);
              setMoveParentId("");
            },
            onDelete: (id) => setDeleteId(id),
          }}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Nouveau dossier</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {createParentId
              ? "Sous-dossier dans l’emplacement sélectionné."
              : "Dossier à la racine de la rubrique."}
          </DialogDescription>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void createFolder();
            }}
          >
            <label className="block text-xs">
              <span className="text-muted-foreground">Nom</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">Description (optionnel)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="h-9 border border-border px-3 text-sm"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={pending || !name.trim()}
                className="h-9 bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {pending ? "…" : "Créer"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(renameId)}
        onOpenChange={(open) => {
          if (!open) setRenameId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogTitle>Renommer</DialogTitle>
          <label className="mt-4 block text-xs">
            <span className="text-muted-foreground">Nom</span>
            <input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRenameId(null)}
              className="h-9 border border-border px-3 text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={pending || !renameName.trim()}
              onClick={() => void renameFolder()}
              className="h-9 bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {pending ? "…" : "Enregistrer"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(moveId)}
        onOpenChange={(open) => {
          if (!open) setMoveId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogTitle>Déplacer</DialogTitle>
          <label className="mt-4 block text-xs">
            <span className="text-muted-foreground">Destination</span>
            <select
              value={moveParentId}
              onChange={(e) => setMoveParentId(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              {flatTargets(tree, "", moveId).map((t) => (
                <option key={t.id ?? "root"} value={t.id ?? ""}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMoveId(null)}
              className="h-9 border border-border px-3 text-sm"
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
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Supprimer ce dossier ?"
        description="Seuls les dossiers vides peuvent être supprimés. Les fichiers cloud ne sont jamais effacés automatiquement."
        confirmLabel="Supprimer"
        destructive
        pending={pending}
        onConfirm={() => void deleteFolder()}
      />
    </div>
  );
}
