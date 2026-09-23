import { z } from "zod";
import { db } from "@/lib/db";
import {
  assertCanManageStructure,
  assertCanUpload,
} from "@/lib/access";
import { authenticate, apiError, HttpError, readJson } from "@/lib/http";
import { nameSchema } from "@/lib/validation/file";
import {
  assertDocumentaryFolder,
  deleteDocumentaryFolder,
  moveDocumentaryFolder,
  renameDocumentaryFolder,
} from "@/lib/heritage/documentary-folders";

type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: nameSchema.optional(),
  description: z.string().max(2000).optional().nullable(),
  /** Set to move within the same heritage section; null = section root. */
  parentId: z.string().min(1).nullable().optional(),
});

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await authenticate(request, true);
    const { id } = await context.params;
    const body = patchSchema.parse(await readJson(request));

    const existing = await db.folder.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        heritageSectionId: true,
      },
    });
    if (!existing) throw new HttpError(404, "Dossier introuvable.");

    if (existing.heritageSectionId) {
      await assertCanManageStructure(user, existing.projectId);
      await assertDocumentaryFolder(id);
      if (body.parentId !== undefined) {
        await moveDocumentaryFolder({ folderId: id, parentId: body.parentId });
      }
      if (body.name !== undefined || body.description !== undefined) {
        const current = await assertDocumentaryFolder(id);
        await renameDocumentaryFolder({
          folderId: id,
          name: body.name ?? current.name,
          description: body.description,
        });
      }
      const folder = await assertDocumentaryFolder(id);
      return Response.json({
        ok: true,
        id: folder.id,
        name: folder.name,
        description: folder.description,
        parentId: folder.parentId,
        heritageSectionId: folder.heritageSectionId,
      });
    }

    await assertCanUpload(user, existing.projectId);
    if (body.parentId !== undefined) {
      throw new HttpError(
        400,
        "Le déplacement des dossiers hérités n’est pas disponible ici.",
      );
    }
    if (!body.name) throw new HttpError(400, "Nom manquant.");
    await db.folder.update({ where: { id }, data: { name: body.name } });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await authenticate(request, true);
    const { id } = await context.params;
    const existing = await db.folder.findUnique({
      where: { id },
      select: { id: true, projectId: true, heritageSectionId: true },
    });
    if (!existing) throw new HttpError(404, "Dossier introuvable.");

    if (existing.heritageSectionId) {
      await assertCanManageStructure(user, existing.projectId);
      await deleteDocumentaryFolder(id);
      return Response.json({ ok: true });
    }

    await assertCanUpload(user, existing.projectId);

    await db.$transaction(async (tx) => {
      const folder = await tx.folder.findUnique({
        where: { id },
        include: { _count: { select: { files: true, children: true } } },
      });
      if (!folder) throw new HttpError(404, "Dossier introuvable.");
      if (folder._count.files || folder._count.children) {
        throw new HttpError(409, "Seul un dossier vide peut être supprimé.");
      }
      await tx.folder.delete({ where: { id } });
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
