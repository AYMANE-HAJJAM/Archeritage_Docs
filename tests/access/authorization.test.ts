import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { canManagePlatform } from "../../lib/access/roles";
import {
  EMPTY_PROJECT_PERMISSIONS,
  FULL_PROJECT_PERMISSIONS,
  normalizeProjectPermissions,
  resolveCanCreateDossier,
  resolveProjectPermissions,
} from "../../lib/access/permissions";
import { createUserSchema, updateUserSchema, createSectionSchema } from "../../lib/admin/schemas";
import { hashInvitationToken, buildInvitationUrl } from "../../lib/admin/invite-token";
import { generateNextSectionCode } from "../../lib/admin/identifiers";
import {
  CHATEAU_STRUCTURE,
  MURAILLES_STRUCTURE,
  allHeritageSections,
} from "../../lib/heritage/config/structure";
import { applyFlagChange } from "../../components/admin/permission-matrix";

test("canManagePlatform is ADMIN-only", () => {
  assert.equal(canManagePlatform({ id: "1", role: "ADMIN" }), true);
  assert.equal(canManagePlatform({ id: "2", role: "USER" }), false);
});

test("ADMIN always resolves to full project permissions including download", () => {
  const perms = resolveProjectPermissions({ id: "a", role: "ADMIN" }, null);
  assert.deepEqual(perms, FULL_PROJECT_PERMISSIONS);
  assert.equal(perms.canDownload, true);
});

test("USER without membership has no project permissions", () => {
  const perms = resolveProjectPermissions({ id: "u", role: "USER" }, null);
  assert.deepEqual(perms, EMPTY_PROJECT_PERMISSIONS);
});

test("USER view-only: preview allowed, upload/download/structure denied", () => {
  const perms = resolveProjectPermissions(
    { id: "u", role: "USER" },
    {
      canView: true,
      canUpload: false,
      canDownload: false,
      canDeleteDocuments: false,
      canEditDossier: false,
      canManageStructure: false,
      canReclassifyDocuments: false,
    },
  );
  assert.equal(perms.canView, true);
  assert.equal(perms.canUpload, false);
  assert.equal(perms.canDownload, false);
  assert.equal(perms.canDeleteDocuments, false);
  assert.equal(perms.canManageStructure, false);
});

test("USER download allowed only with canDownload", () => {
  const denied = resolveProjectPermissions(
    { id: "u", role: "USER" },
    {
      canView: true,
      canUpload: false,
      canDownload: false,
      canDeleteDocuments: false,
      canEditDossier: false,
      canManageStructure: false,
      canReclassifyDocuments: false,
    },
  );
  const allowed = resolveProjectPermissions(
    { id: "u", role: "USER" },
    {
      canView: true,
      canUpload: false,
      canDownload: true,
      canDeleteDocuments: false,
      canEditDossier: false,
      canManageStructure: false,
      canReclassifyDocuments: false,
    },
  );
  assert.equal(denied.canDownload, false);
  assert.equal(allowed.canDownload, true);
});

test("USER upload allowed only with canUpload", () => {
  const denied = resolveProjectPermissions(
    { id: "u", role: "USER" },
    {
      canView: true,
      canUpload: false,
      canDownload: true,
      canDeleteDocuments: false,
      canEditDossier: false,
      canManageStructure: false,
      canReclassifyDocuments: false,
    },
  );
  const allowed = resolveProjectPermissions(
    { id: "u", role: "USER" },
    {
      canView: true,
      canUpload: true,
      canDownload: true,
      canDeleteDocuments: false,
      canEditDossier: false,
      canManageStructure: false,
      canReclassifyDocuments: false,
    },
  );
  assert.equal(denied.canUpload, false);
  assert.equal(allowed.canUpload, true);
});

test("USER manage structure allowed only with canManageStructure", () => {
  const denied = resolveProjectPermissions(
    { id: "u", role: "USER" },
    {
      canView: true,
      canUpload: true,
      canDownload: true,
      canDeleteDocuments: false,
      canEditDossier: false,
      canManageStructure: false,
      canReclassifyDocuments: false,
    },
  );
  const allowed = resolveProjectPermissions(
    { id: "u", role: "USER" },
    {
      canView: true,
      canUpload: false,
      canDownload: false,
      canDeleteDocuments: false,
      canEditDossier: false,
      canManageStructure: true,
      canReclassifyDocuments: false,
    },
  );
  assert.equal(denied.canManageStructure, false);
  assert.equal(allowed.canManageStructure, true);
});

