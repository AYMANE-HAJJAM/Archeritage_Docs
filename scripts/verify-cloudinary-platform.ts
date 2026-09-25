/**
 * Cloudinary platform cleanup verification (+ optional delete of leftovers).
 * Does NOT touch DB or B2.
 *
 * Default: inventory only.
 * CLOUDINARY_FORCE_CLEAN=1 → delete remaining platform assets, then re-verify.
 */
import { config } from "dotenv";
config({ path: ".env" });

import { v2 as cloudinary } from "cloudinary";

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

const FORCE = process.env.CLOUDINARY_FORCE_CLEAN === "1";

const PLATFORM_PREFIXES = ["archeritage/", "safi-patrimoine/"] as const;
const PRESERVE_PREFIXES = [
  "samples/",
  "uploads/",
  "naala-foncier/",
  "rg3cp/",
  "project/",
] as const;

type Asset = {
  public_id: string;
  asset_id?: string;
  resource_type: string;
  type: string;
  bytes: number;
  folder?: string | null;
  reason: string;
};

function configure() {
  cloudinary.config({
    cloud_name: required("CLOUDINARY_CLOUD_NAME"),
    api_key: required("CLOUDINARY_API_KEY"),
    api_secret: required("CLOUDINARY_API_SECRET"),
    secure: true,
  });
}

function isPreserved(publicId: string): boolean {
  const id = publicId.replace(/^\/+/, "");
  return PRESERVE_PREFIXES.some(
    (p) => id === p.slice(0, -1) || id.startsWith(p),
  );
}

function isPlatformByPrefix(publicId: string): boolean {
  const id = publicId.replace(/^\/+/, "");
  return PLATFORM_PREFIXES.some(
    (p) => id === p.slice(0, -1) || id.startsWith(p),
  );
}

/** Heuristic legacy ARCHERITAGE / Safi assets outside known folders. */
function isPlatformLegacyHeuristic(publicId: string): boolean {
  if (isPreserved(publicId)) return false;
  if (isPlatformByPrefix(publicId)) return false;
  const id = publicId.toLowerCase();
  // Explicit product / dossier markers only — avoid broad UUID root matches
  return (
    /\b(archeritage|safi[-_]?patrimoine|murailles?|chateau[-_]?de[-_]?mer|chateau[-_]mer)\b/.test(
      id,
    ) ||
    id.startsWith("saf-") ||
    id.startsWith("saf_") ||
    id.includes("/safi/") ||
    id.includes("safi-patrimoine") ||
    id.includes("murailles-portugaises") ||
    id.includes("chateau-de-mer")
  );
}

async function listAllResources(): Promise<
  Array<{
    public_id: string;
    asset_id?: string;
    resource_type: string;
    type: string;
    bytes: number;
    folder?: string | null;
  }>
> {
  const out: Array<{
    public_id: string;
    asset_id?: string;
    resource_type: string;
    type: string;
    bytes: number;
    folder?: string | null;
  }> = [];
  const resourceTypes = ["image", "video", "raw"] as const;
  const types = ["upload", "authenticated", "private"] as const;

  for (const resource_type of resourceTypes) {
    for (const type of types) {
      let next_cursor: string | undefined;
      do {
        try {
          const res = (await cloudinary.api.resources({
            resource_type,
            type,
            max_results: 500,
            next_cursor,
          })) as {
            resources?: Array<{
              public_id: string;
              asset_id?: string;
              bytes?: number;
              folder?: string;
            }>;
            next_cursor?: string;
          };
          for (const r of res.resources ?? []) {
            out.push({
              public_id: r.public_id,
              asset_id: r.asset_id,
              resource_type,
              type,
              bytes: r.bytes ?? 0,
              folder: r.folder ?? null,
            });
          }
          next_cursor = res.next_cursor;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!/not found|Invalid|404/i.test(msg)) {
            console.warn(`list ${resource_type}/${type}:`, msg);
          }
          next_cursor = undefined;
        }
      } while (next_cursor);
    }
  }
  return out;
}

async function searchExpression(expression: string): Promise<
  Array<{ public_id: string; resource_type?: string; bytes?: number }>
