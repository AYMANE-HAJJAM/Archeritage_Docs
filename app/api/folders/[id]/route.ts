import { z } from "zod";
import { db } from "@/lib/db";
import { assertCanManageStructure, getProjectIdForSection } from "@/lib/access";
import { authenticate, apiError, HttpError, readJson } from "@/lib/http";
import { nameSchema } from "@/lib/validation/file";
import {
  deleteFolderIfEmpty,
  moveFolder,
  renameFolder,
} from "@/lib/structure/folders";

type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: nameSchema.optional(),
  /** Move within the same section; null = section root. */
  parentId: z.string().min(1).nullable().optional(),
});

async function authorizeFolder(request: Request, folderId: string) {
  const user = await authenticate(request, true);
  const folder = await db.folder.findUnique({
    where: { id: folderId },
    select: { id: true, sectionId: true },
  });
  if (!folder) throw new HttpError(404, "Dossier introuvable.");
  const projectId = await getProjectIdForSection(folder.sectionId);
  await assertCanManageStructure(user, projectId);
  return { folder, user };
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const { user } = await authorizeFolder(request, id);
    const body = patchSchema.parse(await readJson(request));

    if (body.parentId !== undefined) {
      await moveFolder(id, body.parentId, user.id);
    }
    if (body.name !== undefined) {
      await renameFolder(id, body.name, user.id);
    }
    if (body.parentId === undefined && body.name === undefined) {
      throw new HttpError(400, "Aucune modification.");
    }

    const folder = await db.folder.findUnique({
      where: { id },
      select: { id: true, name: true, parentId: true, sectionId: true },
    });
    return Response.json({ ok: true, ...folder });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const { user } = await authorizeFolder(request, id);
    await deleteFolderIfEmpty(id, user.id);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
