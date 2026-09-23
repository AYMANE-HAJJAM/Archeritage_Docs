import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertWithinUploadLimit,
  contentDisposition,
  maxUploadBytes,
  MAX_UPLOAD_MB_CEILING,
  nameSchema,
  resolveMaxUploadMb,
  validateFile,
} from "../../lib/validation/file";
import { folderTrail } from "../../lib/utils";

test("supported images require matching signatures and extensions", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x01]);
  assert.equal(validateFile("photo.JPEG", "image/jpeg", jpeg).storageProvider, "CLOUDINARY");
  assert.throws(() => validateFile("photo.png", "image/png", jpeg));
  assert.throws(() => validateFile("photo.jpg", "image/jpeg", Buffer.from("not an image")));
  assert.throws(() => validateFile("photo.pdf", "application/pdf", jpeg));
  assert.throws(() => validateFile("drawing.svg", "image/svg+xml", Buffer.from("<svg/>")));
});

test("PDF signature is required; videos get extension MIME; other docs stay octet-stream", () => {
  assert.equal(validateFile("CPS.pdf", "application/pdf", Buffer.from("%PDF-1.7 content")).mimeType, "application/pdf");
  assert.throws(() => validateFile("CPS.pdf", "application/pdf", Buffer.from("<script>")));
  const document = validateFile("drawing.dwg", "text/html", Buffer.from("some binary data"));
  assert.equal(document.storageProvider, "BACKBLAZE_B2");
  assert.equal(document.mimeType, "application/octet-stream");

  const mts = validateFile("clip.MTS", "application/octet-stream", Buffer.from("fake-mts-bytes"));
  assert.equal(mts.storageProvider, "BACKBLAZE_B2");
  assert.equal(mts.mimeType, "video/MP2T");
  assert.equal(mts.extension, "mts");

  const avi = validateFile("clip.avi", "application/octet-stream", Buffer.from("fake-avi-bytes"));
  assert.equal(avi.mimeType, "video/x-msvideo");

  const mp4 = validateFile("clip.mp4", "application/octet-stream", Buffer.from("fake-mp4-bytes"));
  assert.equal(mp4.mimeType, "video/mp4");
});

test("empty files, dangerous names and over-limit payloads are rejected", () => {
  for (const name of ["../file", "x\\file", "name\r\nheader", "..", " "]) {
    assert.equal(nameSchema.safeParse(name).success, false);
  }
  assert.throws(() => validateFile("empty.zip", "", Buffer.alloc(0)));
  assert.throws(() => assertWithinUploadLimit(0));
  assert.throws(() => assertWithinUploadLimit(maxUploadBytes() + 1));
});

test("MAX_UPLOAD_MB accepts values above the old 100MB hard ceiling", () => {
  const previous = process.env.MAX_UPLOAD_MB;
  try {
    process.env.MAX_UPLOAD_MB = "500";
    assert.equal(resolveMaxUploadMb(), 500);
    assert.equal(maxUploadBytes(), 500 * 1024 * 1024);

    process.env.MAX_UPLOAD_MB = "900";
    assert.equal(resolveMaxUploadMb(), 900);

    process.env.MAX_UPLOAD_MB = String(MAX_UPLOAD_MB_CEILING + 1);
    assert.throws(() => resolveMaxUploadMb(), /MAX_UPLOAD_MB/);
  } finally {
    if (previous === undefined) delete process.env.MAX_UPLOAD_MB;
    else process.env.MAX_UPLOAD_MB = previous;
  }
});

test("video validation can use a short head buffer with explicit size", () => {
  const previous = process.env.MAX_UPLOAD_MB;
  try {
    process.env.MAX_UPLOAD_MB = "500";
    const head = Buffer.from("fake-mts-head");
    const meta = validateFile(
      "00015.MTS",
      "application/octet-stream",
      head,
      102 * 1024 * 1024,
    );
    assert.equal(meta.extension, "mts");
    assert.equal(meta.storageProvider, "BACKBLAZE_B2");
  } finally {
    if (previous === undefined) delete process.env.MAX_UPLOAD_MB;
    else process.env.MAX_UPLOAD_MB = previous;
  }
});

test("download names encode Unicode and cannot inject HTTP headers", () => {
  const result = contentDisposition('Château "test"\r\n.pdf');
  assert.ok(!result.includes("\r") && !result.includes("\n"));
  assert.ok(result.includes("filename*=UTF-8''Ch%C3%A2teau"));
  assert.ok(result.startsWith("attachment;"));
});

test("folder paths support deep nesting without recursion and terminate on corrupted cycles", () => {
  const folders = Array.from({ length: 2000 }, (_, i) => ({
    id: String(i),
    name: `Folder ${i}`,
    parentId: i ? String(i - 1) : null,
  }));
  assert.equal(folderTrail("1999", folders).length, 2000);
  assert.equal(
    folderTrail("a", [
      { id: "a", name: "A", parentId: "b" },
      { id: "b", name: "B", parentId: "a" },
    ]).length,
    2,
  );
});
