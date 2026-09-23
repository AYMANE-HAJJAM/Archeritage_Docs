/**
 * Deep-inspect one DOCX: ZIP entries, LibreOffice CLI with captured stderr, PDF validity.
 * Usage: npx tsx --conditions=react-server scripts/inspect-one-docx.ts <fileId>
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeDatabaseUrl } from "../lib/db/connection-string";
import { readRawObjectBytes } from "../lib/storage";
import { findSofficeBinary } from "../lib/documents/converter";
import { computePreviewCacheKey } from "../lib/storage/preview-cache";
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";

const execFileAsync = promisify(execFile);

/** Minimal ZIP central-directory listing without renaming to .zip */
function listZipEntries(buf: Buffer): string[] {
  const names: string[] = [];
  // Scan for local file headers PK\x03\x04
  let i = 0;
  while (i < buf.length - 30) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x03 && buf[i + 3] === 0x04) {
      const nameLen = buf.readUInt16LE(i + 26);
      const extraLen = buf.readUInt16LE(i + 28);
      const compSize = buf.readUInt32LE(i + 18);
      const name = buf.subarray(i + 30, i + 30 + nameLen).toString("utf8");
      names.push(name);
      i += 30 + nameLen + extraLen + compSize;
      continue;
    }
    // End of central directory — stop if we hit it while scanning
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      break;
    }
    i += 1;
  }
  // Prefer central directory parse for accuracy
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd >= 0) {
    const cdOffset = buf.readUInt32LE(eocd + 16);
    const cdEntries: string[] = [];
    let p = cdOffset;
    while (p < buf.length - 46) {
      if (!(buf[p] === 0x50 && buf[p + 1] === 0x4b && buf[p + 2] === 0x01 && buf[p + 3] === 0x02)) break;
      const nameLen = buf.readUInt16LE(p + 28);
      const extraLen = buf.readUInt16LE(p + 30);
      const commentLen = buf.readUInt16LE(p + 32);
      const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
      cdEntries.push(name);
      p += 46 + nameLen + extraLen + commentLen;
    }
    if (cdEntries.length) return cdEntries;
  }
  return names;
}

