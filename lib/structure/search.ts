/**
 * Project search — filename, folder, section, part, project names.
 * Returns full logical path. Paginated.
 */
import "server-only";

import { db } from "@/lib/db";
import { canManagePlatform, type AccessUser } from "@/lib/access";

export type SearchHit = {
  type: "file" | "folder" | "section" | "part";
  id: string;
  name: string;
  path: string;
  href: string;
};

export async function searchProject(
  projectSlug: string,
  query: string,
  user: AccessUser,
  options?: { page?: number; pageSize?: number },
): Promise<{ hits: SearchHit[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options?.pageSize ?? 20));
  const q = query.trim();
  if (q.length < 2) {
    return { hits: [], total: 0, page, pageSize };
  }

  const project = await db.project.findUnique({
    where: { slug: projectSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      territoire: { select: { code: true, name: true } },
    },
  });
  if (!project) return { hits: [], total: 0, page, pageSize };

  const isAdmin = canManagePlatform(user);
  const confidentialFilter = isAdmin
    ? {}
    : { confidentialite: { not: "CONFIDENTIEL" as const } };

  const [parts, sections, folders, files] = await Promise.all([
    db.part.findMany({
      where: {
        projectId: project.id,
        isActive: true,
        name: { contains: q, mode: "insensitive" },
      },
      select: { id: true, name: true, slug: true },
      take: pageSize,
    }),
    db.section.findMany({
      where: {
        isActive: true,
        group: { projectId: project.id },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        group: {
          select: {
            name: true,
            part: { select: { name: true, slug: true } },
          },
        },
      },
      take: pageSize,
    }),
    db.folder.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
        section: { group: { projectId: project.id } },
      },
      select: {
        id: true,
        name: true,
        section: {
          select: {
            id: true,
            name: true,
            group: {
              select: {
                name: true,
                part: { select: { name: true, slug: true } },
              },
            },
          },
        },
      },
      take: pageSize,
    }),
    db.file.findMany({
      where: {
        section: { group: { projectId: project.id } },
        ...confidentialFilter,
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { originalName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        displayName: true,
        sectionId: true,
        folderId: true,
        section: {
          select: {
            id: true,
            name: true,
            group: {
              select: {
                name: true,
                part: { select: { name: true, slug: true } },
              },
            },
          },
        },
        folder: { select: { id: true, name: true } },
      },
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const hits: SearchHit[] = [];

  for (const part of parts) {
    hits.push({
      type: "part",
      id: part.id,
      name: part.name,
      path: [project.territoire?.name, project.name, part.name]
        .filter(Boolean)
        .join(" / "),
      href: `/projects/${project.slug}/parts/${part.slug}`,
    });
  }

  for (const section of sections) {
    const partName = section.group.part?.name;
    hits.push({
      type: "section",
      id: section.id,
      name: section.name,
      path: [project.name, partName, section.group.name, section.name]
        .filter(Boolean)
        .join(" / "),
      href: `/projects/${project.slug}?sectionId=${section.id}`,
    });
  }

  for (const folder of folders) {
    const partName = folder.section.group.part?.name;
    hits.push({
      type: "folder",
      id: folder.id,
      name: folder.name,
      path: [
        project.name,
        partName,
        folder.section.group.name,
        folder.section.name,
        folder.name,
      ]
        .filter(Boolean)
        .join(" / "),
      href: `/projects/${project.slug}/folders/${folder.id}`,
    });
  }

  for (const file of files) {
    const partName = file.section.group.part?.name;
    hits.push({
      type: "file",
      id: file.id,
      name: file.displayName,
      path: [
        project.name,
        partName,
        file.section.group.name,
        file.section.name,
        file.folder?.name,
        file.displayName,
      ]
        .filter(Boolean)
        .join(" / "),
      href: `/projects/${project.slug}?sectionId=${file.sectionId}${
        file.folderId ? `&folderId=${file.folderId}` : ""
      }`,
    });
  }

  return {
    hits: hits.slice(0, pageSize),
    total: hits.length,
    page,
    pageSize,
  };
}
