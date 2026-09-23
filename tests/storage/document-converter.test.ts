import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  isConvertibleOfficeDocument,
  convertOfficeToPdf,
  findSofficeBinary,
  isLibreOfficeAvailable,
  resetSofficeBinaryCache,
  SUPPORTED_OFFICE_EXTENSIONS,
} from "../../lib/documents/converter";
import { computePreviewCacheKey } from "../../lib/storage/preview-cache";

test("isConvertibleOfficeDocument recognizes supported office formats", () => {
  for (const ext of [
    "docx",
    "doc",
    "xlsx",
    "xls",
    "pptx",
    "ppt",
    "odt",
    "ods",
    "odp",
    "rtf",
  ]) {
    assert.equal(isConvertibleOfficeDocument(ext), true, ext);
    assert.equal(isConvertibleOfficeDocument(ext.toUpperCase()), true, ext);
    assert.equal(isConvertibleOfficeDocument(`.${ext}`), true, `.${ext}`);
  }

  assert.equal(isConvertibleOfficeDocument("pdf"), false);
  assert.equal(isConvertibleOfficeDocument("png"), false);
  assert.equal(isConvertibleOfficeDocument("exe"), false);
  assert.equal(isConvertibleOfficeDocument("zip"), false);
});

test("SUPPORTED_OFFICE_EXTENSIONS includes Word/Excel/PowerPoint", () => {
  for (const ext of ["docx", "doc", "xlsx", "xls", "pptx", "ppt"]) {
    assert.ok(SUPPORTED_OFFICE_EXTENSIONS.has(ext), ext);
  }
});

test("computePreviewCacheKey is deterministic and sensitive to file changes", () => {
  const fileA = {
    id: "file_123",
    sourceHash: "abc123hash",
    storageKey: "archeritage/key1",
    storageVersion: "v1",
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };

  const key1 = computePreviewCacheKey(fileA);
  const key2 = computePreviewCacheKey(fileA);
  assert.equal(key1, key2);
  assert.equal(key1.length, 64);

  const fileB = {
    ...fileA,
    sourceHash: "differentHash",
  };
  const key3 = computePreviewCacheKey(fileB);
  assert.notEqual(key1, key3);
});

test("findSofficeBinary returns an existing path or null (never a bare command)", () => {
  resetSofficeBinaryCache();
  const resolved = findSofficeBinary();
  if (resolved === null) {
    assert.equal(isLibreOfficeAvailable(), false);
    return;
  }
  assert.ok(path.isAbsolute(resolved) || resolved.includes(path.sep));
  assert.equal(isLibreOfficeAvailable(), true);
});

test("convertOfficeToPdf converts real DOCX when LibreOffice is available", async (t) => {
  resetSofficeBinaryCache();
  if (!isLibreOfficeAvailable()) {
    t.skip("LibreOffice not installed on this machine");
    return;
  }

  const docxPath = path.join(
    process.cwd(),
    "tests",
    "fixtures",
    "office",
    "sample.docx",
  );

  let docxBuffer: Buffer;
  try {
    docxBuffer = await fs.readFile(docxPath);
  } catch {
    t.skip(`Sample DOCX not found at ${docxPath}`);
    return;
  }

  assert.ok(docxBuffer.length > 0);

  const pdfBuffer = await convertOfficeToPdf(docxBuffer, "docx");
  assert.ok(pdfBuffer.length > 1000);
  assert.equal(pdfBuffer.subarray(0, 5).toString("utf8"), "%PDF-");
});

test("convertOfficeToPdf rejects unsupported formats", async () => {
  const fakeBuffer = Buffer.from("test");
  await assert.rejects(async () => {
    await convertOfficeToPdf(fakeBuffer, "exe");
  }, /Format de document non convertible/);
});

test("convertOfficeToPdf rejects invalid DOCX ZIP containers", async () => {
  await assert.rejects(async () => {
    await convertOfficeToPdf(Buffer.from("not-a-zip"), "docx");
  }, /ZIP valide|archive ZIP/);
});

test("convertOfficeToPdf fails clearly when LibreOffice is missing", async (t) => {
  resetSofficeBinaryCache();
  if (isLibreOfficeAvailable()) {
    t.skip("LibreOffice is installed — missing-binary path not exercised");
    return;
  }

  await assert.rejects(async () => {
    // Minimal PK zip header so we pass OOXML gate and hit missing-binary path
    const pk = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    const named = Buffer.concat([
      pk,
      Buffer.from("[Content_Types].xml word/document.xml"),
    ]);
    await convertOfficeToPdf(named, "docx");
  }, /LibreOffice/);
});
