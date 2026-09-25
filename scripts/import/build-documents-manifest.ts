/**
 * Documents-only dry run. Reads local import-source files and writes a manifest.
 * Does not create Territoire/Project/structure rows and does not upload.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { generateSlug, proposeProjectCode } from "../../lib/admin/identifiers";
import { buildCloudinaryFolderPath } from "../../lib/storage/path-builder";
import {
  detectFileKind,
  resolveStorageProvider,
} from "../../lib/storage/provider";

const ROOT = path.resolve("import-source");
const CHATEAU_ROOT = path.join(
  ROOT,
  "dossier chateau de mert SAFI",
  "chateau de mer synthese",
);
const MURAILLES_ROOT = path.join(ROOT, "muraille portugaise");

const TERRITOIRE_NAME = "Safi Patrimoine";
const TERRITOIRE_CODE = proposeProjectCode(TERRITOIRE_NAME);

type Status = "READY" | "DUPLICATE" | "UNRESOLVED" | "SKIP_MEDIA";

type Target = {
  project: "Château de Mer" | "Murailles portugaises de Safi";
  part: string | "GLOBAL";
  group: string;
  section: string;
  nestedFolder: string | null;
  reason: string;
};

type ManifestEntry = {
  sourceRoot: string;
  relativePath: string;
  filename: string;
  extension: string;
  sizeBytes: number;
  sha256: string;
  detectedKind: "image" | "video" | "document";
  targetTerritoire: string;
  targetProject: string | null;
  targetPart: string | null;
  targetGroup: string | null;
  targetSection: string | null;
  nestedFolder: string | null;
  expectedStorageProvider: "CLOUDINARY" | "BACKBLAZE_B2";
  logicalFolderPreview: string | null;
  duplicateOf: string | null;
  status: Status;
  reason: string;
};

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function readZipEntry(buf: Buffer, name: string): Buffer | null {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let cursor = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(cursor) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(cursor + 10);
    const compSize = buf.readUInt32LE(cursor + 20);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const localOffset = buf.readUInt32LE(cursor + 42);
    const entryName = buf.subarray(cursor + 46, cursor + 46 + nameLen).toString("utf8");
    cursor += 46 + nameLen + extraLen + commentLen;
    if (entryName !== name) continue;
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraExtra(localExtraLen);
    const compressed = buf.subarray(dataStart, dataStart + compSize);
    if (method === 0) return Buffer.from(compressed);
    if (method === 8) return inflateRawSync(compressed);
    return null;
  }
  return null;
}

function localExtraExtra(len: number): number {
  return len;
}

function docxPlainText(buf: Buffer): string {
  const xml = readZipEntry(buf, "word/document.xml");
  if (!xml) return "";
  return xml
    .toString("utf8")
    .replace(/<w:p\b[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function pdfPlainText(buf: Buffer): string {
  const chunks: string[] = [];
  const source = buf.toString("latin1");
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(source))) {
    const raw = Buffer.from(match[1], "latin1");
    let text = "";
    try {
      text = inflateRawSync(raw).toString("latin1");
    } catch {
      text = raw.toString("latin1");
    }
    const pieces = text.match(/\((?:\\.|[^\\)]){2,}\)/g) ?? [];
    for (const piece of pieces) {
      const inner = piece
        .slice(1, -1)
        .replace(/\\n/g, " ")
        .replace(/\\r/g, " ")
        .replace(/\\t/g, " ")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      if (/[A-Za-zÀ-ÿ]{3,}/.test(inner)) chunks.push(inner);
    }
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim().slice(0, 4000);
}

function snippet(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const letters = clean.match(/[A-Za-zÀ-ÿ]/g)?.length ?? 0;
  if (letters < 24 || letters / Math.max(clean.length, 1) < 0.4) return "";
  return clean.slice(0, 180);
}

function classifyChateau(filename: string, text: string): Target | null {
  const name = fold(filename.replace(/\.[^.]+$/, ""));
  const body = fold(text);
  const project = "Château de Mer" as const;

  if (name.includes("pack consultation") || name.startsWith("pack consultation")) {
    return {
      project,
      part: "GLOBAL",
      group: "CONSULTATION & PROJET",
      section: "Dossier de consultation",
      nestedFolder: null,
      reason: "Nom explicite : pack de consultation.",
    };
  }
  if (name.includes("memoire technique")) {
    return {
      project,
      part: "GLOBAL",
      group: "CONSULTATION & PROJET",
      section: "Mémoire technique",
      nestedFolder: null,
      reason: "Nom explicite : mémoire technique.",
    };
  }
  if (name.includes("etape") && name.includes("consultation")) {
    return {
      project,
      part: "GLOBAL",
      group: "CONSULTATION & PROJET",
      section: "Dossier de consultation",
      nestedFolder: null,
      reason: "Nom explicite : étapes de préparation de la consultation.",
    };
  }
  if (
    name.includes("lettre") && name.includes("intention") ||
    name.includes("mlettre")
  ) {
    return {
      project,
      part: "GLOBAL",
      group: "CONSULTATION & PROJET",
      section: "Équipe & pièces de candidature",
      nestedFolder: null,
      reason: "Nom explicite : lettre d’intention d’équipe.",
    };
  }
  if (name.includes("cv") && (name.includes("mission") || name.includes("equipe"))) {
    return {
      project,
      part: "GLOBAL",
      group: "CONSULTATION & PROJET",
      section: "Équipe & pièces de candidature",
      nestedFolder: null,
      reason: "Nom explicite : modèle de CV de mission.",
    };
  }
  if (
    name.includes("dahir") ||
    name.includes("bulletin officiel") ||
    name.includes("dossier juridique") ||
    name.includes("classement")
  ) {
    return {
      project,
      part: "GLOBAL",
      group: "COMPRENDRE",
      section: "Protection juridique",
      nestedFolder: null,
      reason: "Document juridique, dahir, bulletin officiel ou texte de classement.",
    };
  }
  if (name === "chateau de mer") {
    return {
      project,
      part: "GLOBAL",
      group: "COMPRENDRE",
      section: "Présentation & histoire",
      nestedFolder: null,
      reason: "Document de présentation du château.",
    };
  }
  if (name === "lecture 1" || name === "article" || name === "article2") {
    return {
      project,
      part: "GLOBAL",
      group: "COMPRENDRE",
      section: "Documentation & articles",
      nestedFolder: null,
      reason: "Article ou lecture documentaire.",
    };
  }
  if (name.includes("portuaire")) {
    return {
      project,
      part: "GLOBAL",
      group: "DIAGNOSTIC & ENVIRONNEMENT",
      section: "Environnement maritime & littoral",
      nestedFolder: null,
      reason: "Document portuaire / environnement maritime.",
    };
  }
  if (name.includes("expertise") || name.includes("kssar") || name.includes("qsar")) {
    return {
      project,
      part: "GLOBAL",
      group: "DIAGNOSTIC & ENVIRONNEMENT",
      section: "Expertise & diagnostic",
      nestedFolder: null,
      reason: "Rapport d’expertise / diagnostic.",
    };
  }
  if (
    body.includes("bulletin officiel") ||
    body.includes("dahir") ||
    (body.includes("classement") && body.includes("patrimoine"))
  ) {
    return {
      project,
      part: "GLOBAL",
      group: "COMPRENDRE",
      section: "Protection juridique",
      nestedFolder: null,
      reason: "Le texte confirme un document juridique ou de classement, sans nom déjà mappé.",
    };
  }
  return null;
}

function classifyMurailles(filename: string): Target | null {
  const name = fold(filename.replace(/\.[^.]+$/, ""));
  const project = "Murailles portugaises de Safi" as const;

  if (name.includes("atlas") && name.includes("patholog")) {
    return {
      project,
      part: "GLOBAL",
      group: "DIAGNOSTIC",
      section: "Pathologies",
      nestedFolder: null,
      reason: "Atlas des pathologies.",
    };
  }
  if (name === "rc" || name.startsWith("rc ")) {
    return {
      project,
      part: "GLOBAL",
      group: "CONSULTATION & PROJET",
      section: "Règlement de consultation",
      nestedFolder: null,
      reason: "Règlement de consultation.",
    };
  }
  if (name.includes("pieces complementaires") || name.includes("piece complementaire")) {
    return {
      project,
      part: "GLOBAL",
      group: "CONSULTATION & PROJET",
      section: "Pièces complémentaires",
      nestedFolder: null,
      reason: "Pièces complémentaires de consultation.",
    };
  }
  if (name.includes("analyse comparative") || name.includes("recommandation")) {
    return {
      project,
      part: "GLOBAL",
      group: "CONSULTATION & PROJET",
      section: "Analyses & recommandations",
      nestedFolder: null,
      reason: "Analyse comparative et recommandations.",
    };
  }
  if (name.startsWith("cps") || name.includes(" cps")) {
    return {
      project,
      part: "GLOBAL",
      group: "CONSULTATION & PROJET",
      section: "CPS",
      nestedFolder: null,
      reason: "Cahier des prescriptions spéciales.",
    };
  }
  if (name.startsWith("synthese donnees plans") || name.startsWith("synthese donnees plan")) {
    return {
      project,
      part: "GLOBAL",
      group: "RELEVÉS & PLANS",
      section: "Synthèses",
      nestedFolder: null,
      reason: "Synthèse des données de plans. Les variantes de nom sont comparées par SHA-256.",
    };
  }
  const tranche = name.match(/tranche\s+(iii|iv|v|vi|ix|3|4|5|6|9)\b/);
  if (tranche && name.includes("objet")) {
    const token = tranche[1];
    const map: Record<string, { part: string | "GLOBAL"; section: string }> = {
      iii: { part: "GLOBAL", section: "Tranche III" },
      "3": { part: "GLOBAL", section: "Tranche III" },
      iv: { part: "GLOBAL", section: "Tranche IV" },
      "4": { part: "GLOBAL", section: "Tranche IV" },
      v: { part: "GLOBAL", section: "Tranche V" },
      "5": { part: "GLOBAL", section: "Tranche V" },
      vi: { part: "GLOBAL", section: "Tranche VI" },
      "6": { part: "GLOBAL", section: "Tranche VI" },
      ix: { part: "Tranche IX", section: "Plan topographique — Tranche IX" },
      "9": { part: "Tranche IX", section: "Plan topographique — Tranche IX" },
    };
    const hit = map[token];
    if (!hit) return null;
    return {
      project,
      part: hit.part,
      group: "RELEVÉS & PLANS",
      section: hit.section,
      nestedFolder: null,
      reason:
        hit.part === "GLOBAL"
          ? `Plan de la ${hit.section}, document global (sans partie).`
          : "Plan topographique explicitement rattaché à la Tranche IX.",
    };
  }
  if (name.includes("bab") && name.includes("kasbah")) {
    return {
      project,
      part: "GLOBAL",
      group: "RELEVÉS & PLANS",
      section: "Bab El Kasbah",
      nestedFolder: null,
      reason: "Plan Bab El Kasbah.",
    };
  }
  return null;
}

function logicalPreview(entry: {
  project: string;
  part: string | "GLOBAL";
  section: string;
}): string {
  const projectSlug = generateSlug(entry.project);
  const partSlug = entry.part === "GLOBAL" ? null : generateSlug(entry.part);
  return buildCloudinaryFolderPath({
    territoireCode: TERRITOIRE_CODE,
    projectSlug,
    partSlug,
    sectionSegment: generateSlug(entry.section),
    folderNames: [],
  });
}

function chooseCanonical(paths: string[]): string {
  const ranked = [...paths].sort((a, b) => {
    const aCopy = /\(\d+\)/.test(path.basename(a)) ? 1 : 0;
    const bCopy = /\(\d+\)/.test(path.basename(b)) ? 1 : 0;
    if (aCopy !== bCopy) return aCopy - bCopy;
    const aPhotos = /photos/i.test(a) ? 1 : 0;
    const bPhotos = /photos/i.test(b) ? 1 : 0;
    if (aPhotos !== bPhotos) return aPhotos - bPhotos;
    return a.localeCompare(b, "fr");
  });
  return ranked[0];
}

async function main() {
  const roots = [
    { label: "chateau de mer synthese", abs: CHATEAU_ROOT, project: "chateau" as const },
    { label: "muraille portugaise", abs: MURAILLES_ROOT, project: "murailles" as const },
  ];

  const rows: ManifestEntry[] = [];

  for (const root of roots) {
    const files = await walk(root.abs);
    for (const file of files) {
      const buf = await readFile(file);
      const info = await stat(file);
      const filename = path.basename(file);
      const extension = path.extname(filename).replace(/^\./, "").toLowerCase();
      const relativePath = path.relative(root.abs, file).split(path.sep).join("/");
      const sha256 = createHash("sha256").update(buf).digest("hex");
      const kind = detectFileKind({
        fileName: filename,
        mimeType: extension === "pdf" ? "application/pdf" : "application/octet-stream",
        sizeBytes: info.size,
      });
      const provider = resolveStorageProvider({
        fileName: filename,
        mimeType:
          extension === "pdf"
            ? "application/pdf"
            : extension === "docx"
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "application/octet-stream",
        sizeBytes: info.size,
      });

      if (kind === "image" || kind === "video") {
        rows.push({
          sourceRoot: root.label,
          relativePath,
          filename,
          extension,
          sizeBytes: info.size,
          sha256,
          detectedKind: kind,
          targetTerritoire: TERRITOIRE_NAME,
          targetProject: null,
          targetPart: null,
          targetGroup: null,
          targetSection: null,
          nestedFolder: null,
          expectedStorageProvider: provider,
          logicalFolderPreview: null,
          duplicateOf: null,
          status: "SKIP_MEDIA",
          reason: "Phase documents uniquement. Média non importé.",
        });
        continue;
      }

      const text =
        extension === "docx"
          ? docxPlainText(buf)
          : extension === "pdf"
            ? pdfPlainText(buf)
            : "";
      const target =
        root.project === "chateau"
          ? classifyChateau(filename, text)
          : classifyMurailles(filename);
      const excerpt = snippet(text);
      if (!target) {
        rows.push({
          sourceRoot: root.label,
          relativePath,
          filename,
          extension,
          sizeBytes: info.size,
          sha256,
          detectedKind: kind,
          targetTerritoire: TERRITOIRE_NAME,
          targetProject: root.project === "chateau" ? "Château de Mer" : "Murailles portugaises de Safi",
          targetPart: null,
          targetGroup: null,
          targetSection: null,
          nestedFolder: null,
          expectedStorageProvider: provider,
          logicalFolderPreview: null,
          duplicateOf: null,
          status: "UNRESOLVED",
          reason: excerpt
            ? `Aucun rattachement certain. Extrait : ${excerpt}`
            : "Aucun rattachement certain, et le texte extrait est vide.",
        });
        continue;
      }

      rows.push({
        sourceRoot: root.label,
        relativePath,
        filename,
        extension,
        sizeBytes: info.size,
        sha256,
        detectedKind: kind,
        targetTerritoire: TERRITOIRE_NAME,
        targetProject: target.project,
        targetPart: target.part === "GLOBAL" ? "GLOBAL" : target.part,
        targetGroup: target.group,
        targetSection: target.section,
        nestedFolder: target.nestedFolder,
        expectedStorageProvider: provider,
        logicalFolderPreview: logicalPreview(target),
        duplicateOf: null,
        status: "READY",
        reason: excerpt ? `${target.reason} Extrait : ${excerpt}` : target.reason,
      });
    }
  }

  const byHash = new Map<string, ManifestEntry[]>();
  for (const row of rows) {
    if (row.status !== "READY") continue;
    const list = byHash.get(row.sha256) ?? [];
    list.push(row);
    byHash.set(row.sha256, list);
  }
  for (const group of byHash.values()) {
    if (group.length < 2) continue;
    const canonicalRel = chooseCanonical(
      group.map((row) => `${row.sourceRoot}/${row.relativePath}`),
    );
    for (const row of group) {
      const key = `${row.sourceRoot}/${row.relativePath}`;
      if (key === canonicalRel) continue;
      row.status = "DUPLICATE";
      row.duplicateOf = canonicalRel;
      row.reason = `SHA-256 identique à ${canonicalRel}. ${row.reason}`;
    }
  }

  rows.sort((a, b) =>
    `${a.sourceRoot}/${a.relativePath}`.localeCompare(
      `${b.sourceRoot}/${b.relativePath}`,
      "fr",
    ),
  );

  const counts = {
    total: rows.length,
    documents: rows.filter((r) => r.detectedKind === "document").length,
    media: rows.filter((r) => r.status === "SKIP_MEDIA").length,
    ready: rows.filter((r) => r.status === "READY").length,
    duplicate: rows.filter((r) => r.status === "DUPLICATE").length,
    unresolved: rows.filter((r) => r.status === "UNRESOLVED").length,
    readyBytes: rows
      .filter((r) => r.status === "READY")
      .reduce((n, r) => n + r.sizeBytes, 0),
  };

  await mkdir(path.resolve("reports/import"), { recursive: true });
  await writeFile(
    path.resolve("reports/import/documents-import-manifest.json"),
    JSON.stringify(
      {
        phase: "documents-only-dry-run",
        generatedAt: new Date().toISOString(),
        note: "No structure created and no object uploaded. logicalFolderPreview uses slugified display names via buildCloudinaryFolderPath. Live upload will use Section.code or Section.id as the section segment, plus a file id prefix.",
        territoire: { name: TERRITOIRE_NAME, proposedCode: TERRITOIRE_CODE },
        counts,
        files: rows,
      },
      null,
      2,
    ),
    "utf8",
  );

  const lines = [
    "Documents import dry run",
    `Territoire: ${TERRITOIRE_NAME} (proposed code ${TERRITOIRE_CODE})`,
    `Files: ${counts.total}`,
    `Documents: ${counts.documents}`,
    `SKIP_MEDIA: ${counts.media}`,
    `READY: ${counts.ready}`,
    `DUPLICATE: ${counts.duplicate}`,
    `UNRESOLVED: ${counts.unresolved}`,
    `READY bytes for B2: ${counts.readyBytes}`,
    "",
    "READY",
  ];
  for (const row of rows.filter((r) => r.status === "READY")) {
    lines.push(
      `- ${row.sourceRoot}/${row.relativePath} → ${row.targetProject} / ${row.targetPart} / ${row.targetGroup} / ${row.targetSection} [${row.expectedStorageProvider}]`,
    );
  }
  lines.push("", "DUPLICATE");
  for (const row of rows.filter((r) => r.status === "DUPLICATE")) {
    lines.push(`- ${row.sourceRoot}/${row.relativePath} = ${row.duplicateOf}`);
  }
  lines.push("", "UNRESOLVED");
  for (const row of rows.filter((r) => r.status === "UNRESOLVED")) {
    lines.push(`- ${row.sourceRoot}/${row.relativePath}: ${row.reason}`);
  }
  lines.push("", "SKIP_MEDIA");
  for (const row of rows.filter((r) => r.status === "SKIP_MEDIA")) {
    lines.push(`- ${row.sourceRoot}/${row.relativePath}`);
  }
  await writeFile(
    path.resolve("reports/import/documents-import-summary.txt"),
    lines.join("\n") + "\n",
    "utf8",
  );

  console.log(JSON.stringify(counts, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
