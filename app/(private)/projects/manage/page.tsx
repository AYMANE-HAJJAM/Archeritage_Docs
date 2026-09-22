import { requireAdmin } from "@/lib/access";
import { listAdminTerritoires } from "@/lib/admin/territoires";
import { PlatformsManager } from "@/components/manage/platforms-manager";

export default async function ProjectsManagePage() {
  await requireAdmin();
  const platforms = await listAdminTerritoires();

  return (
    <PlatformsManager
      platforms={platforms.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        slug: p.slug,
        description: p.description,
        isActive: p.isActive,
        dossierCount: p.dossierCount,
        sectionCount: p.sectionCount,
        fileCount: p.fileCount,
        lastActivityAt: p.lastActivityAt.toISOString(),
      }))}
    />
  );
}
