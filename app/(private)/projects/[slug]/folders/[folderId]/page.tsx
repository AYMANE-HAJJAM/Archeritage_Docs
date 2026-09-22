import { redirect } from "next/navigation";

import {
  documentsPath,
  isHeritageProject,
} from "@/lib/heritage/config/structure";

/**
 * Legacy folder deep-links redirect into the heritage document index.
 * Folder rows remain in the database for File.folderId integrity.
 */
export default async function FolderPage({
  params,
}: {
  params: Promise<{ slug: string; folderId: string }>;
}) {
  const { slug } = await params;

  if (isHeritageProject(slug)) {
    redirect(documentsPath(slug));
  }

  redirect(`/projects/${slug}`);
}
