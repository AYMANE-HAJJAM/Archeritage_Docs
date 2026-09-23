import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { parseUpdateSectionFormData } from "../../lib/admin/section-update-form";

/** Mirrors updateSectionSchema groupId / optional field rules (no server-only import). */
const patchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  groupId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

function formFrom(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    form.set(key, value);
  }
  return form;
}

/** Same spread used by updateSection — only defined keys become Prisma writes. */
function prismaPatchFrom(
  data: z.infer<typeof patchSchema>,
): Record<string, unknown> {
  return {
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined
      ? { description: data.description }
      : {}),
    ...(data.groupId !== undefined ? { groupId: data.groupId } : {}),
    ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
  };
}

test("A. title-only edit keeps group (Comprendre) — no groupId write", () => {
  const parsed = parseUpdateSectionFormData(
    formFrom({ title: "Histoire et documentaire" }),
  );
  assert.equal(parsed.title, "Histoire et documentaire");
  assert.equal("groupId" in parsed, false);

  const schema = patchSchema.parse(parsed);
  const write = prismaPatchFrom(schema);
  assert.deepEqual(write, { title: "Histoire et documentaire" });
  assert.equal("groupId" in write, false);
});

test("B. description-only edit leaves group unchanged", () => {
  const parsed = parseUpdateSectionFormData(
    formFrom({ description: "Nouvelle intro" }),
  );
  const write = prismaPatchFrom(patchSchema.parse(parsed));
  assert.deepEqual(write, { description: "Nouvelle intro" });
  assert.equal("groupId" in write, false);
});

test("C. visibility-only edit leaves group unchanged", () => {
  const parsed = parseUpdateSectionFormData(formFrom({ isActive: "0" }));
  const write = prismaPatchFrom(patchSchema.parse(parsed));
  assert.deepEqual(write, { isActive: false });
  assert.equal("groupId" in write, false);
});

test("D. explicit group change moves section", () => {
  const parsed = parseUpdateSectionFormData(
    formFrom({ groupId: "group-comprendre" }),
  );
  const write = prismaPatchFrom(patchSchema.parse(parsed));
  assert.deepEqual(write, { groupId: "group-comprendre" });
});

test("E. explicit Sans groupe sets groupId null (Autres)", () => {
  const parsed = parseUpdateSectionFormData(formFrom({ groupId: "" }));
  assert.equal(parsed.groupId, null);
  const write = prismaPatchFrom(patchSchema.parse(parsed));
  assert.deepEqual(write, { groupId: null });
});

test("F. title-only edit does not change order fields", () => {
  const parsed = parseUpdateSectionFormData(
    formFrom({
      title: "Histoire et documentaire",
      description: "Keep description",
      groupId: "group-comprendre",
    }),
  );
  const write = prismaPatchFrom(patchSchema.parse(parsed));
  assert.equal(write.title, "Histoire et documentaire");
  assert.equal(write.groupId, "group-comprendre");
  assert.equal("sortOrder" in write, false);
});

test("regression: old form.get(groupId)||null would false-clear group", () => {
  // Previous action used: groupId: form.get("groupId") || null
  // When the field is omitted, get() returns null → coerced to null write.
  function legacyCoerce(form: FormData): string | null {
    return (form.get("groupId") as string | null) || null;
  }
  assert.equal(legacyCoerce(formFrom({ title: "x" })), null);

  const fixed = parseUpdateSectionFormData(
    formFrom({ title: "Histoire et documentaire" }),
  );
  assert.equal("groupId" in fixed, false);
  assert.equal(fixed.groupId, undefined);
});
