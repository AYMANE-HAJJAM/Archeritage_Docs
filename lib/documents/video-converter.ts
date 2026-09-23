import "server-only";
import { execFile, execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";

import {
  normalizeExtension,
  VIDEO_EXTENSIONS,
} from "@/lib/documents/file-kind";

const execFileAsync = promisify(execFile);

/** Soft ceiling for video → MP4 (large AVCHD/AVI can take several minutes). */
export const VIDEO_CONVERSION_TIMEOUT_MS = 300_000;

/**
 * FFmpeg argv after the binary path for H.264/AAC MP4 preview output.
 * Placeholders: `__INPUT__`, `__OUTPUT__`.
 */
export const VIDEO_PREVIEW_FFMPEG_ARGS_TEMPLATE = [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  // Help MPEG-TS / AVCHD (MTS) probing before decode.
  "-fflags",
  "+genpts",
  "-analyzeduration",
  "100M",
  "-probesize",
  "100M",
  "-i",
  "__INPUT__",
  "-map",
  "0:v:0",
  "-map",
  "0:a:0?",
  "-vf",
  "scale='min(1280,iw)':-2",
  "-c:v",
  "libx264",
  "-preset",
  "veryfast",
  "-crf",
  "23",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "128k",
  "-ac",
  "2",
  "-movflags",
  "+faststart",
  "__OUTPUT__",
] as const;

export type VideoPreviewFailureReason =
  | "unsupported_format"
  | "ffmpeg_missing"
  | "conversion_failed"
  | "conversion_timeout"
  | "unsupported_codec"
  | "derivative_missing"
  | "invalid_mp4_output"
  | "storage_read_failed";

export class VideoPreviewConversionError extends Error {
  readonly reason: VideoPreviewFailureReason;
  readonly detail?: string;

  constructor(
    reason: VideoPreviewFailureReason,
    message: string,
    detail?: string,
  ) {
    super(message);
    this.name = "VideoPreviewConversionError";
    this.reason = reason;
    this.detail = detail;
  }
}

/** Cached resolved path; `null` means searched and not found. */
let cachedFfmpegPath: string | null | undefined;

/** Clears the resolved binary cache (tests / after installing ffmpeg). */
export function resetFfmpegBinaryCache(): void {
  cachedFfmpegPath = undefined;
}

/** True when ffmpeg is available for video → MP4 preview conversion. */
export function isFfmpegAvailable(): boolean {
  return findFfmpegBinary() !== null;
}

export function isConvertibleVideoExtension(extension: string): boolean {
  return VIDEO_EXTENSIONS.has(normalizeExtension(extension));
}

export function buildVideoPreviewFfmpegArgs(
  inputPath: string,
  outputPath: string,
): string[] {
  return VIDEO_PREVIEW_FFMPEG_ARGS_TEMPLATE.map((token) => {
    if (token === "__INPUT__") return inputPath;
    if (token === "__OUTPUT__") return outputPath;
    return token;
  });
}

function isUsableBinary(
  candidate: string | null | undefined,
): candidate is string {
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
        timeout: 1_500,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const hit = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(
          (line) => line.length > 0 && existsSync(/*turbopackIgnore: true*/ line),
        );
      if (hit) return hit;
    } catch {
      // Command not on PATH — try next name
    }
  }

  return null;
}

/** Bundled binary from the `ffmpeg-static` npm package (platform-specific). */
function resolveBundledFfmpeg(): string | null {
  if (isUsableBinary(ffmpegStatic)) return ffmpegStatic;
  return null;
}

/**
 * Resolve a real ffmpeg binary path, or null if conversion is unavailable.
 *
 * Detection order:
 * 1. `FFMPEG_PATH` env (explicit override)
 * 2. Common Windows / Unix install locations
 * 3. PATH (`ffmpeg` / `ffmpeg.exe`)
 * 4. Bundled `ffmpeg-static` (local + most Node hosts)
 */
export function findFfmpegBinary(): string | null {
  if (isUsableBinary(process.env.FFMPEG_PATH)) {
    cachedFfmpegPath = process.env.FFMPEG_PATH;
    return cachedFfmpegPath;
  }

  if (isUsableBinary(cachedFfmpegPath)) {
    return cachedFfmpegPath;
  }

  // Negative cache — avoid repeated slow PATH lookups when ffmpeg is absent.
  if (cachedFfmpegPath === null) {
    return null;
  }

  const isWindows = process.platform === "win32";

  const installCandidates: string[] = isWindows
    ? [
        "C:\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe",
      ]
    : [
        "/usr/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/opt/homebrew/bin/ffmpeg",
      ];

  for (const candidate of installCandidates) {
    if (isUsableBinary(candidate)) {
      cachedFfmpegPath = candidate;
      return candidate;
    }
  }

  const pathHit = resolveFromPath(isWindows ? ["ffmpeg.exe", "ffmpeg"] : ["ffmpeg"]);
  if (pathHit) {
    cachedFfmpegPath = pathHit;
    return pathHit;
  }

  const bundled = resolveBundledFfmpeg();
  if (bundled) {
    cachedFfmpegPath = bundled;
    return bundled;
  }

  cachedFfmpegPath = null;
  return null;
}

