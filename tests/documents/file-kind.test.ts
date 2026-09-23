import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fileTypeBadge,
  isBrowserPlayableVideo,
  isImageFile,
  isVideoFile,
  needsVideoPreviewDerivative,
  normalizeExtension,
  VIDEO_EXTENSIONS,
  videoContentType,
} from "@/lib/documents/file-kind";

test("isImageFile detects Cloudinary and common image extensions", () => {
  assert.equal(
    isImageFile({
      storageProvider: "CLOUDINARY",
      extension: "bin",
      mimeType: "application/octet-stream",
    }),
    true,
  );
  assert.equal(
    isImageFile({
      storageProvider: "BACKBLAZE_B2",
      extension: "JPG",
      mimeType: "image/jpeg",
    }),
    true,
  );
  assert.equal(
    isImageFile({
      storageProvider: "BACKBLAZE_B2",
      extension: "pdf",
      mimeType: "application/pdf",
    }),
    false,
  );
});

test("isVideoFile detects common video extensions including MTS and AVI", () => {
  assert.equal(isVideoFile({ extension: "mp4", mimeType: "video/mp4" }), true);
  assert.equal(isVideoFile({ extension: "WEBM", mimeType: "" }), true);
  assert.equal(
    isVideoFile({ extension: "mts", mimeType: "application/octet-stream" }),
    true,
  );
  assert.equal(
    isVideoFile({ extension: "AVI", mimeType: "application/octet-stream" }),
    true,
  );
  assert.equal(
    isVideoFile({ extension: "m2ts", mimeType: "application/octet-stream" }),
    true,
  );
  assert.equal(
    isVideoFile({ extension: "mpeg", mimeType: "application/octet-stream" }),
    true,
  );
  assert.equal(
    isVideoFile({ extension: "mpg", mimeType: "application/octet-stream" }),
    true,
  );
  assert.equal(
    isVideoFile({ extension: "mov", mimeType: "application/octet-stream" }),
    true,
  );
  assert.equal(
    isVideoFile({ extension: "pdf", mimeType: "application/pdf" }),
    false,
  );
  for (const ext of [
    "mp4",
    "mov",
    "m4v",
    "webm",
    "avi",
    "mts",
    "m2ts",
    "mpeg",
    "mpg",
  ]) {
    assert.ok(VIDEO_EXTENSIONS.has(ext), ext);
  }
});

test("browser-playable vs derivative video classification", () => {
  assert.equal(
    isBrowserPlayableVideo({
      extension: "mp4",
      mimeType: "application/octet-stream",
    }),
    true,
  );
  assert.equal(
    needsVideoPreviewDerivative({
      extension: "mp4",
      mimeType: "application/octet-stream",
    }),
    false,
  );
  assert.equal(
    isBrowserPlayableVideo({
      extension: "mts",
      mimeType: "application/octet-stream",
    }),
    false,
  );
  assert.equal(
    needsVideoPreviewDerivative({
      extension: "mts",
      mimeType: "application/octet-stream",
    }),
    true,
  );
  assert.equal(
    needsVideoPreviewDerivative({
      extension: "avi",
      mimeType: "video/x-msvideo",
    }),
    true,
  );
  assert.equal(
    videoContentType({ extension: "mts", mimeType: "application/octet-stream" }),
    "video/MP2T",
  );
  assert.equal(
    videoContentType({ extension: "avi", mimeType: "application/octet-stream" }),
    "video/x-msvideo",
  );
});

test("fileTypeBadge prefers extension", () => {
  assert.equal(normalizeExtension(".JpEg"), "jpeg");
  assert.equal(
    fileTypeBadge({ extension: "docx", mimeType: "application/pdf" }),
    "DOCX",
  );
  assert.equal(
    fileTypeBadge({ extension: "", mimeType: "video/mp4" }),
    "VIDEO",
  );
  assert.equal(
    fileTypeBadge({ extension: "mts", mimeType: "application/octet-stream" }),
    "MTS",
  );
});
