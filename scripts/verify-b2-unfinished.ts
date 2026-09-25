import { config } from "dotenv";
config({ path: ".env" });

function required(k: string) {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ${k}`);
  return v;
}

async function main() {
  const keyId = required("B2_KEY_ID");
  const appKey = required("B2_APPLICATION_KEY");
  const authHeader =
    "Basic " + Buffer.from(`${keyId}:${appKey}`).toString("base64");
  const authRes = await fetch(
    "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
    { headers: { Authorization: authHeader } },
  );
  const auth = (await authRes.json()) as {
    accountId: string;
    authorizationToken: string;
    apiInfo: { storageApi: { apiUrl: string } };
  };
  const apiUrl = auth.apiInfo.storageApi.apiUrl;
  const token = auth.authorizationToken;
  const accountId = auth.accountId;

  const bucketsRes = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accountId }),
  });
  const buckets = (await bucketsRes.json()) as {
    buckets: Array<{ bucketId: string; bucketName: string }>;
  };
  const target = buckets.buckets.find((b) => b.bucketName === "ArcheritageDocs");
  if (!target) throw new Error("bucket not found");
  console.log("bucket", target);

  const unfinished: unknown[] = [];
  let startFileId: string | undefined;
  do {
    const res = await fetch(
      `${apiUrl}/b2api/v3/b2_list_unfinished_large_files`,
      {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bucketId: target.bucketId,
          startFileId,
          maxFileCount: 100,
        }),
      },
    );
    const data = (await res.json()) as {
      files?: Array<Record<string, unknown>>;
      nextFileId?: string | null;
      code?: string;
      message?: string;
    };
    if (!res.ok) {
      console.log("unfinished error", data);
      break;
    }
    for (const f of data.files ?? []) unfinished.push(f);
    startFileId = data.nextFileId ?? undefined;
  } while (startFileId);

  console.log(
    JSON.stringify(
      {
        unfinishedCount: unfinished.length,
        unfinishedSample: unfinished.slice(0, 20),
      },
      null,
      2,
    ),
  );

  for (const prefix of [
    "archeritage/",
    "safi-patrimoine/",
    "archeritage",
    "safi-patrimoine",
  ]) {
    const res = await fetch(`${apiUrl}/b2api/v3/b2_list_file_names`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucketId: target.bucketId,
        prefix,
        maxFileCount: 10,
      }),
    });
    const data = (await res.json()) as {
      files?: Array<{ fileName: string; contentLength: number }>;
    };
    console.log(
      JSON.stringify({
        prefix,
        ok: res.ok,
        count: data.files?.length ?? 0,
        sample: (data.files ?? []).slice(0, 5),
      }),
    );
  }

  // delimiter listing (folder view)
  for (const prefix of ["", "archeritage/", "safi-patrimoine/"]) {
    const res = await fetch(`${apiUrl}/b2api/v3/b2_list_file_names`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucketId: target.bucketId,
        prefix,
        delimiter: "/",
        maxFileCount: 100,
      }),
    });
    const data = (await res.json()) as {
      files?: unknown[];
      commonPrefixes?: string[];
    };
    console.log(
      JSON.stringify({
        delimiterScanPrefix: prefix || "(root)",
        ok: res.ok,
        files: data.files?.length ?? 0,
        commonPrefixes: data.commonPrefixes ?? [],
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
