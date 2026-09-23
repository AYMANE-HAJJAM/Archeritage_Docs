import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canHardDeleteGroup,
  canHardDeleteSection,
  describeSectionLinkedContent,
  type SectionLinkCounts,
} from "../../lib/admin/section-linked-content";
import { resolveProjectPermissions } from "../../lib/access/permissions";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const emptyCounts = (): SectionLinkCounts => ({
  documentCount: 0,
  sequenceCount: 0,
  sequenceFileCount: 0,
  elementCount: 0,
  gateCount: 0,
  observationCount: 0,
  investigationCount: 0,
  decisionCount: 0,
  interventionCount: 0,
});

test("empty documentary section can be hard-deleted", () => {
  const section = {
    code: "02.1",
    kind: "documentary",
    tracks: ["documents"],
  };
  assert.equal(canHardDeleteSection(section, emptyCounts()), true);
  assert.equal(describeSectionLinkedContent(section, emptyCounts()), null);
});

test("section with classified documents cannot be hard-deleted", () => {
  const section = {
    code: "02.1",
    kind: "documentary",
    tracks: ["documents"],
  };
  const counts = { ...emptyCounts(), documentCount: 3 };
  assert.equal(canHardDeleteSection(section, counts), false);
  assert.match(
    describeSectionLinkedContent(section, counts) ?? "",
    /3 document/,
  );
});

test("sequence-kind section blocked when project has sequences", () => {
  const section = {
    code: "01.10",
    kind: "sequences",
    tracks: ["sequences"],
  };
  const counts = { ...emptyCounts(), sequenceCount: 2 };
  assert.equal(canHardDeleteSection(section, counts), false);
  assert.match(
    describeSectionLinkedContent(section, counts) ?? "",
    /séquences/,
  );
});

test("observation track blocked when observations exist", () => {
  const section = {
    code: "01.12",
    kind: "structured",
    tracks: ["observations"],
  };
  const counts = { ...emptyCounts(), observationCount: 4 };
  assert.equal(canHardDeleteSection(section, counts), false);
  assert.match(
    describeSectionLinkedContent(section, counts) ?? "",
    /4 observation/,
  );
});

test("element / gate / sequence-file content blocks sequence sections", () => {
  const section = {
    code: "01.10",
    kind: "sequences",
    tracks: ["sequences"],
  };
  assert.equal(
    canHardDeleteSection(section, {
      ...emptyCounts(),
      sequenceFileCount: 1,
    }),
    false,
  );
  assert.equal(
    canHardDeleteSection(section, {
      ...emptyCounts(),
      elementCount: 2,
    }),
    false,
  );
  assert.equal(
    canHardDeleteSection(section, {
      ...emptyCounts(),
      gateCount: 1,
    }),
    false,
  );
});

test("empty group can be hard-deleted; group with sections cannot", () => {
  assert.equal(canHardDeleteGroup(0), true);
  assert.equal(canHardDeleteGroup(3), false);
});

test("USER with canManageStructure resolves structure permission", () => {
  const allowed = resolveProjectPermissions(
    { id: "u", role: "USER" },
    {
      canView: true,
      canUpload: false,
      canDownload: false,
      canEditDossier: false,
      canManageStructure: true,
      canReclassifyDocuments: false,
    },
  );
  const denied = resolveProjectPermissions(
    { id: "u", role: "USER" },
    {
      canView: true,
      canUpload: false,
      canDownload: false,
      canEditDossier: false,
      canManageStructure: false,
      canReclassifyDocuments: false,
    },
  );
  assert.equal(allowed.canManageStructure, true);
  assert.equal(denied.canManageStructure, false);
});

test("ADMIN always has canManageStructure", () => {
  const perms = resolveProjectPermissions({ id: "a", role: "ADMIN" }, null);
  assert.equal(perms.canManageStructure, true);
});

test("structure mutations gate through assertCanManageStructure", () => {
  const actions = readFileSync(
    join(process.cwd(), "app/(private)/manage/actions.ts"),
    "utf8",
  );
  assert.match(actions, /requireStructureEditor/);
  assert.match(actions, /assertCanManageStructure/);
  assert.match(actions, /deleteSectionAction/);
  assert.match(actions, /deleteGroupAction/);
  assert.match(actions, /createSectionAction/);
  assert.match(actions, /reorderSectionsAction/);
});

test("structure edit UI is gated by canManageStructure", () => {
  const workspace = readFileSync(
    join(process.cwd(), "components/heritage/heritage-workspace.tsx"),
    "utf8",
  );
  assert.match(
    workspace,
    /editMode && permissions\.canManageStructure && structureEdit/,
  );
});

test("row trash control exposes French accessible label", () => {
  const control = readFileSync(
    join(process.cwd(), "components/manage/section-remove-control.tsx"),
    "utf8",
  );
  assert.match(control, /aria-label="Supprimer la rubrique"/);
  assert.match(control, /Désactiver la rubrique/);
  assert.match(control, /deleteSectionAction/);
  assert.match(control, /updateSectionAction/);
});
