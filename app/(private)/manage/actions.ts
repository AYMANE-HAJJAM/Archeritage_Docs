"use server";

import { revalidatePath } from "next/cache";
import {
  assertCanCreateProject,
  assertCanManageStructure,
  requireActiveUser,
  requireAdmin,
} from "@/lib/access";
import { HttpError } from "@/lib/http";
import {
  createProject,
  createProjectSchema,
  updateProject,
  updateProjectSchema,
} from "@/lib/admin/projects";
import {
  createTerritoire,
  createTerritoireSchema,
  updateTerritoire,
  updateTerritoireSchema,
} from "@/lib/admin/territoires";
import {
  createPart,
  createSection,
  createSectionGroup,
  deletePartIfEmpty,
  deleteSectionGroupIfEmpty,
  deleteSectionIfEmpty,
  moveSectionToGroup,
  renamePart,
  renameSection,
  renameSectionGroup,
  reorderSectionGroups,
  reorderSections,
  setSectionActive,
} from "@/lib/structure/mutations";
import { db } from "@/lib/db";

/** Live UI payloads — presentation only; server remains source of truth. */
export type LivePlatform = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  dossierCount: number;
  sectionCount: number;
  fileCount: number;
  lastActivityAt: string;
};

export type LiveDossier = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sectionCount: number;
  fileCount: number;
  lastActivityAt: string;
};

export type LivePart = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  groupCount: number;
};

export type LiveGroup = {
  id: string;
  name: string;
  partId: string | null;
  sortOrder: number;
};

export type LiveSection = {
  id: string;
  name: string;
  code: string | null;
  groupId: string;
  sortOrder: number;
  isActive: boolean;
  documentCount: number;
  /** True when hard-delete must be refused (documents or folders present). */
  hasLinkedContent: boolean;
};

export type ProjectActionState = {
  error?: string;
  ok?: boolean;
  platform?: LivePlatform;
  dossier?: LiveDossier;
  part?: LivePart;
  group?: LiveGroup;
  section?: LiveSection;
  deletedId?: string;
};

function revalidateManage(territoireId?: string, projectSlug?: string) {
  revalidatePath("/projects/manage");
  if (territoireId) {
    revalidatePath(`/projects/manage/${territoireId}`);
    revalidatePath(`/admin/projects/${territoireId}`);
  }
  revalidatePath("/structure");
  revalidatePath("/projects");
  if (projectSlug) {
    revalidatePath(`/projects/${projectSlug}`);
  }
}

async function requireStructureEditor(projectId: string) {
  const user = await requireActiveUser();
  await assertCanManageStructure(user, projectId);
  return user;
}

async function projectIdForGroup(groupId: string) {
  const group = await db.sectionGroup.findUnique({
    where: { id: groupId },
    select: { projectId: true },
  });
  if (!group) throw new HttpError(404, "Groupe introuvable.");
  return group.projectId;
}

async function projectIdForSection(sectionId: string) {
  const section = await db.section.findUnique({
    where: { id: sectionId },
    select: { group: { select: { projectId: true } } },
  });
  if (!section) throw new HttpError(404, "Rubrique introuvable.");
  return section.group.projectId;
}

function failure(error: unknown, fallback: string): ProjectActionState {
  return { error: error instanceof HttpError ? error.message : fallback };
}

async function toLivePlatform(territoireId: string): Promise<LivePlatform | null> {
  const t = await db.territoire.findUnique({
    where: { id: territoireId },
    include: { projects: { select: { id: true, updatedAt: true } } },
  });
  if (!t) return null;

  const projectIds = t.projects.map((p) => p.id);
  const [sectionCount, fileCount] = await Promise.all([
    db.section.count({ where: { group: { projectId: { in: projectIds } } } }),
    db.file.count({
      where: { section: { group: { projectId: { in: projectIds } } } },
    }),
  ]);
  const lastActivityAt = t.projects
    .map((p) => p.updatedAt)
    .concat(t.updatedAt)
    .sort((a, b) => b.getTime() - a.getTime())[0]!;

  return {
    id: t.id,
    name: t.name,
    code: t.code,
    description: t.description,
    isActive: t.isActive,
    dossierCount: t.projects.length,
    sectionCount,
    fileCount,
    lastActivityAt: lastActivityAt.toISOString(),
  };
}