> {
  const hits: Array<{
    public_id: string;
    resource_type?: string;
    bytes?: number;
  }> = [];
  let next_cursor: string | undefined;
  do {
    try {
      const res = (await cloudinary.search
        .expression(expression)
        .max_results(500)
        .next_cursor(next_cursor)
        .execute()) as {
        resources?: Array<{
          public_id: string;
          resource_type?: string;
          bytes?: number;
        }>;
        next_cursor?: string;
      };
      for (const r of res.resources ?? []) hits.push(r);
      next_cursor = res.next_cursor;
    } catch (err) {
      console.warn(
        "search failed:",
        expression,
        err instanceof Error ? err.message : err,
      );
      break;
    }
  } while (next_cursor);
  return hits;
}

function classify(
  all: Awaited<ReturnType<typeof listAllResources>>,
): {
  platform: Asset[];
  preserved: Asset[];
  otherRoot: Asset[];
} {
  const platform: Asset[] = [];
  const preserved: Asset[] = [];
  const otherRoot: Asset[] = [];

  for (const a of all) {
    if (isPreserved(a.public_id)) {
      preserved.push({ ...a, reason: "preserve-prefix" });
      continue;
    }
    if (isPlatformByPrefix(a.public_id)) {
      platform.push({ ...a, reason: "platform-prefix" });
      continue;
    }
    if (isPlatformLegacyHeuristic(a.public_id)) {
      platform.push({ ...a, reason: "legacy-heuristic" });
      continue;
    }
    otherRoot.push({ ...a, reason: "unrelated-or-unknown-root" });
  }
  return { platform, preserved, otherRoot };
}

function countByType(assets: Asset[]) {
  const m: Record<string, { count: number; bytes: number }> = {};
  for (const a of assets) {
    if (!m[a.resource_type]) m[a.resource_type] = { count: 0, bytes: 0 };
    m[a.resource_type]!.count += 1;
    m[a.resource_type]!.bytes += a.bytes;
  }
  return m;
}

function countByPrefix(assets: Asset[]) {
  const m: Record<string, number> = {};
  for (const a of assets) {
    const p = a.public_id.includes("/")
      ? a.public_id.split("/")[0]!
      : "(root)";
    m[p] = (m[p] ?? 0) + 1;
  }
  return m;
}

