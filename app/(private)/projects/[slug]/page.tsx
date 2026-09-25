import { notFound } from "next/navigation";

import { HeritageWorkspace } from "@/components/heritage/heritage-workspace";
import {
  assertProjectAccess,
  getProjectPermissionsForUser,
  requireActiveUser,
} from "@/lib/access";
import { buildProjectBreadcrumb } from "@/lib/structure/breadcrumb";
import { getProjectBySlug } from "@/lib/structure/queries";
import { loadWorkspace, partFileCount } from "@/lib/structure/workspace";

type ProjectQuery = { sectionId?: string; folderId?: string };

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ProjectQuery>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const user = await requireActiveUser();

  const project = await getProjectBySlug(slug);
  if (!project || !project.isActive) notFound();

  await assertProjectAccess(user, project.id);
  const permissions = await getProjectPermissionsForUser(user, project.id);

  const workspace = await loadWorkspace(project.id, {
    sectionId: query.sectionId ?? null,
    folderId: query.folderId ?? null,
  });
  if (!workspace) notFound();

  const { structure, groups, fileCounts, summary, selection } = workspace;

  const breadcrumb = buildProjectBreadcrumb({
    territoire: structure.project.territoire,
    project: { slug, name: project.name },
    part: null,
    group: selection?.group ?? null,
    section: selection?.section ?? null,
    folders: selection?.folderTrail ?? [],
  });

  const currentLabel = breadcrumb[breadcrumb.length - 1]?.label ?? project.name;

  return (
    <HeritageWorkspace
      breadcrumb={breadcrumb}
      eyebrow={
        structure.project.territoire
          ? `${structure.project.territoire.code} · ${project.name}`
          : project.name
      }
      title={currentLabel}
      projectSlug={slug}
      groups={groups.filter((group) => group.partId === null)}
      parts={structure.parts.map((part) => ({
        id: part.id,
        slug: part.slug,
        name: part.name,
        fileCount: partFileCount(groups, part.id, fileCounts),
      }))}
      fileCounts={fileCounts}
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
