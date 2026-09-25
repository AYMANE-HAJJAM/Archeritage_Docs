import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCloudinaryFolderPath,
  buildDocumentStoragePath,
} from "../../lib/storage/path-builder";

test("buildDocumentStoragePath mirrors hierarchy and sanitizes", () => {
  const key = buildDocumentStoragePath({
    territoireCode: "TER 01",
    projectSlug: "dossier-exemple",
    partSlug: "tranche-ix",
    sectionSegment: "releves",
    folderNames: ["Plans topo", "../evil"],
    originalFilename: "Relevé tranche IX-Objet.pdf",
    fileId: "file123",
  });
  assert.match(key, /^ter-01\/dossier-exemple\/tranche-ix\/releves\//);
  assert.ok(!key.includes(".."));
  assert.ok(key.includes("file123-"));
  assert.ok(key.endsWith(".pdf"));
});

test("buildCloudinaryFolderPath has no filename", () => {
  const folder = buildCloudinaryFolderPath({
    territoireCode: "TER",
    projectSlug: "dossier-exemple",
    partSlug: "facade-maritime",
    sectionSegment: "documentation-photographique",
    folderNames: ["Vues extérieures"],
  });
  assert.equal(
    folder,
    "ter/dossier-exemple/facade-maritime/documentation-photographique/vues-exterieures",
  );
});

test("rejects absolute-looking injection via segment sanitize", () => {
  const key = buildDocumentStoragePath({
    territoireCode: "TER",
    projectSlug: "dossier",
    sectionSegment: "../..",
    originalFilename: "ok.jpg",
    fileId: "x",
  });
  assert.ok(!key.startsWith("/"));
  assert.ok(!key.includes("\\"));
  assert.ok(!key.includes(".."));
});
