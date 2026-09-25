import { notFound } from "next/navigation";

import { HeritageWorkspace } from "@/components/heritage/heritage-workspace";
import {
  assertProjectAccess,
  getProjectPermissionsForUser,
  requireActiveUser,
} from "@/lib/access";
import { buildProjectBreadcrumb } from "@/lib/structure/breadcrumb";
import { getPartBySlug, getProjectBySlug } from "@/lib/structure/queries";
import { loadWorkspace } from "@/lib/structure/workspace";

type PartQuery = { sectionId?: string; folderId?: string };

export default async function ProjectPartPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; part: string }>;
  searchParams: Promise<PartQuery>;
}) {
  const { slug, part: partSlug } = await params;
  const query = await searchParams;
  const user = await requireActiveUser();

  const project = await getProjectBySlug(slug);
  if (!project || !project.isActive) notFound();

  await assertProjectAccess(user, project.id);
  const permissions = await getProjectPermissionsForUser(user, project.id);

  const part = await getPartBySlug(project.id, partSlug);
  if (!part || !part.isActive) notFound();

  const workspace = await loadWorkspace(project.id, {
    partId: part.id,
    sectionId: query.sectionId ?? null,
    folderId: query.folderId ?? null,
  });
  if (!workspace) notFound();

  const { structure, groups, sectionStats, summary, selection } = workspace;

  const breadcrumb = buildProjectBreadcrumb({
    territoire: structure.project.territoire,
    project: { slug, name: project.name },
    part: { slug: part.slug, name: part.name },
    group: selection?.group ?? null,
    section: selection?.section ?? null,
    folders: selection?.folderTrail ?? [],
  });

  const currentLabel = breadcrumb[breadcrumb.length - 1]?.label ?? part.name;

  return (
    <HeritageWorkspace
      breadcrumb={breadcrumb}
      eyebrow={`${project.name} · Partie`}
      title={currentLabel}
      projectSlug={slug}
      groups={groups}
      sectionStats={sectionStats}
      sectionBasePath={`/projects/${slug}/parts/${part.slug}`}
      summary={summary}
      selectedSection={selection?.section ?? null}
      documents={selection?.documents ?? []}
      currentFolderId={selection?.currentFolderId ?? null}
      folders={selection?.folders ?? []}
      moveTargets={selection?.moveTargets ?? []}
      permissions={permissions}
    />
  );
}
