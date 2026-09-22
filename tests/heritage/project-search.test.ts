import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSearchText } from "../../lib/utils";

test("project search needle matching is accent-insensitive", () => {
  const needle = normalizeSearchText("juridique");
  const haystack = normalizeSearchText(
    "01.3 Protection juridique Bulletin officiel",
  );
  assert.ok(haystack.includes(needle));

  const accentNeedle = normalizeSearchText("presentation");
  const accentHay = normalizeSearchText("Présentation du château");
  assert.ok(accentHay.includes(accentNeedle));
});
