import { authenticate, apiError } from "@/lib/http";
import { assertProjectAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { searchProject } from "@/lib/structure/search";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await authenticate(request);
    const { slug } = await params;
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const page = Number(url.searchParams.get("page") || "1");

    const project = await db.project.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!project) throw new HttpError(404, "Projet introuvable.");
    await assertProjectAccess(user, project.id);

    return Response.json(await searchProject(slug, q, user, { page }));
  } catch (error) {
    return apiError(error);
  }
}
