/**
 * Diagnose which DOCX files fail LibreOffice preview conversion.
 * Read-only against originals; does not write to B2 source objects.
 */
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeDatabaseUrl } from "../lib/db/connection-string";
import { readRawObjectBytes } from "../lib/storage";
import { convertOfficeToPdf } from "../lib/documents/converter";

type Row = {
  id: string;
  displayName: string;
  originalName: string;
  mimeType: string;
  size: number;
  extension: string;
  storageProvider: string;
  storageKey: string;
  status: "ok" | "fail";
  error: string | null;
  downloadMs: number | null;
  convertMs: number | null;
  downloadedSize: number | null;
  zipOk: boolean | null;
  pdfSize?: number;
};

async function main() {
  const url = normalizeDatabaseUrl(process.env.DATABASE_URL);
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  try {
    const files = await db.file.findMany({
      where: {
        OR: [
          { extension: { equals: "docx", mode: "insensitive" } },
          { mimeType: { contains: "wordprocessingml" } },
          { displayName: { endsWith: ".docx", mode: "insensitive" } },
          { originalName: { endsWith: ".docx", mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    console.log("DOCX_COUNT", files.length);
    const results: Row[] = [];

    for (const file of files) {
      const row: Row = {
        id: file.id,
        displayName: file.displayName,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        extension: file.extension,
        storageProvider: file.storageProvider,
        storageKey: file.storageKey,
        status: "fail",
        error: null,
        downloadMs: null,
        convertMs: null,
        downloadedSize: null,
        zipOk: null,
      };

      try {
        const t0 = Date.now();
        const bytes = await readRawObjectBytes(file);
        row.downloadMs = Date.now() - t0;
        row.downloadedSize = bytes.length;
        row.zipOk = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;

        const t1 = Date.now();
        const pdf = await convertOfficeToPdf(bytes, file.extension || "docx");
        row.convertMs = Date.now() - t1;
        row.status = "ok";
        row.pdfSize = pdf.length;
      } catch (e) {
        row.status = "fail";
        row.error = e instanceof Error ? e.message : String(e);
      }

      results.push(row);
      console.log(
        JSON.stringify({
          id: row.id,
          name: row.displayName,
          status: row.status,
          error: row.error,
          size: row.size,
          zipOk: row.zipOk,
          convertMs: row.convertMs,
        }),
      );
    }

    const fails = results.filter((r) => r.status === "fail");
    const oks = results.filter((r) => r.status === "ok");
    console.log(
      "SUMMARY",
      JSON.stringify(
        {
          total: results.length,
          ok: oks.length,
          fail: fails.length,
          fails: fails.map((f) => ({
            id: f.id,
            displayName: f.displayName,
            originalName: f.originalName,
            mimeType: f.mimeType,
            size: f.size,
            storageProvider: f.storageProvider,
            storageKey: f.storageKey,
            error: f.error,
            zipOk: f.zipOk,
            downloadedSize: f.downloadedSize,
            downloadMs: f.downloadMs,
          })),
          workingSample: oks.slice(0, 2).map((o) => ({
            id: o.id,
            displayName: o.displayName,
            size: o.size,
            convertMs: o.convertMs,
            pdfSize: o.pdfSize,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
