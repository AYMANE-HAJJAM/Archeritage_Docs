import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import {
  assertWithinUploadLimit,
  maxUploadBytes,
  MAX_UPLOAD_MB_CEILING,
  resolveMaxUploadMb,
} from "@/lib/validation/file";

const SIZE_LADDER_MB = [10, 30, 80, 120, 300] as const;

test("size ladder: configured 500MB allows 10–300MB checks", () => {
  const previous = process.env.MAX_UPLOAD_MB;
  try {
    process.env.MAX_UPLOAD_MB = "500";
    const limit = maxUploadBytes();
    assert.equal(limit, 500 * 1024 * 1024);
    for (const mb of SIZE_LADDER_MB) {
      assert.doesNotThrow(
        () => assertWithinUploadLimit(mb * 1024 * 1024),
        `${mb} MB should be under 500 MB limit`,
      );
    }
    assert.throws(() => assertWithinUploadLimit(501 * 1024 * 1024));
  } finally {
    if (previous === undefined) delete process.env.MAX_UPLOAD_MB;
    else process.env.MAX_UPLOAD_MB = previous;
  }
});

test("old hardcoded ceiling of 100 no longer rejects 500/900", () => {
  const previous = process.env.MAX_UPLOAD_MB;
  try {
    process.env.MAX_UPLOAD_MB = "900";
    assert.equal(resolveMaxUploadMb(), 900);
    assert.ok(900 <= MAX_UPLOAD_MB_CEILING);
  } finally {
    if (previous === undefined) delete process.env.MAX_UPLOAD_MB;
    else process.env.MAX_UPLOAD_MB = previous;
  }
});

test("upload route uses formData once and the shared upload service streams B2", () => {
  const route = readFileSync(
    path.join(process.cwd(), "app/api/files/route.ts"),
    "utf8",
  );
  const service = readFileSync(
    path.join(process.cwd(), "lib/files/create-uploaded-file.ts"),
    "utf8",
  );
  assert.match(route, /request\.formData\(\)/);
  assert.match(route, /createUploadedFile/);
  assert.match(service, /uploadWebFileToB2/);
  assert.doesNotMatch(route, /readLimitedBody\(/);
  assert.match(route, /maxDuration = 600/);
  assert.match(route, /MAX_UPLOAD_MB/);
});
