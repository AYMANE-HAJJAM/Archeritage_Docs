"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  createGroupAction,
  createSectionAction,
  deleteGroupAction,
  deleteSectionAction,
  renameGroupAction,
  reorderGroupsAction,
  reorderSectionsAction,
  updateSectionAction,
  type LiveGroup,
  type LiveSection,
  type ProjectActionState,
} from "@/app/(private)/manage/actions";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const initial: ProjectActionState = {};

export type StructureGroup = LiveGroup;
export type StructureSection = LiveSection;

export type StructureProject = {
  id: string;
  name: string;
  slug: string;
  code?: string | null;
};

export type StructureTerritoire = {
  id: string;
  name: string;
  code: string;
  dossiers: StructureProject[];
};

export function StructureWorkspace({
  territoires,
  initialTerritoireId,
  initialProjectId,
  groups: initialGroups,
  sections: initialSections,
}: {
  territoires: StructureTerritoire[];
  initialTerritoireId: string;
  initialProjectId: string;
  groups: StructureGroup[];
  sections: StructureSection[];
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [groups, setGroups] = useState(initialGroups);
  const [sections, setSections] = useState(initialSections);
  const [structureSource, setStructureSource] = useState({
    groups: initialGroups,
    sections: initialSections,
    projectId: initialProjectId,
  });
  if (
    initialGroups !== structureSource.groups ||
    initialSections !== structureSource.sections ||
    initialProjectId !== structureSource.projectId
  ) {
    setStructureSource({
      groups: initialGroups,
      sections: initialSections,
      projectId: initialProjectId,
    });
    setGroups(initialGroups);
    setSections(initialSections);
  }
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSections[0]?.id ?? null,
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragSectionId, setDragSectionId] = useState<string | null>(null);
  const [dragGroupId, setDragGroupId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Keep selection valid when structure source changes.
  const selectedStillExists = selectedId
    ? sections.some((s) => s.id === selectedId)
    : false;
  if (selectedId && !selectedStillExists) {
    setSelectedId(sections[0]?.id ?? null);
  }
  const selected = sections.find((s) => s.id === selectedId) ?? null;
  const currentTerritoire =
    territoires.find((t) => t.id === initialTerritoireId) ?? territoires[0];
  const dossiers = currentTerritoire?.dossiers ?? [];
  const currentDossier =
    dossiers.find((d) => d.id === initialProjectId) ?? dossiers[0];

  const grouped = useMemo(() => {
    const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
    return sortedGroups.map((group) => ({
      group,
      sections: sections
        .filter((s) => s.groupId === group.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  }, [groups, sections]);

  const ungrouped = useMemo(
    () =>
      sections
        .filter((s) => !s.groupId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [sections],
  );

  function upsertSection(row: StructureSection) {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === row.id);
      if (idx === -1) return [...prev, row];
      const next = [...prev];
      next[idx] = row;
      return next;
    });
    setSelectedId(row.id);
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }

  function upsertGroup(row: StructureGroup) {
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

  function switchTerritoire(territoireId: string) {
    const t = territoires.find((x) => x.id === territoireId);
    const first = t?.dossiers[0];
    if (!first) {
      router.push(`/structure?territoire=${encodeURIComponent(territoireId)}`);
      return;
    }
    router.push(
      `/structure?territoire=${encodeURIComponent(territoireId)}&project=${encodeURIComponent(first.id)}`,
    );
  }

  function switchProject(projectId: string) {
    router.push(
      `/structure?territoire=${encodeURIComponent(initialTerritoireId)}&project=${encodeURIComponent(projectId)}`,
    );
  }

  function persistGroupOrder(nextIds: string[], previous: StructureGroup[]) {
    setGroups((prev) =>
      nextIds
        .map((id, index) => {
          const g = prev.find((x) => x.id === id);
          return g ? { ...g, sortOrder: index } : null;
        })
        .filter(Boolean) as StructureGroup[],
    );
    const fd = new FormData();
    fd.set("projectId", initialProjectId);
    fd.set("orderedIds", nextIds.join(","));
    startTransition(async () => {
      const result = await reorderGroupsAction(initial, fd);
      if (!result.ok) {
        setGroups(previous);
        pushToast(result.error || "Réordonnancement impossible.", "error");
      }
    });
  }

  function onDropSection(targetSectionId: string) {
    if (!dragSectionId || dragSectionId === targetSectionId) return;
    const drag = sections.find((s) => s.id === dragSectionId);
    const target = sections.find((s) => s.id === targetSectionId);
    if (!drag || !target) return;

    const previous = sections;
    const order = sections
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => s.id);
    const from = order.indexOf(dragSectionId);
    const to = order.indexOf(targetSectionId);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, dragSectionId);
    setDragSectionId(null);

    const nextGroupId = target.groupId;
    setSections((prev) =>
      order.map((id, index) => {
        const s = prev.find((x) => x.id === id)!;
        if (id === dragSectionId) {
          return { ...s, groupId: nextGroupId, sortOrder: index };
        }
        return { ...s, sortOrder: index };
      }),
    );

    startTransition(async () => {
      if (drag.groupId !== target.groupId) {
        const fd = new FormData();
        fd.set("sectionId", drag.id);
        fd.set("projectId", initialProjectId);
        fd.set("groupId", target.groupId || "");
        const move = await updateSectionAction(initial, fd);
        if (!move.ok) {
          setSections(previous);
          pushToast(move.error || "Déplacement impossible.", "error");
          return;
        }
        if (move.section) upsertSection(move.section);
      }
      const orderFd = new FormData();
      orderFd.set("projectId", initialProjectId);
      orderFd.set("orderedIds", order.join(","));
      const result = await reorderSectionsAction(initial, orderFd);
      if (!result.ok) {
        setSections(previous);
        pushToast(result.error || "Réordonnancement impossible.", "error");
      }
    });
  }

  function onDropGroup(targetGroupId: string) {
    if (!dragGroupId || dragGroupId === targetGroupId) return;
    const previous = groups;
    const order = groups
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((g) => g.id);
    const from = order.indexOf(dragGroupId);
    const to = order.indexOf(targetGroupId);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, dragGroupId);
    setDragGroupId(null);
    persistGroupOrder(order, previous);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <p className="page-eyebrow">Administration</p>
          <h1 className="page-title">Structure des dossiers</h1>
          <p className="page-lede">
            Organisez les groupes et les rubriques d’un dossier. Glissez pour
            réordonner, cliquez pour modifier le détail.
          </p>
          {currentTerritoire && currentDossier ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {currentTerritoire.name}
              </span>
              <span className="mx-1.5">›</span>
              <span className="font-medium text-foreground">
                {currentDossier.name}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="section-label mb-2">Projet</p>
          <div className="flex flex-wrap gap-2">
            {territoires.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => switchTerritoire(t.id)}
                className={cn(
                  "rounded-sm px-3 py-2 text-xs font-medium tracking-wide transition-colors",
                  t.id === initialTerritoireId
                    ? "bg-foreground text-background"
                    : "border border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="section-label mb-2">Dossier patrimonial</p>
          <div className="flex flex-wrap gap-2 border-b border-border pb-4">
            {dossiers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => switchProject(p.id)}
                className={cn(
                  "rounded-sm px-3 py-2 text-xs font-medium tracking-wide transition-colors",
                  p.id === initialProjectId
                    ? "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-foreground ring-1 ring-accent/40"
                    : "border border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <AddGroupBar projectId={initialProjectId} onCreated={upsertGroup} />
          <AddSectionBar
            projectId={initialProjectId}
            groups={groups}
            onCreated={upsertSection}
          />

          <div className="space-y-5">
            {grouped.map(({ group, sections: groupSections }) => {
              const isCollapsed = collapsed[group.id];
              return (
                <section
                  key={group.id}
                  className={cn(
                    "rounded-md border border-border/80 transition-colors",
                    dragGroupId === group.id && "border-foreground/40",
                  )}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDropGroup(group.id)}
                >
                  <div
                    className="flex items-center gap-2 border-b border-border/60 bg-muted/20 px-3 py-2"
                    draggable
                    onDragStart={() => setDragGroupId(group.id)}
                    onDragEnd={() => setDragGroupId(null)}
                  >
                    <button
                      type="button"
                      aria-expanded={!isCollapsed}
                      onClick={() =>
                        setCollapsed((c) => ({ ...c, [group.id]: !c[group.id] }))
                      }
                      className="text-[11px] text-muted-foreground"
                    >
                      {isCollapsed ? "▸" : "▾"}
                    </button>
                    <h2 className="flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
                      {group.label}
                    </h2>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {groupSections.length}
                    </span>
                    <RenameGroupInline
                      projectId={initialProjectId}
                      group={group}
                      onRenamed={upsertGroup}
                    />
                    {groupSections.length === 0 ? (
                      <DeleteGroupButton
                        groupId={group.id}
                        onDeleted={removeGroup}
                      />
                    ) : null}
                  </div>

                  {!isCollapsed ? (
                    <ul className="divide-y divide-border/50">
                      {groupSections.map((section, index) => (
                        <SectionRow
                          key={section.id}
                          section={section}
                          index={index}
                          selected={selectedId === section.id}
                          onSelect={() => setSelectedId(section.id)}
                          onDragStart={() => setDragSectionId(section.id)}
                          onDragEnd={() => setDragSectionId(null)}
                          onDrop={() => onDropSection(section.id)}
                          dragging={dragSectionId === section.id}
                        />
                      ))}
                      {groupSections.length === 0 ? (
                        <li className="px-4 py-6 text-center text-xs text-muted-foreground">
                          Aucune rubrique — ajoutez-en ci-dessus
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </section>
              );
            })}

            {ungrouped.length ? (
              <section className="rounded-md border border-dashed border-border">
                <div className="border-b border-border/60 px-3 py-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Sans groupe
                  </h2>
                </div>
                <ul className="divide-y divide-border/50">
                  {ungrouped.map((section, index) => (
                    <SectionRow
                      key={section.id}
                      section={section}
                      index={index}
                      selected={selectedId === section.id}
                      onSelect={() => setSelectedId(section.id)}
                      onDragStart={() => setDragSectionId(section.id)}
                      onDragEnd={() => setDragSectionId(null)}
                      onDrop={() => onDropSection(section.id)}
                      dragging={dragSectionId === section.id}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          {selected ? (
            <SectionInspector
              key={selected.id}
              projectId={initialProjectId}
              section={selected}
              groups={groups}
              onUpdated={upsertSection}
              onDeleted={removeSection}
            />
          ) : (
            <div className="border border-border p-4 text-sm text-muted-foreground">
              Sélectionnez une rubrique pour l’éditer.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SectionRow({
  section,
  index,
  selected,
  onSelect,
  onDragStart,
  onDragEnd,
  onDrop,
  dragging,
}: {
  section: StructureSection;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  dragging: boolean;
}) {
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={cn(
        "group flex cursor-grab items-stretch transition-colors active:cursor-grabbing",
        selected && "bg-muted/40",
        dragging && "opacity-50",
        !section.isActive && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className="w-5 text-[10px] tabular-nums text-muted-foreground">
          {index + 1}
        </span>
        <span className="w-12 shrink-0 font-mono text-[11px] text-muted-foreground">
          {section.code}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {section.title}
        </span>
        {!section.isActive ? (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            inactive
          </span>
        ) : null}
        {section.codeLocked ? (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {section.documentCount} doc
          </span>
        ) : null}
      </button>
    </li>
  );
}

function SectionInspector({
  projectId,
  section,
  groups,
  onUpdated,
  onDeleted,
}: {
  projectId: string;
  section: StructureSection;
  groups: StructureGroup[];
  onUpdated: (row: StructureSection) => void;
  onDeleted: (id: string) => void;
}) {
  const { pushToast } = useToast();
  const [state, action, pending] = useActionState(updateSectionAction, initial);
  const [delState, delAction, deleting] = useActionState(deleteSectionAction, initial);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateWasPending = useRef(false);
  const deleteWasPending = useRef(false);

  useEffect(() => {
    const finished = updateWasPending.current && !pending;
    updateWasPending.current = pending;
    if (!finished) return;
    if (state.ok && state.section) {
      onUpdated(state.section);
      pushToast("Rubrique enregistrée.", "success");
    } else if (state.error) {
      pushToast(state.error, "error");
    }
  }, [pending, state, onUpdated, pushToast]);

  useEffect(() => {
    const finished = deleteWasPending.current && !deleting;
    deleteWasPending.current = deleting;
    if (!finished) return;
    if (delState.ok && delState.deletedId) {
      onDeleted(delState.deletedId);
      pushToast("Rubrique supprimée.", "success");
    } else if (delState.error) {
      pushToast(delState.error, "error");
    }
  }, [deleting, delState, onDeleted, pushToast]);

  return (
    <div className="space-y-4 border border-border p-4">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Rubrique
        </p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{section.code}</p>
        {section.codeLocked ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Code verrouillé ({section.documentCount} document(s))
          </p>
        ) : null}
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="sectionId" value={section.id} />
        <input type="hidden" name="projectId" value={projectId} />
        <label className="block text-xs">
          <span className="text-muted-foreground">Titre</span>
          <input
            name="title"
            defaultValue={section.title}
            required
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Description</span>
          <textarea
            name="description"
            defaultValue={section.description || ""}
            rows={3}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Slug</span>
          <input
            name="slug"
            defaultValue={section.slug}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Groupe</span>
          <select
            name="groupId"
            defaultValue={section.groupId || ""}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">—</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Type</span>
          <select
            name="kind"
            defaultValue={section.kind}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="documentary">documentary</option>
            <option value="structured">structured</option>
            <option value="sequences">sequences</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Statut</span>
          <select
            name="isActive"
            defaultValue={section.isActive ? "1" : "0"}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </label>
        {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          Enregistrer
        </button>
      </form>

      {!section.codeLocked ? (
        <>
          <button
            type="button"
            disabled={deleting}
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-destructive underline-offset-2 hover:underline"
          >
            Supprimer (vide uniquement)
          </button>
          {delState.error ? (
            <p className="mt-1 text-xs text-destructive">{delState.error}</p>
          ) : null}
          <form ref={undefined} action={delAction} className="hidden" id={`delete-section-${section.id}`}>
            <input type="hidden" name="sectionId" value={section.id} />
            <input type="hidden" name="projectId" value={projectId} />
          </form>
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title={`Supprimer ${section.code} ?`}
            description="Cette action est définitive. La rubrique doit être vide."
            confirmLabel="Supprimer"
            destructive
            pending={deleting}
            onConfirm={() => {
              setConfirmDelete(false);
              const form = document.getElementById(
                `delete-section-${section.id}`,
              ) as HTMLFormElement | null;
              form?.requestSubmit();
            }}
          />
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Suppression bloquée — désactivez la rubrique si elle ne doit plus
          apparaître.
        </p>
      )}
    </div>
  );
}

function AddGroupBar({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: (row: StructureGroup) => void;
}) {
  const { pushToast } = useToast();
  const [state, action, pending] = useActionState(createGroupAction, initial);
  const wasPending = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished) return;
    if (state.ok && state.group) {
      onCreated(state.group);
      formRef.current?.reset();
      pushToast("Groupe ajouté.", "success");
    } else if (state.error) {
      pushToast(state.error, "error");
    }
  }, [pending, state, onCreated, pushToast]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <label className="block min-w-[200px] flex-1 text-xs">
        <span className="text-muted-foreground">Nouveau groupe</span>
        <input
          name="label"
          required
          placeholder="ex. Comprendre"
          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
      >
        Ajouter
      </button>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

function AddSectionBar({
  projectId,
  groups,
  onCreated,
}: {
  projectId: string;
  groups: StructureGroup[];
  onCreated: (row: StructureSection) => void;
}) {
  const { pushToast } = useToast();
  const [state, action, pending] = useActionState(createSectionAction, initial);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const wasPending = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished) return;
    if (state.ok && state.section) {
      onCreated(state.section);
      formRef.current?.reset();
      pushToast("Rubrique ajoutée.", "success");
    } else if (state.error) {
      pushToast(state.error, "error");
    }
  }, [pending, state, onCreated, pushToast]);

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-3 rounded-md border border-border p-3"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-xs sm:col-span-2 lg:col-span-1">
          <span className="text-muted-foreground">Titre</span>
          <input
            name="title"
            required
            placeholder="ex. Présentation"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Groupe</span>
          <select
            name="groupId"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">—</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            Ajouter rubrique
          </button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Le code (ex. 01.19) et le slug sont générés automatiquement.
      </p>
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:underline"
      >
        {showAdvanced ? "Masquer les paramètres avancés" : "Paramètres avancés"}
      </button>
      {showAdvanced ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="text-muted-foreground">Code (optionnel)</span>
            <input
              name="code"
              placeholder="01.19"
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Slug (optionnel)</span>
            <input
              name="slug"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            />
          </label>
        </div>
      ) : null}
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}

function RenameGroupInline({
  projectId,
  group,
  onRenamed,
}: {
  projectId: string;
  group: StructureGroup;
  onRenamed: (row: StructureGroup) => void;
}) {
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(renameGroupAction, initial);
  const wasPending = useRef(false);

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished) return;
    const timer = window.setTimeout(() => {
      if (state.ok && state.group) {
        onRenamed(state.group);
        setOpen(false);
        pushToast("Groupe renommé.", "success");
      } else if (state.error) {
        pushToast(state.error, "error");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pending, state, onRenamed, pushToast]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
      >
        Renommer
      </button>
    );
  }
  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="groupId" value={group.id} />
      <input
        name="label"
        defaultValue={group.label}
        className="h-7 w-36 rounded border border-border bg-background px-1.5 text-xs"
      />
      <button type="submit" disabled={pending} className="text-[10px] underline">
        OK
      </button>
      {state.error ? <span className="text-[10px] text-destructive">{state.error}</span> : null}
    </form>
  );
}

function DeleteGroupButton({
  groupId,
  onDeleted,
}: {
  groupId: string;
  onDeleted: (id: string) => void;
}) {
  const { pushToast } = useToast();
  const [state, action, pending] = useActionState(deleteGroupAction, initial);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const wasPending = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished) return;
    const timer = window.setTimeout(() => {
      if (state.ok && state.deletedId) {
        onDeleted(state.deletedId);
        pushToast("Groupe retiré.", "success");
      } else if (state.error) {
        pushToast(state.error, "error");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pending, state, onDeleted, pushToast]);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirmDelete(true)}
        className="text-[10px] text-destructive underline-offset-2 hover:underline"
      >
        Retirer
      </button>
      <form ref={formRef} action={action} className="hidden">
        <input type="hidden" name="groupId" value={groupId} />
      </form>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Supprimer ce groupe vide ?"
        description="Cette action retire le groupe de la structure."
        confirmLabel="Supprimer"
        destructive
        pending={pending}
        onConfirm={() => {
          setConfirmDelete(false);
          formRef.current?.requestSubmit();
        }}
      />
      {state.error ? <span className="text-[10px] text-destructive">{state.error}</span> : null}
    </>
  );
}
