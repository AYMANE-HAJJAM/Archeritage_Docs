import { z } from "zod";
import { db } from "@/lib/db";
import { assertCanManageStructure, getProjectIdForSection } from "@/lib/access";
import { authenticate, apiError, HttpError, readJson } from "@/lib/http";
import { nameSchema } from "@/lib/validation/file";
import { deleteDocumentForUser } from "@/lib/documents/delete-document";

type Context = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    displayName: nameSchema.optional(),
    /** Move inside the same section; null = section root. */
    folderId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => v.displayName !== undefined || v.folderId !== undefined, {
    message: "Aucune modification.",
  });

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await authenticate(request, true);
    const { id } = await context.params;
    const data = patchSchema.parse(await readJson(request));

    const file = await db.file.findUnique({
      where: { id },
      select: { id: true, sectionId: true },
    });
    if (!file) throw new HttpError(404, "Fichier introuvable.");

    const projectId = await getProjectIdForSection(file.sectionId);
    await assertCanManageStructure(user, projectId);

    if (data.folderId) {
      const folder = await db.folder.findUnique({
        where: { id: data.folderId },
        select: { sectionId: true },
      });
      if (!folder || folder.sectionId !== file.sectionId) {
        throw new HttpError(400, "Choisissez un dossier de la même section.");
      }
    }

    await db.file.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined
          ? { displayName: data.displayName }
          : {}),
        ...(data.folderId !== undefined ? { folderId: data.folderId } : {}),
      },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await authenticate(request, true);
    const { id } = await context.params;
    const file = await db.file.findUnique({
      where: { id },
      select: { id: true, displayName: true },
    });
    if (!file) throw new HttpError(404, "Fichier introuvable.");

    await deleteDocumentForUser(id, user);
    return Response.json({
      ok: true,
      id: file.id,
      displayName: file.displayName,
    });
  } catch (error) {
    return apiError(error);
  }
}
