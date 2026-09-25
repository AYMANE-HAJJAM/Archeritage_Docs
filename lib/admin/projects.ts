import "server-only";

import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { AuditActions, writeAuditLog } from "@/lib/admin/audit";
import { allocateProjectSlug } from "@/lib/admin/allocate-identifiers";
import { revalidateProjectStructure } from "@/lib/structure/queries";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide")
    .optional()
    .nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  territoireId: z.string().min(1, "Territoire requis"),
  isActive: z.boolean().optional().default(true),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  territoireId: z.string().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function listAdminProjects() {
  return db.project.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { groups: true, parts: true } },
      territoire: { select: { id: true, code: true, name: true } },
    },
  });
}

export async function createProject(
  input: z.infer<typeof createProjectSchema>,
  actorUserId: string,
) {
  const data = createProjectSchema.parse(input);
  const territoire = await db.territoire.findUnique({
    where: { id: data.territoireId },
  });
  if (!territoire) throw new HttpError(400, "Territoire introuvable.");

  const slug = await allocateProjectSlug(data.name, data.slug);

  try {
    const project = await db.project.create({
      data: {
        name: data.name,
        slug,
        description: data.description || null,
        territoireId: data.territoireId,
        isActive: data.isActive ?? true,
      },
    });
    await writeAuditLog({
      actorUserId,
      action: AuditActions.PROJECT_CREATED,
      entityType: "Project",
      entityId: project.id,
      metadata: { slug: project.slug, territoireId: data.territoireId },
    });
    return project;
  } catch (error) {
    const { Prisma } = await import("@/generated/prisma/client");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "Un projet avec ce slug existe déjà.");
    }
    throw error;
  }
}

/**
 * Rename / edit updates display metadata only.
 * Slug is immutable after create (URLs + storage path stability).
 */
export async function updateProject(
  projectId: string,
  input: z.infer<typeof updateProjectSchema>,
  actorUserId: string,
) {
  const data = updateProjectSchema.parse(input);
  const current = await db.project.findUnique({ where: { id: projectId } });
  if (!current) throw new HttpError(404, "Projet introuvable.");

  if (data.territoireId) {
    const territoire = await db.territoire.findUnique({
      where: { id: data.territoireId },
    });
    if (!territoire) throw new HttpError(400, "Territoire introuvable.");
  }

  const updated = await db.project.update({
    where: { id: projectId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(typeof data.territoireId === "string"
        ? { territoireId: data.territoireId }
        : data.territoireId === null
          ? { territoireId: null }
          : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });

  await writeAuditLog({
    actorUserId,
    action:
      data.isActive === false
        ? AuditActions.PROJECT_ARCHIVED
        : AuditActions.PROJECT_UPDATED,
    entityType: "Project",
    entityId: projectId,
    metadata: { slug: updated.slug, isActive: updated.isActive },
  });

  revalidateProjectStructure(updated.slug);
  return updated;
}

/** Safe delete only when project has no parts, groups, or files. */
export async function deleteProjectIfEmpty(
  projectId: string,
  actorUserId: string,
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      _count: { select: { parts: true, groups: true } },
    },
  });
  if (!project) throw new HttpError(404, "Projet introuvable.");

  const fileCount = await db.file.count({
    where: { section: { group: { projectId } } },
  });
  if (project._count.parts > 0 || project._count.groups > 0 || fileCount > 0) {
    throw new HttpError(
      409,
      "Impossible de supprimer un projet non vide. Désactivez-le à la place.",
    );
  }

  await db.project.delete({ where: { id: projectId } });
  await writeAuditLog({
    actorUserId,
    action: AuditActions.PROJECT_ARCHIVED,
    entityType: "Project",
    entityId: projectId,
    metadata: { deleted: true, slug: project.slug },
  });
}
