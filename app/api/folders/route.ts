import { authenticate, apiError, HttpError, readJson } from "@/lib/http";
import {
  assertCanManageStructure,
  assertProjectAccess,
  getProjectIdForSection,
} from "@/lib/access";
import { createFolder, listFolderChildren } from "@/lib/structure/folders";

export async function GET(request: Request) {
  try {
    const user = await authenticate(request);
    const url = new URL(request.url);
    const sectionId = url.searchParams.get("sectionId")?.trim();
    const parentId = url.searchParams.get("parentId")?.trim() || null;
    if (!sectionId) throw new HttpError(400, "sectionId requis.");

    const projectId = await getProjectIdForSection(sectionId);
    await assertProjectAccess(user, projectId);

    const folders = await listFolderChildren(sectionId, parentId);
    return Response.json({ folders });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticate(request, true);
    const body = await readJson(request);
    const sectionId = String(body.sectionId || "").trim();
    const parentId = body.parentId ? String(body.parentId).trim() : null;
    const name = String(body.name || "").trim();
    if (!sectionId || !name) {
      throw new HttpError(400, "sectionId et name requis.");
    }

    const projectId = await getProjectIdForSection(sectionId);
    await assertCanManageStructure(user, projectId);

    const folder = await createFolder({ sectionId, parentId, name });
    return Response.json(folder, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
