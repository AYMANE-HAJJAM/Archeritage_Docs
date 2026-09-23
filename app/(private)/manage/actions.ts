"use server";

import { revalidatePath } from "next/cache";
import {
  assertCanCreateDossier,
  assertCanManageStructure,
  assertCanReclassify,
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
  assessSectionsLinkedContent,
  createGroup,
  createGroupSchema,
  createSection,
  createSectionSchema,
  deleteGroupIfEmpty,
  deleteSectionIfEmpty,
  listStructureAdmin,
  reclassifyDocument,
  renameGroup,
  renameGroupSchema,
  reorderGroups,
  reorderSections,
  updateSection,
  updateSectionSchema,
} from "@/lib/admin/structure";
import { db } from "@/lib/db";

/** Live UI payloads — presentation only; server remains source of truth. */
export type LivePlatform = {
  id: string;
  name: string;
  code: string;
  slug: string;
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
  code: string | null;
  description: string | null;
  type: string;
  isActive: boolean;
  sectionCount: number;
  fileCount: number;
  lastActivityAt: string;
};

export type LiveSection = {
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
  /** True when hard-delete must be refused (documents or linked heritage data). */
  hasLinkedContent: boolean;
};

export type LiveGroup = {
  id: string;
  label: string;
  sortOrder: number;
};

export type ProjectActionState = {
  error?: string;
  ok?: boolean;
  platform?: LivePlatform;
  dossier?: LiveDossier;
  section?: LiveSection;
  group?: LiveGroup;
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
  revalidatePath("/territoires/saf");
  if (projectSlug) {
    revalidatePath(`/projects/${projectSlug}`);
  }
}

async function requireStructureEditor(projectId: string) {
  const user = await requireActiveUser();
  await assertCanManageStructure(user, projectId);
  return user;
}

async function toLivePlatform(territoireId: string): Promise<LivePlatform | null> {
  const t = await db.territoire.findUnique({
    where: { id: territoireId },
    include: {
      projects: {
        select: {
          id: true,
          updatedAt: true,
          _count: { select: { files: true, heritageSections: true } },
          files: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { updatedAt: true },
          },
        },
      },
    },
  });
  if (!t) return null;
  const fileCount = t.projects.reduce((n, p) => n + p._count.files, 0);
  const sectionCount = t.projects.reduce(
    (n, p) => n + p._count.heritageSections,
    0,
  );
  const lastActivityAt = t.projects
    .flatMap((p) => [
      p.updatedAt,
      ...(p.files[0] ? [p.files[0].updatedAt] : []),
    ])
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return {
    id: t.id,
    name: t.name,
    code: t.code,
    slug: t.slug,
    description: t.description,
    isActive: t.isActive,
    dossierCount: t.projects.length,
    sectionCount,
    fileCount,
    lastActivityAt: (lastActivityAt ?? t.updatedAt).toISOString(),
  };
}

async function toLiveDossier(projectId: string): Promise<LiveDossier | null> {
  const p = await db.project.findUnique({
    where: { id: projectId },
    include: {
      _count: { select: { files: true, heritageSections: true } },
      files: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true },
      },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    code: p.code,
    description: p.description,
    type: p.type,
    isActive: p.isActive,
    sectionCount: p._count.heritageSections,
    fileCount: p._count.files,
    lastActivityAt: (p.files[0]?.updatedAt ?? p.updatedAt).toISOString(),
  };
}

async function toLiveSection(sectionId: string): Promise<LiveSection | null> {
  const section = await db.heritageSection.findUnique({
    where: { id: sectionId },
  });
  if (!section) return null;
  const linked = await assessSectionsLinkedContent(section.projectId, [
    {
      id: section.id,
      code: section.code,
      kind: section.kind,
      tracks: section.tracks,
    },
  ]);
  const info = linked.get(section.id);
  const documentCount = info?.documentCount ?? 0;
  return {
    id: section.id,
    code: section.code,
    slug: section.slug,
    title: section.title,
    description: section.description,
    kind: section.kind,
    groupId: section.groupId,
    sortOrder: section.sortOrder,
    isActive: section.isActive,
    documentCount,
    codeLocked: documentCount > 0,
    hasLinkedContent: Boolean(info?.reason),
  };
}

function toLiveGroup(group: {
  id: string;
  label: string;
  sortOrder: number;
}): LiveGroup {
  return {
    id: group.id,
    label: group.label,
    sortOrder: group.sortOrder,
  };
}

