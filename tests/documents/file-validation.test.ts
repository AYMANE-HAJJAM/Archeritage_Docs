import { test } from "node:test";
import assert from "node:assert/strict";
import { contentDisposition, nameSchema, validateFile } from "../../lib/validation/file";
import { folderTrail } from "../../lib/utils";

test("supported images require matching signatures and extensions", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x01]);
  assert.equal(validateFile("photo.JPEG", "image/jpeg", jpeg).storageProvider, "CLOUDINARY");
  assert.throws(() => validateFile("photo.png", "image/png", jpeg));
  assert.throws(() => validateFile("photo.jpg", "image/jpeg", Buffer.from("not an image")));
  assert.throws(() => validateFile("photo.pdf", "application/pdf", jpeg));
  assert.throws(() => validateFile("drawing.svg", "image/svg+xml", Buffer.from("<svg/>")));
});
test("PDF signature is required; arbitrary documents are forced to attachment-safe MIME", () => {
  assert.equal(validateFile("CPS.pdf", "application/pdf", Buffer.from("%PDF-1.7 content")).mimeType, "application/pdf");
  assert.throws(() => validateFile("CPS.pdf", "application/pdf", Buffer.from("<script>")));
  const document = validateFile("drawing.dwg", "text/html", Buffer.from("some binary data"));
  assert.equal(document.storageProvider, "BACKBLAZE_B2");
  assert.equal(document.mimeType, "application/octet-stream");
});
test("empty files, dangerous names and over-limit payloads are rejected", () => {
  for (const name of ["../file", "x\\file", "name\r\nheader", "..", " "]) assert.equal(nameSchema.safeParse(name).success, false);
  assert.throws(() => validateFile("empty.zip", "", Buffer.alloc(0)));
  assert.throws(() => validateFile("large.zip", "", Buffer.alloc(101 * 1024 * 1024)));
});
test("download names encode Unicode and cannot inject HTTP headers", () => {
  const result = contentDisposition('Château "test"\r\n.pdf');
  assert.ok(!result.includes("\r") && !result.includes("\n"));
  assert.ok(result.includes("filename*=UTF-8''Ch%C3%A2teau"));
  assert.ok(result.startsWith("attachment;"));
});
test("folder paths support deep nesting without recursion and terminate on corrupted cycles", () => {
  const folders = Array.from({ length: 2000 }, (_, i) => ({ id: String(i), name: `Folder ${i}`, parentId: i ? String(i - 1) : null }));
  assert.equal(folderTrail("1999", folders).length, 2000);
  assert.equal(folderTrail("a", [{ id: "a", name: "A", parentId: "b" }, { id: "b", name: "B", parentId: "a" }]).length, 2);
});
