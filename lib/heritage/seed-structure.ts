/**
 * Bootstrap default heritage structure into DB from structure.ts templates.
 * Idempotent upsert by (projectId, code). Safe to re-run.
 */
import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  CHATEAU_SLUG,
  CHATEAU_STRUCTURE,
  MURAILLES_SLUG,
  MURAILLES_STRUCTURE,
  type HeritageStructure,
} from "@/lib/heritage/config/structure";

function stableId(prefix: string, parts: string[]): string {
  const digest = createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 22);
  return `${prefix}_${digest}`;
}

export async function seedHeritageStructureForProject(
  client: PrismaClient,
  projectSlug: string,
  template: HeritageStructure,
) {
  const project = await client.project.findUnique({ where: { slug: projectSlug } });
  if (!project) {
    console.warn(`Skip structure seed: project ${projectSlug} not found`);
    return;
  }

  let groupOrder = 0;
  let sectionOrder = 0;

  for (const family of template.families) {
    const groupId = stableId("hg", [project.id, family.title]);
    await client.heritageSectionGroup.upsert({
      where: { id: groupId },
      update: { label: family.title, sortOrder: groupOrder },
      create: {
        id: groupId,
        projectId: project.id,
        label: family.title,
        sortOrder: groupOrder,
      },
    });
    groupOrder += 1;

    for (const section of family.sections) {
      await client.heritageSection.upsert({
        where: {
          projectId_code: { projectId: project.id, code: section.code },
        },
        update: {
          groupId,
          slug: section.slug,
          title: section.name,
          kind: section.kind,
          tracks: section.tracks,
          sortOrder: sectionOrder,
        },
        create: {
          id: stableId("hs", [project.id, section.code]),
          projectId: project.id,
          groupId,
          code: section.code,
          slug: section.slug,
          title: section.name,
          kind: section.kind,
          tracks: section.tracks,
          sortOrder: sectionOrder,
          isActive: true,
        },
      });
      sectionOrder += 1;
    }
  }

  console.log(
    `Heritage structure seeded for ${projectSlug}: ${sectionOrder} sections, ${groupOrder} groups`,
  );
}

export async function seedAllDefaultHeritageStructures(client: PrismaClient) {
  await seedHeritageStructureForProject(client, CHATEAU_SLUG, CHATEAU_STRUCTURE);
  await seedHeritageStructureForProject(client, MURAILLES_SLUG, MURAILLES_STRUCTURE);
}
