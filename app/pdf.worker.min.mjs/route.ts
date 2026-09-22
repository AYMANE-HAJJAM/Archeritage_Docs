import { promises as fs } from "node:fs";
import * as path from "node:path";

export const runtime = "nodejs";

let cachedWorkerBuffer: Buffer | null = null;

export async function GET() {
  try {
    if (!cachedWorkerBuffer) {
      const workerPath = path.join(
        process.cwd(),
        "node_modules",
        "pdfjs-dist",
        "build",
        "pdf.worker.min.mjs"
      );
      cachedWorkerBuffer = await fs.readFile(workerPath);
    }

    return new Response(new Uint8Array(cachedWorkerBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to load PDF worker script:", error instanceof Error ? error.message : "Unknown");
    return new Response("console.error('PDF worker unavailable');", {
      status: 500,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }
}