export async function createTerritoireAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const admin = await requireAdmin();
    const advancedCode = String(form.get("code") || "").trim();
    const advancedSlug = String(form.get("slug") || "").trim();
    const parsed = createTerritoireSchema.safeParse({
      name: form.get("name"),
      code: advancedCode || null,
      slug: advancedSlug || null,
      description: form.get("description") || null,
      isActive: form.get("isActive") !== "0",
    });
    if (!parsed.success) return { error: "Vérifiez les champs du projet." };
    const created = await createTerritoire(parsed.data, admin.id);
    const platform = await toLivePlatform(created.id);
    revalidateManage();
    return { ok: true, platform: platform ?? undefined };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Création impossible.",
    };
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
      code: form.get("code")
        ? String(form.get("code")).toUpperCase()
        : undefined,
      slug: form.get("slug") || undefined,
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
    const platform = await toLivePlatform(territoireId);
    revalidateManage(territoireId);
    return { ok: true, platform: platform ?? undefined };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Mise à jour impossible.",
    };
  }
}

export async function createProjectAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const user = await requireActiveUser();
    const territoireId = String(form.get("territoireId") || "");
    await assertCanCreateDossier(user, territoireId);
    const advancedCode = String(form.get("code") || "").trim();
    const advancedSlug = String(form.get("slug") || "").trim();
    const parsed = createProjectSchema.safeParse({
      name: form.get("name"),
      slug: advancedSlug || null,
      code: advancedCode || null,
      description: form.get("description") || null,
      type: form.get("type") || "AUTRE",
      territoireId,
      isActive: form.get("isActive") !== "0",
    });
    if (!parsed.success) return { error: "Vérifiez les champs du dossier." };
    const created = await createProject(parsed.data, user.id);
    const dossier = await toLiveDossier(created.id);
    revalidateManage(territoireId);
    return { ok: true, dossier: dossier ?? undefined };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Création impossible.",
    };
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
      slug: form.get("slug") || undefined,
      code: form.get("code") || null,
      description: form.get("description") || null,
      type: form.get("type") || undefined,
      territoireId: form.get("territoireId")
        ? String(form.get("territoireId"))
        : undefined,
      isActive:
        form.get("isActive") === "0"
          ? false
          : form.get("isActive") === "1"
            ? true
            : undefined,
    });
    if (!projectId || !parsed.success) return { error: "Vérifiez les champs." };
    await updateProject(projectId, parsed.data, admin.id);
    const dossier = await toLiveDossier(projectId);
    revalidateManage(territoireId);
    return { ok: true, dossier: dossier ?? undefined };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Mise à jour impossible.",
    };
  }
}

export async function createSectionAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const projectId = String(form.get("projectId") || "");
    const user = await requireStructureEditor(projectId);
    const advancedCode = String(form.get("code") || "").trim();
    const advancedSlug = String(form.get("slug") || "").trim();
    const parsed = createSectionSchema.safeParse({
      code: advancedCode || null,
      slug: advancedSlug || null,
      title: form.get("title"),
      description: form.get("description") || null,
      kind: form.get("kind") || "documentary",
      groupId: form.get("groupId") || null,
    });
    if (!projectId || !parsed.success) return { error: "Vérifiez la rubrique." };
    const created = await createSection(projectId, parsed.data, user.id);
    const section = await toLiveSection(created.id);
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { slug: true },
    });
    revalidateManage(undefined, project?.slug);
    return { ok: true, section: section ?? undefined };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Création impossible.",
    };
  }
}

export async function updateSectionAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const sectionId = String(form.get("sectionId") || "");
    const sectionRow = await db.heritageSection.findUnique({
      where: { id: sectionId },
      select: { projectId: true },
    });
    if (!sectionRow) return { error: "Rubrique introuvable." };
    const user = await requireStructureEditor(sectionRow.projectId);
    const parsed = updateSectionSchema.safeParse({
      title: form.get("title") || undefined,
      description: form.get("description") || null,
      slug: form.get("slug") || undefined,
      kind: form.get("kind") || undefined,
      groupId: form.get("groupId") || null,
      isActive:
        form.get("isActive") === "0"
          ? false
          : form.get("isActive") === "1"
            ? true
            : undefined,
    });
    if (!sectionId || !parsed.success) return { error: "Vérifiez la rubrique." };
    await updateSection(sectionId, parsed.data, user.id);
    const section = await toLiveSection(sectionId);
    revalidateManage();
    return { ok: true, section: section ?? undefined };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Mise à jour impossible.",
    };
  }
}

