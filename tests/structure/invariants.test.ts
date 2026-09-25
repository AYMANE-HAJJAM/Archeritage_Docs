import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FULL_PROJECT_PERMISSIONS,
  normalizeProjectPermissions,
  resolveProjectPermissions,
} from "../../lib/access/permissions";
import { buildProjectBreadcrumb } from "../../lib/structure/breadcrumb";
import {
  assertFolderMoveAllowed,
  FolderMoveError,
} from "../../lib/structure/folder-invariants";

test("canManageStructure does not imply canDeleteDocuments", () => {
  const perms = resolveProjectPermissions(
    { id: "u", role: "USER" },
    {
      canView: true,
      canUpload: false,
      canDownload: false,
      canDeleteDocuments: false,
      canManageStructure: true,
    },
  );
  assert.equal(perms.canManageStructure, true);
  assert.equal(perms.canDeleteDocuments, false);
});

test("canDeleteDocuments works without canManageStructure", () => {
  const perms = resolveProjectPermissions(
    { id: "u", role: "USER" },
    {
      canView: true,
      canUpload: false,
      canDownload: true,
      canDeleteDocuments: true,
      canManageStructure: false,
    },
  );
  assert.equal(perms.canDeleteDocuments, true);
  assert.equal(perms.canManageStructure, false);
});

test("ADMIN has both structure and delete", () => {
  assert.equal(FULL_PROJECT_PERMISSIONS.canManageStructure, true);
  assert.equal(FULL_PROJECT_PERMISSIONS.canDeleteDocuments, true);
});

test("turning off canView clears all other flags", () => {
  const cleared = normalizeProjectPermissions({
    canView: false,
    canUpload: true,
    canDownload: true,
    canDeleteDocuments: true,
    canManageStructure: true,
  });
  assert.deepEqual(cleared, {
    canView: false,
    canUpload: false,
    canDownload: false,
    canDeleteDocuments: false,
    canManageStructure: false,
  });
});

test("folder cannot parent itself", () => {
  assert.throws(
    () =>
      assertFolderMoveAllowed({
        folderId: "f1",
        newParentId: "f1",
        folderSectionId: "s1",
        descendantIds: [],
      }),
    (err: unknown) => err instanceof FolderMoveError && err.status === 400,
  );
});

test("folder cannot move under a descendant", () => {
  assert.throws(
    () =>
      assertFolderMoveAllowed({
        folderId: "f1",
        newParentId: "f2",
        folderSectionId: "s1",
        parentSectionId: "s1",
        descendantIds: ["f2", "f3"],
      }),
    (err: unknown) => err instanceof FolderMoveError && err.status === 400,
  );
});

test("folder cannot cross section", () => {
  assert.throws(
    () =>
      assertFolderMoveAllowed({
        folderId: "f1",
        newParentId: "f9",
        folderSectionId: "s1",
        parentSectionId: "s2",
        descendantIds: [],
      }),
    (err: unknown) => err instanceof FolderMoveError && err.status === 400,
  );
});

test("valid same-section move is allowed", () => {
  assert.doesNotThrow(() =>
    assertFolderMoveAllowed({
      folderId: "f1",
      newParentId: "f9",
      folderSectionId: "s1",
      parentSectionId: "s1",
      descendantIds: ["f2"],
    }),
  );
});

test("breadcrumb includes territoire → project → part → section → folders", () => {
  const items = buildProjectBreadcrumb({
    territoire: { code: "SAF", name: "Plateforme" },
    project: { slug: "dossier", name: "Dossier" },
    part: { slug: "part-a", name: "Partie A" },
    group: { name: "Groupe" },
    section: { id: "sec1", name: "Rubrique", code: "01.1" },
    folders: [
      { id: "f1", name: "Plans" },
      { id: "f2", name: "Topo" },
    ],
  });
  assert.equal(items[0]?.href, "/territoires/SAF");
  assert.equal(items[1]?.href, "/projects/dossier");
  assert.equal(items[2]?.href, "/projects/dossier/parts/part-a");
  assert.ok(items.some((i) => i.label === "Rubrique"));
  assert.ok(items.some((i) => i.label === "Plans"));
  assert.ok(items.some((i) => i.label === "Topo"));
});
