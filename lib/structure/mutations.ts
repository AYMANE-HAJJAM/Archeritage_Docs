/**
 * Structure mutations with server-side integrity rules.
 *
 * Rename = display metadata only (no storage key moves).
 * Move = explicit relationship change only.
 */
import "server-only";

import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { AuditActions, writeAuditLog } from "@/lib/admin/audit";
import { allocatePartSlug } from "@/lib/admin/allocate-identifiers";
import { generateSlug } from "@/lib/admin/identifiers";
import { revalidateProjectStructure } from "@/lib/structure/queries";

async function getProjectSlug(projectId: string) {
  const p = await db.project.findUnique({
    where: { id: projectId },
    select: { slug: true },
  });
  if (!p) throw new HttpError(404, "Projet introuvable.");
  return p.slug;
}

// ─── Part ───────────────────────────────────────────────────────────────────

export const createPartSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional()
    .nullable(),
  sortOrder: z.number().int().optional(),
});

export async function createPart(
  input: z.infer<typeof createPartSchema>,
  actorUserId: string,
) {
  const data = createPartSchema.parse(input);
  const project = await db.project.findUnique({ where: { id: data.projectId } });
  if (!project) throw new HttpError(404, "Projet introuvable.");

  const slug = await allocatePartSlug(data.projectId, data.name, data.slug);
  const maxOrder = await db.part.aggregate({
    where: { projectId: data.projectId },
    _max: { sortOrder: true },
  });

  const part = await db.part.create({
    data: {
      projectId: data.projectId,
      name: data.name,
      slug,
      sortOrder: data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await writeAuditLog({
    actorUserId,
    action: "part.created",
    entityType: "Part",
    entityId: part.id,
    metadata: { projectId: data.projectId, slug },
  });
  revalidateProjectStructure(project.slug);
  return part;
}

export async function renamePart(
  partId: string,
  name: string,
  actorUserId: string,
) {
  const trimmed = name.trim();
  if (!trimmed) throw new HttpError(400, "Nom requis.");

  const part = await db.part.findUnique({ where: { id: partId } });
  if (!part) throw new HttpError(404, "Partie introuvable.");

  // Slug stays immutable — rename is display-only.
  const updated = await db.part.update({
    where: { id: partId },
    data: { name: trimmed },
  });

  await writeAuditLog({
    actorUserId,
    action: "part.renamed",
    entityType: "Part",
    entityId: partId,
    metadata: { name: trimmed },
  });
  revalidateProjectStructure(await getProjectSlug(part.projectId));
  return updated;
}

export async function reorderParts(
  projectId: string,
  orderedIds: string[],
  actorUserId: string,
) {
  const parts = await db.part.findMany({
    where: { projectId },
    select: { id: true },
  });
  const known = new Set(parts.map((p) => p.id));
  if (orderedIds.some((id) => !known.has(id))) {
    throw new HttpError(400, "Identifiants de parties invalides.");
  }

  await db.$transaction(
    orderedIds.map((id, index) =>
      db.part.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );

  await writeAuditLog({
    actorUserId,
    action: "part.reordered",
    entityType: "Project",
    entityId: projectId,
    metadata: { orderedIds },
  });
  revalidateProjectStructure(await getProjectSlug(projectId));
}

export async function setPartActive(
  partId: string,
  isActive: boolean,
  actorUserId: string,
) {
  const part = await db.part.findUnique({ where: { id: partId } });
  if (!part) throw new HttpError(404, "Partie introuvable.");

  const updated = await db.part.update({
    where: { id: partId },
    data: { isActive },
  });
  await writeAuditLog({
    actorUserId,
    action: isActive ? "part.activated" : "part.deactivated",
    entityType: "Part",
    entityId: partId,
  });
  revalidateProjectStructure(await getProjectSlug(part.projectId));
  return updated;
}

export async function deletePartIfEmpty(partId: string, actorUserId: string) {
  const part = await db.part.findUnique({
    where: { id: partId },
    include: { _count: { select: { groups: true } } },
  });
  if (!part) throw new HttpError(404, "Partie introuvable.");
  if (part._count.groups > 0) {
    throw new HttpError(409, "Impossible de supprimer une partie non vide.");
  }

  await db.part.delete({ where: { id: partId } });
  await writeAuditLog({
    actorUserId,
    action: "part.deleted",
    entityType: "Part",
    entityId: partId,
  });
  revalidateProjectStructure(await getProjectSlug(part.projectId));
}

// ─── SectionGroup ───────────────────────────────────────────────────────────

export const createGroupSchema = z.object({
  projectId: z.string().min(1),
  partId: z.string().optional().nullable(),
  name: z.string().trim().min(1).max(160),
  sortOrder: z.number().int().optional(),
});

export async function createSectionGroup(
  input: z.infer<typeof createGroupSchema>,
  actorUserId: string,
) {
  const data = createGroupSchema.parse(input);
  const project = await db.project.findUnique({ where: { id: data.projectId } });
  if (!project) throw new HttpError(404, "Projet introuvable.");

  if (data.partId) {
    const part = await db.part.findUnique({ where: { id: data.partId } });
    if (!part || part.projectId !== data.projectId) {
      throw new HttpError(400, "La partie n’appartient pas à ce projet.");
    }
  }

  const maxOrder = await db.sectionGroup.aggregate({
    where: { projectId: data.projectId, partId: data.partId ?? null },
    _max: { sortOrder: true },
  });

  const group = await db.sectionGroup.create({
    data: {
      projectId: data.projectId,
      partId: data.partId ?? null,
      name: data.name,
      sortOrder: data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
      createdById: actorUserId,
    },
  });

  await writeAuditLog({
    actorUserId,
    action: "section_group.created",
    entityType: "SectionGroup",
    entityId: group.id,
  });
  revalidateProjectStructure(project.slug);
  return group;
}

export async function renameSectionGroup(
  groupId: string,
  name: string,
  actorUserId: string,
) {
  const trimmed = name.trim();
  if (!trimmed) throw new HttpError(400, "Nom requis.");

  const group = await db.sectionGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new HttpError(404, "Groupe introuvable.");

  const updated = await db.sectionGroup.update({
    where: { id: groupId },
    data: { name: trimmed },
  });
  await writeAuditLog({
    actorUserId,
    action: "section_group.renamed",
    entityType: "SectionGroup",
    entityId: groupId,
  });
  revalidateProjectStructure(await getProjectSlug(group.projectId));
  return updated;
}

export async function reorderSectionGroups(
  projectId: string,
  orderedIds: string[],
  actorUserId: string,
) {
  const groups = await db.sectionGroup.findMany({
    where: { projectId },
    select: { id: true },
  });
  const known = new Set(groups.map((g) => g.id));
  if (orderedIds.some((id) => !known.has(id))) {
    throw new HttpError(400, "Identifiants de groupes invalides.");
  }

  await db.$transaction(
    orderedIds.map((id, index) =>
      db.sectionGroup.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );

  await writeAuditLog({
    actorUserId,
    action: "section_group.reordered",
    entityType: "Project",
    entityId: projectId,
  });
  revalidateProjectStructure(await getProjectSlug(projectId));
}

export async function deleteSectionGroupIfEmpty(
  groupId: string,
  actorUserId: string,
) {
  const group = await db.sectionGroup.findUnique({
    where: { id: groupId },
    include: { _count: { select: { sections: true } } },
  });
  if (!group) throw new HttpError(404, "Groupe introuvable.");
  if (group._count.sections > 0) {
    throw new HttpError(409, "Impossible de supprimer un groupe non vide.");
  }

  await db.sectionGroup.delete({ where: { id: groupId } });
  await writeAuditLog({
    actorUserId,
    action: "section_group.deleted",
    entityType: "SectionGroup",
    entityId: groupId,
  });
  revalidateProjectStructure(await getProjectSlug(group.projectId));
}

// ─── Section ────────────────────────────────────────────────────────────────

export const createSectionSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().max(32).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export async function createSection(
  input: z.infer<typeof createSectionSchema>,
  actorUserId: string,
) {
  const data = createSectionSchema.parse(input);
  const group = await db.sectionGroup.findUnique({ where: { id: data.groupId } });
  if (!group) throw new HttpError(404, "Groupe introuvable.");

  const maxOrder = await db.section.aggregate({
    where: { groupId: data.groupId },
    _max: { sortOrder: true },
  });

  const section = await db.section.create({
    data: {
      groupId: data.groupId,
      name: data.name,
      code: data.code?.trim() || null,
      sortOrder: data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
      createdById: actorUserId,
    },
  });

  await writeAuditLog({
    actorUserId,
    action: "section.created",
    entityType: "Section",
    entityId: section.id,
  });
  revalidateProjectStructure(await getProjectSlug(group.projectId));
  return section;
}

/**
 * Rename keeps groupId and sortOrder unchanged.
 */
export async function renameSection(
  sectionId: string,
  name: string,
  actorUserId: string,
  code?: string | null,
) {
  const trimmed = name.trim();
  if (!trimmed) throw new HttpError(400, "Nom requis.");

  const section = await db.section.findUnique({
    where: { id: sectionId },
    include: { group: { select: { projectId: true } } },
  });
  if (!section) throw new HttpError(404, "Section introuvable.");

  const updated = await db.section.update({
    where: { id: sectionId },
    data: {
      name: trimmed,
      ...(code !== undefined ? { code: code?.trim() || null } : {}),
    },
  });

  await writeAuditLog({
    actorUserId,
    action: "section.renamed",
    entityType: "Section",
    entityId: sectionId,
  });
  revalidateProjectStructure(await getProjectSlug(section.group.projectId));
  return updated;
}

/** Explicit move between groups (same project only). */
export async function moveSectionToGroup(
  sectionId: string,
  targetGroupId: string,
  actorUserId: string,
) {
  const section = await db.section.findUnique({
    where: { id: sectionId },
    include: { group: true },
  });
  if (!section) throw new HttpError(404, "Section introuvable.");

  const target = await db.sectionGroup.findUnique({ where: { id: targetGroupId } });
  if (!target) throw new HttpError(404, "Groupe cible introuvable.");
  if (target.projectId !== section.group.projectId) {
    throw new HttpError(400, "Déplacement inter-projets interdit.");
  }

  const maxOrder = await db.section.aggregate({
    where: { groupId: targetGroupId },
    _max: { sortOrder: true },
  });

  const updated = await db.section.update({
    where: { id: sectionId },
    data: {
      groupId: targetGroupId,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await writeAuditLog({
    actorUserId,
    action: "section.moved",
    entityType: "Section",
    entityId: sectionId,
    metadata: { fromGroupId: section.groupId, toGroupId: targetGroupId },
  });
  revalidateProjectStructure(await getProjectSlug(section.group.projectId));
  return updated;
}

export async function reorderSections(
  groupId: string,
  orderedIds: string[],
  actorUserId: string,
) {
  const group = await db.sectionGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new HttpError(404, "Groupe introuvable.");

  const sections = await db.section.findMany({
    where: { groupId },
    select: { id: true },
  });
  const known = new Set(sections.map((s) => s.id));
  if (orderedIds.some((id) => !known.has(id))) {
    throw new HttpError(400, "Identifiants de sections invalides.");
  }

  await db.$transaction(
    orderedIds.map((id, index) =>
      db.section.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );

  await writeAuditLog({
    actorUserId,
    action: "section.reordered",
    entityType: "SectionGroup",
    entityId: groupId,
  });
  revalidateProjectStructure(await getProjectSlug(group.projectId));
}

export async function setSectionActive(
  sectionId: string,
  isActive: boolean,
  actorUserId: string,
) {
  const section = await db.section.findUnique({
    where: { id: sectionId },
    include: { group: { select: { projectId: true } } },
  });
  if (!section) throw new HttpError(404, "Section introuvable.");

  const updated = await db.section.update({
    where: { id: sectionId },
    data: { isActive },
  });
  await writeAuditLog({
    actorUserId,
    action: isActive ? "section.activated" : "section.deactivated",
    entityType: "Section",
    entityId: sectionId,
  });
  revalidateProjectStructure(await getProjectSlug(section.group.projectId));
  return updated;
}

export async function deleteSectionIfEmpty(
  sectionId: string,
  actorUserId: string,
) {
  const section = await db.section.findUnique({
    where: { id: sectionId },
    include: {
      group: { select: { projectId: true } },
      _count: { select: { folders: true, files: true } },
    },
  });
  if (!section) throw new HttpError(404, "Section introuvable.");
  if (section._count.folders > 0 || section._count.files > 0) {
    throw new HttpError(409, "Impossible de supprimer une section non vide.");
  }

  await db.section.delete({ where: { id: sectionId } });
  await writeAuditLog({
    actorUserId,
    action: "section.deleted",
    entityType: "Section",
    entityId: sectionId,
  });
  revalidateProjectStructure(await getProjectSlug(section.group.projectId));
}

void generateSlug; // keep import available for callers
void AuditActions;
