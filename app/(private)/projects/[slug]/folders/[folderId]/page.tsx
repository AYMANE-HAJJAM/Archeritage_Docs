import { redirect } from "next/navigation";

import {
  documentsPath,
  isHeritageProject,
  sectionFolderPath,
} from "@/lib/heritage/config/structure";
import { getDocumentaryFolder } from "@/lib/heritage/documentary-folders";
import { db } from "@/lib/db";

/**
 * Deep-link into a documentary folder under its heritage section.
 * Legacy (non-section) folders land on the document index.
 */
export default async function FolderPage({
  params,
}: {
  params: Promise<{ slug: string; folderId: string }>;
}) {
  const { slug, folderId } = await params;

  if (isHeritageProject(slug)) {
    const folder = await getDocumentaryFolder(folderId);
    if (folder?.heritageSectionId) {
      const section = await db.heritageSection.findUnique({
        where: { id: folder.heritageSectionId },
        select: { code: true },
      });
      if (section) {
        redirect(sectionFolderPath(slug, section.code, folder.id));
      }
    }
    redirect(documentsPath(slug));
  }

  redirect(`/projects/${slug}`);
}
