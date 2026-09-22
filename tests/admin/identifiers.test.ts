import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  allocateUnique,
  allocateUniqueCode,
  extractSectionPrefixes,
  generateNextSectionCode,
  generateSlug,
  proposeDossierCode,
  proposeProjectCode,
} from "../../lib/admin/identifiers";

describe("generateSlug", () => {
  it("strips accents and hyphenates", () => {
    assert.equal(generateSlug("Essaouira Patrimoine"), "essaouira-patrimoine");
    assert.equal(generateSlug("Château de Mer"), "chateau-de-mer");
    assert.equal(generateSlug("Murailles portugaises de Safi"), "murailles-portugaises-de-safi");
  });

  it("falls back for empty input", () => {
    assert.equal(generateSlug("!!!"), "item");
  });
});

describe("proposeProjectCode", () => {
  it("uses first significant word", () => {
    assert.equal(proposeProjectCode("Safi Patrimoine"), "SAF");
    assert.equal(proposeProjectCode("Essaouira Patrimoine"), "ESS");
    assert.equal(proposeProjectCode("Marrakech Patrimoine"), "MAR");
  });
});

describe("proposeDossierCode", () => {
  it("builds initials or short codes", () => {
    assert.equal(proposeDossierCode("Château de Mer"), "CDM");
    assert.equal(proposeDossierCode("Murailles"), "MUR");
    assert.equal(proposeDossierCode("Dar Soltane"), "DS");
    assert.equal(proposeDossierCode("Kasbah"), "KAS");
  });
});

describe("generateNextSectionCode", () => {
  it("increments after max without renumbering gaps", () => {
    assert.equal(
      generateNextSectionCode(["01.1", "01.2", "01.18"], "01"),
      "01.19",
    );
    assert.equal(
      generateNextSectionCode(["02.1", "02.20"], "02"),
      "02.21",
    );
  });

  it("starts at .1 when empty", () => {
    assert.equal(generateNextSectionCode([], "03"), "03.1");
  });

  it("skips collisions if max+1 somehow taken", () => {
    assert.equal(
      generateNextSectionCode(["01.1", "01.3"], "01"),
      "01.4",
    );
  });

  it("preserves existing codes (stability)", () => {
    const existing = ["01.1", "01.2", "01.18"];
    const next = generateNextSectionCode(existing, "01");
    assert.ok(!existing.includes(next));
    assert.deepEqual(existing, ["01.1", "01.2", "01.18"]);
  });
});

describe("extractSectionPrefixes", () => {
  it("reads dossier prefixes from codes", () => {
    assert.deepEqual(extractSectionPrefixes(["01.1", "01.18", "02.5"]), [
      "01",
      "02",
    ]);
  });
});

describe("allocateUnique", () => {
  it("appends suffix on slug collision", async () => {
    const taken = new Set(["essaouira-patrimoine"]);
    const slug = await allocateUnique("essaouira-patrimoine", async (c) =>
      taken.has(c),
    );
    assert.equal(slug, "essaouira-patrimoine-2");
  });
});

describe("allocateUniqueCode", () => {
  it("appends numeric suffix on code collision", async () => {
    const taken = new Set(["ESS", "ESS2"]);
    const code = await allocateUniqueCode("ESS", async (c) => taken.has(c));
    assert.equal(code, "ESS3");
  });
});
