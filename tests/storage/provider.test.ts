import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import {
  detectFileKind,
  resolveStorageProvider,
} from "../../lib/storage/provider";
import {
  cloudinaryVideoMaxBytes,
  resolveCloudinaryVideoMaxMb,
} from "../../lib/storage/video-limit";

const MB = 1024 * 1024;

function withThreshold(run: () => void) {
  const previous = process.env.CLOUDINARY_VIDEO_MAX_MB;
  process.env.CLOUDINARY_VIDEO_MAX_MB = "100";
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.CLOUDINARY_VIDEO_MAX_MB;
    else process.env.CLOUDINARY_VIDEO_MAX_MB = previous;
  }
}

test("default video threshold is 100 MB when env is absent", () => {
  const previous = process.env.CLOUDINARY_VIDEO_MAX_MB;
  delete process.env.CLOUDINARY_VIDEO_MAX_MB;
  try {
    assert.equal(resolveCloudinaryVideoMaxMb(), 100);
    assert.equal(cloudinaryVideoMaxBytes(), 100 * MB);
  } finally {
    if (previous !== undefined) process.env.CLOUDINARY_VIDEO_MAX_MB = previous;
  }
});

test("provider routing by kind and size", () => {
  withThreshold(() => {
    assert.equal(
      resolveStorageProvider({
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 5 * MB,
      }),
      "CLOUDINARY",
    );
    assert.equal(
      resolveStorageProvider({
        fileName: "scan.png",
        mimeType: "image/png",
        sizeBytes: 150 * MB,
      }),
      "CLOUDINARY",
    );
    assert.equal(
      resolveStorageProvider({
        fileName: "clip.mp4",
        mimeType: "video/mp4",
        sizeBytes: 20 * MB,
      }),
      "CLOUDINARY",
    );
    assert.equal(
      resolveStorageProvider({
        fileName: "clip.mts",
        mimeType: "video/MP2T",
        sizeBytes: 99 * MB,
      }),
      "CLOUDINARY",
    );
    assert.equal(
      resolveStorageProvider({
        fileName: "exact.mts",
        mimeType: "video/MP2T",
        sizeBytes: 100 * MB,
      }),
      "CLOUDINARY",
    );
    assert.equal(
      resolveStorageProvider({
        fileName: "over.mts",
        mimeType: "video/MP2T",
        sizeBytes: 100 * MB + 1,
      }),
      "BACKBLAZE_B2",
    );
    assert.equal(
      resolveStorageProvider({
        fileName: "DSC_0183.AVI",
        mimeType: "video/x-msvideo",
        sizeBytes: 304 * MB,
      }),
      "BACKBLAZE_B2",
    );
    assert.equal(
      resolveStorageProvider({
        fileName: "note.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1 * MB,
      }),
      "BACKBLAZE_B2",
    );
    assert.equal(
      resolveStorageProvider({
        fileName: "note.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 200_000,
      }),
      "BACKBLAZE_B2",
    );
  });
});

test("octet-stream with .MTS is still a video", () => {
  assert.equal(
    detectFileKind({
      fileName: "00015.MTS",
      mimeType: "application/octet-stream",
    }),
    "video",
  );
  withThreshold(() => {
    assert.equal(
      resolveStorageProvider({
        fileName: "00015.MTS",
        mimeType: "application/octet-stream",
        sizeBytes: 90 * MB,
      }),
      "CLOUDINARY",
    );
  });
});

test("a client-supplied provider is ignored", () => {
  withThreshold(() => {
    const forced = resolveStorageProvider({
      fileName: "note.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1 * MB,
      ...({ storageProvider: "CLOUDINARY" } as object),
    });
    assert.equal(forced, "BACKBLAZE_B2");
  });
});

test("UI upload route delegates to the shared upload service", () => {
  const route = readFileSync(
    path.join(process.cwd(), "app/api/files/route.ts"),
    "utf8",
  );
  const service = readFileSync(
    path.join(process.cwd(), "lib/files/create-uploaded-file.ts"),
    "utf8",
  );
  assert.match(route, /createUploadedFile/);
  assert.match(route, /storageProvider/);
  assert.doesNotMatch(route, /resolveStorageProvider/);
  assert.doesNotMatch(route, /db\.file\.create/);
  assert.match(service, /resolveStorageProvider/);
  assert.match(service, /buildDocumentStoragePath/);
  assert.match(service, /db\.file\.create/);
  assert.match(service, /uploadWebFileToB2/);
  assert.doesNotMatch(service, /db\.file\.create[\s\S]*uploadObject/);
});
