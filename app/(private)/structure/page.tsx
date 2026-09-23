import { requireAdmin } from "@/lib/access";
import { listStructureAdmin } from "@/lib/admin/structure";
import { listTerritoiresForStructure } from "@/lib/admin/territoires";
import { StructureWorkspace } from "@/components/manage/structure-workspace";

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

  const structure = await listStructureAdmin(selected.id);
  const territoire = territoires.find((t) => t.id === selectedTerritoireId)!;

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
          code: p.code,
          description: p.description,
          sectionCount: p._count.heritageSections,
          fileCount: p._count.files,
        })),
      }))}
      initialTerritoireId={territoire.id}
      initialProjectId={selected.id}
      groups={structure.groups.map((g) => ({
        id: g.id,
        label: g.label,
        sortOrder: g.sortOrder,
      }))}
      sections={structure.sections.map((s) => ({
        id: s.id,
        code: s.code,
        slug: s.slug,
        title: s.title,
        description: s.description,
        kind: s.kind,
        groupId: s.groupId,
        sortOrder: s.sortOrder,
        isActive: s.isActive,
        documentCount: s.documentCount,
        codeLocked: s.codeLocked,
        hasLinkedContent: s.hasLinkedContent,
      }))}
    />
  );
}
