import "server-only";
import { execFile, execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Soft ceiling for Office → PDF (large DOCX with images can exceed 90s under load). */
export const OFFICE_CONVERSION_TIMEOUT_MS = 180_000;

export const SUPPORTED_OFFICE_EXTENSIONS = new Set([
  "docx",
  "doc",
  "xlsx",
  "xls",
  "pptx",
  "ppt",
  "odt",
  "ods",
  "odp",
  "rtf",
]);

export type PreviewFailureReason =
  | "invalid_docx"
  | "unsupported_format"
  | "libreoffice_missing"
  | "libreoffice_conversion_failed"
  | "conversion_timeout"
  | "output_missing"
  | "invalid_pdf_output"
  | "storage_read_failed"
  | "cache_corrupt";

export class PreviewConversionError extends Error {
  readonly reason: PreviewFailureReason;
  readonly detail?: string;

  constructor(reason: PreviewFailureReason, message: string, detail?: string) {
    super(message);
    this.name = "PreviewConversionError";
    this.reason = reason;
    this.detail = detail;
  }
}

export function isConvertibleOfficeDocument(extension: string): boolean {
  return SUPPORTED_OFFICE_EXTENSIONS.has(
    extension.toLowerCase().replace(/^\./, "").trim(),
  );
}

/** Cached resolved path; `null` means searched and not found. */
let cachedSofficePath: string | null | undefined;

/** Clears the resolved binary cache (tests / after installing LibreOffice). */
export function resetSofficeBinaryCache(): void {
  cachedSofficePath = undefined;
}

/** True when LibreOffice is available for Office → PDF preview conversion. */
export function isLibreOfficeAvailable(): boolean {
  return findSofficeBinary() !== null;
}

function isUsableBinary(candidate: string | null | undefined): candidate is string {
  return Boolean(candidate && existsSync(/*turbopackIgnore: true*/ candidate));
}

/**
 * Resolve a command name via PATH (`where` on Windows, `which` elsewhere).
 * Returns the first existing absolute path, or null.
 */
function resolveFromPath(commandNames: string[]): string | null {
  const locator = process.platform === "win32" ? "where" : "which";

  for (const name of commandNames) {
    try {
      const stdout = execFileSync(locator, [name], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 5_000,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const hit = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0 && existsSync(/*turbopackIgnore: true*/ line));
      if (hit) return hit;
    } catch {
      // Command not on PATH — try next name
    }
  }

  return null;
}

/**
 * Resolve a real LibreOffice binary path, or null if conversion is unavailable.
 *
 * Detection order:
 * 1. `SOFFICE_PATH` env (explicit override)
 * 2. Standard Windows / Unix install locations
 * 3. PATH (`soffice.com` / `soffice.exe` / `soffice` / `libreoffice`)
 *
 * On Windows, prefer `soffice.com` when both `.com` and `.exe` exist — the
 * `.com` shim waits for headless conversion to finish (`.exe` can return early).
 */
export function findSofficeBinary(): string | null {
  if (isUsableBinary(process.env.SOFFICE_PATH)) {
    cachedSofficePath = process.env.SOFFICE_PATH;
    return cachedSofficePath;
  }

  if (isUsableBinary(cachedSofficePath)) {
    return cachedSofficePath;
  }

  const isWindows = process.platform === "win32";

  const installCandidates: string[] = isWindows
    ? [
        "C:\\Program Files\\LibreOffice\\program\\soffice.com",
        "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com",
        "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
        "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
      ]
    : [
        "/usr/bin/soffice",
        "/usr/bin/libreoffice",
        "/usr/local/bin/soffice",
        "/usr/local/bin/libreoffice",
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
      ];

  for (const candidate of installCandidates) {
    if (isUsableBinary(candidate)) {
      cachedSofficePath = candidate;
      return candidate;
    }
  }

  if (cachedSofficePath === null) {
    return null;
  }

  const pathHit = resolveFromPath(
    isWindows
      ? ["soffice.com", "soffice.exe", "soffice"]
      : ["soffice", "libreoffice"],
  );

  if (pathHit) {
    cachedSofficePath = pathHit;
    return pathHit;
  }

  cachedSofficePath = null;
  return null;
}

/** Quick structural check for OOXML (.docx/.xlsx/.pptx) ZIP packages. */
export function assertValidOfficeZipContainer(
  inputBuffer: Buffer,
  extension: string,
): void {
  const ext = extension.toLowerCase().replace(/^\./, "").trim();
  if (!["docx", "xlsx", "pptx"].includes(ext)) return;

  if (inputBuffer.length < 4 || inputBuffer[0] !== 0x50 || inputBuffer[1] !== 0x4b) {
    throw new PreviewConversionError(
      "invalid_docx",
      "Le fichier Office n’est pas une archive ZIP valide (en-tête PK manquant).",
      `extension=${ext} size=${inputBuffer.length}`,
    );
  }

  if (ext === "docx") {
    const asLatin1 = inputBuffer.toString("binary");
    const hasContentTypes = asLatin1.includes("[Content_Types].xml");
    const hasDocument = asLatin1.includes("word/document.xml");
    if (!hasContentTypes || !hasDocument) {
      throw new PreviewConversionError(
        "invalid_docx",
        "Le fichier DOCX est incomplet ou corrompu (entrées OOXML manquantes).",
        `hasContentTypes=${hasContentTypes} hasDocument=${hasDocument}`,
      );
    }
  }
}

export async function convertOfficeToPdf(
  inputBuffer: Buffer,
  extension: string,
): Promise<Buffer> {
  const cleanExt = extension.toLowerCase().replace(/^\./, "").trim();
  if (!isConvertibleOfficeDocument(cleanExt)) {
    throw new PreviewConversionError(
      "unsupported_format",
      `Format de document non convertible : ${cleanExt}`,
    );
  }

  assertValidOfficeZipContainer(inputBuffer, cleanExt);

  const sofficeBin = findSofficeBinary();
  if (!sofficeBin) {
    throw new PreviewConversionError(
      "libreoffice_missing",
      "LibreOffice n’est pas installé. L’aperçu des documents Office est indisponible. Installez LibreOffice ou définissez SOFFICE_PATH.",
    );
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "archeritage-conv-"));
  const inputPath = path.join(tempDir, `document.${cleanExt}`);
  const outDir = path.join(tempDir, "out");
  const profileDir = path.join(tempDir, "profile");

  try {
    await fs.mkdir(outDir, { recursive: true });
    await fs.mkdir(profileDir, { recursive: true });
    await fs.writeFile(inputPath, inputBuffer);

    const normalizedProfile = profileDir.replace(/\\/g, "/");
    const profileUrl = normalizedProfile.startsWith("/")
      ? `file://${normalizedProfile}`
      : `file:///${normalizedProfile}`;

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
      inputPath,
    ];

    console.info(
      `[preview] Converting .${cleanExt} via LibreOffice (${sofficeBin}) timeout=${OFFICE_CONVERSION_TIMEOUT_MS}ms`,
    );

    try {
      await execFileAsync(sofficeBin, args, {
        timeout: OFFICE_CONVERSION_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 20 * 1024 * 1024,
      });
    } catch (spawnError) {
      const detail =
        spawnError instanceof Error ? spawnError.message : String(spawnError);
      const timedOut =
        /ETIMEDOUT|timed out|TIMEOUT/i.test(detail) ||
        (spawnError instanceof Error &&
          "killed" in spawnError &&
          Boolean((spawnError as { killed?: boolean }).killed));

      console.error("[preview] LibreOffice spawn/convert failed:", {
        reason: timedOut ? "conversion_timeout" : "libreoffice_conversion_failed",
        sofficeBin,
        extension: cleanExt,
        detail,
      });

      throw new PreviewConversionError(
        timedOut ? "conversion_timeout" : "libreoffice_conversion_failed",
        timedOut
          ? "La conversion du document a dépassé le délai autorisé."
          : `Échec de la conversion du document en PDF (${detail})`,
        detail,
      );
    }

    const expectedPdfName = "document.pdf";
    const outputPath = path.join(outDir, expectedPdfName);

    let pdfBytes: Buffer;
    if (existsSync(/*turbopackIgnore: true*/ outputPath)) {
      pdfBytes = await fs.readFile(outputPath);
    } else {
      const files = await fs.readdir(outDir);
      const pdfFile = files.find((f) => f.toLowerCase().endsWith(".pdf"));
      if (!pdfFile) {
        throw new PreviewConversionError(
          "output_missing",
          "La conversion n’a produit aucun fichier PDF (LibreOffice n’a rien écrit dans le dossier de sortie).",
        );
      }
      pdfBytes = await fs.readFile(path.join(outDir, pdfFile));
    }

    validatePdfBuffer(pdfBytes);
    return pdfBytes;
  } catch (error) {
    if (error instanceof PreviewConversionError) {
      console.error("[preview] Office to PDF conversion failed:", {
        reason: error.reason,
        sofficeBin,
        extension: cleanExt,
        detail: error.detail ?? error.message,
      });
      throw error;
    }
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error("[preview] Office to PDF conversion failed:", {
      reason: "libreoffice_conversion_failed",
      sofficeBin,
      extension: cleanExt,
      detail,
    });
    throw new PreviewConversionError(
      "libreoffice_conversion_failed",
      "Échec de la conversion du document en PDF.",
      detail,
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function validatePdfBuffer(bytes: Buffer): void {
  if (bytes.length < 5 || bytes.subarray(0, 5).toString("utf8") !== "%PDF-") {
    throw new PreviewConversionError(
      "invalid_pdf_output",
      "Le fichier généré n’est pas un document PDF valide.",
    );
  }
}
