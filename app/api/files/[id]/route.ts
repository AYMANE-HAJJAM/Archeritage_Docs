import { z } from "zod";
import { db } from "@/lib/db";
import { authenticate, apiError, HttpError, readJson } from "@/lib/http";
import { nameSchema } from "@/lib/validation/file";
import { deleteDocumentForUser } from "@/lib/documents/delete-document";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    await authenticate(request, true);
    const { id } = await context.params;
    const data = z
      .object({
        displayName: nameSchema.optional(),
        folderId: z.string().min(1).optional(),
      })
      .refine((v) => v.displayName || v.folderId)
      .parse(await readJson(request));
    const file = await db.file.findUnique({ where: { id } });
    if (!file) throw new HttpError(404, "Fichier introuvable.");
    if (
      data.folderId &&
      !(await db.folder.findFirst({
        where: { id: data.folderId, projectId: file.projectId },
      }))
    ) {
      throw new HttpError(400, "Choisissez un dossier du même projet.");
    }
    await db.file.update({ where: { id }, data });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await authenticate(request, true);
    const { id } = await context.params;
    const deleted = await deleteDocumentForUser(user, id);
    return Response.json({
      ok: true,
      id: deleted.id,
      displayName: deleted.displayName,
    });
  } catch (error) {
    return apiError(error);
  }
}
