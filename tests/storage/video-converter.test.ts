import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  buildVideoPreviewFfmpegArgs,
  convertVideoToPreviewMp4,
  findFfmpegBinary,
  isConvertibleVideoExtension,
  isFfmpegAvailable,
  resetFfmpegBinaryCache,
  VIDEO_PREVIEW_FFMPEG_ARGS_TEMPLATE,
  VideoPreviewConversionError,
} from "@/lib/documents/video-converter";
import { computePreviewCacheKey } from "@/lib/storage/preview-cache";

test("isConvertibleVideoExtension covers MTS/AVI/MP4 family", () => {
  for (const ext of ["mp4", "avi", "mts", "m2ts", "mov", "webm", "mpeg", "mpg"]) {
    assert.equal(isConvertibleVideoExtension(ext), true, ext);
    assert.equal(isConvertibleVideoExtension(`.${ext}`), true, `.${ext}`);
    assert.equal(isConvertibleVideoExtension(ext.toUpperCase()), true, ext);
  }
  assert.equal(isConvertibleVideoExtension("pdf"), false);
  assert.equal(isConvertibleVideoExtension("docx"), false);
});

test("preview ffmpeg args target H.264 AAC MP4 with optional audio", () => {
  const joined = VIDEO_PREVIEW_FFMPEG_ARGS_TEMPLATE.join(" ");
  assert.match(joined, /libx264/);
  assert.match(joined, /\baac\b/);
  assert.match(joined, /yuv420p/);
  assert.match(joined, /\+faststart/);
  assert.match(joined, /0:a:0\?/);

  const args = buildVideoPreviewFfmpegArgs("/tmp/in.mts", "/tmp/out.mp4");
  assert.equal(args.includes("/tmp/in.mts"), true);
  assert.equal(args.includes("/tmp/out.mp4"), true);
  assert.equal(args.includes("__INPUT__"), false);
});

test("findFfmpegBinary resolves env, PATH, or bundled ffmpeg-static", () => {
  resetFfmpegBinaryCache();
  const resolved = findFfmpegBinary();
  assert.notEqual(resolved, null, "ffmpeg-static or system ffmpeg should be available");
  assert.ok(path.isAbsolute(resolved!) || resolved!.includes(path.sep));
  assert.equal(isFfmpegAvailable(), true);
});

test("convertVideoToPreviewMp4 fails clearly when ffmpeg is missing", async (t) => {
  resetFfmpegBinaryCache();
  if (isFfmpegAvailable()) {
    t.skip("ffmpeg is available — missing-binary path not exercised");
    return;
  }

  await assert.rejects(
    () => convertVideoToPreviewMp4(Buffer.from("not-a-video"), "mts"),
    (error: unknown) => {
      assert.ok(error instanceof VideoPreviewConversionError);
      assert.equal(error.reason, "ffmpeg_missing");
      assert.match(error.message, /ffmpeg/i);
      return true;
    },
  );
});

test("convertVideoToPreviewMp4 rejects unsupported formats", async () => {
  await assert.rejects(
    () => convertVideoToPreviewMp4(Buffer.from("%PDF-1.7"), "pdf"),
    (error: unknown) => {
      assert.ok(error instanceof VideoPreviewConversionError);
      assert.equal(error.reason, "unsupported_format");
      return true;
    },
  );
});

test("convertVideoToPreviewMp4 converts synthetic MP4 (native path input)", async (t) => {
  resetFfmpegBinaryCache();
  if (!isFfmpegAvailable()) {
    t.skip("ffmpeg not available");
    return;
  }

  const ffmpeg = findFfmpegBinary()!;
  const tempDir = await fs.mkdtemp(
    path.join(process.cwd(), ".cache", "video-test-"),
  );
  const sourcePath = path.join(tempDir, "source.mp4");

  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    await execFileAsync(
      ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=320x240:d=0.5",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        sourcePath,
      ],
      { timeout: 60_000, windowsHide: true },
    );

    const input = await fs.readFile(sourcePath);
    const output = await convertVideoToPreviewMp4(input, "mp4");
    assert.ok(output.length > 100);
    assert.equal(output.subarray(4, 8).toString("ascii"), "ftyp");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test("convertVideoToPreviewMp4 converts AVI container when ffmpeg can read it", async (t) => {
  resetFfmpegBinaryCache();
  if (!isFfmpegAvailable()) {
    t.skip("ffmpeg not available");
    return;
  }

  const ffmpeg = findFfmpegBinary()!;
  const tempDir = await fs.mkdtemp(
    path.join(process.cwd(), ".cache", "video-test-"),
  );
  const sourcePath = path.join(tempDir, "source.avi");

  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    await execFileAsync(
      ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=320x240:d=0.5",
        "-c:v",
        "mpeg4",
        sourcePath,
      ],
      { timeout: 60_000, windowsHide: true },
    );

    const input = await fs.readFile(sourcePath);
    const output = await convertVideoToPreviewMp4(input, "avi");
    assert.ok(output.length > 100);
    assert.equal(output.subarray(4, 8).toString("ascii"), "ftyp");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test("convertVideoToPreviewMp4 converts MPEG-TS-like MTS when ffmpeg can read it", async (t) => {
  resetFfmpegBinaryCache();
  if (!isFfmpegAvailable()) {
    t.skip("ffmpeg not available");
    return;
  }

  const ffmpeg = findFfmpegBinary()!;
  const tempDir = await fs.mkdtemp(
    path.join(process.cwd(), ".cache", "video-test-"),
  );
  const sourcePath = path.join(tempDir, "source.mts");

  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    // MPEG-TS container with H.264 — closest portable stand-in for AVCHD .MTS.
    await execFileAsync(
      ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=green:s=320x240:d=0.5",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-f",
        "mpegts",
        sourcePath,
      ],
      { timeout: 60_000, windowsHide: true },
    );

    const input = await fs.readFile(sourcePath);
    const output = await convertVideoToPreviewMp4(input, "mts");
    assert.ok(output.length > 100);
    assert.equal(output.subarray(4, 8).toString("ascii"), "ftyp");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test("video preview cache key stays deterministic per File.id/sourceHash", () => {
  const fileA = {
    id: "vid_123",
    sourceHash: "hashA",
    storageKey: "archeritage/key-video",
    storageVersion: "v1",
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
  const key1 = computePreviewCacheKey(fileA);
  const key2 = computePreviewCacheKey(fileA);
  assert.equal(key1, key2);
  assert.notEqual(
    key1,
    computePreviewCacheKey({ ...fileA, sourceHash: "hashB" }),
  );
});
