import "server-only";

import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { AuditActions, writeAuditLog } from "@/lib/admin/audit";
import {
  allocateNextSectionCode,
  allocateSectionSlug,
} from "@/lib/admin/allocate-identifiers";
import { revalidateHeritageStructure } from "@/lib/heritage/queries/structure";
import { createSectionSchema } from "@/lib/admin/schemas";
import {
  describeSectionLinkedContent,
  type SectionLinkCounts,
} from "@/lib/admin/section-linked-content";

export { createSectionSchema };
export {
  canHardDeleteGroup,
  canHardDeleteSection,
  describeSectionLinkedContent,
} from "@/lib/admin/section-linked-content";

const kindSchema = z.enum(["documentary", "structured", "sequences"]);

export const updateSectionSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  kind: kindSchema.optional(),
  groupId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  tracks: z.array(z.string()).optional(),
});

export const createGroupSchema = z.object({
  label: z.string().trim().min(1).max(120),
});

export const renameGroupSchema = z.object({
  label: z.string().trim().min(1).max(120),
});

async function projectSlugOrThrow(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { slug: true },
  });
  if (!project) throw new HttpError(404, "Projet introuvable.");
  return project.slug;
}

export async function listStructureAdmin(projectId: string) {
  const [groups, sections] = await Promise.all([
    db.heritageSectionGroup.findMany({
      where: { projectId },
      orderBy: { sortOrder: "asc" },
    }),
    db.heritageSection.findMany({
      where: { projectId },
      orderBy: { sortOrder: "asc" },
      include: {
        group: { select: { id: true, label: true } },
      },
    }),
  ]);

  const linkedById = await assessSectionsLinkedContent(
    projectId,
    sections.map((s) => ({
      id: s.id,
      code: s.code,
      kind: s.kind,
      tracks: s.tracks,
    })),
  );

  return {
    groups,
    sections: sections.map((s) => {
      const linked = linkedById.get(s.id);
      const documentCount = linked?.documentCount ?? 0;
      const hasLinkedContent = Boolean(linked?.reason);
      return {
        ...s,
        documentCount,
        codeLocked: documentCount > 0,
        hasLinkedContent,
      };
    }),
  };
}

export async function createSection(
  projectId: string,
  input: z.infer<typeof createSectionSchema>,
  actorUserId: string,
) {
  const data = createSectionSchema.parse(input);
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new HttpError(404, "Dossier introuvable.");

  const code = data.code?.trim() || (await allocateNextSectionCode(projectId));
  const slug = await allocateSectionSlug(projectId, data.title, data.slug);

  const maxOrder = await db.heritageSection.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });

  try {
    const section = await db.heritageSection.create({
      data: {
        projectId,
        code,
        slug,
        title: data.title,
        description: data.description ?? null,
        kind: data.kind,
        groupId: data.groupId ?? null,
        tracks: data.tracks,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        isActive: true,
      },
    });
    await writeAuditLog({
      actorUserId,
      action: AuditActions.SECTION_CREATED,
      entityType: "HeritageSection",
      entityId: section.id,
      metadata: { code: section.code, projectId },
    });
    revalidateHeritageStructure(await projectSlugOrThrow(projectId));
    return section;
  } catch (error) {
    const { Prisma } = await import("@/generated/prisma/client");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "Une rubrique avec ce code existe déjà.");
    }
    throw error;
  }
}

export async function updateSection(
  sectionId: string,
  input: z.infer<typeof updateSectionSchema>,
  actorUserId: string,
) {
  const data = updateSectionSchema.parse(input);
  const current = await db.heritageSection.findUnique({ where: { id: sectionId } });
  if (!current) throw new HttpError(404, "Rubrique introuvable.");

  const updated = await db.heritageSection.update({
    where: { id: sectionId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.kind !== undefined ? { kind: data.kind } : {}),
      ...(data.groupId !== undefined ? { groupId: data.groupId } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.tracks !== undefined ? { tracks: data.tracks } : {}),
    },
  });

  await writeAuditLog({
    actorUserId,
    action:
      data.isActive === false
        ? AuditActions.SECTION_DEACTIVATED
        : AuditActions.SECTION_UPDATED,
    entityType: "HeritageSection",
    entityId: sectionId,
    metadata: { code: updated.code },
  });
  revalidateHeritageStructure(await projectSlugOrThrow(current.projectId));
  return updated;
}

