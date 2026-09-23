import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import {
  FULL_PROJECT_PERMISSIONS,
  resolveProjectPermissions,
} from "@/lib/access/permissions";
import { AuditActions } from "@/lib/admin/audit";

test("ADMIN full permissions include canDeleteDocuments", () => {
  assert.equal(FULL_PROJECT_PERMISSIONS.canDeleteDocuments, true);
  const perms = resolveProjectPermissions({ id: "a", role: "ADMIN" }, null);
  assert.equal(perms.canDeleteDocuments, true);
});

test("canManageStructure does not grant canDeleteDocuments", () => {
  const perms = resolveProjectPermissions(
    { id: "u", role: "USER" },
    {
      canView: true,
      canUpload: true,
      canDownload: true,
      canDeleteDocuments: false,
      canEditDossier: false,
      canManageStructure: true,
      canReclassifyDocuments: false,
    },
  );
  assert.equal(perms.canManageStructure, true);
  assert.equal(perms.canDeleteDocuments, false);
});

test("DOCUMENT_DELETED audit action is defined", () => {
  assert.equal(AuditActions.DOCUMENT_DELETED, "DOCUMENT_DELETED");
});

test("DELETE files API uses deleteDocumentForUser with authorization", () => {
  const route = readFileSync(
    path.join(process.cwd(), "app/api/files/[id]/route.ts"),
    "utf8",
  );
  assert.match(route, /deleteDocumentForUser/);
  assert.match(route, /authenticate\(request,\s*true\)/);
});

test("deleteDocumentForUser enforces canDeleteDocuments and hard-deletes", () => {
  const source = readFileSync(
    path.join(process.cwd(), "lib/documents/delete-document.ts"),
    "utf8",
  );
  assert.match(source, /assertCanDeleteDocuments/);
  assert.match(source, /deleteObject/);
  assert.match(source, /invalidatePreviewCacheForFile/);
  assert.match(source, /db\.file\.delete/);
  assert.match(source, /DOCUMENT_DELETED/);
  assert.match(source, /Hard-delete/);
});

test("permission matrix exposes Supprimer des documents", () => {
  const source = readFileSync(
    path.join(process.cwd(), "components/admin/permission-matrix.tsx"),
    "utf8",
  );
  assert.match(source, /Supprimer des documents/);
  assert.match(source, /canDeleteDocuments/);
});
