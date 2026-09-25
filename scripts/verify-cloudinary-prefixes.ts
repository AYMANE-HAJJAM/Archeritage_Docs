/**
 * Per-type / per-prefix Cloudinary platform zero-check.
 */
import { config } from "dotenv";
config({ path: ".env" });
import { v2 as cloudinary } from "cloudinary";

function required(k: string) {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ${k}`);
  return v;
}

cloudinary.config({
  cloud_name: required("CLOUDINARY_CLOUD_NAME"),
  api_key: required("CLOUDINARY_API_KEY"),
  api_secret: required("CLOUDINARY_API_SECRET"),
  secure: true,
});

async function countPrefix(
  resource_type: string,
  type: string,
  prefix: string,
): Promise<{ count: number; sample: string[] }> {
  let count = 0;
  const sample: string[] = [];
  let next_cursor: string | undefined;
  do {
    try {
      const res = (await cloudinary.api.resources({
        resource_type,
        type,
        prefix,
        max_results: 500,
        next_cursor,
      })) as {
        resources?: Array<{ public_id: string }>;
        next_cursor?: string;
      };
      for (const r of res.resources ?? []) {
        count += 1;
        if (sample.length < 5) sample.push(r.public_id);
      }
      next_cursor = res.next_cursor;
    } catch {
      break;
    }
  } while (next_cursor);
  return { count, sample };
}

async function main() {
  const resourceTypes = ["image", "video", "raw"] as const;
  const types = ["upload", "authenticated", "private"] as const;
  const prefixes = ["archeritage", "safi-patrimoine"];
  const report: Record<string, unknown> = {};

  for (const prefix of prefixes) {
    const row: Record<string, unknown> = {};
    for (const resource_type of resourceTypes) {
      const byDelivery: Record<string, unknown> = {};
      let total = 0;
      for (const type of types) {
        const r = await countPrefix(resource_type, type, prefix);
        byDelivery[type] = r;
        total += r.count;
      }
      row[resource_type] = { total, byDelivery };
    }
    report[prefix] = row;
  }

  // root folders listing if available
  let rootFolders: string[] = [];
  try {
    const folders = (await cloudinary.api.root_folders()) as {
      folders?: Array<{ name: string }>;
    };
    rootFolders = (folders.folders ?? []).map((f) => f.name);
  } catch (err) {
    rootFolders = [`(error: ${err instanceof Error ? err.message : err})`];
  }

  console.log(
    JSON.stringify(
      {
        cloudName: required("CLOUDINARY_CLOUD_NAME"),
        rootFolders,
        platformPrefixScan: report,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