async function toLiveDossier(projectId: string): Promise<LiveDossier | null> {
  const p = await db.project.findUnique({ where: { id: projectId } });
  if (!p) return null;

  const [sectionCount, fileCount, lastFile] = await Promise.all([
    db.section.count({ where: { group: { projectId } } }),
    db.file.count({ where: { section: { group: { projectId } } } }),
    db.file.findFirst({
      where: { section: { group: { projectId } } },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    isActive: p.isActive,
    sectionCount,
    fileCount,
    lastActivityAt: (lastFile?.updatedAt ?? p.updatedAt).toISOString(),
  };
}

async function toLiveSection(sectionId: string): Promise<LiveSection | null> {
  const section = await db.section.findUnique({
    where: { id: sectionId },
    include: { _count: { select: { files: true, folders: true } } },
  });
  if (!section) return null;
  return {
    id: section.id,
    name: section.name,
    code: section.code,
    groupId: section.groupId,
    sortOrder: section.sortOrder,
    isActive: section.isActive,
    documentCount: section._count.files,
    hasLinkedContent: section._count.files > 0 || section._count.folders > 0,
  };
}

// ─── Territoire / Project ───────────────────────────────────────────────────

export async function createTerritoireAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const admin = await requireAdmin();
    const advancedCode = String(form.get("code") || "").trim();
    const parsed = createTerritoireSchema.safeParse({
      name: form.get("name"),
      code: advancedCode ? advancedCode.toUpperCase() : null,
      description: form.get("description") || null,
      isActive: form.get("isActive") !== "0",
    });
    if (!parsed.success) return { error: "Vérifiez les champs du projet." };
    const created = await createTerritoire(parsed.data, admin.id);
    revalidateManage();
    return { ok: true, platform: (await toLivePlatform(created.id)) ?? undefined };
  } catch (error) {
    return failure(error, "Création impossible.");
  }
}

export async function updateTerritoireAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const admin = await requireAdmin();
    const territoireId = String(form.get("territoireId") || "");
    const parsed = updateTerritoireSchema.safeParse({
      name: form.get("name") || undefined,
      description: form.get("description") || null,
      isActive:
        form.get("isActive") === "0"
          ? false
          : form.get("isActive") === "1"
            ? true
            : undefined,
    });
    if (!territoireId || !parsed.success) return { error: "Vérifiez les champs." };
    await updateTerritoire(territoireId, parsed.data, admin.id);
    revalidateManage(territoireId);
    return {
      ok: true,
      platform: (await toLivePlatform(territoireId)) ?? undefined,
    };
  } catch (error) {
    return failure(error, "Mise à jour impossible.");
  }
}

export async function createProjectAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const user = await requireActiveUser();
    await assertCanCreateProject(user);
    const territoireId = String(form.get("territoireId") || "");
    const advancedSlug = String(form.get("slug") || "").trim();
    const parsed = createProjectSchema.safeParse({
      name: form.get("name"),
      slug: advancedSlug || null,
      description: form.get("description") || null,
      territoireId,
      isActive: form.get("isActive") !== "0",
    });
    if (!parsed.success) return { error: "Vérifiez les champs du dossier." };
    const created = await createProject(parsed.data, user.id);
    revalidateManage(territoireId);
    return { ok: true, dossier: (await toLiveDossier(created.id)) ?? undefined };
  } catch (error) {
    return failure(error, "Création impossible.");
  }
}

export async function updateProjectAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const admin = await requireAdmin();
    const projectId = String(form.get("projectId") || "");
    const territoireId = String(form.get("territoireId") || "") || undefined;
    const parsed = updateProjectSchema.safeParse({
      name: form.get("name") || undefined,
      description: form.get("description") || null,
      territoireId: territoireId ?? undefined,
      isActive:
        form.get("isActive") === "0"
          ? false
          : form.get("isActive") === "1"
            ? true
            : undefined,
    });
    if (!projectId || !parsed.success) return { error: "Vérifiez les champs." };
    await updateProject(projectId, parsed.data, admin.id);
    revalidateManage(territoireId);
    return { ok: true, dossier: (await toLiveDossier(projectId)) ?? undefined };
  } catch (error) {
    return failure(error, "Mise à jour impossible.");
  }
}

