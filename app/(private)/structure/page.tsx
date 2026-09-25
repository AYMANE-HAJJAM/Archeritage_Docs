import { requireAdmin } from "@/lib/access";
import { loadStructureWorkspaceAction } from "@/app/(private)/manage/actions";
import { listTerritoiresForStructure } from "@/lib/admin/territoires";
import { StructureWorkspace } from "@/components/manage/structure-workspace";
import { db } from "@/lib/db";

export default async function StructurePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; territoire?: string }>;
}) {
  await requireAdmin();
  const { project: projectParam, territoire: territoireParam } = await searchParams;
  const territoires = await listTerritoiresForStructure();
  const allDossiers = territoires.flatMap((t) =>
    t.projects.map((p) => ({ ...p, territoireId: t.id, territoireName: t.name })),
  );

  if (!territoires.length || !allDossiers.length) {
    return (
      <div className="space-y-3">
        <p className="page-eyebrow">Administration</p>
        <h1 className="page-title">Structure des dossiers</h1>
        <p className="page-lede">
          Aucun dossier patrimonial. Créez d’abord un projet, puis un dossier
          depuis Projets.
        </p>
      </div>
    );
  }

  const selectedByProject = projectParam
    ? allDossiers.find((p) => p.id === projectParam)
    : undefined;

  const selectedTerritoireId =
    selectedByProject?.territoireId ??
    (territoireParam && territoires.some((t) => t.id === territoireParam)
      ? territoireParam
      : null) ??
    territoires.find((t) => t.isActive && t.projects.length)?.id ??
    territoires[0].id;

  const dossiersInTerritoire = allDossiers.filter(
    (p) => p.territoireId === selectedTerritoireId,
  );

  const selected =
    (selectedByProject &&
    selectedByProject.territoireId === selectedTerritoireId
      ? selectedByProject
      : null) ??
    dossiersInTerritoire.find((p) => p.isActive) ??
    dossiersInTerritoire[0];

  if (!selected) {
    return (
      <div className="space-y-3">
        <p className="page-eyebrow">Administration</p>
        <h1 className="page-title">Structure des dossiers</h1>
        <p className="page-lede">
          Ce projet n’a pas encore de dossier patrimonial. Ajoutez-en un depuis
          la fiche projet.
        </p>
      </div>
    );
  }

  const structure = await loadStructureWorkspaceAction(selected.id);
  const territoire = territoires.find((t) => t.id === selectedTerritoireId)!;

  // Per-dossier counters for the selector cards.
  const sectionCounts = await db.section.groupBy({
    by: ["groupId"],
    _count: { _all: true },
  });
  const groupOwners = await db.sectionGroup.findMany({
    select: { id: true, projectId: true },
  });
  const sectionsByProject = new Map<string, number>();
  for (const row of sectionCounts) {
    const owner = groupOwners.find((g) => g.id === row.groupId);
    if (!owner) continue;
    sectionsByProject.set(
      owner.projectId,
      (sectionsByProject.get(owner.projectId) ?? 0) + row._count._all,
    );
  }
  const fileCounts = await db.file.findMany({
    select: { section: { select: { group: { select: { projectId: true } } } } },
  });
  const filesByProject = new Map<string, number>();
  for (const f of fileCounts) {
    const projectId = f.section.group.projectId;
    filesByProject.set(projectId, (filesByProject.get(projectId) ?? 0) + 1);
  }

  return (
    <StructureWorkspace
      territoires={territoires.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        dossiers: t.projects.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          sectionCount: sectionsByProject.get(p.id) ?? 0,
          fileCount: filesByProject.get(p.id) ?? 0,
        })),
      }))}
      initialTerritoireId={territoire.id}
      initialProjectId={selected.id}
      parts={structure.parts ?? []}
      groups={structure.groups ?? []}
      sections={structure.sections ?? []}
    />
  );
}
