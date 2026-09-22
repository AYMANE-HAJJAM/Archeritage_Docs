import { z } from "zod";
import { db } from "@/lib/db";
import { authenticate, apiError, HttpError, readJson } from "@/lib/http";
import { nameSchema } from "@/lib/validation/file";

const schema = z.object({ name: nameSchema, projectId: z.string().min(1), parentId: z.string().min(1).nullable() });
export async function POST(request: Request) {
  try {
    await authenticate(request, true);
    const data = schema.parse(await readJson(request));
    if (!await db.project.findUnique({ where: { id: data.projectId } })) throw new HttpError(404, "Projet introuvable.");
    if (data.parentId && !await db.folder.findFirst({ where: { id: data.parentId, projectId: data.projectId } })) throw new HttpError(404, "Dossier introuvable.");
    const folder = await db.folder.create({ data });
    return Response.json({ id: folder.id }, { status: 201 });
  } catch (error) { return apiError(error); }
}