async function main() {
  const fileId = process.argv[2] || "cmu2v01ud00095ouww8aylqqu"; // largest by default
  const url = normalizeDatabaseUrl(process.env.DATABASE_URL);
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "docx-one-"));
  try {
    const file = await db.file.findUnique({ where: { id: fileId } });
    if (!file) throw new Error(`File not found: ${fileId}`);

    console.log(
      "FILE_META",
      JSON.stringify(
        {
          id: file.id,
          displayName: file.displayName,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          extension: file.extension,
          storageProvider: file.storageProvider,
          storageKey: file.storageKey,
          sourceHash: file.sourceHash,
          storageVersion: file.storageVersion,
          updatedAt: file.updatedAt,
          cacheKey: computePreviewCacheKey(file),
        },
        null,
        2,
      ),
    );

    const bytes = await readRawObjectBytes(file);
    const localDocx = path.join(tmpRoot, "original.docx");
    await fs.writeFile(localDocx, bytes);
    console.log(
      "DOWNLOAD",
      JSON.stringify({
        downloadedSize: bytes.length,
        sizeMatch: bytes.length === file.size,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        pkZip: bytes[0] === 0x50 && bytes[1] === 0x4b,
        localPath: localDocx,
      }),
    );

    const entries = listZipEntries(bytes);
    const expected = [
      "[Content_Types].xml",
      "word/document.xml",
      "word/_rels/document.xml.rels",
    ];
    console.log(
      "ZIP",
      JSON.stringify(
        {
          entryCount: entries.length,
          hasExpected: Object.fromEntries(
            expected.map((e) => [e, entries.includes(e)]),
          ),
          hasVba: entries.some((e) => /vbaProject|macros/i.test(e)),
          hasEmbeddings: entries.some((e) => /embeddings\//i.test(e)),
          hasOle: entries.some((e) => /oleObject|\.bin$/i.test(e)),
          mediaCount: entries.filter((e) => /word\/media\//i.test(e)).length,
          sampleEntries: entries.slice(0, 40),
        },
        null,
        2,
      ),
    );

    const soffice = findSofficeBinary();
    if (!soffice) throw new Error("LibreOffice not found");
    const outDir = path.join(tmpRoot, "out");
    const profileDir = path.join(tmpRoot, "profile");
    await fs.mkdir(outDir);
    await fs.mkdir(profileDir);
    const profileUrl = `file:///${profileDir.replace(/\\/g, "/")}`;
    const args = [
      "--headless",
      "--invisible",
      "--nologo",
      "--nodefault",
      "--nofirststartwizard",
      "--norestore",
      `-env:UserInstallation=${profileUrl}`,
      "--convert-to",
      "pdf",
      "--outdir",
      outDir,
      localDocx,
    ];

    const t0 = Date.now();
    let stdout = "";
    let stderr = "";
    let exitCode: number | null = null;
    try {
      const result = await execFileAsync(soffice, args, {
        timeout: 180_000,
        windowsHide: true,
        maxBuffer: 20 * 1024 * 1024,
        encoding: "utf8",
      });
      stdout = result.stdout || "";
      stderr = result.stderr || "";
      exitCode = 0;
    } catch (e: unknown) {
      const err = e as {
        code?: number;
        killed?: boolean;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      stdout = err.stdout || "";
      stderr = err.stderr || err.message || String(e);
      exitCode = typeof err.code === "number" ? err.code : 1;
    }
    const elapsedMs = Date.now() - t0;
    const pdfPath = path.join(outDir, "original.pdf");
    const pdfExists = existsSync(pdfPath);
    let pdfSize = 0;
    let pdfMagic = "";
    if (pdfExists) {
      const pdf = await fs.readFile(pdfPath);
      pdfSize = pdf.length;
      pdfMagic = pdf.subarray(0, 8).toString("utf8");
    }
    console.log(
      "LIBREOFFICE",
      JSON.stringify(
        {
          soffice,
          exitCode,
          elapsedMs,
          stdout: stdout.slice(0, 2000),
          stderr: stderr.slice(0, 4000),
          pdfExists,
          pdfSize,
          pdfMagic,
          outDirFiles: await fs.readdir(outDir),
        },
        null,
        2,
      ),
    );

    // Compare with a known-working small file
    const working = await db.file.findFirst({
      where: {
        id: { not: fileId },
        extension: { equals: "docx", mode: "insensitive" },
        size: { lt: 30_000 },
      },
      orderBy: { size: "asc" },
    });
    if (working) {
      const wBytes = await readRawObjectBytes(working);
      const wPath = path.join(tmpRoot, "working.docx");
      await fs.writeFile(wPath, wBytes);
      const wOut = path.join(tmpRoot, "out-working");
      const wProfile = path.join(tmpRoot, "profile-working");
      await fs.mkdir(wOut);
      await fs.mkdir(wProfile);
      const wProfileUrl = `file:///${wProfile.replace(/\\/g, "/")}`;
      const wt0 = Date.now();
      await execFileAsync(
        soffice,
        [
          "--headless",
          "--invisible",
          "--nologo",
          "--nodefault",
          "--nofirststartwizard",
          "--norestore",
          `-env:UserInstallation=${wProfileUrl}`,
          "--convert-to",
          "pdf",
          "--outdir",
          wOut,
          wPath,
        ],
        { timeout: 180_000, windowsHide: true, maxBuffer: 20 * 1024 * 1024 },
      );
      const wPdf = path.join(wOut, "working.pdf");
      console.log(
        "WORKING_COMPARE",
        JSON.stringify({
          id: working.id,
          displayName: working.displayName,
          size: working.size,
          mimeType: working.mimeType,
          extension: working.extension,
          elapsedMs: Date.now() - wt0,
          pdfExists: existsSync(wPdf),
          pdfSize: existsSync(wPdf) ? (await fs.stat(wPdf)).size : 0,
        }),
      );
    }
  } finally {
    await db.$disconnect();
    // Keep temp for manual inspection? User said temp only — clean up
    await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
