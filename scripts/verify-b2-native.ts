/**
 * Cross-check ArcheritageDocs via Backblaze Native API (not only S3).
 * Prints account id, key capabilities, bucket id, file names + versions.
 */
import { config } from "dotenv";
config({ path: ".env" });

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

async function main() {
  const keyId = required("B2_KEY_ID");
  const appKey = required("B2_APPLICATION_KEY");
  const bucketName = required("B2_BUCKET_NAME");
  const s3Endpoint = required("B2_ENDPOINT");
  const region = required("B2_REGION");

  const authHeader =
    "Basic " + Buffer.from(`${keyId}:${appKey}`).toString("base64");

  const authRes = await fetch(
    "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
    { headers: { Authorization: authHeader } },
  );
  const authText = await authRes.text();
  if (!authRes.ok) {
    console.error("b2_authorize_account failed", authRes.status, authText);
    process.exitCode = 1;
    return;
  }
  const auth = JSON.parse(authText) as {
    accountId: string;
    apiInfo?: {
      storageApi?: {
        apiUrl: string;
        downloadUrl: string;
        bucketId?: string;
        bucketName?: string;
        namePrefix?: string | null;
        absoluteMinimumPartSize?: number;
        capabilities?: string[];
      };
    };
    authorizationToken: string;
    allowed?: {
      bucketId: string | null;
      bucketName: string | null;
      capabilities: string[];
      namePrefix: string | null;
    };
    apiUrl?: string;
    downloadUrl?: string;
  };

  // v3 vs v2 shape normalization
  const apiUrl =
    auth.apiInfo?.storageApi?.apiUrl ?? auth.apiUrl ?? "";
  const token = auth.authorizationToken;
  const allowed = auth.allowed ?? {
    bucketId: auth.apiInfo?.storageApi?.bucketId ?? null,
    bucketName: auth.apiInfo?.storageApi?.bucketName ?? null,
    capabilities: auth.apiInfo?.storageApi?.capabilities ?? [],
    namePrefix: auth.apiInfo?.storageApi?.namePrefix ?? null,
  };

  console.log(
    JSON.stringify(
      {
        s3ConfigFromEnv: {
          bucketName,
          s3Endpoint,
          region,
          keyIdMasked: `${keyId.slice(0, 6)}…${keyId.slice(-4)}`,
        },
        nativeAuth: {
          accountId: auth.accountId,
          apiUrl,
          downloadUrl:
            auth.apiInfo?.storageApi?.downloadUrl ?? auth.downloadUrl,
          allowedBucketId: allowed.bucketId,
          allowedBucketName: allowed.bucketName,
          allowedNamePrefix: allowed.namePrefix,
          capabilities: allowed.capabilities,
        },
      },
      null,
      2,
    ),
  );

  // List buckets
  const listBucketsRes = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accountId: auth.accountId }),
  });
  const listBucketsText = await listBucketsRes.text();
  if (!listBucketsRes.ok) {
    console.error("b2_list_buckets failed", listBucketsRes.status, listBucketsText);
  }
  const bucketsJson = listBucketsRes.ok
    ? (JSON.parse(listBucketsText) as {
        buckets: Array<{
          bucketId: string;
          bucketName: string;
          bucketType: string;
          fileCount?: number;
          totalSize?: number;
        }>;
      })
    : { buckets: [] };

  console.log(
    "\nBuckets visible to this key:",
    JSON.stringify(
      bucketsJson.buckets.map((b) => ({
        bucketId: b.bucketId,
        bucketName: b.bucketName,
        bucketType: b.bucketType,
        fileCount: b.fileCount,
        totalSize: b.totalSize,
        totalSizeHuman:
          typeof b.totalSize === "number" ? formatBytes(b.totalSize) : null,
      })),
      null,
      2,
    ),
  );

  const target =
    bucketsJson.buckets.find((b) => b.bucketName === bucketName) ??
    (allowed.bucketId
      ? {
          bucketId: allowed.bucketId,
          bucketName: allowed.bucketName ?? bucketName,
        }
      : null);

  if (!target?.bucketId) {
    console.error("Target bucket not found for this account/key");
    process.exitCode = 1;
    return;
  }

  console.log("\nTarget bucket:", target.bucketId, target.bucketName);

  // List all file names
  const files: Array<{
    fileName: string;
    size: number;
    fileId: string;
    action: string;
  }> = [];
  let startFileName: string | undefined;
  do {
    const res = await fetch(`${apiUrl}/b2api/v3/b2_list_file_names`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucketId: target.bucketId,
        startFileName,
        maxFileCount: 10000,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("b2_list_file_names failed", res.status, text);
      break;
    }
    const data = JSON.parse(text) as {
      files: Array<{
        fileName: string;
        contentLength: number;
        fileId: string;
        action: string;
      }>;
      nextFileName: string | null;
    };
    for (const f of data.files) {
      files.push({
        fileName: f.fileName,
        size: f.contentLength,
        fileId: f.fileId,
        action: f.action,
      });
    }
    startFileName = data.nextFileName ?? undefined;
  } while (startFileName);

  // List all file versions
  const versions: Array<{
    fileName: string;
    size: number;
    fileId: string;
    action: string;
  }> = [];
  let startFileNameV: string | undefined;
  let startFileIdV: string | undefined;
  do {
    const res = await fetch(`${apiUrl}/b2api/v3/b2_list_file_versions`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucketId: target.bucketId,
        startFileName: startFileNameV,
        startFileId: startFileIdV,
        maxFileCount: 10000,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("b2_list_file_versions failed", res.status, text);
      break;
    }
    const data = JSON.parse(text) as {
      files: Array<{
        fileName: string;
        contentLength: number;
        fileId: string;
        action: string;
      }>;
      nextFileName: string | null;
      nextFileId: string | null;
    };
    for (const f of data.files) {
      versions.push({
        fileName: f.fileName,
        size: f.contentLength,
        fileId: f.fileId,
        action: f.action,
      });
    }
    startFileNameV = data.nextFileName ?? undefined;
    startFileIdV = data.nextFileId ?? undefined;
  } while (startFileNameV);

  const byPrefix = (list: typeof files) => {
    const m: Record<string, { count: number; bytes: number }> = {};
    for (const f of list) {
      const p = f.fileName.includes("/")
        ? `${f.fileName.split("/")[0]}/`
        : "(root)/";
      if (!m[p]) m[p] = { count: 0, bytes: 0 };
      m[p]!.count += 1;
      m[p]!.bytes += f.size;
    }
    return Object.fromEntries(
      Object.entries(m).map(([k, v]) => [
        k,
        { count: v.count, bytes: v.bytes, bytesHuman: formatBytes(v.bytes) },
      ]),
    );
  };

  console.log(
    "\nNative API file names:",
    JSON.stringify(
      {
        count: files.length,
        bytes: files.reduce((s, f) => s + f.size, 0),
        bytesHuman: formatBytes(files.reduce((s, f) => s + f.size, 0)),
        byPrefix: byPrefix(files),
        sample: files.slice(0, 15),
      },
      null,
      2,
    ),
  );

  console.log(
    "\nNative API file versions:",
    JSON.stringify(
      {
        count: versions.length,
        bytes: versions.reduce((s, f) => s + f.size, 0),
        bytesHuman: formatBytes(versions.reduce((s, f) => s + f.size, 0)),
        byAction: versions.reduce(
          (acc, v) => {
            acc[v.action] = (acc[v.action] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        byPrefix: byPrefix(versions),
        sample: versions.slice(0, 15),
      },
      null,
      2,
    ),
  );

  // Get upload URL / bucket info if available
  try {
    const infoRes = await fetch(`${apiUrl}/b2api/v3/b2_get_bucket`, {
      // may not exist on all API versions — ignore failure
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: auth.accountId,
        bucketId: target.bucketId,
      }),
    });
    if (infoRes.ok) {
      console.log("\nb2_get_bucket:", await infoRes.text());
    }
  } catch {
    /* ignore */
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
