import "server-only";

import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { AuditActions, writeAuditLog } from "@/lib/admin/audit";
import {
  allocateTerritoireCode,
  allocateTerritoireSlug,
} from "@/lib/admin/allocate-identifiers";

export const createTerritoireSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .regex(/^[A-Z0-9_-]+$/, "Code invalide")
    .optional()
    .nullable(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide")
    .optional()
    .nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateTerritoireSchema = createTerritoireSchema.partial();

export type AdminTerritoireRow = {
  id: string;
  name: string;
  code: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  dossierCount: number;
  sectionCount: number;
  fileCount: number;
  lastActivityAt: Date;
};

function maxDate(dates: Date[]): Date {
  return dates.reduce((a, b) => (a > b ? a : b));
}

export async function listAdminTerritoires(): Promise<AdminTerritoireRow[]> {
  const territoires = await db.territoire.findMany({
    orderBy: { name: "asc" },
    include: {
      projects: {
        select: {
          id: true,
          isActive: true,
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

  return territoires.map((t) => {
    const dossierCount = t.projects.length;
    const sectionCount = t.projects.reduce(
      (n, p) => n + p._count.heritageSections,
      0,
    );
    const fileCount = t.projects.reduce((n, p) => n + p._count.files, 0);
    const activityDates = [
      t.updatedAt,
      ...t.projects.map((p) => p.updatedAt),
      ...t.projects.flatMap((p) =>
        p.files[0] ? [p.files[0].updatedAt] : [],
      ),
    ];
    return {
      id: t.id,
      name: t.name,
      code: t.code,
      slug: t.slug,
      description: t.description,
      isActive: t.isActive,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      dossierCount,
      sectionCount,
      fileCount,
      lastActivityAt: maxDate(activityDates),
    };
  });
}

export async function getAdminTerritoireDetail(territoireId: string) {
  const t = await db.territoire.findUnique({
    where: { id: territoireId },
    include: {
      projects: {
        orderBy: { name: "asc" },
        include: {
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

  const dossiers = t.projects.map(({ files, _count, ...project }) => ({
    ...project,
    sectionCount: _count.heritageSections,
    fileCount: _count.files,
    lastActivityAt: files[0]?.updatedAt ?? project.updatedAt,
  }));

  const sectionCount = dossiers.reduce((n, d) => n + d.sectionCount, 0);
  const fileCount = dossiers.reduce((n, d) => n + d.fileCount, 0);
  const lastActivityAt = maxDate([
    t.updatedAt,
    ...dossiers.map((d) => d.lastActivityAt),
  ]);

  return {
    id: t.id,
    name: t.name,
    code: t.code,
    slug: t.slug,
    description: t.description,
    isActive: t.isActive,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    dossierCount: dossiers.length,
    sectionCount,
    fileCount,
    lastActivityAt,
    dossiers,
  };
}

export async function createTerritoire(
  input: z.infer<typeof createTerritoireSchema>,
  actorUserId: string,
) {
  const data = createTerritoireSchema.parse(input);
  const slug = await allocateTerritoireSlug(data.name, data.slug);
  const code = await allocateTerritoireCode(data.name, data.code);

  try {
    const territoire = await db.territoire.create({
      data: {
        name: data.name,
        code,
        slug,
        description: data.description || null,
        isActive: data.isActive ?? true,
      },
    });
    await writeAuditLog({
      actorUserId,
      action: AuditActions.TERRITOIRE_CREATED,
      entityType: "Territoire",
      entityId: territoire.id,
      metadata: { code: territoire.code, slug: territoire.slug },
    });
    return territoire;
  } catch (error) {
    const { Prisma } = await import("@/generated/prisma/client");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "Un projet avec ce code ou ce slug existe déjà.");
    }
    throw error;
  }
}

export async function updateTerritoire(
  territoireId: string,
  input: z.infer<typeof updateTerritoireSchema>,
  actorUserId: string,
) {
  const data = updateTerritoireSchema.parse(input);
  const current = await db.territoire.findUnique({ where: { id: territoireId } });
  if (!current) throw new HttpError(404, "Projet introuvable.");

  try {
    const updated = await db.territoire.update({
      where: { id: territoireId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(typeof data.code === "string"
          ? { code: data.code.toUpperCase() }
          : {}),
        ...(typeof data.slug === "string" ? { slug: data.slug } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    await writeAuditLog({
      actorUserId,
      action:
        data.isActive === false
          ? AuditActions.TERRITOIRE_ARCHIVED
          : AuditActions.TERRITOIRE_UPDATED,
      entityType: "Territoire",
      entityId: territoireId,
      metadata: {
        code: updated.code,
        slug: updated.slug,
        isActive: updated.isActive,
      },
    });
    return updated;
  } catch (error) {
    const { Prisma } = await import("@/generated/prisma/client");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "Un projet avec ce code ou ce slug existe déjà.");
    }
    throw error;
  }
}

/** Territoires with nested dossiers for Structure picker. */
export async function listTerritoiresForStructure() {
  return db.territoire.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
      projects: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          code: true,
          description: true,
          isActive: true,
          _count: {
            select: {
              heritageSections: true,
              files: true,
            },
          },
        },
      },
    },
  });
}
