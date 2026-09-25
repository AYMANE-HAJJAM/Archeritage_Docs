/**
 * Media-only dry run. Classifies from folder path, filename, extension, and size.
 * SHA-256 is streamed. File bytes are not decoded or inspected.
 * Does not create structure and does not upload.
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  detectFileKind,
  resolveStorageProvider,
} from "../../lib/storage/provider";
import { cloudinaryVideoMaxBytes } from "../../lib/storage/video-limit";

const ROOT = path.resolve("import-source/media");
const CHATEAU = "Château de Mer";
const MURAILLES = "Murailles portugaises de Safi";
const GROUP = "DOCUMENTATION VISUELLE";
const PHOTO = "Documentation photographique";
const VIDEO = "Documentation vidéo";

type Kind = "image" | "video" | "document";
type Status = "READY" | "DUPLICATE" | "UNRESOLVED" | "UNSUPPORTED";

type Target = {
  project: string;
  part: string;
  section: string;
  folders: string[];
  area: string;
};

type Row = {
  sourceRelativePath: string;
  filename: string;
  extension: string;
  sizeBytes: number;
  sizeMB: number;
  sha256: string;
  detectedKind: Kind;
  targetProject: string | null;
  targetPart: string | null;
  targetGroup: string | null;
  targetSection: string | null;
  targetFolders: string[];
  expectedStorageProvider: "CLOUDINARY" | "BACKBLAZE_B2" | null;
  duplicateOf: string | null;
  duplicateGroup: string | null;
  crossContext: boolean;
  area: string | null;
  status: Status;
  reason: string;
};

function hashFile(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function classify(parts: string[], kind: Kind): { target: Target; reason: string } | null {
  const root = parts[0];
  const rest = parts.slice(1);

  if (root === "CHATEAU MER") {
    const side = rest[0];
    const bucket = rest[1];
    if ((side === "Externe" || side === "Interne") && rest.length === 2) {
      if (bucket === "Photos" && kind === "image") {
        return loc(CHATEAU, "GLOBAL", PHOTO, [side], "Château", "Dossier photo Externe/Interne.");
      }
      if (bucket === "Vidéos" && kind === "video") {
        return loc(CHATEAU, "GLOBAL", VIDEO, [side], "Château", "Dossier vidéo Externe/Interne.");
      }
    }
    return null;
  }

  if (root === "Façade maritime Muraille") {
    const side = rest[0];
    const bucket = rest[1];
    if ((side === "Externe" || side === "Interne") && rest.length === 2) {
      if (bucket === "Photos" && kind === "image") {
        return loc(
          MURAILLES,
          "Façade maritime de la Muraille",
          PHOTO,
          [side],
          "Façade maritime",
          "Façade maritime, dossier photo.",
        );
      }
      if (bucket === "Vidéos" && kind === "video") {
        return loc(
          MURAILLES,
          "Façade maritime de la Muraille",
          VIDEO,
          [side],
          "Façade maritime",
          "Façade maritime, dossier vidéo.",
        );
      }
    }
    return null;
  }

  if (root === "Muraille partie 2") {
    const side = rest[0];
    if ((side === "Externe" || side === "Interne") && rest.length === 2) {
      if (rest[1] === "Photos" && kind === "image") {
        return loc(MURAILLES, "Muraille — Partie 2", PHOTO, [side], "Muraille Partie 2", "Partie 2, dossier photo.");
      }
      if (rest[1] === "Vidéos" && kind === "video") {
        return loc(MURAILLES, "Muraille — Partie 2", VIDEO, [side], "Muraille Partie 2", "Partie 2, dossier vidéo.");
      }
    }
    if (side === "Potiers" && (rest.length === 1 || (rest.length === 2 && rest[1] === "Vidéo"))) {
      if (kind === "image") {
        return loc(MURAILLES, "Muraille — Partie 2", PHOTO, ["Potiers"], "Muraille Partie 2", "Potiers, image par extension.");
      }
      if (kind === "video") {
        return loc(MURAILLES, "Muraille — Partie 2", VIDEO, ["Potiers"], "Muraille Partie 2", "Potiers, vidéo par extension.");
      }
    }
    return null;
  }

  if (root === "Tranche IX") {
    const secteur = rest[0];
    if (secteur === "Secteur A") {
      if (rest.length === 1 && kind === "video") {
        return loc(MURAILLES, "Tranche IX", VIDEO, ["Secteur A"], "Tranche IX / Secteur A", "Vidéo à la racine du Secteur A.");
      }
      if (rest.length === 2 && rest[1] === "Photos" && kind === "image") {
        return loc(MURAILLES, "Tranche IX", PHOTO, ["Secteur A"], "Tranche IX / Secteur A", "Photos du Secteur A.");
      }
      if (rest.length === 2 && rest[1] === "Interne" && kind === "video") {
        return loc(MURAILLES, "Tranche IX", VIDEO, ["Secteur A", "Interne"], "Tranche IX / Secteur A", "Vidéos internes du Secteur A.");
      }
      if (rest.length === 2 && rest[1] === "Interne" && kind === "image") {
        return loc(MURAILLES, "Tranche IX", PHOTO, ["Secteur A", "Interne"], "Tranche IX / Secteur A", "Image dans le dossier Interne du Secteur A.");
      }
      return null;
    }
    if (secteur === "Secteur B" || secteur === "Secteur C") {
      const area = `Tranche IX / ${secteur}`;
      const side = rest[1];
      if ((side === "Externe" || side === "Interne") && rest.length === 3) {
        if (rest[2] === "Photos" && kind === "image") {
          return loc(MURAILLES, "Tranche IX", PHOTO, [secteur, side], area, `${secteur} ${side} photos.`);
        }
        if (rest[2] === "Vidéos" && kind === "video") {
          return loc(MURAILLES, "Tranche IX", VIDEO, [secteur, side], area, `${secteur} ${side} vidéos.`);
        }
      }
      if (secteur === "Secteur C" && rest.length === 2 && rest[1] === "Mosquée du Sultan" && kind === "video") {
        return loc(MURAILLES, "Tranche IX", VIDEO, ["Secteur C", "Mosquée du Sultan"], area, "Vidéos Mosquée du Sultan.");
      }
      if (secteur === "Secteur C" && rest.length === 2 && rest[1] === "Residence du Sultan" && kind === "image") {
        return loc(MURAILLES, "Tranche IX", PHOTO, ["Secteur C", "Résidence du Sultan"], area, "Images Résidence du Sultan.");
      }
    }
  }
  return null;
}

function loc(
  project: string,
  part: string,
  section: string,
  folders: string[],
  area: string,
  reason: string,
): { target: Target; reason: string } {
  return { target: { project, part, section, folders, area }, reason };
}

function targetKey(row: Pick<Row, "targetProject" | "targetPart" | "targetSection" | "targetFolders">): string {
  return [row.targetProject, row.targetPart, row.targetSection, row.targetFolders.join("/")].join("|");
}

function chooseCanonical(paths: string[]): string {
  return [...paths].sort((a, b) => {
    const copy = (value: string) => (/copie|\(\d+\)/i.test(path.basename(value)) ? 1 : 0);
    const score = copy(a) - copy(b);
    if (score !== 0) return score;
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b, "fr");
  })[0];
}

async function main() {
  const files = await walk(ROOT);
  const rows: Row[] = [];
  let n = 0;
  for (const file of files) {
    n += 1;
    if (n % 50 === 0) console.log(`hashed ${n}/${files.length}`);
    const info = await stat(file);
    const relative = path.relative(ROOT, file).split(path.sep).join("/");
    const parts = relative.split("/");
    const filename = parts[parts.length - 1];
    const folders = parts.slice(0, -1);
    const extension = path.extname(filename).replace(/^\./, "").toLowerCase();
    const kind = detectFileKind({
      fileName: filename,
      mimeType: "application/octet-stream",
    });
    const sha256 = await hashFile(file);
    const sizeMB = Math.round((info.size / (1024 * 1024)) * 100) / 100;

    if (kind !== "image" && kind !== "video") {
      rows.push({
        sourceRelativePath: relative,
        filename,
        extension,
        sizeBytes: info.size,
        sizeMB,
        sha256,
        detectedKind: kind,
        targetProject: null,
        targetPart: null,
        targetGroup: null,
        targetSection: null,
        targetFolders: [],
        expectedStorageProvider: null,
        duplicateOf: null,
        duplicateGroup: null,
        crossContext: false,
        area: null,
        status: "UNSUPPORTED",
        reason: "Ni image ni vidéo reconnue par l’extension.",
      });
      continue;
    }

    const mapped = classify(folders, kind);
    const provider = resolveStorageProvider({
      fileName: filename,
      mimeType: "application/octet-stream",
      sizeBytes: info.size,
    });
    if (!mapped) {
      rows.push({
        sourceRelativePath: relative,
        filename,
        extension,
        sizeBytes: info.size,
        sizeMB,
        sha256,
        detectedKind: kind,
        targetProject: null,
        targetPart: null,
        targetGroup: null,
        targetSection: null,
        targetFolders: [],
        expectedStorageProvider: provider,
        duplicateOf: null,
        duplicateGroup: null,
        crossContext: false,
        area: null,
        status: "UNRESOLVED",
        reason: "Chemin source hors des règles de classement.",
      });
      continue;
    }

    rows.push({
      sourceRelativePath: relative,
      filename,
      extension,
      sizeBytes: info.size,
      sizeMB,
      sha256,
      detectedKind: kind,
      targetProject: mapped.target.project,
      targetPart: mapped.target.part,
      targetGroup: GROUP,
      targetSection: mapped.target.section,
      targetFolders: mapped.target.folders,
      expectedStorageProvider: provider,
      duplicateOf: null,
      duplicateGroup: null,
      crossContext: false,
      area: mapped.target.area,
      status: "READY",
      reason: mapped.reason,
    });
  }

  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    if (row.status !== "READY") continue;
    const list = groups.get(row.sha256) ?? [];
    list.push(row);
    groups.set(row.sha256, list);
  }
  let groupIndex = 0;
  const duplicateGroups: Array<{
    sha256: string;
    crossContext: boolean;
    canonical: string;
    files: string[];
  }> = [];
  for (const [sha, members] of groups) {
    if (members.length < 2) continue;
    groupIndex += 1;
    const id = `dup-${groupIndex}`;
    const contexts = new Set(members.map(targetKey));
    const crossContext = contexts.size > 1;
    const canonical = chooseCanonical(members.map((row) => row.sourceRelativePath));
    for (const row of members) {
      row.duplicateGroup = id;
      row.crossContext = crossContext;
      if (!crossContext && row.sourceRelativePath !== canonical) {
        row.status = "DUPLICATE";
        row.duplicateOf = canonical;
        row.reason = `Même contenu que ${canonical}, même destination.`;
      }
    }
    duplicateGroups.push({
      sha256: sha,
      crossContext,
      canonical,
      files: members.map((row) => row.sourceRelativePath),
    });
  }

  const ready = rows.filter((row) => row.status === "READY");
  const sum = (items: Row[]) => items.reduce((n, row) => n + row.sizeBytes, 0);
  const images = ready.filter((row) => row.detectedKind === "image");
  const videos = ready.filter((row) => row.detectedKind === "video");
  const cloudinaryImages = images.filter((row) => row.expectedStorageProvider === "CLOUDINARY");
  const cloudinaryVideos = videos.filter((row) => row.expectedStorageProvider === "CLOUDINARY");
  const b2Videos = videos.filter((row) => row.expectedStorageProvider === "BACKBLAZE_B2");
  const areas = new Map<string, number>();
  for (const row of ready) {
    const key = row.area ?? "autre";
    areas.set(key, (areas.get(key) ?? 0) + 1);
  }

  const counts = {
    total: rows.length,
    images: rows.filter((row) => row.detectedKind === "image").length,
    videos: rows.filter((row) => row.detectedKind === "video").length,
    ready: ready.length,
    duplicate: rows.filter((row) => row.status === "DUPLICATE").length,
    unresolved: rows.filter((row) => row.status === "UNRESOLVED").length,
    unsupported: rows.filter((row) => row.status === "UNSUPPORTED").length,
    cloudinaryImages: cloudinaryImages.length,
    cloudinaryImageBytes: sum(cloudinaryImages),
    cloudinaryVideos: cloudinaryVideos.length,
    cloudinaryVideoBytes: sum(cloudinaryVideos),
    b2Videos: b2Videos.length,
    b2VideoBytes: sum(b2Videos),
    videoThresholdBytes: cloudinaryVideoMaxBytes(),
    byArea: Object.fromEntries([...areas.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"))),
  };

  await mkdir(path.resolve("reports/import"), { recursive: true });
  await writeFile(
    path.resolve("reports/import/media-import-manifest.json"),
    JSON.stringify(
      {
        phase: "media-only-dry-run",
        generatedAt: new Date().toISOString(),
        note: "Classification from path and extension only. No media was decoded and no storage or business rows were written.",
        counts,
        duplicateGroups,
        files: rows.sort((a, b) => a.sourceRelativePath.localeCompare(b.sourceRelativePath, "fr")),
      },
      null,
      2,
    ),
    "utf8",
  );

  const lines = [
    "Media import dry run",
    `Files: ${counts.total}`,
    `Images: ${counts.images}`,
    `Videos: ${counts.videos}`,
    `READY: ${counts.ready}`,
    `DUPLICATE: ${counts.duplicate}`,
    `UNRESOLVED: ${counts.unresolved}`,
    `UNSUPPORTED: ${counts.unsupported}`,
    `Cloudinary images: ${counts.cloudinaryImages} (${counts.cloudinaryImageBytes} bytes)`,
    `Cloudinary videos: ${counts.cloudinaryVideos} (${counts.cloudinaryVideoBytes} bytes)`,
    `B2 videos: ${counts.b2Videos} (${counts.b2VideoBytes} bytes)`,
    `Video threshold bytes: ${counts.videoThresholdBytes}`,
    "",
    "By area:",
    ...Object.entries(counts.byArea).map(([area, count]) => `- ${area}: ${count}`),
    "",
    "Duplicate groups:",
    ...duplicateGroups.map(
      (group) =>
        `- ${group.crossContext ? "CROSS" : "SAME"} ${group.sha256.slice(0, 12)} canonical=${group.canonical} (${group.files.length})`,
    ),
    "",
    "Large B2 videos:",
    ...b2Videos.map((row) => `- ${row.sizeMB} MiB ${row.sourceRelativePath}`),
    "",
    "UNRESOLVED:",
    ...rows.filter((row) => row.status === "UNRESOLVED").map((row) => `- ${row.sourceRelativePath}`),
  ];
  await writeFile(
    path.resolve("reports/import/media-import-summary.txt"),
    lines.join("\n") + "\n",
    "utf8",
  );
  console.log(JSON.stringify(counts, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
