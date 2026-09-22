"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createGroupAction,
  createSectionAction,
  deleteSectionAction,
  renameGroupAction,
  reorderGroupsAction,
  reorderSectionsAction,
  updateSectionAction,
  type ProjectActionState,
} from "../../actions";

const initial: ProjectActionState = {};

type Group = { id: string; label: string; sortOrder: number };
type Section = {
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

export function StructureEditor({
  projectId,
  groups,
  sections,
}: {
  projectId: string;
  groups: Group[];
  sections: Section[];
}) {
  const orderedSectionIds = useMemo(
    () => [...sections].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.id),
    [sections],
  );
  const orderedGroupIds = useMemo(
    () => [...groups].sort((a, b) => a.sortOrder - b.sortOrder).map((g) => g.id),
    [groups],
  );

  const [sectionOrder, setSectionOrder] = useState(orderedSectionIds.join(","));
  const [groupOrder, setGroupOrder] = useState(orderedGroupIds.join(","));

  const [createState, createAction, creating] = useActionState(createSectionAction, initial);
  const [groupState, groupAction, grouping] = useActionState(createGroupAction, initial);
  const [reorderSecState, reorderSecAction, reorderingSec] = useActionState(
    reorderSectionsAction,
    initial,
  );
  const [reorderGrpState, reorderGrpAction, reorderingGrp] = useActionState(
    reorderGroupsAction,
    initial,
  );

  return (
    <div className="space-y-8">
      <form action={groupAction} className="flex flex-wrap items-end gap-2 border border-border p-3">
        <input type="hidden" name="projectId" value={projectId} />
        <label className="block text-xs">
          <span className="text-muted-foreground">Nouveau groupe</span>
          <input
            name="label"
            required
            className="mt-1 h-9 w-56 rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={grouping}
          className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
        >
          Ajouter
        </button>
        {groupState.error ? (
          <p className="w-full text-xs text-destructive">{groupState.error}</p>
        ) : null}
      </form>

      <form action={createAction} className="space-y-3 border border-border p-4">
        <h3 className="text-sm font-medium">Ajouter une rubrique</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs">
            <span className="text-muted-foreground">Code</span>
            <input
              name="code"
              required
              placeholder="01.19"
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Slug</span>
            <input
              name="slug"
              required
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            />
          </label>
          <label className="block text-xs sm:col-span-2">
            <span className="text-muted-foreground">Titre</span>
            <input
              name="title"
              required
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
          <label className="block text-xs">
            <span className="text-muted-foreground">Type</span>
            <select
              name="kind"
              defaultValue="documentary"
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="documentary">documentary</option>
              <option value="structured">structured</option>
              <option value="sequences">sequences</option>
            </select>
          </label>
        </div>
        <input type="hidden" name="projectId" value={projectId} />
        {createState.error ? (
          <p className="text-sm text-destructive">{createState.error}</p>
        ) : null}
        <button
          type="submit"
          disabled={creating}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          Créer la rubrique
        </button>
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Groupes</h3>
        <ul className="divide-y divide-border border-y border-border">
          {groups
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((group) => (
              <GroupRow key={group.id} projectId={projectId} group={group} />
            ))}
        </ul>
        <form action={reorderGrpAction} className="flex flex-wrap items-end gap-2 pt-2">
          <input type="hidden" name="projectId" value={projectId} />
          <label className="block flex-1 text-xs">
            <span className="text-muted-foreground">
              Ordre des groupes (IDs séparés par des virgules)
            </span>
            <input
              name="orderedIds"
              value={groupOrder}
              onChange={(e) => setGroupOrder(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-xs"
            />
          </label>
          <button
            type="submit"
            disabled={reorderingGrp}
            className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            Appliquer l’ordre
          </button>
          {reorderGrpState.error ? (
            <p className="w-full text-xs text-destructive">{reorderGrpState.error}</p>
          ) : null}
        </form>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Rubriques</h3>
        <ul className="divide-y divide-border border-y border-border">
          {sections
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((section) => (
              <SectionRow
                key={section.id}
                projectId={projectId}
                section={section}
                groups={groups}
              />
            ))}
        </ul>
        <form action={reorderSecAction} className="flex flex-wrap items-end gap-2 pt-2">
          <input type="hidden" name="projectId" value={projectId} />
          <label className="block flex-1 text-xs">
            <span className="text-muted-foreground">
              Ordre des rubriques (IDs séparés par des virgules)
            </span>
            <input
              name="orderedIds"
              value={sectionOrder}
              onChange={(e) => setSectionOrder(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-xs"
            />
          </label>
          <button
            type="submit"
            disabled={reorderingSec}
            className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            Appliquer l’ordre
          </button>
          {reorderSecState.error ? (
            <p className="w-full text-xs text-destructive">{reorderSecState.error}</p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

function GroupRow({ projectId, group }: { projectId: string; group: Group }) {
  const [state, action, pending] = useActionState(renameGroupAction, initial);
  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="groupId" value={group.id} />
        <input
          name="label"
          defaultValue={group.label}
          className="h-8 w-64 rounded-md border border-border bg-background px-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="text-xs underline-offset-2 hover:underline"
        >
          Renommer
        </button>
        {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
      </form>
      <code className="text-[10px] text-muted-foreground">{group.id}</code>
    </li>
  );
}

function SectionRow({
  projectId,
  section,
  groups,
}: {
  projectId: string;
  section: Section;
  groups: Group[];
}) {
  const [open, setOpen] = useState(false);
  const [updateState, updateAction, updating] = useActionState(updateSectionAction, initial);
  const [deleteState, deleteAction, deleting] = useActionState(deleteSectionAction, initial);

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-mono text-xs text-muted-foreground">{section.code}</span>{" "}
          <span className="text-sm font-medium">{section.title}</span>
          {!section.isActive ? (
            <span className="ml-2 text-[11px] text-muted-foreground">(inactive)</span>
          ) : null}
          {section.codeLocked ? (
            <span className="ml-2 text-[11px] text-muted-foreground">
              · {section.documentCount} doc(s) — code verrouillé
            </span>
          ) : (
            <span className="ml-2 text-[11px] text-muted-foreground">· vide</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs underline-offset-2 hover:underline"
        >
          {open ? "Fermer" : "Éditer"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-3 rounded border border-border p-3">
          <form action={updateAction} className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="sectionId" value={section.id} />
            <input type="hidden" name="projectId" value={projectId} />
            <label className="block text-xs sm:col-span-2">
              <span className="text-muted-foreground">Titre</span>
              <input
                name="title"
                defaultValue={section.title}
                className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">Slug</span>
              <input
                name="slug"
                defaultValue={section.slug}
                className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">Groupe</span>
              <select
                name="groupId"
                defaultValue={section.groupId || ""}
                className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
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
                className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
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
                className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </label>
            <p className="sm:col-span-2 text-[11px] text-muted-foreground">
              Code : <strong>{section.code}</strong>
              {section.codeLocked
                ? " (immutable — documents associés)"
                : " (modifiable uniquement à la création)"}
            </p>
            {updateState.error ? (
              <p className="sm:col-span-2 text-xs text-destructive">{updateState.error}</p>
            ) : null}
            <button
              type="submit"
              disabled={updating}
              className="h-8 rounded-md border border-border px-3 text-xs hover:bg-muted sm:col-span-2 sm:w-fit"
            >
              Enregistrer
            </button>
          </form>

          {!section.codeLocked ? (
            <form
              action={deleteAction}
              onSubmit={(e) => {
                if (!confirm(`Supprimer définitivement ${section.code} ?`)) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="sectionId" value={section.id} />
              <input type="hidden" name="projectId" value={projectId} />
              <button
                type="submit"
                disabled={deleting}
                className="text-xs text-destructive underline-offset-2 hover:underline"
              >
                Supprimer (rubrique vide uniquement)
              </button>
              {deleteState.error ? (
                <p className="mt-1 text-xs text-destructive">{deleteState.error}</p>
              ) : null}
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">
              Suppression bloquée — désactivez la rubrique si elle ne doit plus
              apparaître.
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}
