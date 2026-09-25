import { redirect } from "next/navigation";

import { db } from "@/lib/db";

/** Deep-link into a folder — resolves its section and opens the workspace. */
export default async function FolderPage({
  params,
}: {
  params: Promise<{ slug: string; folderId: string }>;
}) {
  const { slug, folderId } = await params;

  const folder = await db.folder.findUnique({
    where: { id: folderId },
    select: {
      id: true,
      sectionId: true,
      section: { select: { group: { select: { project: { select: { slug: true } } } } } },
    },
  });

  if (!folder || folder.section.group.project.slug !== slug) {
    redirect(`/projects/${slug}`);
  }

  redirect(
    `/projects/${slug}?sectionId=${folder.sectionId}&folderId=${folder.id}`,
  );
}