export async function reorderSections(
  projectId: string,
  orderedIds: string[],
  actorUserId: string,
) {
  const sections = await db.heritageSection.findMany({
    where: { projectId },
    select: { id: true },
  });
  const known = new Set(sections.map((s) => s.id));
  if (orderedIds.length !== known.size || orderedIds.some((id) => !known.has(id))) {
    throw new HttpError(400, "Ordre de rubriques invalide.");
  }

  await db.$transaction(
    orderedIds.map((id, index) =>
      db.heritageSection.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  await writeAuditLog({
    actorUserId,
    action: AuditActions.SECTION_REORDERED,
    entityType: "Project",
    entityId: projectId,
    metadata: { count: orderedIds.length },
  });
  revalidateHeritageStructure(await projectSlugOrThrow(projectId));
}

export async function reorderGroups(
  projectId: string,
  orderedIds: string[],
  actorUserId: string,
) {
  const groups = await db.heritageSectionGroup.findMany({
    where: { projectId },
    select: { id: true },
  });
  const known = new Set(groups.map((g) => g.id));
  if (orderedIds.length !== known.size || orderedIds.some((id) => !known.has(id))) {
    throw new HttpError(400, "Ordre de groupes invalide.");
  }

  await db.$transaction(
    orderedIds.map((id, index) =>
      db.heritageSectionGroup.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  await writeAuditLog({
    actorUserId,
    action: AuditActions.SECTION_REORDERED,
    entityType: "HeritageSectionGroup",
    entityId: projectId,
  });
  revalidateHeritageStructure(await projectSlugOrThrow(projectId));
}

export async function createGroup(
  projectId: string,
  input: z.infer<typeof createGroupSchema>,
  actorUserId: string,
) {
  const data = createGroupSchema.parse(input);
  const maxOrder = await db.heritageSectionGroup.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });
  const group = await db.heritageSectionGroup.create({
    data: {
      projectId,
      label: data.label,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  await writeAuditLog({
    actorUserId,
    action: AuditActions.GROUP_CREATED,
    entityType: "HeritageSectionGroup",
    entityId: group.id,
  });
  revalidateHeritageStructure(await projectSlugOrThrow(projectId));
  return group;
}

export async function renameGroup(
  groupId: string,
  input: z.infer<typeof renameGroupSchema>,
  actorUserId: string,
) {
  const data = renameGroupSchema.parse(input);
  const group = await db.heritageSectionGroup.update({
    where: { id: groupId },
    data: { label: data.label },
  });
  await writeAuditLog({
    actorUserId,
    action: AuditActions.GROUP_UPDATED,
    entityType: "HeritageSectionGroup",
    entityId: groupId,
  });
  revalidateHeritageStructure(await projectSlugOrThrow(group.projectId));
  return group;
}

export async function deleteGroupIfEmpty(groupId: string, actorUserId: string) {
  const group = await db.heritageSectionGroup.findUnique({
    where: { id: groupId },
    include: { _count: { select: { sections: true } } },
  });
  if (!group) throw new HttpError(404, "Groupe introuvable.");
  if (group._count.sections > 0) {
    throw new HttpError(
      409,
      "Suppression impossible : déplacez ou retirez d’abord les rubriques du groupe.",
    );
  }
  await db.heritageSectionGroup.delete({ where: { id: groupId } });
  await writeAuditLog({
    actorUserId,
    action: AuditActions.GROUP_DELETED,
    entityType: "HeritageSectionGroup",
    entityId: groupId,
    metadata: { deleted: true, label: group.label },
  });
  revalidateHeritageStructure(await projectSlugOrThrow(group.projectId));
}

async function loadProjectLinkCounts(
  projectId: string,
): Promise<Omit<SectionLinkCounts, "documentCount"> & { sequenceIds: string[] }> {
  const sequences = await db.sequence.findMany({
    where: { projectId },
    select: { id: true },
  });
  const sequenceIds = sequences.map((s) => s.id);
  if (sequenceIds.length === 0) {
    return {
      sequenceIds,
      sequenceCount: 0,
      sequenceFileCount: 0,
      elementCount: 0,
      gateCount: 0,
      observationCount: 0,
      investigationCount: 0,
      decisionCount: 0,
      interventionCount: 0,
    };
  }

  const [
    sequenceFileCount,
    elementCount,
    gateCount,
    observationCount,
    investigationCount,
    decisionCount,
    interventionCount,
  ] = await Promise.all([
    db.file.count({ where: { projectId, sequenceId: { in: sequenceIds } } }),
    db.element.count({ where: { sequenceId: { in: sequenceIds } } }),
    db.gate.count({
      where: {
        OR: [{ projectId }, { sequenceId: { in: sequenceIds } }],
      },
    }),
    db.observation.count({ where: { sequenceId: { in: sequenceIds } } }),
    db.investigation.count({ where: { sequenceId: { in: sequenceIds } } }),
    db.decision.count({ where: { sequenceId: { in: sequenceIds } } }),
    db.intervention.count({ where: { sequenceId: { in: sequenceIds } } }),
  ]);

  return {
    sequenceIds,
    sequenceCount: sequenceIds.length,
    sequenceFileCount,
    elementCount,
    gateCount,
    observationCount,
    investigationCount,
    decisionCount,
    interventionCount,
  };
}

export async function assessSectionsLinkedContent(
  projectId: string,
  sections: Array<{ id: string; code: string; kind: string; tracks: unknown }>,
): Promise<Map<string, { reason: string | null; documentCount: number }>> {
  const docCounts = await db.file.groupBy({
    by: ["docCategorie"],
    where: {
      projectId,
      documentScope: "PROJECT_SECTION",
      docCategorie: { not: null },
    },
    _count: { _all: true },
  });
  const countByCode = new Map(
    docCounts.map((row) => [row.docCategorie!, row._count._all]),
  );
  const projectCounts = await loadProjectLinkCounts(projectId);
  const result = new Map<string, { reason: string | null; documentCount: number }>();

  for (const section of sections) {
    const documentCount = countByCode.get(section.code) ?? 0;
    const counts: SectionLinkCounts = {
      documentCount,
      sequenceCount: projectCounts.sequenceCount,
      sequenceFileCount: projectCounts.sequenceFileCount,
      elementCount: projectCounts.elementCount,
      gateCount: projectCounts.gateCount,
      observationCount: projectCounts.observationCount,
      investigationCount: projectCounts.investigationCount,
      decisionCount: projectCounts.decisionCount,
      interventionCount: projectCounts.interventionCount,
    };
    result.set(section.id, {
      documentCount,
      reason: describeSectionLinkedContent(section, counts),
    });
  }

  return result;
}

async function sectionHasBusinessContent(
  projectId: string,
  section: { id?: string; code: string; tracks: unknown; kind: string },
): Promise<string | null> {
  const map = await assessSectionsLinkedContent(projectId, [
    {
      id: section.id ?? section.code,
      code: section.code,
      kind: section.kind,
      tracks: section.tracks,
    },
  ]);
  return map.get(section.id ?? section.code)?.reason ?? null;
}

export async function deleteSectionIfEmpty(sectionId: string, actorUserId: string) {
  const section = await db.heritageSection.findUnique({ where: { id: sectionId } });
  if (!section) throw new HttpError(404, "Rubrique introuvable.");

  const linked = await sectionHasBusinessContent(section.projectId, section);
  if (linked) {
    throw new HttpError(
      409,
      `Suppression impossible : ${linked}. Désactivez la rubrique à la place.`,
    );
  }

  await db.heritageSection.delete({ where: { id: sectionId } });
  await writeAuditLog({
    actorUserId,
    action: AuditActions.SECTION_DELETED,
    entityType: "HeritageSection",
    entityId: sectionId,
    metadata: { code: section.code },
  });
  revalidateHeritageStructure(await projectSlugOrThrow(section.projectId));
}

export async function reclassifyDocument(
  fileId: string,
  newSectionCode: string,
  actorUserId: string,
) {
  const file = await db.file.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      projectId: true,
      docCategorie: true,
      documentScope: true,
      project: { select: { slug: true } },
    },
  });
  if (!file) throw new HttpError(404, "Document introuvable.");

  const section = await db.heritageSection.findFirst({
    where: {
      projectId: file.projectId,
      code: newSectionCode,
      isActive: true,
    },
  });
  if (!section) {
    throw new HttpError(400, "Rubrique cible invalide ou inactive pour ce projet.");
  }

  const previous = file.docCategorie;
  await db.file.update({
    where: { id: fileId },
    data: {
      documentScope: "PROJECT_SECTION",
      docCategorie: section.code,
    },
  });

  await writeAuditLog({
    actorUserId,
    action: AuditActions.DOCUMENT_RECLASSIFIED,
    entityType: "File",
    entityId: fileId,
    metadata: { from: previous, to: section.code, projectId: file.projectId },
  });

  return { from: previous, to: section.code };
}
