"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, X } from "lucide-react";
import {
  createGroupAction,
  createSectionAction,
  deleteGroupAction,
  deleteSectionAction,
  renameGroupAction,
  reorderGroupsAction,
  reorderSectionsAction,
  updateSectionAction,
} from "@/app/(private)/manage/actions";

export type EditableGroup = {
  id: string;
  label: string;
  sortOrder: number;
};

export type EditableSection = {
  id: string;
  code: string;
  slug: string;
  title: string;
  description: string | null;
  kind: string;
  groupId: string | null;
  sortOrder: number;
  isActive: boolean;
  documentCount: number;
  codeLocked: boolean;
};

type StructureEditModeProps = {
  projectId: string;
  projectSlug: string;
  groups: EditableGroup[];
  sections: EditableSection[];
  onExit: () => void;
};

export function StructureEditMode({
  projectId,
  groups,
  sections,
  onExit,
}: StructureEditModeProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const orderedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);

  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [addSectionGroupId, setAddSectionGroupId] = useState<string | null>(null);
  const [editSection, setEditSection] = useState<EditableSection | null>(null);
  const [moveSection, setMoveSection] = useState<EditableSection | null>(null);
  const [menuSectionId, setMenuSectionId] = useState<string | null>(null);
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  function runAction(
    action: (prev: { ok?: boolean; error?: string }, form: FormData) => Promise<{ ok?: boolean; error?: string }>,
    form: FormData,
    onOk?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action({}, form);
      if (result.error) {
        setError(result.error);
        return;
      }
      onOk?.();
      refresh();
    });
  }

  function sectionsInGroup(groupId: string | null) {
    return sections
      .filter((s) => s.groupId === groupId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function moveSectionInList(sectionId: string, direction: -1 | 1) {
    const ordered = [...sections]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => s.id);
    const idx = ordered.indexOf(sectionId);
    const swap = idx + direction;
    if (idx < 0 || swap < 0 || swap >= ordered.length) return;
    const next = [...ordered];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("orderedIds", next.join(","));
    runAction(reorderSectionsAction, fd);
  }

  function moveGroupInList(groupId: string, direction: -1 | 1) {
    const ordered = orderedGroups.map((g) => g.id);
    const idx = ordered.indexOf(groupId);
    const swap = idx + direction;
    if (idx < 0 || swap < 0 || swap >= ordered.length) return;
    const next = [...ordered];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("orderedIds", next.join(","));
    runAction(reorderGroupsAction, fd);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-muted/30 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          Mode structure — les codes existants restent stables.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAddGroupOpen(true)}
            className="h-8 border border-border bg-surface px-2.5 text-xs font-medium hover:bg-muted"
          >
            Ajouter un groupe
          </button>
          <button
            type="button"
            onClick={onExit}
            className="h-8 border border-border bg-surface px-2.5 text-xs font-medium hover:bg-muted"
          >
            Terminer
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {orderedGroups.map((group) => {
        const rows = sectionsInGroup(group.id);
        return (
          <div key={group.id}>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
                  {group.label}
                </h2>
                {renameGroupId === group.id ? (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      runAction(renameGroupAction, fd, () =>
                        setRenameGroupId(null),
                      );
                    }}
                  >
                    <input type="hidden" name="groupId" value={group.id} />
                    <input
                      name="label"
                      defaultValue={group.label}
                      required
                      className="h-7 w-36 border border-border bg-background px-1.5 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={pending}
                      className="text-[10px] font-medium hover:underline"
                    >
                      OK
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="text-[10px] text-muted-foreground hover:underline"
                    onClick={() => setRenameGroupId(group.id)}
                  >
                    Renommer
                  </button>
                )}
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => moveGroupInList(group.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => moveGroupInList(group.id, 1)}
                >
                  ↓
                </button>
                {rows.length === 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="text-[10px] text-destructive hover:underline"
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("groupId", group.id);
                      runAction(deleteGroupAction, fd);
                    }}
                  >
                    Retirer
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setAddSectionGroupId(group.id)}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <Plus className="size-3.5" />
                Ajouter une rubrique
              </button>
            </div>

            <div className="overflow-hidden border border-border bg-surface">
              <table className="w-full min-w-[36rem] table-fixed text-left text-sm">
                <thead className="border-b border-border bg-muted/55 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="w-16 px-3 py-2 font-semibold">Code</th>
                    <th className="px-3 py-2 font-semibold">Rubrique</th>
                    <th className="hidden w-24 px-3 py-2 text-right font-semibold sm:table-cell">
                      Docs
                    </th>
                    <th className="w-28 px-3 py-2 font-semibold">Statut</th>
                    <th className="w-20 px-2 py-2 text-right font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((section) => (
                    <tr
                      key={section.id}
                      className="border-b border-border/80 last:border-0"
                    >
                      <td className="px-3 py-2 text-[12px] font-semibold tabular-nums text-accent">
                        {section.code}
                      </td>
                      <td className="px-3 py-2">
                        <div className="truncate text-[13px] font-medium">
                          {section.title}
                        </div>
                        {section.description ? (
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {section.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="hidden px-3 py-2 text-right text-[13px] tabular-nums text-muted-foreground sm:table-cell">
                        {section.documentCount}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="status-pill"
                          data-tone={section.isActive ? "documented" : "empty"}
                        >
                          {section.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="relative px-2 py-2 text-right">
                        <button
                          type="button"
                          className="inline-flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label="Actions rubrique"
                          onClick={() =>
                            setMenuSectionId((id) =>
                              id === section.id ? null : section.id,
                            )
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                        {menuSectionId === section.id ? (
                          <SectionActionMenu
                            section={section}
                            onClose={() => setMenuSectionId(null)}
                            onEdit={() => {
                              setEditSection(section);
                              setMenuSectionId(null);
                            }}
                            onMove={() => {
                              setMoveSection(section);
                              setMenuSectionId(null);
                            }}
                            onReorder={(dir) => moveSectionInList(section.id, dir)}
                            onToggleActive={() => {
                              const fd = new FormData();
                              fd.set("sectionId", section.id);
                              fd.set("isActive", section.isActive ? "0" : "1");
                              runAction(updateSectionAction, fd, () =>
                                setMenuSectionId(null),
                              );
                            }}
                            onDelete={() => {
                              if (
                                !confirm(
                                  section.documentCount > 0 || section.codeLocked
                                    ? "Cette rubrique contient du contenu. La suppression sera refusée — préférez la désactivation."
                                    : `Supprimer la rubrique « ${section.title} » ?`,
                                )
                              ) {
                                return;
                              }
                              const fd = new FormData();
                              fd.set("sectionId", section.id);
                              runAction(deleteSectionAction, fd, () =>
                                setMenuSectionId(null),
                              );
                            }}
                            pending={pending}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-4 text-xs text-muted-foreground"
                      >
                        Aucune rubrique dans ce groupe.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {addGroupOpen ? (
        <Modal title="Ajouter un groupe" onClose={() => setAddGroupOpen(false)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("projectId", projectId);
              runAction(createGroupAction, fd, () => setAddGroupOpen(false));
            }}
          >
            <Field name="label" label="Libellé" required />
            <ModalActions
              pending={pending}
              onCancel={() => setAddGroupOpen(false)}
              submitLabel="Créer"
            />
          </form>
        </Modal>
      ) : null}

      {addSectionGroupId ? (
        <Modal
          title="Ajouter une rubrique"
          onClose={() => setAddSectionGroupId(null)}
        >
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("projectId", projectId);
              fd.set("groupId", addSectionGroupId);
              fd.set("kind", "documentary");
              runAction(createSectionAction, fd, () =>
                setAddSectionGroupId(null),
              );
            }}
          >
            <Field name="title" label="Titre" required />
            <label className="block text-xs">
              <span className="text-muted-foreground">Description (optionnel)</span>
              <textarea
                name="description"
                rows={3}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <p className="text-[11px] text-muted-foreground">
              Le code et l’ordre sont générés automatiquement.
            </p>
            <ModalActions
              pending={pending}
              onCancel={() => setAddSectionGroupId(null)}
              submitLabel="Ajouter"
            />
          </form>
        </Modal>
      ) : null}

      {editSection ? (
        <Modal title="Modifier la rubrique" onClose={() => setEditSection(null)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("sectionId", editSection.id);
              runAction(updateSectionAction, fd, () => setEditSection(null));
            }}
          >
            <Field
              name="title"
              label="Titre"
              defaultValue={editSection.title}
              required
            />
            <label className="block text-xs">
              <span className="text-muted-foreground">Description</span>
              <textarea
                name="description"
                rows={3}
                defaultValue={editSection.description ?? ""}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <p className="text-[11px] text-muted-foreground">
              Code stable : {editSection.code}
            </p>
            <ModalActions
              pending={pending}
              onCancel={() => setEditSection(null)}
              submitLabel="Enregistrer"
            />
          </form>
        </Modal>
      ) : null}

      {moveSection ? (
        <Modal title="Déplacer la rubrique" onClose={() => setMoveSection(null)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("sectionId", moveSection.id);
              runAction(updateSectionAction, fd, () => setMoveSection(null));
            }}
          >
            <label className="block text-xs">
              <span className="text-muted-foreground">Groupe cible</span>
              <select
                name="groupId"
                defaultValue={moveSection.groupId ?? ""}
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="">— Sans groupe —</option>
                {orderedGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <ModalActions
              pending={pending}
              onCancel={() => setMoveSection(null)}
              submitLabel="Déplacer"
            />
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function SectionActionMenu({
  section,
  onClose,
  onEdit,
  onMove,
  onReorder,
  onToggleActive,
  onDelete,
  pending,
}: {
  section: EditableSection;
  onClose: () => void;
  onEdit: () => void;
  onMove: () => void;
  onReorder: (dir: -1 | 1) => void;
  onToggleActive: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-2 top-8 z-20 min-w-[11rem] border border-border bg-surface py-1 text-left shadow-sm"
    >
      <button
        type="button"
        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
        onClick={onEdit}
      >
        Modifier
      </button>
      <button
        type="button"
        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
        onClick={onMove}
      >
        Déplacer
      </button>
      <button
        type="button"
        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
        onClick={() => onReorder(-1)}
      >
        Monter
      </button>
      <button
        type="button"
        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
        onClick={() => onReorder(1)}
      >
        Descendre
      </button>
      <button
        type="button"
        disabled={pending}
        className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
        onClick={onToggleActive}
      >
        {section.isActive ? "Désactiver" : "Activer"}
      </button>
      <button
        type="button"
        disabled={pending}
        className="block w-full px-3 py-1.5 text-left text-xs text-destructive hover:bg-muted"
        onClick={onDelete}
      >
        Supprimer
      </button>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md border border-border bg-surface p-4 shadow-lg"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  pending,
  onCancel,
  submitLabel,
}: {
  pending: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="h-9 border border-border px-3 text-sm hover:bg-muted"
      >
        Annuler
      </button>
      <button
        type="submit"
        disabled={pending}
        className="h-9 bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "…" : submitLabel}
      </button>
    </div>
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
        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
      />
    </label>
  );
}