// ─── Parties ────────────────────────────────────────────────────────────────

export async function createPartAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const projectId = String(form.get("projectId") || "");
    const user = await requireStructureEditor(projectId);
    const created = await createPart(
      { projectId, name: String(form.get("name") || "") },
      user.id,
    );
    revalidateManage();
    return {
      ok: true,
      part: {
        id: created.id,
        name: created.name,
        slug: created.slug,
        sortOrder: created.sortOrder,
        groupCount: 0,
      },
    };
  } catch (error) {
    return failure(error, "Création impossible.");
  }
}

export async function renamePartAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const partId = String(form.get("partId") || "");
    const part = await db.part.findUnique({
      where: { id: partId },
      select: { projectId: true },
    });
    if (!part) return { error: "Partie introuvable." };
    const user = await requireStructureEditor(part.projectId);
    const updated = await renamePart(partId, String(form.get("name") || ""), user.id);
    revalidateManage();
    return {
      ok: true,
      part: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        sortOrder: updated.sortOrder,
        groupCount: await db.sectionGroup.count({ where: { partId } }),
      },
    };
  } catch (error) {
    return failure(error, "Renommage impossible.");
  }
}

export async function deletePartAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const partId = String(form.get("partId") || "");
    const part = await db.part.findUnique({
      where: { id: partId },
      select: { projectId: true },
    });
    if (!part) return { error: "Partie introuvable." };
    const user = await requireStructureEditor(part.projectId);
    await deletePartIfEmpty(partId, user.id);
    revalidateManage();
    return { ok: true, deletedId: partId };
  } catch (error) {
    return failure(error, "Suppression impossible.");
  }
}

// ─── Groupes ────────────────────────────────────────────────────────────────

export async function createGroupAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const projectId = String(form.get("projectId") || "");
    const user = await requireStructureEditor(projectId);
    const created = await createSectionGroup(
      {
        projectId,
        partId: String(form.get("partId") || "") || null,
        name: String(form.get("name") || ""),
      },
      user.id,
    );
    revalidateManage();
    return {
      ok: true,
      group: {
        id: created.id,
        name: created.name,
        partId: created.partId,
        sortOrder: created.sortOrder,
      },
    };
  } catch (error) {
    return failure(error, "Création impossible.");
  }
}

export async function renameGroupAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const groupId = String(form.get("groupId") || "");
    const user = await requireStructureEditor(await projectIdForGroup(groupId));
    const updated = await renameSectionGroup(
      groupId,
      String(form.get("name") || ""),
      user.id,
    );
    revalidateManage();
    return {
      ok: true,
      group: {
        id: updated.id,
        name: updated.name,
        partId: updated.partId,
        sortOrder: updated.sortOrder,
      },
    };
  } catch (error) {
    return failure(error, "Renommage impossible.");
  }
}

export async function deleteGroupAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const groupId = String(form.get("groupId") || "");
    const user = await requireStructureEditor(await projectIdForGroup(groupId));
    await deleteSectionGroupIfEmpty(groupId, user.id);
    revalidateManage();
    return { ok: true, deletedId: groupId };
  } catch (error) {
    return failure(error, "Suppression impossible.");
  }
}

export async function reorderGroupsAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const projectId = String(form.get("projectId") || "");
    const user = await requireStructureEditor(projectId);
    const orderedIds = String(form.get("orderedIds") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!orderedIds.length) return { error: "Ordre invalide." };
    await reorderSectionGroups(projectId, orderedIds, user.id);
    revalidateManage();
    return { ok: true };
  } catch (error) {
    return failure(error, "Réordonnancement impossible.");
  }
}

// ─── Rubriques ──────────────────────────────────────────────────────────────

