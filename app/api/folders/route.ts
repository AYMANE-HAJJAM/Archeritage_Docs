import { z } from "zod";
import { db } from "@/lib/db";
import {
  assertCanManageStructure,
  assertCanUpload,
} from "@/lib/access";
import { authenticate, apiError, HttpError, readJson } from "@/lib/http";
import { nameSchema } from "@/lib/validation/file";
import {
  createDocumentaryFolder,
  assertDocumentaryFolder,
} from "@/lib/heritage/documentary-folders";

const schema = z.object({
  name: nameSchema,
  projectId: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  /** When set, creates a documentary folder under a heritage section. */
  heritageSectionId: z.string().min(1).optional(),
  description: z.string().max(2000).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const user = await authenticate(request, true);
    const data = schema.parse(await readJson(request));

    if (!(await db.project.findUnique({ where: { id: data.projectId } }))) {
      throw new HttpError(404, "Projet introuvable.");
    }

    if (data.heritageSectionId) {
      await assertCanManageStructure(user, data.projectId);
      if (data.parentId) {
        await assertDocumentaryFolder(data.parentId, {
          projectId: data.projectId,
          heritageSectionId: data.heritageSectionId,
        });
      }
      const folder = await createDocumentaryFolder({
        projectId: data.projectId,
        heritageSectionId: data.heritageSectionId,
        parentId: data.parentId,
        name: data.name,
        description: data.description,
      });
      return Response.json(
        {
          id: folder.id,
          name: folder.name,
          description: folder.description,
          parentId: folder.parentId,
          heritageSectionId: folder.heritageSectionId,
        },
        { status: 201 },
      );
    }

    // Legacy Explorer folders — uploaders may organize the physical tree.
    await assertCanUpload(user, data.projectId);
    if (
      data.parentId &&
      !(await db.folder.findFirst({
        where: {
          id: data.parentId,
          projectId: data.projectId,
          heritageSectionId: null,
        },
      }))
    ) {
      throw new HttpError(404, "Dossier introuvable.");
    }
    const folder = await db.folder.create({
      data: {
        name: data.name,
        projectId: data.projectId,
        parentId: data.parentId,
        heritageSectionId: null,
      },
    });
    return Response.json({ id: folder.id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
