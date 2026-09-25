import "server-only";

import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { AuditActions, writeAuditLog } from "@/lib/admin/audit";
import { allocateTerritoireCode } from "@/lib/admin/allocate-identifiers";

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
  description: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateTerritoireSchema = createTerritoireSchema.partial();

export type AdminTerritoireRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  dossierCount: number;
  sectionCount: number;
  fileCount: number;
  lastActivityAt: Date;
};

export async function listAdminTerritoires(): Promise<AdminTerritoireRow[]> {
  const territoires = await db.territoire.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { projects: true } },
      projects: { select: { id: true, updatedAt: true } },
    },
  });

  const rows: AdminTerritoireRow[] = [];
  for (const t of territoires) {
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

    rows.push({
      id: t.id,
      name: t.name,
      code: t.code,
      description: t.description,
      isActive: t.isActive,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      dossierCount: t._count.projects,
      sectionCount,
      fileCount,
      lastActivityAt,
    });
  }
  return rows;
}

export async function getAdminTerritoireDetail(territoireId: string) {
  const t = await db.territoire.findUnique({
    where: { id: territoireId },
    include: {
      projects: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { groups: true, parts: true } },
        },
      },
    },
  });
  if (!t) return null;

  const counters = await Promise.all(
    t.projects.map(async (p) => {
      const [sectionCount, fileCount, lastFile] = await Promise.all([
        db.section.count({ where: { group: { projectId: p.id } } }),
        db.file.count({ where: { section: { group: { projectId: p.id } } } }),
        db.file.findFirst({
          where: { section: { group: { projectId: p.id } } },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        }),
      ]);
      return { sectionCount, fileCount, lastActivityAt: lastFile?.updatedAt ?? p.updatedAt };
    }),
  );

  return {
    id: t.id,
    name: t.name,
    code: t.code,
    description: t.description,
    isActive: t.isActive,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    dossierCount: t.projects.length,
    dossiers: t.projects.map((p, i) => ({
      ...p,
      groupCount: p._count.groups,
      partCount: p._count.parts,
      ...counters[i]!,
    })),
  };
}

export async function createTerritoire(
  input: z.infer<typeof createTerritoireSchema>,
  actorUserId: string,
) {
  const data = createTerritoireSchema.parse(input);
  const code = await allocateTerritoireCode(data.name, data.code);

  try {
    const territoire = await db.territoire.create({
      data: {
        name: data.name,
        code,
        description: data.description || null,
        isActive: data.isActive ?? true,
      },
    });
    await writeAuditLog({
      actorUserId,
      action: AuditActions.TERRITOIRE_CREATED,
      entityType: "Territoire",
      entityId: territoire.id,
      metadata: { code: territoire.code },
    });
    return territoire;
  } catch (error) {
    const { Prisma } = await import("@/generated/prisma/client");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "Un territoire avec ce code existe déjà.");
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
  if (!current) throw new HttpError(404, "Territoire introuvable.");

  // Rename updates display metadata only — code is immutable after create.
  try {
    const updated = await db.territoire.update({
      where: { id: territoireId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
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
      metadata: { code: updated.code, isActive: updated.isActive },
    });
    return updated;
  } catch (error) {
    throw error;
  }
}

/** Territoires with nested projects for Structure picker. */
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
          description: true,
          isActive: true,
          _count: {
            select: {
              groups: true,
              parts: true,
            },
          },
        },
      },
    },
  });
}