export async function createSectionAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const groupId = String(form.get("groupId") || "");
    const projectId = await projectIdForGroup(groupId);
    const user = await requireStructureEditor(projectId);
    const created = await createSection(
      {
        groupId,
        name: String(form.get("name") || ""),
        code: String(form.get("code") || "").trim() || null,
      },
      user.id,
    );
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { slug: true },
    });
    revalidateManage(undefined, project?.slug);
    return { ok: true, section: (await toLiveSection(created.id)) ?? undefined };
  } catch (error) {
    return failure(error, "Création impossible.");
  }
}

export async function updateSectionAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const sectionId = String(form.get("sectionId") || "");
    const user = await requireStructureEditor(await projectIdForSection(sectionId));
    const rawCode = form.get("code");
    await renameSection(
      sectionId,
      String(form.get("name") || ""),
      user.id,
      rawCode === null ? undefined : String(rawCode).trim() || null,
    );
    revalidateManage();
    return { ok: true, section: (await toLiveSection(sectionId)) ?? undefined };
  } catch (error) {
    return failure(error, "Mise à jour impossible.");
  }
}

export async function setSectionActiveAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const sectionId = String(form.get("sectionId") || "");
    const user = await requireStructureEditor(await projectIdForSection(sectionId));
    await setSectionActive(sectionId, form.get("isActive") === "1", user.id);
    revalidateManage();
    return { ok: true, section: (await toLiveSection(sectionId)) ?? undefined };
  } catch (error) {
    return failure(error, "Mise à jour impossible.");
  }
}

export async function moveSectionAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const sectionId = String(form.get("sectionId") || "");
    const user = await requireStructureEditor(await projectIdForSection(sectionId));
    await moveSectionToGroup(sectionId, String(form.get("groupId") || ""), user.id);
    revalidateManage();
    return { ok: true, section: (await toLiveSection(sectionId)) ?? undefined };
  } catch (error) {
    return failure(error, "Déplacement impossible.");
  }
}

export async function deleteSectionAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const sectionId = String(form.get("sectionId") || "");
    const user = await requireStructureEditor(await projectIdForSection(sectionId));
    await deleteSectionIfEmpty(sectionId, user.id);
    revalidateManage();
    return { ok: true, deletedId: sectionId };
  } catch (error) {
    return failure(error, "Suppression impossible.");
  }
}

export async function reorderSectionsAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const groupId = String(form.get("groupId") || "");
    const user = await requireStructureEditor(await projectIdForGroup(groupId));
    const orderedIds = String(form.get("orderedIds") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!orderedIds.length) return { error: "Ordre invalide." };
    await reorderSections(groupId, orderedIds, user.id);
    revalidateManage();
    return { ok: true };
  } catch (error) {
    return failure(error, "Réordonnancement impossible.");
  }
}

/** Soft-load structure for the Structure page selector (no full navigation). */
export async function loadStructureWorkspaceAction(projectId: string): Promise<{
  ok?: boolean;
  error?: string;
  projectId?: string;
  parts?: LivePart[];
  groups?: LiveGroup[];
  sections?: LiveSection[];
}> {
  try {
    if (!projectId) return { error: "Dossier manquant." };
    await requireStructureEditor(projectId);

    const [parts, groups, sections] = await Promise.all([
      db.part.findMany({
        where: { projectId },
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { groups: true } } },
      }),
      db.sectionGroup.findMany({
        where: { projectId },
        orderBy: { sortOrder: "asc" },
      }),
      db.section.findMany({
        where: { group: { projectId } },
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { files: true, folders: true } } },
      }),
    ]);

    return {
      ok: true,
      projectId,
      parts: parts.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        sortOrder: p.sortOrder,
        groupCount: p._count.groups,
      })),
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        partId: g.partId,
        sortOrder: g.sortOrder,
      })),
      sections: sections.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        groupId: s.groupId,
        sortOrder: s.sortOrder,
        isActive: s.isActive,
        documentCount: s._count.files,
        hasLinkedContent: s._count.files > 0 || s._count.folders > 0,
      })),
    };
  } catch (error) {
    return failure(error, "Impossible de charger la structure.");
  }
}
