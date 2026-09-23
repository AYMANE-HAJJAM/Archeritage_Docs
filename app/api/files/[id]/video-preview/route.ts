import { db } from "@/lib/db";
import { authenticate, apiError, HttpError } from "@/lib/http";
import { assertFileReadable } from "@/lib/access";
import { contentDisposition } from "@/lib/validation/file";
import { needsVideoPreviewDerivative } from "@/lib/documents/file-kind";
import {
  VideoPreviewConversionError,
  type VideoPreviewFailureReason,
} from "@/lib/documents/video-converter";
import { getOrGenerateVideoPreviewMp4 } from "@/lib/storage/video-preview-cache";

export const runtime = "nodejs";

function classifyVideoPreviewError(error: unknown): {
  reason: VideoPreviewFailureReason | "preview_failed";
  message: string;
} {
  if (error instanceof VideoPreviewConversionError) {
    return { reason: error.reason, message: error.message };
  }
  const message =
    error instanceof Error
      ? error.message
      : "Aperçu vidéo indisponible pour ce fichier.";
  if (/ffmpeg/i.test(message)) {
    return { reason: "ffmpeg_missing", message };
  }
  if (/ETIMEDOUT|timed out|délai/i.test(message)) {
    return { reason: "conversion_timeout", message };
  }
  if (/codec|decoder|Invalid data|not supported/i.test(message)) {
    return { reason: "unsupported_codec", message };
  }
  if (/stockage|storage|S3|NoSuchKey/i.test(message)) {
    return { reason: "storage_read_failed", message };
  }
  return { reason: "preview_failed", message };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const file = await db.file.findUnique({ where: { id } });
    if (!file) throw new HttpError(404, "Fichier introuvable.");
    await assertFileReadable(user, file);

    if (!needsVideoPreviewDerivative(file)) {
      return Response.json(
        {
          error:
            "Ce format vidéo se lit directement — utilisez le flux original.",
          code: "unsupported_format",
        },
        { status: 415 },
      );
    }

    try {
      const mp4Buffer = await getOrGenerateVideoPreviewMp4(file);
      const previewName = `${file.displayName.replace(/\.[^/.]+$/, "")}.mp4`;

      const range = request.headers.get("range");
      let status = 200;
      let responseBuffer: Buffer = mp4Buffer;

      const headers = new Headers({
        "Content-Type": "video/mp4",
        "Content-Disposition": contentDisposition(previewName, true),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Accept-Ranges": "bytes",
      });

      if (range && /^bytes=\d*-\d*$/.test(range)) {
        const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
        const total = mp4Buffer.length;
        const start = startStr ? parseInt(startStr, 10) : 0;
        const end = endStr ? parseInt(endStr, 10) : total - 1;
        if (
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          start >= 0 &&
          end >= start &&
          start < total
        ) {
          const safeEnd = Math.min(end, total - 1);
          status = 206;
          responseBuffer = mp4Buffer.subarray(start, safeEnd + 1);
          headers.set("Content-Range", `bytes ${start}-${safeEnd}/${total}`);
        }
      }

      headers.set("Content-Length", String(responseBuffer.length));

      return new Response(new Uint8Array(responseBuffer), {
        status,
        headers,
      });
    } catch (conversionError) {
      const { reason, message } = classifyVideoPreviewError(conversionError);
      console.error("[video-preview] Video conversion failed", {
        reason,
        fileId: file.id,
        displayName: file.displayName,
        extension: file.extension,
        size: file.size,
        storageKey: file.storageKey,
        message,
        detail:
          conversionError instanceof VideoPreviewConversionError
            ? conversionError.detail
            : undefined,
      });
      return Response.json(
        {
          error: "Aperçu vidéo indisponible pour ce fichier.",
          code: reason,
        },
        { status: 422 },
      );
    }
  } catch (error) {
    return apiError(error);
  }
}
