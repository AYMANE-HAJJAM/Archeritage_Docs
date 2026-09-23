import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeFolderStats,
  wouldCreateFolderCycle,
} from "@/lib/heritage/documentary-folder-types";

test("wouldCreateFolderCycle rejects self and descendant parents", () => {
  const folders = [
    { id: "a", parentId: null },
    { id: "b", parentId: "a" },
    { id: "c", parentId: "b" },
    { id: "d", parentId: "a" },
  ];
  assert.equal(wouldCreateFolderCycle("a", "a", folders), true);
  assert.equal(wouldCreateFolderCycle("a", "b", folders), true);
  assert.equal(wouldCreateFolderCycle("a", "c", folders), true);
  assert.equal(wouldCreateFolderCycle("b", "c", folders), true);
  assert.equal(wouldCreateFolderCycle("c", "d", folders), false);
  assert.equal(wouldCreateFolderCycle("c", null, folders), false);
  assert.equal(wouldCreateFolderCycle("d", "b", folders), false);
});

test("computeFolderStats aggregates recursive documents and direct children", () => {
  const folders = [
    { id: "root", parentId: null },
    { id: "child", parentId: "root" },
    { id: "grand", parentId: "child" },
    { id: "sib", parentId: "root" },
  ];
  const now = new Date("2026-01-15T00:00:00.000Z");
  const earlier = new Date("2026-01-10T00:00:00.000Z");
  const files = [
    {
      folderId: "root",
      size: 100,
      updatedAt: earlier,
      createdAt: earlier,
    },
    {
      folderId: "grand",
      size: 250,
      updatedAt: now,
      createdAt: earlier,
    },
    {
      folderId: "sib",
      size: 50,
      updatedAt: earlier,
      createdAt: earlier,
    },
  ];

  const root = computeFolderStats("root", folders, files);
  assert.equal(root.childFolderCount, 2);
  assert.equal(root.documentCount, 3);
  assert.equal(root.totalBytes, 400);
  assert.equal(root.lastActivityAt, now.toISOString());

  const child = computeFolderStats("child", folders, files);
  assert.equal(child.childFolderCount, 1);
  assert.equal(child.documentCount, 1);
  assert.equal(child.totalBytes, 250);

  const grand = computeFolderStats("grand", folders, files);
  assert.equal(grand.childFolderCount, 0);
  assert.equal(grand.documentCount, 1);
  assert.equal(grand.totalBytes, 250);
});

test("legacy folders without heritageSectionId are distinct from documentary trees", () => {
  // Documentary folders are keyed by heritageSectionId; legacy rows stay null.
  // Cycle helper only operates on the graph passed in — legacy trees must not
  // be mixed into section graphs by callers.
  const documentary = [
    { id: "pres", parentId: null },
    { id: "gov", parentId: "pres" },
    { id: "t9", parentId: "gov" },
    { id: "y2026", parentId: "t9" },
  ];
  assert.equal(wouldCreateFolderCycle("pres", "y2026", documentary), true);
  assert.equal(wouldCreateFolderCycle("y2026", "pres", documentary), false);

  const deep = computeFolderStats("pres", documentary, [
    {
      folderId: "y2026",
      size: 1024,
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    },
  ]);
  assert.equal(deep.childFolderCount, 1);
  assert.equal(deep.documentCount, 1);
  assert.equal(deep.totalBytes, 1024);
});

test("4+ level nesting graph remains acyclic for valid sibling moves", () => {
  const folders = [
    { id: "1", parentId: null },
    { id: "2", parentId: "1" },
    { id: "3", parentId: "2" },
    { id: "4", parentId: "3" },
    { id: "5", parentId: "4" },
    { id: "alt", parentId: "1" },
  ];
  assert.equal(wouldCreateFolderCycle("5", "alt", folders), false);
  assert.equal(wouldCreateFolderCycle("2", "5", folders), true);
  assert.equal(wouldCreateFolderCycle("alt", "5", folders), false);
});