async function deletePlatform(assets: Asset[]) {
  const groups = new Map<string, string[]>();
  for (const a of assets) {
    const key = `${a.resource_type}|${a.type}`;
    const list = groups.get(key) ?? [];
    list.push(a.public_id);
    groups.set(key, list);
  }
  for (const [key, ids] of groups) {
    const [resource_type, type] = key.split("|") as [string, string];
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      try {
        const res = await cloudinary.api.delete_resources(chunk, {
          resource_type,
          type,
        });
        console.log(
          `deleted ${resource_type}/${type} chunk ${i / 100 + 1}:`,
          JSON.stringify(res.deleted ?? res).slice(0, 200),
        );
      } catch (err) {
        console.warn(
          `delete failed ${resource_type}/${type}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }
}

async function main() {
  configure();
  console.log(
    JSON.stringify(
      {
        cloudName: required("CLOUDINARY_CLOUD_NAME"),
        apiKeyMasked: `${required("CLOUDINARY_API_KEY").slice(0, 4)}…${required("CLOUDINARY_API_KEY").slice(-4)}`,
        forceClean: FORCE,
      },
      null,
      2,
    ),
  );

  console.log("\n[1] Full account inventory…");
  const all = await listAllResources();

  console.log("\n[2] Search API for platform keywords…");
  const searchHits = [
    ...(await searchExpression("folder:archeritage*")),
    ...(await searchExpression("folder:safi-patrimoine*")),
    ...(await searchExpression("public_id:archeritage*")),
    ...(await searchExpression("public_id:safi-patrimoine*")),
    ...(await searchExpression("public_id:*murailles*")),
    ...(await searchExpression("public_id:*chateau*")),
  ];
  const searchIds = new Set(searchHits.map((h) => h.public_id));

  const classified = classify(all);
  // Add search hits not already classified if they look platform-related
  for (const id of searchIds) {
    if (classified.platform.some((p) => p.public_id === id)) continue;
    if (isPreserved(id)) continue;
    if (isPlatformByPrefix(id) || isPlatformLegacyHeuristic(id)) {
      const hit = searchHits.find((h) => h.public_id === id)!;
      classified.platform.push({
        public_id: id,
        resource_type: hit.resource_type ?? "image",
        type: "upload",
        bytes: hit.bytes ?? 0,
        reason: "search-hit",
      });
    }
  }

  const before = {
    accountTotal: all.length,
    platform: {
      count: classified.platform.length,
      bytes: classified.platform.reduce((s, a) => s + a.bytes, 0),
      bytesHuman: formatBytes(
        classified.platform.reduce((s, a) => s + a.bytes, 0),
      ),
      byType: countByType(classified.platform),
      byReason: classified.platform.reduce(
        (acc, a) => {
          acc[a.reason] = (acc[a.reason] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      sample: classified.platform.slice(0, 20).map((a) => ({
        public_id: a.public_id,
        resource_type: a.resource_type,
        type: a.type,
        bytes: a.bytes,
        reason: a.reason,
      })),
    },
    prefixes: {
      archeritage: all.filter((a) => isPlatformByPrefix(a.public_id) && a.public_id.replace(/^\/+/, "").startsWith("archeritage")).length,
      safiPatrimoine: all.filter((a) =>
        a.public_id.replace(/^\/+/, "").startsWith("safi-patrimoine"),
      ).length,
    },
    preserved: {
      count: classified.preserved.length,
      byPrefix: countByPrefix(classified.preserved),
    },
    otherRootUnrelated: {
      count: classified.otherRoot.length,
      byPrefix: countByPrefix(classified.otherRoot),
      sample: classified.otherRoot.slice(0, 10).map((a) => a.public_id),
    },
    searchHitCount: searchIds.size,
  };

  console.log("\n── BEFORE ──");
  console.log(JSON.stringify(before, null, 2));

  if (classified.platform.length === 0) {
    console.log("\nNo platform Cloudinary assets remain. Nothing to delete.");
    console.log("\n── AFTER (unchanged) ──");
    console.log(
      JSON.stringify(
        {
          platformImages: 0,
          platformVideos: 0,
          platformRaw: 0,
          preservedCount: classified.preserved.length,
          unrelatedRootCount: classified.otherRoot.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!FORCE) {
    console.log(
      `\n${classified.platform.length} platform asset(s) remain. Re-run with CLOUDINARY_FORCE_CLEAN=1 to delete them.`,
    );
    process.exitCode = 2;
    return;
  }

  console.log(
    `\n[3] Deleting ${classified.platform.length} platform assets…`,
  );
  await deletePlatform(classified.platform);

  console.log("\n[4] Re-inventory…");
  const afterAll = await listAllResources();
  const afterClassified = classify(afterAll);
  const after = {
    accountTotal: afterAll.length,
    platform: {
      count: afterClassified.platform.length,
      byType: countByType(afterClassified.platform),
      sample: afterClassified.platform.slice(0, 10).map((a) => a.public_id),
    },
    prefixes: {
      archeritage: afterAll.filter((a) =>
        a.public_id.replace(/^\/+/, "").startsWith("archeritage"),
      ).length,
      safiPatrimoine: afterAll.filter((a) =>
        a.public_id.replace(/^\/+/, "").startsWith("safi-patrimoine"),
      ).length,
    },
    preserved: {
      count: afterClassified.preserved.length,
      byPrefix: countByPrefix(afterClassified.preserved),
    },
    otherRootUnrelated: {
      count: afterClassified.otherRoot.length,
    },
  };

  console.log("\n── AFTER ──");
  console.log(JSON.stringify(after, null, 2));

  const platformByType = countByType(afterClassified.platform);
  const ok =
    afterClassified.platform.length === 0 &&
    (platformByType.image?.count ?? 0) === 0 &&
    (platformByType.video?.count ?? 0) === 0 &&
    (platformByType.raw?.count ?? 0) === 0 &&
    after.prefixes.archeritage === 0 &&
    after.prefixes.safiPatrimoine === 0;

  // preserved should not drop dramatically vs before (allow small listing variance)
  if (
    afterClassified.preserved.length + 5 <
    classified.preserved.length
  ) {
    console.error("WARNING: preserved asset count dropped unexpectedly");
    process.exitCode = 1;
  }

  if (!ok) {
    console.error("Platform assets still remain after cleanup");
    process.exitCode = 1;
  } else {
    console.log("\nPLATFORM CLOUDINARY CLEAN — images/videos/raw = 0");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
