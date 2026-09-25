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
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createGroupAction,
  createPartAction,
  createSectionAction,
  deletePartAction,
  loadStructureWorkspaceAction,
  moveSectionAction,
  renameGroupAction,
  renamePartAction,
  reorderGroupsAction,
  reorderSectionsAction,
  updateSectionAction,
  type LiveGroup,
  type LivePart,
  type LiveSection,
  type ProjectActionState,
} from "@/app/(private)/manage/actions";
import { EmptyState } from "@/components/layout/page-header";
import { useToast } from "@/components/ui/toast";
import { SectionRemoveControl } from "@/components/manage/section-remove-control";
import { GroupRemoveControl } from "@/components/manage/group-remove-control";

const initial: ProjectActionState = {};

export type StructurePart = LivePart;
export type StructureGroup = LiveGroup;
export type StructureSection = LiveSection;

export type StructureProject = {
  id: string;
  name: string;
  slug: string;
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
  parts: initialParts,
  groups: initialGroups,
  sections: initialSections,
}: {
  territoires: StructureTerritoire[];
  initialTerritoireId: string;
  initialProjectId: string;
  parts: StructurePart[];
  groups: StructureGroup[];
  sections: StructureSection[];
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [activeTerritoireId, setActiveTerritoireId] = useState(initialTerritoireId);
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId);
  const [parts, setParts] = useState(initialParts);
  const [groups, setGroups] = useState(initialGroups);
  const [sections, setSections] = useState(initialSections);
  const [structureSource, setStructureSource] = useState({
    parts: initialParts,
    groups: initialGroups,
    sections: initialSections,
    projectId: initialProjectId,
    territoireId: initialTerritoireId,
  });
  const [switching, setSwitching] = useState(false);

  if (
    initialParts !== structureSource.parts ||
    initialGroups !== structureSource.groups ||
    initialSections !== structureSource.sections ||
    initialProjectId !== structureSource.projectId ||
    initialTerritoireId !== structureSource.territoireId
  ) {
    setStructureSource({
      parts: initialParts,
      groups: initialGroups,
      sections: initialSections,
      projectId: initialProjectId,
      territoireId: initialTerritoireId,
    });
    setParts(initialParts);
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
  if (selectedId && !sections.some((s) => s.id === selectedId)) {
    setSelectedId(sections[0]?.id ?? null);
  }
  const selected = sections.find((s) => s.id === selectedId) ?? null;
  const currentTerritoire =
    territoires.find((t) => t.id === activeTerritoireId) ?? territoires[0];
  const dossiers = currentTerritoire?.dossiers ?? [];
  const currentDossier =
    dossiers.find((d) => d.id === activeProjectId) ?? dossiers[0];

  /** Groups laid out per Part, project-level groups first. */
  const layout = useMemo(() => {
    const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
    const withSections = (partId: string | null) =>
      sortedGroups
        .filter((g) => g.partId === partId)
        .map((group) => ({
          group,
          sections: sections
            .filter((s) => s.groupId === group.id)
            .sort((a, b) => a.sortOrder - b.sortOrder),
        }));

    return [
      { part: null as StructurePart | null, groups: withSections(null) },
      ...[...parts]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((part) => ({ part, groups: withSections(part.id) })),
    ];
  }, [parts, groups, sections]);

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

  function upsertPart(row: StructurePart) {
    setParts((prev) => {
      const idx = prev.findIndex((p) => p.id === row.id);
      if (idx === -1) return [...prev, row];
      const next = [...prev];
      next[idx] = row;
      return next;
    });
  }

  function syncUrl(territoireId: string, projectId: string) {
    const qs = new URLSearchParams({
      territoire: territoireId,
      project: projectId,
    });
    router.replace(`/structure?${qs.toString()}`, { scroll: false });
  }

  function switchTerritoire(territoireId: string) {
    if (territoireId === activeTerritoireId) return;
    const t = territoires.find((x) => x.id === territoireId);
    const first = t?.dossiers[0];
    if (!first) {
      setActiveTerritoireId(territoireId);
      setActiveProjectId("");
      setParts([]);
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
      setActiveTerritoireId(territoireId);
      setActiveProjectId(projectId);
      setParts(result.parts ?? []);
      setGroups(result.groups);
      setSections(result.sections);
      setSelectedId(result.sections[0]?.id ?? null);
      setCollapsed({});
      syncUrl(territoireId, projectId);
    });
  }

  function onDropSection(targetSectionId: string) {
    if (!dragSectionId || dragSectionId === targetSectionId) return;
    const drag = sections.find((s) => s.id === dragSectionId);
    const target = sections.find((s) => s.id === targetSectionId);
    if (!drag || !target) return;

    const previous = sections;
    const targetGroupId = target.groupId;
    const order = sections
      .filter((s) => s.groupId === targetGroupId || s.id === dragSectionId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => s.id);
    const from = order.indexOf(dragSectionId);
    const to = order.indexOf(targetSectionId);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, dragSectionId);
    setDragSectionId(null);

    setSections((prev) =>
      prev.map((s) => {
        const index = order.indexOf(s.id);
        if (index === -1) return s;
        return { ...s, groupId: targetGroupId, sortOrder: index };
      }),
    );

    startTransition(async () => {
      if (drag.groupId !== targetGroupId) {
        const fd = new FormData();
        fd.set("sectionId", drag.id);
        fd.set("groupId", targetGroupId);
        const move = await moveSectionAction(initial, fd);
        if (!move.ok) {
          setSections(previous);
          pushToast(move.error || "Déplacement impossible.", "error");
          return;
        }
      }
      const orderFd = new FormData();
      orderFd.set("groupId", targetGroupId);
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

    setGroups((prev) =>
      order
        .map((id, index) => {
          const g = prev.find((x) => x.id === id);
          return g ? { ...g, sortOrder: index } : null;
        })
        .filter(Boolean) as StructureGroup[],
    );

    const fd = new FormData();
    fd.set("projectId", activeProjectId);
    fd.set("orderedIds", order.join(","));
    startTransition(async () => {
      const result = await reorderGroupsAction(initial, fd);
      if (!result.ok) {
        setGroups(previous);
        pushToast(result.error || "Réordonnancement impossible.", "error");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="max-w-2xl space-y-2">
        <p className="page-eyebrow">Administration</p>
        <h1 className="page-title">Structure des dossiers</h1>
        <p className="page-lede">
          Organisez la table des matières : parties, groupes et rubriques.
          Glissez pour réordonner, cliquez une rubrique pour la modifier à
          droite.
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
                Les parties sont optionnelles : un groupe sans partie s’affiche
                directement à la racine du dossier.
              </p>
            </div>

            <PartsBar
              projectId={activeProjectId}
              parts={parts}
              onCreated={upsertPart}
              onRenamed={upsertPart}
              onDeleted={(id) =>
                setParts((prev) => prev.filter((p) => p.id !== id))
              }
            />
            <AddGroupBar
              projectId={activeProjectId}
              parts={parts}
              onCreated={upsertGroup}
            />
            <AddSectionBar groups={groups} parts={parts} onCreated={upsertSection} />

            <div className="space-y-6">
              {groups.length === 0 && sections.length === 0 ? (
                <EmptyState
                  title="Structure vide"
                  description="Commencez par un groupe (ex. « Comprendre »), puis ajoutez votre première rubrique."
                />
              ) : null}

              {layout.map(({ part, groups: partGroups }) => {
                if (!part && partGroups.length === 0) return null;
                return (
                  <div key={part?.id ?? "__root"} className="space-y-3">
                    {part ? (
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Partie · {part.name}
                      </p>
                    ) : null}
                    {partGroups.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                        Aucun groupe dans cette partie.
                      </p>
                    ) : null}
                    {partGroups.map(({ group, sections: groupSections }) => {
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
                                setCollapsed((c) => ({
                                  ...c,
                                  [group.id]: !c[group.id],
                                }))
                              }
                              className="text-[11px] text-muted-foreground"
                            >
                              {isCollapsed ? "▸" : "▾"}
                            </button>
                            <h2 className="flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
                              {group.name}
                            </h2>
                            <span className="text-[10px] tabular-nums text-muted-foreground">
                              {groupSections.length}
                            </span>
                            <RenameGroupInline
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
                                    Ajoutez une rubrique avec le formulaire
                                    ci-dessus.
                                  </p>
                                </li>
                              ) : null}
                            </ul>
                          ) : null}
                        </section>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="lg:sticky lg:top-20 lg:self-start">
            {selected ? (
              <SectionInspector
                key={selected.id}
                projectId={activeProjectId}
                section={selected}
                groups={groups}
                parts={parts}
                onUpdated={upsertSection}
                onDeleted={removeSection}
              />
            ) : (
              <div className="border border-dashed border-border bg-surface/50 p-5">
                <p className="text-sm font-medium text-foreground">
                  Aucune rubrique sélectionnée
                </p>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  Cliquez une rubrique dans la liste pour modifier son nom, son
                  code ou son groupe.
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Structure à gérer
      </p>

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
                      <span
                        className={cn(
                          "block truncate text-sm tracking-tight",
                          active
                            ? "font-semibold text-foreground"
                            : "font-medium text-foreground/90",
                        )}
                      >
                        {dossier.name}
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
          {section.code ?? "—"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {section.name}
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
  parts,
  onUpdated,
  onDeleted,
}: {
  projectId: string;
  section: StructureSection;
  groups: StructureGroup[];
  parts: StructurePart[];
  onUpdated: (row: StructureSection) => void;
  onDeleted: (id: string) => void;
}) {
  const { pushToast } = useToast();
  const [state, action, pending] = useActionState(updateSectionAction, initial);
  const [moveState, moveAction, moving] = useActionState(moveSectionAction, initial);
  const updateWasPending = useRef(false);
  const moveWasPending = useRef(false);

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
    const finished = moveWasPending.current && !moving;
    moveWasPending.current = moving;
    if (!finished) return;
    if (moveState.ok && moveState.section) {
      onUpdated(moveState.section);
      pushToast("Rubrique déplacée.", "success");
    } else if (moveState.error) {
      pushToast(moveState.error, "error");
    }
  }, [moving, moveState, onUpdated, pushToast]);

  return (
    <div className="space-y-5 border border-border bg-surface p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Détail de la rubrique
        </p>
        <p className="mt-2 font-mono text-sm text-foreground">
          {section.code ?? "Sans code"}
        </p>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="sectionId" value={section.id} />
        <label className="block text-xs">
          <span className="text-muted-foreground">Nom</span>
          <input
            name="name"
            defaultValue={section.name}
            required
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Code (optionnel)</span>
          <input
            name="code"
            defaultValue={section.code ?? ""}
            placeholder="01.19"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        {state.error ? (
          <p className="text-xs text-destructive">{state.error}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          Enregistrer
        </button>
      </form>

      <form action={moveAction} className="space-y-2 border-t border-border pt-4">
        <input type="hidden" name="sectionId" value={section.id} />
        <label className="block text-xs">
          <span className="text-muted-foreground">Groupe parent</span>
          <select
            name="groupId"
            defaultValue={section.groupId}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {groupOptionLabel(g, parts)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={moving}
          className="h-9 w-full rounded-md border border-border text-sm hover:bg-muted disabled:opacity-60"
        >
          Déplacer
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

function groupOptionLabel(group: StructureGroup, parts: StructurePart[]) {
  const part = group.partId ? parts.find((p) => p.id === group.partId) : null;
  return part ? `${part.name} › ${group.name}` : group.name;
}

function PartsBar({
  projectId,
  parts,
  onCreated,
  onRenamed,
  onDeleted,
}: {
  projectId: string;
  parts: StructurePart[];
  onCreated: (row: StructurePart) => void;
  onRenamed: (row: StructurePart) => void;
  onDeleted: (id: string) => void;
}) {
  const { pushToast } = useToast();
  const [state, action, pending] = useActionState(createPartAction, initial);
  const wasPending = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished) return;
    if (state.ok && state.part) {
      onCreated(state.part);
      formRef.current?.reset();
      pushToast("Partie ajoutée.", "success");
    } else if (state.error) {
      pushToast(state.error, "error");
    }
  }, [pending, state, onCreated, pushToast]);

  return (
    <div className="space-y-2 rounded-md border border-border bg-surface/50 p-3">
      <form
        ref={formRef}
        action={action}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <label className="block min-w-[200px] flex-1 text-xs">
          <span className="text-muted-foreground">Nouvelle partie</span>
          <input
            name="name"
            required
            placeholder="ex. Murailles Nord"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
          <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
            Subdivision optionnelle du dossier, avec sa propre page.
          </span>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
        >
          Ajouter
        </button>
        {state.error ? (
          <p className="w-full text-xs text-destructive">{state.error}</p>
        ) : null}
      </form>

      {parts.length ? (
        <ul className="divide-y divide-border/50 border-t border-border/50">
          {parts.map((part) => (
            <li key={part.id} className="flex items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm">{part.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {part.slug}
              </span>
              <RenamePartInline part={part} onRenamed={onRenamed} />
              <DeletePartControl part={part} onDeleted={onDeleted} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function RenamePartInline({
  part,
  onRenamed,
}: {
  part: StructurePart;
  onRenamed: (row: StructurePart) => void;
}) {
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(renamePartAction, initial);
  const wasPending = useRef(false);

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished) return;
    const timer = window.setTimeout(() => {
      if (state.ok && state.part) {
        onRenamed(state.part);
        setOpen(false);
        pushToast("Partie renommée.", "success");
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
      <input type="hidden" name="partId" value={part.id} />
      <input
        name="name"
        defaultValue={part.name}
        className="h-7 w-36 rounded border border-border bg-background px-1.5 text-xs"
      />
      <button type="submit" disabled={pending} className="text-[10px] underline">
        OK
      </button>
    </form>
  );
}

function DeletePartControl({
  part,
  onDeleted,
}: {
  part: StructurePart;
  onDeleted: (id: string) => void;
}) {
  const { pushToast } = useToast();
  const [state, action, pending] = useActionState(deletePartAction, initial);
  const wasPending = useRef(false);

  useEffect(() => {
    const finished = wasPending.current && !pending;
    wasPending.current = pending;
    if (!finished) return;
    if (state.ok && state.deletedId) {
      onDeleted(state.deletedId);
      pushToast("Partie supprimée.", "success");
    } else if (state.error) {
      pushToast(state.error, "error");
    }
  }, [pending, state, onDeleted, pushToast]);

  return (
    <form action={action}>
      <input type="hidden" name="partId" value={part.id} />
      <button
        type="submit"
        disabled={pending || part.groupCount > 0}
        title={
          part.groupCount > 0
            ? "Cette partie contient des groupes"
            : "Supprimer la partie"
        }
        className="text-[10px] text-muted-foreground underline-offset-2 hover:underline disabled:opacity-40"
      >
        Supprimer
      </button>
    </form>
  );
}

function AddGroupBar({
  projectId,
  parts,
  onCreated,
}: {
  projectId: string;
  parts: StructurePart[];
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
    <form
      ref={formRef}
      action={action}
      className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface/50 p-3"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <label className="block min-w-[200px] flex-1 text-xs">
        <span className="text-muted-foreground">Nouveau groupe</span>
        <input
          name="name"
          required
          placeholder="ex. Comprendre, Agir, Suivre…"
          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
      </label>
      {parts.length ? (
        <label className="block min-w-[160px] text-xs">
          <span className="text-muted-foreground">Partie</span>
          <select
            name="partId"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Racine du dossier</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
      >
        Ajouter
      </button>
      {state.error ? (
        <p className="w-full text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}

function AddSectionBar({
  groups,
  parts,
  onCreated,
}: {
  groups: StructureGroup[];
  parts: StructurePart[];
  onCreated: (row: StructureSection) => void;
}) {
  const { pushToast } = useToast();
  const [state, action, pending] = useActionState(createSectionAction, initial);
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

  if (groups.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
        Créez un groupe avant d’ajouter une rubrique.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-3 rounded-md border border-border bg-surface/50 p-4"
    >
      <p className="text-xs font-medium text-foreground">Nouvelle rubrique</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs sm:col-span-2 lg:col-span-1">
          <span className="text-muted-foreground">Nom</span>
          <input
            name="name"
            required
            placeholder="ex. Présentation, Historique…"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Groupe</span>
          <select
            name="groupId"
            required
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {groupOptionLabel(g, parts)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Code (optionnel)</span>
          <input
            name="code"
            placeholder="01.19"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
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
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}

function RenameGroupInline({
  group,
  onRenamed,
}: {
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
      <input type="hidden" name="groupId" value={group.id} />
      <input
        name="name"
        defaultValue={group.name}
        className="h-7 w-36 rounded border border-border bg-background px-1.5 text-xs"
      />
      <button type="submit" disabled={pending} className="text-[10px] underline">
        OK
      </button>
      {state.error ? (
        <span className="text-[10px] text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