export async function deleteSectionAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const sectionId = String(form.get("sectionId") || "");
    const section = await db.heritageSection.findUnique({
      where: { id: sectionId },
      select: { projectId: true },
    });
    if (!section) return { error: "Rubrique introuvable." };
    const user = await requireStructureEditor(section.projectId);
    if (!sectionId) return { error: "Rubrique manquante." };
    await deleteSectionIfEmpty(sectionId, user.id);
    revalidateManage();
    return { ok: true, deletedId: sectionId };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Suppression impossible.",
    };
  }
}

export async function createGroupAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const projectId = String(form.get("projectId") || "");
    const user = await requireStructureEditor(projectId);
    const parsed = createGroupSchema.safeParse({ label: form.get("label") });
    if (!projectId || !parsed.success) return { error: "Libellé de groupe requis." };
    const created = await createGroup(projectId, parsed.data, user.id);
    revalidateManage();
    return { ok: true, group: toLiveGroup(created) };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Création impossible.",
    };
  }
}

export async function renameGroupAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const groupId = String(form.get("groupId") || "");
    const groupRow = await db.heritageSectionGroup.findUnique({
      where: { id: groupId },
      select: { projectId: true },
    });
    if (!groupRow) return { error: "Groupe manquant." };
    const user = await requireStructureEditor(groupRow.projectId);
    const parsed = renameGroupSchema.safeParse({ label: form.get("label") });
    if (!groupId || !parsed.success) return { error: "Libellé invalide." };
    const updated = await renameGroup(groupId, parsed.data, user.id);
    revalidateManage();
    return { ok: true, group: toLiveGroup(updated) };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Renommage impossible.",
    };
  }
}

export async function deleteGroupAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const groupId = String(form.get("groupId") || "");
    const group = await db.heritageSectionGroup.findUnique({
      where: { id: groupId },
      select: { projectId: true },
    });
    if (!group) return { error: "Groupe manquant." };
    const user = await requireStructureEditor(group.projectId);
    await deleteGroupIfEmpty(groupId, user.id);
    revalidateManage();
    return { ok: true, deletedId: groupId };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Suppression impossible.",
    };
  }
}

export async function reorderSectionsAction(
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
    if (!projectId || !orderedIds.length) return { error: "Ordre invalide." };
    await reorderSections(projectId, orderedIds, user.id);
    revalidateManage();
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Réordonnancement impossible.",
    };
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
    if (!projectId || !orderedIds.length) return { error: "Ordre invalide." };
    await reorderGroups(projectId, orderedIds, user.id);
    revalidateManage();
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof HttpError ? error.message : "Réordonnancement impossible.",
    };
  }
}

export async function reclassifyDocumentAction(
  _prev: ProjectActionState,
  form: FormData,
): Promise<ProjectActionState> {
  try {
    const user = await requireActiveUser();
    const fileId = String(form.get("fileId") || "");
    const sectionCode = String(form.get("sectionCode") || "");
    if (!fileId || !sectionCode) return { error: "Document ou rubrique manquant." };
    const file = await db.file.findUnique({
      where: { id: fileId },
      select: { projectId: true },
    });
    if (!file) return { error: "Document introuvable." };
    await assertCanReclassify(user, file.projectId);
    await reclassifyDocument(fileId, sectionCode, user.id);
    revalidateManage();
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof HttpError ? error.message : "Reclassification impossible.",
    };
  }
}

/** Soft-load structure for the Structure page selector (no full navigation). */
export async function loadStructureWorkspaceAction(
  projectId: string,
): Promise<{
  ok?: boolean;
  error?: string;
  projectId?: string;
  groups?: LiveGroup[];
  sections?: LiveSection[];
}> {
  try {
    await requireStructureEditor(projectId);
    if (!projectId) return { error: "Dossier manquant." };
    const structure = await listStructureAdmin(projectId);
    return {
      ok: true,
      projectId,
      groups: structure.groups.map((g) => ({
        id: g.id,
        label: g.label,
        sortOrder: g.sortOrder,
      })),
      sections: structure.sections.map((s) => ({
        id: s.id,
        code: s.code,
        slug: s.slug,
        title: s.title,
        description: s.description,
        kind: s.kind,
        groupId: s.groupId,
        sortOrder: s.sortOrder,
        isActive: s.isActive,
        documentCount: s.documentCount,
        codeLocked: s.codeLocked,
        hasLinkedContent: s.hasLinkedContent,
      })),
    };
  } catch (error) {
    return {
      error:
        error instanceof HttpError
          ? error.message
          : "Impossible de charger la structure.",
    };
  }
}
