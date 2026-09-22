import "server-only";

import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { AuditActions, writeAuditLog } from "@/lib/admin/audit";
import {
  allocateProjectCode,
  allocateProjectSlug,
} from "@/lib/admin/allocate-identifiers";
import { revalidateHeritageStructure } from "@/lib/heritage/queries/structure";

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
  code: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .regex(/^[A-Z0-9_-]+$/)
    .optional()
    .nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  type: z.enum(["CHATEAU", "MURAILLE", "AUTRE"]).default("AUTRE"),
  /** Parent platform (Territoire). Required for dossiers patrimoniaux. */
  territoireId: z.string().min(1, "Territoire requis"),
  isActive: z.boolean().optional().default(true),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  isActive: z.boolean().optional(),
  territoireId: z.string().min(1).optional().nullable(),
});

export async function listAdminProjects() {
  const projects = await db.project.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { files: true, heritageSections: true } },
      territoire: { select: { id: true, code: true, name: true } },
      files: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true },
      },
    },
  });
  return projects.map(({ files, ...project }) => ({
    ...project,
    lastActivityAt: files[0]?.updatedAt ?? project.updatedAt,
  }));
}

export async function createProject(
  input: z.infer<typeof createProjectSchema>,
  actorUserId: string,
) {
  const data = createProjectSchema.parse(input);
  const territoire = await db.territoire.findUnique({
    where: { id: data.territoireId },
  });
  if (!territoire) throw new HttpError(400, "Projet parent introuvable.");

  const slug = await allocateProjectSlug(data.name, data.slug);
  const code = await allocateProjectCode(data.name, data.code);

  try {
    const project = await db.project.create({
      data: {
        name: data.name,
        slug,
        code,
        description: data.description || null,
        type: data.type,
        territoireId: data.territoireId,
        isActive: data.isActive ?? true,
      },
    });
    await writeAuditLog({
      actorUserId,
      action: AuditActions.PROJECT_CREATED,
      entityType: "Project",
      entityId: project.id,
      metadata: { slug: project.slug, code: project.code, territoireId: data.territoireId },
    });
    return project;
  } catch (error) {
    const { Prisma } = await import("@/generated/prisma/client");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "Un dossier avec ce slug ou ce code existe déjà.");
    }
    throw error;
  }
}

export async function updateProject(
  projectId: string,
  input: z.infer<typeof updateProjectSchema>,
  actorUserId: string,
) {
  const data = updateProjectSchema.parse(input);
  const current = await db.project.findUnique({ where: { id: projectId } });
  if (!current) throw new HttpError(404, "Dossier patrimonial introuvable.");

  if (data.territoireId) {
    const territoire = await db.territoire.findUnique({
      where: { id: data.territoireId },
    });
    if (!territoire) throw new HttpError(400, "Projet parent introuvable.");
  }

  // Archive always soft — hard delete never (documents & structure preserved).
  try {
    const updated = await db.project.update({
      where: { id: projectId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(typeof data.slug === "string" ? { slug: data.slug } : {}),
        ...(typeof data.code === "string" ? { code: data.code } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
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

    revalidateHeritageStructure(updated.slug);
    if (current.slug !== updated.slug) {
      revalidateHeritageStructure(current.slug);
    }
    return updated;
  } catch (error) {
    const { Prisma } = await import("@/generated/prisma/client");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "Un dossier avec ce slug ou ce code existe déjà.");
    }
    throw error;
  }
}