function classifyFfmpegFailure(detail: string): VideoPreviewFailureReason {
  if (/ETIMEDOUT|timed out|TIMEOUT/i.test(detail)) {
    return "conversion_timeout";
  }
  if (
    /Invalid data found|could not find codec|Unknown decoder|Unsupported codec|Decoder \(.*\) not found|No decoder|not supported/i.test(
      detail,
    )
  ) {
    return "unsupported_codec";
  }
  return "conversion_failed";
}

function isValidMp4Buffer(bytes: Buffer): boolean {
  if (bytes.length < 12) return false;
  // ISO BMFF: size(4) + 'ftyp' at offset 4
  return bytes.subarray(4, 8).toString("ascii") === "ftyp";
}

/**
 * Convert arbitrary video bytes to an H.264 + AAC MP4 suitable for HTML5 playback.
 * Does not mutate the original — caller stores/serves the result as a derivative only.
 */
export async function convertVideoToPreviewMp4(
  inputBuffer: Buffer,
  extension: string,
): Promise<Buffer> {
  const cleanExt = normalizeExtension(extension);
  if (!isConvertibleVideoExtension(cleanExt)) {
    throw new VideoPreviewConversionError(
      "unsupported_format",
      `Format vidéo non convertible : ${cleanExt || "(aucune)"}`,
    );
  }

  const ffmpegBin = findFfmpegBinary();
  if (!ffmpegBin) {
    throw new VideoPreviewConversionError(
      "ffmpeg_missing",
      "ffmpeg n’est pas installé. L’aperçu des formats vidéo non natifs est indisponible. Installez ffmpeg, définissez FFMPEG_PATH, ou assurez-vous que le paquet ffmpeg-static est présent.",
    );
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "archeritage-video-"));
  const inputPath = path.join(tempDir, `source.${cleanExt}`);
  const outputPath = path.join(tempDir, "preview.mp4");

  try {
    await fs.writeFile(inputPath, inputBuffer);

    const args = buildVideoPreviewFfmpegArgs(inputPath, outputPath);

    console.info(
      `[video-preview] Converting .${cleanExt} via ffmpeg (${ffmpegBin}) timeout=${VIDEO_CONVERSION_TIMEOUT_MS}ms`,
    );

    try {
      await execFileAsync(ffmpegBin, args, {
        timeout: VIDEO_CONVERSION_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 20 * 1024 * 1024,
      });
    } catch (spawnError) {
      const detail =
        spawnError instanceof Error ? spawnError.message : String(spawnError);
      const stderr =
        spawnError &&
        typeof spawnError === "object" &&
        "stderr" in spawnError &&
        typeof (spawnError as { stderr?: unknown }).stderr === "string"
          ? (spawnError as { stderr: string }).stderr
          : "";
      const combined = `${detail}\n${stderr}`.trim();
      const reason = classifyFfmpegFailure(combined);
      const timedOut =
        reason === "conversion_timeout" ||
        (spawnError instanceof Error &&
          "killed" in spawnError &&
          Boolean((spawnError as { killed?: boolean }).killed));

      console.error("[video-preview] ffmpeg spawn/convert failed:", {
        reason: timedOut ? "conversion_timeout" : reason,
        ffmpegBin,
        extension: cleanExt,
        detail: combined.slice(0, 2000),
      });

      throw new VideoPreviewConversionError(
        timedOut ? "conversion_timeout" : reason,
        timedOut
          ? "La conversion vidéo a dépassé le délai autorisé."
          : `Échec de la conversion vidéo (${combined.slice(0, 280)})`,
        combined.slice(0, 4000),
      );
    }

    if (!existsSync(/*turbopackIgnore: true*/ outputPath)) {
      throw new VideoPreviewConversionError(
        "derivative_missing",
        "La conversion n’a produit aucun fichier MP4 (ffmpeg n’a rien écrit).",
      );
    }

    const mp4Bytes = await fs.readFile(outputPath);
    if (!isValidMp4Buffer(mp4Bytes)) {
      throw new VideoPreviewConversionError(
        "invalid_mp4_output",
        "Le fichier généré n’est pas un MP4 valide.",
        `size=${mp4Bytes.length}`,
      );
    }

    return mp4Bytes;
  } catch (error) {
    if (error instanceof VideoPreviewConversionError) {
      console.error("[video-preview] Video to MP4 conversion failed:", {
        reason: error.reason,
        ffmpegBin,
        extension: cleanExt,
        detail: error.detail ?? error.message,
      });
      throw error;
    }
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error("[video-preview] Video to MP4 conversion failed:", {
      reason: "conversion_failed",
      ffmpegBin,
      extension: cleanExt,
      detail,
    });
    throw new VideoPreviewConversionError(
      "conversion_failed",
      "Échec de la conversion vidéo en MP4.",
      detail,
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
