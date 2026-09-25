/**
 * Verify + force-empty ArcheritageDocs B2 bucket (app credentials).
 * Deletes current objects AND all versions under archeritage/ and safi-patrimoine/.
 * Does NOT delete the bucket.
 *
 * Usage:
 *   npx tsx scripts/verify-and-empty-b2.ts           # inventory only
 *   B2_FORCE_EMPTY=1 npx tsx scripts/verify-and-empty-b2.ts  # delete then re-list
 */
import { config } from "dotenv";
config({ path: ".env" });

import {
  S3Client,
  ListObjectsV2Command,
  ListObjectVersionsCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing ${key}`);
  return v;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(2)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function maskKeyId(id: string): string {
  if (id.length <= 8) return "***";
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

const FORCE = process.env.B2_FORCE_EMPTY === "1";

function client() {
  return new S3Client({
    endpoint: required("B2_ENDPOINT"),
    region: required("B2_REGION"),
    credentials: {
      accessKeyId: required("B2_KEY_ID"),
      secretAccessKey: required("B2_APPLICATION_KEY"),
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

type VersionRow = {
  key: string;
  size: number;
  versionId: string | null;
  isLatest: boolean;
  isDeleteMarker: boolean;
};

async function listCurrent(c: S3Client, bucket: string) {
  const objects: { key: string; size: number }[] = [];
  let token: string | undefined;
  do {
    const res = await c.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    for (const o of res.Contents ?? []) {
      if (o.Key) objects.push({ key: o.Key, size: o.Size ?? 0 });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return objects;
}

async function listAllVersions(c: S3Client, bucket: string) {
  const rows: VersionRow[] = [];
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;
  do {
    const res = await c.send(
      new ListObjectVersionsCommand({
        Bucket: bucket,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
        MaxKeys: 1000,
      }),
    );
    for (const v of res.Versions ?? []) {
      if (!v.Key) continue;
      rows.push({
        key: v.Key,
        size: v.Size ?? 0,
        versionId: v.VersionId ?? null,
        isLatest: Boolean(v.IsLatest),
        isDeleteMarker: false,
      });
    }
    for (const m of res.DeleteMarkers ?? []) {
      if (!m.Key) continue;
      rows.push({
        key: m.Key,
        size: 0,
        versionId: m.VersionId ?? null,
        isLatest: Boolean(m.IsLatest),
        isDeleteMarker: true,
      });
    }
    keyMarker = res.IsTruncated ? res.NextKeyMarker : undefined;
    versionIdMarker = res.IsTruncated ? res.NextVersionIdMarker : undefined;
  } while (keyMarker || versionIdMarker);

  return rows;
}

function summarize(
  label: string,
  current: { key: string; size: number }[],
  versions: VersionRow[],
) {
  const byPrefix: Record<string, { count: number; bytes: number }> = {};
  for (const o of current) {
    const p = o.key.includes("/") ? `${o.key.split("/")[0]}/` : "(root)/";
    if (!byPrefix[p]) byPrefix[p] = { count: 0, bytes: 0 };
    byPrefix[p]!.count += 1;
    byPrefix[p]!.bytes += o.size;
  }
  const versionBytes = versions
    .filter((v) => !v.isDeleteMarker)
    .reduce((s, v) => s + v.size, 0);
  const versionByPrefix: Record<
    string,
    { versions: number; deleteMarkers: number; bytes: number }
  > = {};
  for (const v of versions) {
    const p = v.key.includes("/") ? `${v.key.split("/")[0]}/` : "(root)/";
    if (!versionByPrefix[p]) {
      versionByPrefix[p] = { versions: 0, deleteMarkers: 0, bytes: 0 };
    }
    if (v.isDeleteMarker) versionByPrefix[p]!.deleteMarkers += 1;
    else {
      versionByPrefix[p]!.versions += 1;
      versionByPrefix[p]!.bytes += v.size;
    }
  }

  const archeritageCurrent = current.filter((o) =>
    o.key.startsWith("archeritage/"),
  );
  const safiCurrent = current.filter((o) =>
    o.key.startsWith("safi-patrimoine/"),
  );
  const archeritageVersions = versions.filter((v) =>
    v.key.startsWith("archeritage/"),
  );
  const safiVersions = versions.filter((v) =>
    v.key.startsWith("safi-patrimoine/"),
  );

  return {
    label,
    currentObjectCount: current.length,
    currentBytes: current.reduce((s, o) => s + o.size, 0),
    currentBytesHuman: formatBytes(current.reduce((s, o) => s + o.size, 0)),
    currentByPrefix: Object.fromEntries(
      Object.entries(byPrefix).map(([k, v]) => [
        k,
        { count: v.count, bytesHuman: formatBytes(v.bytes), bytes: v.bytes },
      ]),
    ),
    versionRecordCount: versions.length,
    versionBytes,
    versionBytesHuman: formatBytes(versionBytes),
    versionByPrefix: Object.fromEntries(
      Object.entries(versionByPrefix).map(([k, v]) => [
        k,
        {
          versions: v.versions,
          deleteMarkers: v.deleteMarkers,
          bytesHuman: formatBytes(v.bytes),
          bytes: v.bytes,
        },
      ]),
    ),
    prefixes: {
      "archeritage/": {
        currentObjects: archeritageCurrent.length,
        currentBytes: archeritageCurrent.reduce((s, o) => s + o.size, 0),
        currentBytesHuman: formatBytes(
          archeritageCurrent.reduce((s, o) => s + o.size, 0),
        ),
        versionRecords: archeritageVersions.length,
        versionBytes: archeritageVersions
          .filter((v) => !v.isDeleteMarker)
          .reduce((s, v) => s + v.size, 0),
        versionBytesHuman: formatBytes(
          archeritageVersions
            .filter((v) => !v.isDeleteMarker)
            .reduce((s, v) => s + v.size, 0),
        ),
        deleteMarkers: archeritageVersions.filter((v) => v.isDeleteMarker)
          .length,
      },
      "safi-patrimoine/": {
        currentObjects: safiCurrent.length,
        currentBytes: safiCurrent.reduce((s, o) => s + o.size, 0),
        currentBytesHuman: formatBytes(
          safiCurrent.reduce((s, o) => s + o.size, 0),
        ),
        versionRecords: safiVersions.length,
        versionBytes: safiVersions
          .filter((v) => !v.isDeleteMarker)
          .reduce((s, v) => s + v.size, 0),
        versionBytesHuman: formatBytes(
          safiVersions
            .filter((v) => !v.isDeleteMarker)
            .reduce((s, v) => s + v.size, 0),
        ),
        deleteMarkers: safiVersions.filter((v) => v.isDeleteMarker).length,
      },
    },
    sampleCurrent: current.slice(0, 10).map((o) => ({
      key: o.key,
      size: o.size,
      sizeHuman: formatBytes(o.size),
    })),
    sampleVersions: versions.slice(0, 10).map((v) => ({
      key: v.key,
      size: v.size,
      versionId: v.versionId,
      isLatest: v.isLatest,
      isDeleteMarker: v.isDeleteMarker,
    })),
  };
}

async function deleteAllVersions(
  c: S3Client,
  bucket: string,
  versions: VersionRow[],
) {
  // Prefer versioned deletes; if no versionId, delete by key only
  const targets = versions.filter((v) => v.versionId);
  const bareKeys = [
    ...new Set(versions.filter((v) => !v.versionId).map((v) => v.key)),
  ];

  console.log(
    `Deleting ${targets.length} versioned records + ${bareKeys.length} bare keys…`,
  );

  for (let i = 0; i < targets.length; i += 500) {
    const batch = targets.slice(i, i + 500);
    const res = await c.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((v) => ({
            Key: v.key,
            VersionId: v.versionId!,
          })),
          Quiet: false,
        },
      }),
    );
    const errors = res.Errors ?? [];
    if (errors.length) {
      console.error("Delete errors (sample):", errors.slice(0, 5));
    }
    console.log(
      `  batch ${i / 500 + 1}: deleted=${res.Deleted?.length ?? 0} errors=${errors.length}`,
    );
  }

  for (let i = 0; i < bareKeys.length; i += 500) {
    const batch = bareKeys.slice(i, i + 500);
    await c.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
  }
}

async function main() {
  const bucket = required("B2_BUCKET_NAME");
  const endpoint = required("B2_ENDPOINT");
  const region = required("B2_REGION");
  const keyId = required("B2_KEY_ID");

  console.log("=".repeat(72));
  console.log("B2 CONFIG (from app .env — secrets redacted)");
  console.log("=".repeat(72));
  console.log(
    JSON.stringify(
      {
        bucket,
        endpoint,
        region,
        keyIdMasked: maskKeyId(keyId),
        keyIdLength: keyId.length,
        forceEmpty: FORCE,
      },
      null,
      2,
    ),
  );

  const c = client();

  try {
    await c.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`HeadBucket: OK (${bucket} accessible with these credentials)`);
  } catch (err) {
    console.error("HeadBucket FAILED:", err);
    process.exitCode = 1;
    return;
  }

  console.log("\n[1] Listing current objects (ListObjectsV2)…");
  let current = await listCurrent(c, bucket);
  console.log("\n[2] Listing all versions (ListObjectVersions)…");
  let versions = await listAllVersions(c, bucket);

  const before = summarize("BEFORE", current, versions);
  console.log("\n── BEFORE ──");
  console.log(JSON.stringify(before, null, 2));

  const needsDelete =
    current.length > 0 ||
    versions.some((v) => !v.isDeleteMarker) ||
    versions.some((v) => v.isDeleteMarker);

  if (!FORCE) {
    console.log(
      "\nInventory only. Re-run with B2_FORCE_EMPTY=1 to delete all versions.",
    );
    if (needsDelete) process.exitCode = 2;
    return;
  }

  if (!needsDelete) {
    console.log("\nBucket already empty (no current objects, no versions).");
    return;
  }

  // If ListObjectsV2 empty but versions exist → previous delete only added markers
  // If both empty but console shows data → credential/bucket mismatch (already HeadBucket OK)
  // Also delete any current objects not in version list
  const versionKeys = new Set(versions.map((v) => v.key));
  for (const o of current) {
    if (!versionKeys.has(o.key)) {
      versions.push({
        key: o.key,
        size: o.size,
        versionId: null,
        isLatest: true,
        isDeleteMarker: false,
      });
    }
  }

  console.log("\n[3] FORCE DELETE all versions + delete markers…");
  await deleteAllVersions(c, bucket, versions);

  // Second pass: re-list and delete anything remaining
  console.log("\n[4] Re-list and purge any leftovers…");
  for (let pass = 1; pass <= 3; pass++) {
    current = await listCurrent(c, bucket);
    versions = await listAllVersions(c, bucket);
    const remaining = [
      ...versions,
      ...current
        .filter((o) => !versions.some((v) => v.key === o.key))
        .map(
          (o): VersionRow => ({
            key: o.key,
            size: o.size,
            versionId: null,
            isLatest: true,
            isDeleteMarker: false,
          }),
        ),
    ];
    if (remaining.length === 0 && current.length === 0) break;
    console.log(
      `  pass ${pass}: current=${current.length} versionRecords=${versions.length}`,
    );
    await deleteAllVersions(c, bucket, remaining);
  }

  current = await listCurrent(c, bucket);
  versions = await listAllVersions(c, bucket);
  const after = summarize("AFTER", current, versions);
  console.log("\n── AFTER ──");
  console.log(JSON.stringify(after, null, 2));

  const empty =
    after.currentObjectCount === 0 &&
    after.prefixes["archeritage/"].currentObjects === 0 &&
    after.prefixes["safi-patrimoine/"].currentObjects === 0 &&
    after.prefixes["archeritage/"].versionBytes === 0 &&
    after.prefixes["safi-patrimoine/"].versionBytes === 0 &&
    after.versionRecordCount === 0;

  if (!empty) {
    console.error("\nBUCKET NOT EMPTY AFTER FORCE DELETE");
    process.exitCode = 1;
  } else {
    console.log("\nBUCKET EMPTY — current objects=0, versions=0, bytes=0");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
