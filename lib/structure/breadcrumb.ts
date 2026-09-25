/**
 * Breadcrumb from actual DB hierarchy.
 * Territoire → Project → Part? → Group → Section → Folders…
 */
export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function buildProjectBreadcrumb(input: {
  territoire?: { code: string; name: string } | null;
  project: { slug: string; name: string };
  part?: { slug: string; name: string } | null;
  group?: { name: string } | null;
  section?: { id: string; name: string; code?: string | null } | null;
  folders?: { id: string; name: string }[];
}): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [];

  if (input.territoire) {
    items.push({
      label: input.territoire.name,
      href: `/territoires/${input.territoire.code}`,
    });
  }

  items.push({
    label: input.project.name,
    href: `/projects/${input.project.slug}`,
  });

  if (input.part) {
    items.push({
      label: input.part.name,
      href: `/projects/${input.project.slug}/parts/${input.part.slug}`,
    });
  }

  if (input.group) {
    items.push({ label: input.group.name });
  }

  if (input.section) {
    items.push({
      label: input.section.name,
      href: `/projects/${input.project.slug}?sectionId=${input.section.id}`,
    });
  }

  const folders = input.folders ?? [];
  folders.forEach((folder, index) => {
    const isLast = index === folders.length - 1 && !input.section;
    items.push({
      label: folder.name,
      href: isLast
        ? undefined
        : `/projects/${input.project.slug}/folders/${folder.id}`,
    });
  });

  return items;
}

/** Immediate parent of the current page, for the sticky "Retour" button. */
export function backFromBreadcrumb(
  items: BreadcrumbItem[],
): { href: string; label: string } | null {
  for (let i = items.length - 2; i >= 0; i--) {
    const item = items[i]!;
    if (item.href) return { href: item.href, label: `Retour à ${item.label}` };
  }
  return null;
}
