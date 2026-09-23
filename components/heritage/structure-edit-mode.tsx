"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, X } from "lucide-react";
import {
  createGroupAction,
  createSectionAction,
  deleteSectionAction,
  renameGroupAction,
  reorderGroupsAction,
  reorderSectionsAction,
  updateSectionAction,
  type LiveSection,
} from "@/app/(private)/manage/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SectionRemoveControl } from "@/components/manage/section-remove-control";
import { GroupRemoveControl } from "@/components/manage/group-remove-control";
import { useToast } from "@/components/ui/toast";

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
  hasLinkedContent: boolean;
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
  groups: initialGroups,
  sections: initialSections,
  onExit,
}: StructureEditModeProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState(initialGroups);
  const [sections, setSections] = useState(initialSections);
  const [source, setSource] = useState({
    groups: initialGroups,
    sections: initialSections,
  });

  if (
    initialGroups !== source.groups ||
    initialSections !== source.sections
  ) {
    setSource({ groups: initialGroups, sections: initialSections });
    setGroups(initialGroups);
    setSections(initialSections);
  }

  const orderedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);

  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [addSectionGroupId, setAddSectionGroupId] = useState<string | null>(null);
  const [editSection, setEditSection] = useState<EditableSection | null>(null);
  const [moveSection, setMoveSection] = useState<EditableSection | null>(null);
  const [menuSectionId, setMenuSectionId] = useState<string | null>(null);
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EditableSection | null>(
    null,
  );

  function upsertSection(row: EditableSection | LiveSection) {
    setSections((prev) => {
      const mapped: EditableSection = {
        id: row.id,
        code: row.code,
        slug: row.slug,
        title: row.title,
        description: row.description,
        kind: row.kind,
        groupId: row.groupId,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
        documentCount: row.documentCount,
        codeLocked: row.codeLocked,
        hasLinkedContent: row.hasLinkedContent,
      };
      const idx = prev.findIndex((s) => s.id === mapped.id);
      if (idx === -1) return [...prev, mapped];
      const next = [...prev];
      next[idx] = mapped;
      return next;
    });
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
    setMenuSectionId((prev) => (prev === id ? null : prev));
  }

  function upsertGroup(row: EditableGroup) {
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === row.id);
      if (idx === -1) return [...prev, row];
      const next = [...prev];
      next[idx] = row;
      return next;
    });
  }

  function removeGroup(id: string) {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }

  function runAction(
    action: (
      prev: { ok?: boolean; error?: string; section?: LiveSection; group?: EditableGroup; deletedId?: string },
      form: FormData,
    ) => Promise<{
      ok?: boolean;
      error?: string;
      section?: LiveSection;
      group?: EditableGroup;
      deletedId?: string;
    }>,
    form: FormData,
    onOk?: (result: {
      section?: LiveSection;
      group?: EditableGroup;
      deletedId?: string;
    }) => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action({}, form);
      if (result.error) {
        setError(result.error);
        pushToast(result.error, "error");
        return;
      }
      onOk?.(result);
      router.refresh();
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
    setSections((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      return next
        .map((id, sortOrder) => {
          const row = byId.get(id);
          return row ? { ...row, sortOrder } : null;
        })
        .filter((s): s is EditableSection => Boolean(s));
    });
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("orderedIds", next.join(","));
    runAction(reorderSectionsAction, fd, () => {
      pushToast("Ordre des rubriques mis à jour.", "success");
    });
  }

  function moveGroupInList(groupId: string, direction: -1 | 1) {
    const ordered = orderedGroups.map((g) => g.id);
    const idx = ordered.indexOf(groupId);
    const swap = idx + direction;
    if (idx < 0 || swap < 0 || swap >= ordered.length) return;
    const next = [...ordered];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setGroups((prev) => {
      const byId = new Map(prev.map((g) => [g.id, g]));
      return next
        .map((id, sortOrder) => {
          const row = byId.get(id);
          return row ? { ...row, sortOrder } : null;
        })
        .filter((g): g is EditableGroup => Boolean(g));
    });
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("orderedIds", next.join(","));
    runAction(reorderGroupsAction, fd, () => {
      pushToast("Ordre des groupes mis à jour.", "success");
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-muted/30 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          Mode structure — ajoutez, réordonnez ou retirez des rubriques. Les codes
          existants restent stables.
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
                      runAction(renameGroupAction, fd, (result) => {
                        if (result.group) upsertGroup(result.group);
                        setRenameGroupId(null);
                        pushToast("Groupe renommé.", "success");
                      });
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
                <GroupRemoveControl
                  groupId={group.id}
                  sectionCount={rows.length}
                  onDeleted={removeGroup}
                />
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
                    <th className="w-24 px-2 py-2 text-right font-semibold">
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
                      <td className="relative px-2 py-2">
                        <div className="flex items-center justify-end gap-0.5">
                          <SectionRemoveControl
                            projectId={projectId}
                            section={section}
                            onDeleted={removeSection}
                            onDeactivated={upsertSection}
                          />
                          <button
                            type="button"
                            className="inline-flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
                            aria-label="Autres actions rubrique"
                            onClick={() =>
                              setMenuSectionId((id) =>
                                id === section.id ? null : section.id,
                              )
                            }
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </div>
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
                              runAction(updateSectionAction, fd, (result) => {
                                if (result.section) upsertSection(result.section);
                                setMenuSectionId(null);
                                pushToast(
                                  section.isActive
                                    ? "Rubrique désactivée."
                                    : "Rubrique activée.",
                                  "success",
                                );
                              });
                            }}
                            onDelete={() => {
                              setPendingDelete(section);
                              setMenuSectionId(null);
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
              runAction(createGroupAction, fd, (result) => {
                if (result.group) upsertGroup(result.group);
                setAddGroupOpen(false);
                pushToast("Groupe ajouté.", "success");
              });
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
              runAction(createSectionAction, fd, (result) => {
                if (result.section) upsertSection(result.section);
                setAddSectionGroupId(null);
                pushToast("Rubrique ajoutée.", "success");
              });
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
              runAction(updateSectionAction, fd, (result) => {
                if (result.section) upsertSection(result.section);
                setEditSection(null);
                pushToast("Rubrique enregistrée.", "success");
              });
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
            <label className="block text-xs">
              <span className="text-muted-foreground">Groupe</span>
              <select
                name="groupId"
                defaultValue={editSection.groupId ?? ""}
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
              runAction(updateSectionAction, fd, (result) => {
                if (result.section) upsertSection(result.section);
                setMoveSection(null);
                pushToast("Rubrique déplacée.", "success");
              });
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

      {/* Menu « Supprimer » uses the same confirmation rules as the row trash. */}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={
          pendingDelete?.hasLinkedContent
            ? "Cette rubrique ne peut pas être supprimée"
            : "Supprimer cette rubrique ?"
        }
        description={
          pendingDelete?.hasLinkedContent
            ? "Cette rubrique contient des documents ou des données liées. Elle ne peut pas être supprimée définitivement."
            : "Cette action supprimera définitivement la rubrique."
        }
        confirmLabel={
          pendingDelete?.hasLinkedContent
            ? pendingDelete.isActive
              ? "Désactiver la rubrique"
              : "Compris"
            : "Supprimer"
        }
        destructive={
          !pendingDelete?.hasLinkedContent || Boolean(pendingDelete?.isActive)
        }
        pending={pending}
        onConfirm={() => {
          if (!pendingDelete) return;
          const target = pendingDelete;
          setPendingDelete(null);
          if (target.hasLinkedContent) {
            if (!target.isActive) return;
            const fd = new FormData();
            fd.set("sectionId", target.id);
            fd.set("isActive", "0");
            runAction(updateSectionAction, fd, (result) => {
              if (result.section) upsertSection(result.section);
              pushToast("Rubrique désactivée.", "success");
            });
            return;
          }
          // Same mutation as row trash.
          const fd = new FormData();
          fd.set("sectionId", target.id);
          runAction(deleteSectionAction, fd, () => {
            removeSection(target.id);
            pushToast("Rubrique supprimée.", "success");
          });
        }}
      />
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
