import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHATEAU_SLUG,
  CHATEAU_STRUCTURE,
  MURAILLES_SLUG,
  MURAILLES_STRUCTURE,
  SAFI_PROJECTS,
  allHeritageSections,
  findHeritageSection,
} from "../../lib/heritage/config/structure";
import {
  officialSectionCodesFromDefaults,
  validateDocumentCategory,
  validateProjectSectionCategoryAgainstDefaults,
} from "../../lib/heritage/config/validate-category";
import { assertCertainClassificationsMatchStructure } from "../../lib/heritage/classification";
import {
  isActiveDocumentScope,
  isDocumentScopeValue,
} from "../../lib/heritage/types/document-scope";
import { resolvePlacement } from "../../lib/heritage/document-placement";

test("Château official sections are 01.1 through 01.18", () => {
  const codes = officialSectionCodesFromDefaults(CHATEAU_SLUG);
  assert.equal(codes.length, 18);
  assert.deepEqual(
    codes,
    Array.from({ length: 18 }, (_, i) => `01.${i + 1}`),
  );
  assert.equal(allHeritageSections(CHATEAU_STRUCTURE).length, 18);
});

test("Murailles official sections are 02.1 through 02.20", () => {
  const codes = officialSectionCodesFromDefaults(MURAILLES_SLUG);
  assert.equal(codes.length, 20);
  assert.deepEqual(
    codes,
    Array.from({ length: 20 }, (_, i) => `02.${i + 1}`),
  );
  assert.equal(allHeritageSections(MURAILLES_STRUCTURE).length, 20);
});

test("Safi landing exposes only Château and Murailles", () => {
  assert.equal(SAFI_PROJECTS.length, 2);
  assert.deepEqual(
    SAFI_PROJECTS.map((p) => p.projectSlug),
    [CHATEAU_SLUG, MURAILLES_SLUG],
  );
});

test("findHeritageSection resolves by code and slug", () => {
  const byCode = findHeritageSection(MURAILLES_STRUCTURE, "02.12");
  assert.equal(byCode?.name, "Pathologies");
  const bySlug = findHeritageSection(MURAILLES_STRUCTURE, "pathologies");
  assert.equal(bySlug?.code, "02.12");
});

test("invalid project section is rejected (defaults)", () => {
  const bad = validateProjectSectionCategoryAgainstDefaults(CHATEAU_SLUG, "01.99");
  assert.equal(bad.ok, false);
  const wrongProject = validateProjectSectionCategoryAgainstDefaults(CHATEAU_SLUG, "02.12");
  assert.equal(wrongProject.ok, false);
  const goodDefault = validateProjectSectionCategoryAgainstDefaults(CHATEAU_SLUG, "01.3");
  assert.equal(goodDefault.ok, true);
  if (goodDefault.ok) assert.equal(goodDefault.label, "Protection juridique");
});

test("TERRITORY and SHARED_RESOURCE are rejected by active validation", async () => {
  assert.equal(isActiveDocumentScope("PROJECT_SECTION"), true);
  assert.equal(isActiveDocumentScope("TERRITORY"), false);
  assert.equal(isActiveDocumentScope("SHARED_RESOURCE"), false);
  // Scope gate rejects without needing DB-backed section lookup
  const territory = await validateDocumentCategory("TERRITORY", "medina-territoire");
  assert.equal(territory.ok, false);
  const shared = await validateDocumentCategory("SHARED_RESOURCE", "cps-bde-dqe");
  assert.equal(shared.ok, false);
});

test("legacy Prisma enum values remain recognizable but inactive", () => {
  assert.equal(isDocumentScopeValue("TERRITORY"), true);
  assert.equal(isDocumentScopeValue("SHARED_RESOURCE"), true);
});

test("placement labels heritage vs document projet", () => {
  const heritage = resolvePlacement("PROJECT_SECTION", "01.10", "01.10 Falaise");
  assert.equal(heritage.group, "heritage");
  assert.equal(heritage.label, "01.10 Falaise");
  const projectDoc = resolvePlacement(null, null);
  assert.equal(projectDoc.group, "project");
  assert.equal(projectDoc.label, "Document projet");
});

test("CERTAIN classification plan stays aligned with structure.ts", () => {
  assertCertainClassificationsMatchStructure();
});
