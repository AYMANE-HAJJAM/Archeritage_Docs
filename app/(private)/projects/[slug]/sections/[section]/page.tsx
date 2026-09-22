import { notFound, redirect } from "next/navigation";

import {
  findHeritageSection,
  sectionQueryPath,
} from "@/lib/heritage/config/structure";
import { getHeritageStructure } from "@/lib/heritage/queries/structure";

/** Legacy section URLs redirect into the same-page workspace. */
export default async function HeritageSectionRedirectPage({
  params,
}: {
  params: Promise<{ slug: string; section: string }>;
}) {
  const { slug, section: sectionKey } = await params;
  const structure = await getHeritageStructure(slug);
  if (!structure) notFound();

  const section = findHeritageSection(structure, sectionKey);
  if (!section) notFound();

  redirect(sectionQueryPath(slug, section.code));
}
