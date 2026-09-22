import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";

/**
 * Legacy admin project URL:
 * - territoire id → platform detail
 * - dossier (Project) id → parent platform detail
 */
export default async function AdminProjectDetailRedirect({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireAdmin();
  const { projectId } = await params;

  const territoire = await db.territoire.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (territoire) {
    redirect(`/projects/manage/${territoire.id}`);
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { territoireId: true, id: true },
  });
  if (project?.territoireId) {
    redirect(`/projects/manage/${project.territoireId}`);
  }
  if (project) {
    redirect(`/structure?project=${encodeURIComponent(project.id)}`);
  }

  redirect("/projects/manage");
}
