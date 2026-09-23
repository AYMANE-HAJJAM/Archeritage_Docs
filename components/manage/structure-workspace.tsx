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
  loadStructureWorkspaceAction,
  renameGroupAction,
  reorderGroupsAction,
  reorderSectionsAction,
  updateSectionAction,
  type LiveGroup,
  type LiveSection,
  type ProjectActionState,
} from "@/app/(private)/manage/actions";
import { EmptyState } from "@/components/layout/page-header";
import { useToast } from "@/components/ui/toast";
import { SectionRemoveControl } from "@/components/manage/section-remove-control";
import { GroupRemoveControl } from "@/components/manage/group-remove-control";
import { Check } from "lucide-react";

const initial: ProjectActionState = {};

export type StructureGroup = LiveGroup;
export type StructureSection = LiveSection;

export type StructureProject = {
  id: string;
  name: string;
  slug: string;
  code?: string | null;
  description?: string | null;
  sectionCount: number;
  fileCount: number;
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
  const [activeTerritoireId, setActiveTerritoireId] = useState(initialTerritoireId);
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId);
  const [groups, setGroups] = useState(initialGroups);
  const [sections, setSections] = useState(initialSections);
  const [structureSource, setStructureSource] = useState({
    groups: initialGroups,
    sections: initialSections,
    projectId: initialProjectId,
    territoireId: initialTerritoireId,
  });
  const [switching, setSwitching] = useState(false);

  if (
    initialGroups !== structureSource.groups ||
    initialSections !== structureSource.sections ||
    initialProjectId !== structureSource.projectId ||
    initialTerritoireId !== structureSource.territoireId
  ) {
    setStructureSource({
      groups: initialGroups,
      sections: initialSections,
      projectId: initialProjectId,
      territoireId: initialTerritoireId,
    });
    setGroups(initialGroups);
    setSections(initialSections);
    setActiveProjectId(initialProjectId);
    setActiveTerritoireId(initialTerritoireId);
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
    territoires.find((t) => t.id === activeTerritoireId) ?? territoires[0];
  const dossiers = currentTerritoire?.dossiers ?? [];
  const currentDossier =
    dossiers.find((d) => d.id === activeProjectId) ?? dossiers[0];

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

  function syncUrl(territoireId: string, projectId: string) {
    const qs = new URLSearchParams({
      territoire: territoireId,
      project: projectId,
    });
    router.replace(`/structure?${qs.toString()}`, { scroll: false });
  }

  function applyLoadedStructure(
    territoireId: string,
    projectId: string,
    nextGroups: StructureGroup[],
    nextSections: StructureSection[],
  ) {
    setActiveTerritoireId(territoireId);
    setActiveProjectId(projectId);
    setGroups(nextGroups);
    setSections(nextSections);
    setSelectedId(nextSections[0]?.id ?? null);
    setCollapsed({});
    syncUrl(territoireId, projectId);
  }

  function switchTerritoire(territoireId: string) {
    if (territoireId === activeTerritoireId) return;
    const t = territoires.find((x) => x.id === territoireId);
    const first = t?.dossiers[0];
    if (!first) {
      setActiveTerritoireId(territoireId);
      setActiveProjectId("");
      setGroups([]);
      setSections([]);
      setSelectedId(null);
      router.replace(
        `/structure?territoire=${encodeURIComponent(territoireId)}`,
        { scroll: false },
      );
      return;
    }
    void switchProject(first.id, territoireId);
  }

  async function switchProject(
    projectId: string,
    territoireId: string = activeTerritoireId,
  ) {
    if (projectId === activeProjectId && territoireId === activeTerritoireId) {
      return;
    }
    setSwitching(true);
    startTransition(async () => {
      const result = await loadStructureWorkspaceAction(projectId);
      setSwitching(false);
      if (!result.ok || !result.groups || !result.sections) {
        pushToast(result.error || "Impossible de charger la structure.", "error");
        return;
      }
      applyLoadedStructure(
        territoireId,
        projectId,
        result.groups,
        result.sections,
      );
    });
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
    fd.set("projectId", activeProjectId);
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
        fd.set("projectId", activeProjectId);
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
      orderFd.set("projectId", activeProjectId);
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
      <div className="max-w-2xl space-y-2">
        <p className="page-eyebrow">Administration</p>
        <h1 className="page-title">Structure des dossiers</h1>
        <p className="page-lede">
          Organisez la table des matières : groupes, rubriques et ordre
          d’affichage. Glissez pour réordonner, cliquez une rubrique pour la
          modifier à droite.
        </p>
      </div>

      <StructureContextSelector
        territoires={territoires}
        activeTerritoireId={activeTerritoireId}
        activeProjectId={activeProjectId}
        switching={switching}
        onSelectTerritoire={switchTerritoire}
        onSelectDossier={(id) => void switchProject(id)}
      />

      {dossiers.length === 0 ? (
        <EmptyState
          title="Aucun dossier à organiser"
          description="Créez d’abord un dossier patrimonial dans la fiche projet, puis revenez ici pour structurer ses rubriques."
        />
      ) : (
      <div
        className={cn(
          "grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]",
          switching && "pointer-events-none opacity-60",
        )}
      >
        <div className="space-y-5">
          <div className="space-y-1">
            <p className="section-label">
              Structure
              {currentDossier ? ` · ${currentDossier.name}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Ajoutez des groupes puis des rubriques. Glissez les lignes pour
              changer l’ordre.
            </p>
          </div>
          <AddGroupBar projectId={activeProjectId} onCreated={upsertGroup} />
          <AddSectionBar
            projectId={activeProjectId}
            groups={groups}
            onCreated={upsertSection}
          />

          <div className="space-y-5">
            {groups.length === 0 && sections.length === 0 ? (
              <EmptyState
                title="Structure vide"
                description="Commencez par un groupe (ex. « Comprendre »), puis ajoutez votre première rubrique."
              />
            ) : null}
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
                      projectId={activeProjectId}
                      group={group}
                      onRenamed={upsertGroup}
                    />
                    <GroupRemoveControl
                      groupId={group.id}
                      sectionCount={groupSections.length}
                      onDeleted={removeGroup}
                    />
                  </div>

                  {!isCollapsed ? (
                    <ul className="divide-y divide-border/50">
                      {groupSections.map((section, index) => (
                        <SectionRow
                          key={section.id}
                          projectId={activeProjectId}
                          section={section}
                          index={index}
                          selected={selectedId === section.id}
                          onSelect={() => setSelectedId(section.id)}
                          onDragStart={() => setDragSectionId(section.id)}
                          onDragEnd={() => setDragSectionId(null)}
                          onDrop={() => onDropSection(section.id)}
                          dragging={dragSectionId === section.id}
                          onDeleted={removeSection}
                          onDeactivated={upsertSection}
                        />
                      ))}
                      {groupSections.length === 0 ? (
                        <li className="px-4 py-8 text-center">
                          <p className="text-xs font-medium text-foreground">
                            Groupe vide
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Ajoutez une rubrique avec le formulaire ci-dessus.
                          </p>
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
                      projectId={activeProjectId}
                      section={section}
                      index={index}
                      selected={selectedId === section.id}
                      onSelect={() => setSelectedId(section.id)}
                      onDragStart={() => setDragSectionId(section.id)}
                      onDragEnd={() => setDragSectionId(null)}
                      onDrop={() => onDropSection(section.id)}
                      dragging={dragSectionId === section.id}
                      onDeleted={removeSection}
                      onDeactivated={upsertSection}
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
              projectId={activeProjectId}
              section={selected}
              groups={groups}
              onUpdated={upsertSection}
              onDeleted={removeSection}
            />
          ) : (
            <div className="border border-dashed border-border bg-surface/50 p-5">
              <p className="text-sm font-medium text-foreground">
                Aucune rubrique sélectionnée
              </p>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                Cliquez une rubrique dans la liste pour modifier son titre,
                description ou statut.
              </p>
            </div>
          )}
        </aside>
      </div>
      )}
    </div>
  );
}

function StructureContextSelector({
  territoires,
  activeTerritoireId,
  activeProjectId,
  switching,
  onSelectTerritoire,
  onSelectDossier,
}: {
  territoires: StructureTerritoire[];
  activeTerritoireId: string;
  activeProjectId: string;
  switching: boolean;
  onSelectTerritoire: (id: string) => void;
  onSelectDossier: (id: string) => void;
}) {
  const current =
    territoires.find((t) => t.id === activeTerritoireId) ?? territoires[0];
  const dossiers = current?.dossiers ?? [];

  return (
    <section className="space-y-5 rounded-md border border-border bg-surface p-4 sm:p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Structure à gérer
        </p>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={territoires.length > 1 ? "structure-project-select" : undefined}
          className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
        >
          Projet
        </label>
        {territoires.length > 1 ? (
          <select
            id="structure-project-select"
            value={activeTerritoireId}
            disabled={switching}
            onChange={(e) => onSelectTerritoire(e.target.value)}
            className="h-10 w-full max-w-md rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {territoires.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex h-10 max-w-md items-center rounded-md border border-border/70 bg-muted/25 px-3">
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
              {current?.name ?? "—"}
            </span>
            {current?.code ? (
              <span className="ml-2 shrink-0 font-mono text-[11px] text-muted-foreground">
                {current.code}
              </span>
            ) : null}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Dossier patrimonial
        </p>
        {dossiers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun dossier sur ce projet.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {dossiers.map((dossier) => {
              const active = dossier.id === activeProjectId;
              const meta = [
                dossier.sectionCount === 1
                  ? "1 rubrique"
                  : `${dossier.sectionCount} rubriques`,
                dossier.fileCount === 1
                  ? "1 document"
                  : `${dossier.fileCount} documents`,
              ].join(" · ");
              return (
                <li key={dossier.id}>
                  <button
                    type="button"
                    disabled={switching}
                    aria-pressed={active}
                    onClick={() => onSelectDossier(dossier.id)}
                    className={cn(
                      "group flex w-full items-start gap-3 rounded-md border px-3.5 py-3 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:opacity-60",
                      active
                        ? "border-accent bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))] shadow-[inset_3px_0_0_0_var(--accent)]"
                        : "border-border bg-background hover:border-border hover:bg-muted/40",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                        active
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border bg-surface text-transparent",
                      )}
                      aria-hidden
                    >
                      <Check className="size-3" strokeWidth={2.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm tracking-tight",
                            active
                              ? "font-semibold text-foreground"
                              : "font-medium text-foreground/90",
                          )}
                        >
                          {dossier.name}
                        </span>
                        {dossier.code ? (
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                            {dossier.code}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-[11px] tabular-nums text-muted-foreground">
                        {meta}
                      </span>
                      {dossier.description ? (
                        <span className="mt-1 line-clamp-1 block text-[11px] leading-4 text-muted-foreground/90">
                          {dossier.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function SectionRow({
  projectId,
  section,
  index,
  selected,
  onSelect,
  onDragStart,
  onDragEnd,
  onDrop,
  dragging,
  onDeleted,
  onDeactivated,
}: {
  projectId: string;
  section: StructureSection;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  dragging: boolean;
  onDeleted: (id: string) => void;
  onDeactivated: (row: StructureSection) => void;
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
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Inactive
          </span>
        ) : null}
        {section.documentCount > 0 ? (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {section.documentCount === 1
              ? "1 document"
              : `${section.documentCount} documents`}
          </span>
        ) : null}
      </button>
      <div className="flex items-center pr-1.5">
        <SectionRemoveControl
          projectId={projectId}
          section={section}
          onDeleted={onDeleted}
          onDeactivated={onDeactivated}
        />
      </div>
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
  const updateWasPending = useRef(false);

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

  return (
    <div className="space-y-5 border border-border bg-surface p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Détail de la rubrique
        </p>
        <p className="mt-2 font-mono text-sm text-foreground">{section.code}</p>
        {section.codeLocked ? (
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Code verrouillé — {section.documentCount} document
            {section.documentCount > 1 ? "s" : ""} rattaché
            {section.documentCount > 1 ? "s" : ""}.
          </p>
        ) : (
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Modifiez le contenu affiché dans la table des matières.
          </p>
        )}
      </div>

      <form action={action} className="space-y-4">
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
            placeholder="Texte d’introduction affiché sous le titre"
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Adresse web (slug)</span>
          <input
            name="slug"
            defaultValue={section.slug}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
          <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
            Identifiant utilisé dans l’URL de la rubrique.
          </span>
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Groupe parent</span>
          <select
            name="groupId"
            defaultValue={section.groupId || ""}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Sans groupe</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Type de contenu</span>
          <select
            name="kind"
            defaultValue={section.kind}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="documentary">Documentaire</option>
            <option value="structured">Structuré</option>
            <option value="sequences">Séquences</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Visibilité</span>
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

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-[11px] font-medium text-muted-foreground">
          Zone de danger
        </p>
        <SectionRemoveControl
          projectId={projectId}
          section={section}
          onDeleted={onDeleted}
          onDeactivated={onUpdated}
          className="size-9 border border-border"
        />
      </div>
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
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface/50 p-3">
      <input type="hidden" name="projectId" value={projectId} />
      <label className="block min-w-[200px] flex-1 text-xs">
        <span className="text-muted-foreground">Nouveau groupe</span>
        <input
          name="label"
          required
          placeholder="ex. Comprendre, Agir, Suivre…"
          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
        <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
          Chapitre regroupant plusieurs rubriques.
        </span>
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
      className="space-y-3 rounded-md border border-border bg-surface/50 p-4"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <p className="text-xs font-medium text-foreground">Nouvelle rubrique</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-xs sm:col-span-2 lg:col-span-1">
          <span className="text-muted-foreground">Titre</span>
          <input
            name="title"
            required
            placeholder="ex. Présentation, Historique…"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Groupe</span>
          <select
            name="groupId"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Sans groupe</option>
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
      <p className="text-xs leading-5 text-muted-foreground">
        Le code (ex. 01.19) et l’adresse web sont générés automatiquement à
        partir du titre.
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
