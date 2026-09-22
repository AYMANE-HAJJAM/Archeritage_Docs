import { z } from "zod";
import { db } from "@/lib/db";
import { authenticate, apiError, HttpError, readJson } from "@/lib/http";
import { nameSchema } from "@/lib/validation/file";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    await authenticate(request, true);
    const { id } = await context.params;
    const { name } = z.object({ name: nameSchema }).parse(await readJson(request));
    await db.folder.update({ where: { id }, data: { name } });
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    await authenticate(request, true);
    const { id } = await context.params;
    await db.$transaction(async (tx) => {
      const folder = await tx.folder.findUnique({ where: { id }, include: { _count: { select: { files: true, children: true } } } });
      if (!folder) throw new HttpError(404, "Dossier introuvable.");
      if (folder._count.files || folder._count.children) throw new HttpError(409, "Seul un dossier vide peut être supprimé.");
      await tx.folder.delete({ where: { id } }); // Restrict FKs also prevent concurrent inserts.
    });
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
