import { authenticate, apiError, HttpError } from "@/lib/http";
import { getLibrary } from "@/lib/documents/library";
import { isHeritageProject } from "@/lib/heritage/config/structure";
import { searchHeritageProject } from "@/lib/heritage/queries/project-search";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await authenticate(request);
    const { slug } = await params;
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const mode = url.searchParams.get("mode") || "";

    // Heritage in-project search (sections + documents + folders).
    if (mode === "heritage") {
      if (!isHeritageProject(slug)) {
        throw new HttpError(
          400,
          "Recherche patrimoniale indisponible pour ce projet.",
        );
      }
      return Response.json(await searchHeritageProject(user, slug, q));
    }

    // Legacy Explorer library search (default).
    const type = url.searchParams.get("type") || undefined;
    const folder = url.searchParams.get("folder") || null;
    return Response.json(await getLibrary(slug, folder, { q, type }));
  } catch (error) {
    return apiError(error);
  }
}
