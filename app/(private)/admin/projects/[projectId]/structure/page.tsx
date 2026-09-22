import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/access";

export default async function AdminStructureRedirect({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireAdmin();
  const { projectId } = await params;
  redirect(`/structure?project=${encodeURIComponent(projectId)}`);
}