test("USER delete documents allowed only with canDeleteDocuments", () => {
  const denied = resolveProjectPermissions(
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
  const allowed = resolveProjectPermissions(
    { id: "u", role: "USER" },
    {
      canView: true,
      canUpload: false,
      canDownload: false,
      canDeleteDocuments: true,
      canEditDossier: false,
      canManageStructure: false,
      canReclassifyDocuments: false,
    },
  );
  assert.equal(denied.canDeleteDocuments, false);
  assert.equal(allowed.canDeleteDocuments, true);
  // Structure management must not imply deletion.
  assert.equal(denied.canManageStructure, true);
});

test("ADMIN always has canDeleteDocuments", () => {
  const perms = resolveProjectPermissions({ id: "a", role: "ADMIN" }, null);
  assert.equal(perms.canDeleteDocuments, true);
});

test("normalize clears dependent flags when view is false", () => {
  const normalized = normalizeProjectPermissions({
    canView: false,
    canUpload: true,
    canDownload: true,
    canDeleteDocuments: true,
    canEditDossier: true,
    canManageStructure: true,
    canReclassifyDocuments: true,
  });
  assert.deepEqual(normalized, EMPTY_PROJECT_PERMISSIONS);
});

test("UI flag rules: unchecking Voir clears dependents", () => {
  const next = applyFlagChange(
    {
      canView: true,
      canUpload: true,
      canDownload: true,
      canDeleteDocuments: true,
      canManageStructure: true,
    },
    "canView",
    false,
  );
  assert.equal(next.canView, false);
  assert.equal(next.canUpload, false);
  assert.equal(next.canDownload, false);
  assert.equal(next.canDeleteDocuments, false);
  assert.equal(next.canManageStructure, false);
});

test("UI flag rules: checking Importer forces Voir", () => {
  const next = applyFlagChange(
    {
      canView: false,
      canUpload: false,
      canDownload: false,
      canDeleteDocuments: false,
      canManageStructure: false,
    },
    "canUpload",
    true,
  );
  assert.equal(next.canView, true);
  assert.equal(next.canUpload, true);
});

test("UI flag rules: checking Supprimer des documents forces Voir", () => {
  const next = applyFlagChange(
    {
      canView: false,
      canUpload: false,
      canDownload: false,
      canDeleteDocuments: false,
      canManageStructure: false,
    },
    "canDeleteDocuments",
    true,
  );
  assert.equal(next.canView, true);
  assert.equal(next.canDeleteDocuments, true);
});

test("canCreateDossier is ADMIN-only (USER membership ignored)", () => {
  assert.equal(
    resolveCanCreateDossier({ id: "u", role: "USER" }, null),
    false,
  );
  assert.equal(
    resolveCanCreateDossier(
      { id: "u", role: "USER" },
      { canCreateDossier: true },
    ),
    false,
  );
  assert.equal(
    resolveCanCreateDossier({ id: "a", role: "ADMIN" }, null),
    true,
  );
  assert.equal(
    resolveCanCreateDossier(
      { id: "a", role: "ADMIN" },
      { canCreateDossier: false },
    ),
    true,
  );
});

test("inaccessible dossier: canView false means no access", () => {
  const perms = resolveProjectPermissions(
    { id: "u", role: "USER" },
    {
      canView: false,
      canUpload: true,
      canDownload: true,
      canDeleteDocuments: true,
      canEditDossier: false,
      canManageStructure: false,
      canReclassifyDocuments: false,
    },
  );
  assert.equal(perms.canView, false);
  assert.equal(perms.canUpload, false);
  assert.equal(perms.canDownload, false);
  assert.equal(perms.canDeleteDocuments, false);
});

test("invitation token is hashed (never store plaintext)", () => {
  const raw = randomBytes(32).toString("hex");
  const hashed = hashInvitationToken(raw);
  assert.equal(hashed.length, 64);
  assert.notEqual(hashed, raw);
  assert.equal(hashed, createHash("sha256").update(raw).digest("hex"));
  const url = buildInvitationUrl(raw);
  assert.match(url, /\/activate\?token=/);
  assert.ok(!url.includes(hashed));
});

test("createUserSchema normalizes email and defaults role USER", () => {
  const parsed = createUserSchema.parse({
    firstName: "Amina",
    lastName: "Benali",
    email: "Amina@Example.COM",
  });
  assert.equal(parsed.email, "amina@example.com");
  assert.equal(parsed.role, "USER");
});

test("updateUserSchema rejects invalid role", () => {
  assert.throws(() =>
    updateUserSchema.parse({
      firstName: "A",
      lastName: "B",
      email: "a@b.com",
      role: "MOE",
    }),
  );
});

test("createSectionSchema allows omitted code (auto-allocate)", () => {
  const ok = createSectionSchema.parse({
    title: "Nouvelle rubrique",
  });
  assert.equal(ok.code, undefined);
});

test("section code generation keeps existing codes stable", () => {
  assert.equal(generateNextSectionCode(["01.1", "01.18"], "01"), "01.19");
  assert.equal(generateNextSectionCode(["02.1", "02.20"], "02"), "02.21");
});

test("default templates still cover official Safi sections", () => {
  assert.equal(allHeritageSections(CHATEAU_STRUCTURE).length, 18);
  assert.equal(allHeritageSections(MURAILLES_STRUCTURE).length, 20);
});
