import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { importPlan } from "../../lib/documents/import-plan";

test("import plan metadata covers both Safi projects without review leftovers", () => {
  assert.equal(importPlan.length, 35);
  assert.equal(importPlan.filter((item) => item.project === "chateau-de-mer").length, 15);
  assert.equal(importPlan.filter((item) => item.project === "muraille-portugaise").length, 20);
  assert.equal(importPlan.filter((item) => item.review).length, 0);
  for (const item of importPlan) {
    assert.ok(item.relativePath.length > 0);
    assert.ok(item.displayName.length > 0);
  }
});

test("optional: source_import corpus hashes match the documented duplicate count", async (t) => {
  const sample = join(
    "source_import",
    importPlan[0].project,
    ...importPlan[0].relativePath.split("/"),
  );
  try {
    await access(sample);
  } catch {
    t.skip("source_import/ not present — local ops corpus only (gitignored)");
    return;
  }

  const hashes = await Promise.all(
    importPlan.map(async (item) =>
      createHash("sha256")
        .update(
          await readFile(
            join("source_import", item.project, ...item.relativePath.split("/")),
          ),
        )
        .digest("hex"),
    ),
  );
  const occurrences = new Map<string, number>();
  for (const hash of hashes) {
    occurrences.set(hash, (occurrences.get(hash) ?? 0) + 1);
  }
  assert.equal(
    [...occurrences.values()].reduce(
      (copies, count) => copies + Math.max(0, count - 1),
      0,
    ),
    3,
  );
  assert.equal(new Set(hashes).size, 32);
});
