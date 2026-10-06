// Local/Render-shell diagnostic. No database, storage, dotenv, or uploaded files.
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

let failed = false;
const candidates = process.env.SOFFICE_PATH
  ? [process.env.SOFFICE_PATH]
  : process.platform === "win32"
    ? ["C:/Program Files/LibreOffice/program/soffice.com", "soffice.com"]
    : ["/usr/bin/soffice", "soffice", "libreoffice"];
let version;
for (const binary of candidates) {
  try {
    version = execFileSync(binary, ["--headless", "--version"], {
      encoding: "utf8", timeout: 15_000, windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    console.log(`Office runtime OK: ${binary}: ${version}`);
    break;
  } catch {
    // Try the next installation location or PATH command.
  }
}
if (!version) {
  console.error("Office runtime MISSING/UNUSABLE: install LibreOffice Writer, Impress and Calc. SOFFICE_PATH only selects an installed executable.");
  failed = true;
}

let scratch;
try {
  scratch = await fs.mkdtemp(path.join(os.tmpdir(), "archeritage-check-"));
  await fs.writeFile(path.join(scratch, "probe"), "temporary scratch probe");
  console.log(`Temporary filesystem writable: ${os.tmpdir()}`);
} catch (error) {
  console.error("Temporary filesystem check failed:", error.message);
  failed = true;
} finally {
  if (scratch) {
    try {
      await fs.rm(scratch, { recursive: true, force: true, maxRetries: 3 });
      console.log("Temporary probe cleaned up.");
    } catch (error) {
      console.error("Temporary probe cleanup failed:", error.message);
      failed = true;
    }
  }
}
process.exitCode = failed ? 1 : 0;
