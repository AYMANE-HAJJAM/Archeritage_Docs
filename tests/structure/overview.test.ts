import assert from "node:assert/strict";
import test from "node:test";

import { formatPersonName } from "../../lib/users/display-name";
import {
  latestTimestamp,
  rollupFilesByPart,
  rollupFolderSubtrees,
} from "../../lib/structure/overview";

test("formatPersonName uses the configured name, then first and last name, then email", () => {
  assert.equal(
    formatPersonName({
      firstName: "Amina",
      lastName: "Bennani",
      name: "Amina Bennani",
      email: "a@example.com",
    }),
    "Amina Bennani",
  );
  assert.equal(
    formatPersonName({
      firstName: "Admin",
      lastName: "ARCHERITAGE",
      name: "",
      email: "naciri@archeritage.ma",
    }),
    "Admin ARCHERITAGE",
  );
  assert.equal(
    formatPersonName({
      firstName: "Ahmed",
      lastName: "Naciri Taoufik",
      name: "Ahmed Naciri Taoufik",
      email: "naciri@archeritage.ma",
    }),
    "Ahmed Naciri Taoufik",
  );
  assert.equal(
    formatPersonName({ name: "Administrateur", email: "a@example.com" }),
    "Administrateur",
  );
  assert.equal(formatPersonName({ name: "  ", email: "a@example.com" }), "a@example.com");
  assert.equal(formatPersonName(null), "—");
  assert.equal(formatPersonName({}), "—");
});

test("latestTimestamp picks the newest defined date", () => {
  const older = new Date("2026-09-20T00:00:00.000Z");
  const newer = new Date("2026-09-25T12:00:00.000Z");
  assert.equal(
    latestTimestamp([older, null, newer, undefined])?.toISOString(),
    newer.toISOString(),
  );
  assert.equal(latestTimestamp([null, undefined]), null);
});

test("part rollup ignores project-level files", () => {
  const rollup = rollupFilesByPart(
    [
      { sectionId: "global", fileCount: 12, totalBytes: 500 },
      { sectionId: "part-sec", fileCount: 2, totalBytes: 80 },
      { sectionId: "part-sec-2", fileCount: 1, totalBytes: 20 },
    ],
    new Map([
      ["global", null],
      ["part-sec", "part-a"],
      ["part-sec-2", "part-a"],
    ]),
  );
  assert.deepEqual(rollup, {
    "part-a": { fileCount: 3, totalBytes: 100 },
  });
  assert.equal(Object.hasOwn(rollup, "global"), false);
});

test("folder subtree counts include nested files and skip the section root", () => {
  const created = new Date("2026-09-01T00:00:00.000Z");
  const parentUpdated = new Date("2026-09-02T00:00:00.000Z");
  const nestedFile = new Date("2026-09-20T00:00:00.000Z");
  const stats = rollupFolderSubtrees(
    [
      { id: "parent", parentId: null, createdAt: created, updatedAt: parentUpdated },
      { id: "child", parentId: "parent", createdAt: created, updatedAt: created },
    ],
    [
      {
        folderId: null,
        fileCount: 9,
        totalBytes: 900,
        createdAt: nestedFile,
        updatedAt: nestedFile,
      },
      {
        folderId: "child",
        fileCount: 4,
        totalBytes: 40,
        createdAt: nestedFile,
        updatedAt: nestedFile,
      },
    ],
  );
  assert.equal(stats.get("parent")?.fileCount, 4);
  assert.equal(stats.get("parent")?.totalBytes, 40);
  assert.equal(stats.get("parent")?.childFolderCount, 1);
  assert.equal(stats.get("child")?.fileCount, 4);
  assert.equal(
    stats.get("parent")?.lastActivityAt.toISOString(),
    nestedFile.toISOString(),
  );
});
