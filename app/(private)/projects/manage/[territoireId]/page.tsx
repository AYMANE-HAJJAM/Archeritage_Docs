import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/access";
import { getAdminTerritoireDetail } from "@/lib/admin/territoires";
import { PlatformDetailView } from "@/components/manage/platform-detail";

export default async function PlatformDetailPage({
  params,
}: {
  params: Promise<{ territoireId: string }>;
}) {
  await requireAdmin();
  const { territoireId } = await params;
  const platform = await getAdminTerritoireDetail(territoireId);
  if (!platform) notFound();

  return (
    <PlatformDetailView
      platform={{
        id: platform.id,
        name: platform.name,
        code: platform.code,
        slug: platform.slug,
        description: platform.description,
        isActive: platform.isActive,
        createdAt: platform.createdAt.toISOString(),
        updatedAt: platform.updatedAt.toISOString(),
        dossiers: platform.dossiers.map((d) => ({
          id: d.id,
          name: d.name,
          slug: d.slug,
          code: d.code,
          description: d.description,
          type: d.type,
          isActive: d.isActive,
          sectionCount: d.sectionCount,
          fileCount: d.fileCount,
          lastActivityAt: d.lastActivityAt.toISOString(),
        })),
      }}
    />
  );
}
