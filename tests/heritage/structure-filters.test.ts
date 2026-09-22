import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STRUCTURE_FILTERS,
  filterHeritageStructure,
  hasActiveStructureFilters,
} from "../../lib/heritage/structure-filters";
import type { HeritageStructure } from "../../lib/heritage/config/structure";
import type { ProjectHeritageSummary } from "../../lib/heritage/queries/section-summaries";

const structure: HeritageStructure = {
  dossierCode: "01",
  title: "Test",
  description: "",
  projectSlug: "test",
  families: [
    {
      title: "COMPRENDRE",
      sections: [
        {
          code: "01.1",
          slug: "presentation",
          name: "Présentation",
          kind: "documentary",
          tracks: ["documents"],
        },
        {
          code: "01.3",
          slug: "protection",
          name: "Protection",
          kind: "documentary",
          tracks: ["documents"],
        },
      ],
    },
    {
      title: "DIAGNOSTIQUER",
      sections: [
        {
          code: "01.10",
          slug: "diagnostic",
          name: "Diagnostic technique",
          kind: "documentary",
          tracks: ["documents"],
        },
      ],
    },
  ],
};

const emptyMetrics = {
  documents: 0,
  photos: 0,
  sequences: 0,
  tours: 0,
  portes: 0,
  babElKasbah: 0,
  observations: 0,
  investigations: 0,
  decisions: 0,
  interventions: 0,
};

const summary: ProjectHeritageSummary = {
  sectionCount: 3,
  totalFiles: 2,
  documentedSections: 1,
  sequenceCount: 0,
  totalBytes: 100,
  lastActivityAt: null,
  sections: {
    "01.1": {
      code: "01.1",
      metrics: emptyMetrics,
      hasContent: false,
      labels: [],
      fileCount: 0,
      subfolderCount: 0,
      totalBytes: 0,
      lastUpdatedAt: null,
      status: "Vide",
    },
    "01.3": {
      code: "01.3",
      metrics: { ...emptyMetrics, documents: 2 },
      hasContent: true,
      labels: ["2 documents"],
      fileCount: 2,
      subfolderCount: 0,
      totalBytes: 100,
      lastUpdatedAt: null,
      status: "Documentée",
    },
    "01.10": {
      code: "01.10",
      metrics: emptyMetrics,
      hasContent: false,
      labels: [],
      fileCount: 0,
      subfolderCount: 0,
      totalBytes: 0,
      lastUpdatedAt: null,
      status: "Vide",
    },
  },
};

test("status and documents filters", () => {
  const documented = filterHeritageStructure(structure, summary, {
    ...DEFAULT_STRUCTURE_FILTERS,
    status: "documented",
  });
  assert.equal(documented.matchCount, 1);
  assert.equal(documented.families[0]?.sections[0]?.code, "01.3");

  const withDocs = filterHeritageStructure(structure, summary, {
    ...DEFAULT_STRUCTURE_FILTERS,
    documents: "with",
  });
  assert.equal(withDocs.matchCount, 1);

  const without = filterHeritageStructure(structure, summary, {
    ...DEFAULT_STRUCTURE_FILTERS,
    documents: "without",
  });
  assert.equal(without.matchCount, 2);
});

test("group filter hides other families", () => {
  const filtered = filterHeritageStructure(structure, summary, {
    ...DEFAULT_STRUCTURE_FILTERS,
    group: "DIAGNOSTIQUER",
  });
  assert.equal(filtered.families.length, 1);
  assert.equal(filtered.families[0]?.title, "DIAGNOSTIQUER");
  assert.equal(filtered.matchCount, 1);
});

test("empty filters are inactive", () => {
  assert.equal(hasActiveStructureFilters(DEFAULT_STRUCTURE_FILTERS), false);
  assert.equal(
    hasActiveStructureFilters({
      ...DEFAULT_STRUCTURE_FILTERS,
      status: "empty",
    }),
    true,
  );
});
