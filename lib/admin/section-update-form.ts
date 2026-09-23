/**
 * Parse FormData for heritage section updates with true PATCH semantics.
 *
 * - field absent → undefined (leave existing DB value unchanged)
 * - groupId present + empty → null (explicit “Sans groupe”)
 * - groupId present + id → move to that group
 * - description present + empty → null (clear description)
 */
export function parseUpdateSectionFormData(form: FormData): {
  title?: string;
  description?: string | null;
  slug?: string;
  kind?: string;
  groupId?: string | null;
  isActive?: boolean;
} {
  const payload: {
    title?: string;
    description?: string | null;
    slug?: string;
    kind?: string;
    groupId?: string | null;
    isActive?: boolean;
  } = {};

  if (form.has("title")) {
    const title = String(form.get("title") ?? "").trim();
    if (title) payload.title = title;
  }

  if (form.has("description")) {
    const description = String(form.get("description") ?? "").trim();
    payload.description = description || null;
  }

  if (form.has("slug")) {
    const slug = String(form.get("slug") ?? "").trim();
    if (slug) payload.slug = slug;
  }

  if (form.has("kind")) {
    const kind = String(form.get("kind") ?? "").trim();
    if (kind) payload.kind = kind;
  }

  if (form.has("groupId")) {
    const groupId = String(form.get("groupId") ?? "").trim();
    payload.groupId = groupId || null;
  }

  if (form.has("isActive")) {
    const raw = form.get("isActive");
    if (raw === "0") payload.isActive = false;
    else if (raw === "1") payload.isActive = true;
  }

  return payload;
}
