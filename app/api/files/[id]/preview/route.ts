import { db } from "@/lib/db";
import { authenticate, apiError, HttpError } from "@/lib/http";
import { assertFileReadable } from "@/lib/access";
import { contentDisposition } from "@/lib/validation/file";
import { readObject } from "@/lib/storage";
import {
  isConvertibleOfficeDocument,
  PreviewConversionError,
  type PreviewFailureReason,
} from "@/lib/documents/converter";
import { getOrGeneratePreviewPdf } from "@/lib/storage/preview-cache";

export const runtime = "nodejs";

function classifyPreviewError(error: unknown): {
  reason: PreviewFailureReason | "preview_failed";
  message: string;
} {
  if (error instanceof PreviewConversionError) {
    return { reason: error.reason, message: error.message };
  }
  const message =
    error instanceof Error ? error.message : "Aperçu indisponible pour ce fichier.";
  if (/LibreOffice/i.test(message)) {
    return { reason: "libreoffice_missing", message };
  }
  if (/ETIMEDOUT|timed out|délai/i.test(message)) {
    return { reason: "conversion_timeout", message };
  }
  if (/ZIP|OOXML|corrompu|PK manquant/i.test(message)) {
    return { reason: "invalid_docx", message };
  }
  if (/aucun fichier PDF|output/i.test(message)) {
    return { reason: "output_missing", message };
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
    const isPdf =
      file.mimeType === "application/pdf" ||
      file.extension.toLowerCase() === "pdf";

    // 1. Native PDF: stream directly from storage
    if (isPdf) {
      const range = request.headers.get("range");
      if (range && !/^bytes=\d*-\d*$/.test(range)) {
        throw new HttpError(416, "Plage invalide.");
      }
      const result = await readObject(file, false, range, false);
      const filename = file.displayName.toLowerCase().endsWith(".pdf")
        ? file.displayName
        : `${file.displayName}.pdf`;

      const headers = new Headers({
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(filename, true),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Accept-Ranges": "bytes",
      });

      if (result.length) headers.set("Content-Length", result.length);
      if (result.contentRange) headers.set("Content-Range", result.contentRange);

      return new Response(result.body as ReadableStream, {
        status: result.status,
        headers,
      });
    }

    // 2. Office formats: convert server-side and serve cached PDF preview
    if (isConvertibleOfficeDocument(file.extension)) {
      try {
        const pdfBuffer = await getOrGeneratePreviewPdf(file);
        const previewName = `${file.displayName.replace(/\.[^/.]+$/, "")}.pdf`;

        const range = request.headers.get("range");
        let status = 200;
        let responseBuffer: Buffer = pdfBuffer;

        const headers = new Headers({
          "Content-Type": "application/pdf",
          "Content-Disposition": contentDisposition(previewName, true),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Accept-Ranges": "bytes",
        });

        if (range && /^bytes=\d*-\d*$/.test(range)) {
          const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
          const total = pdfBuffer.length;
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
            responseBuffer = pdfBuffer.subarray(start, safeEnd + 1);
            headers.set(
              "Content-Range",
              `bytes ${start}-${safeEnd}/${total}`,
            );
          }
        }

        headers.set("Content-Length", String(responseBuffer.length));

        return new Response(new Uint8Array(responseBuffer), {
          status,
          headers,
        });
      } catch (conversionError) {
        const { reason, message } = classifyPreviewError(conversionError);
        console.error("[preview] Document conversion failed", {
          reason,
          fileId: file.id,
          displayName: file.displayName,
          extension: file.extension,
          size: file.size,
          storageKey: file.storageKey,
          message,
          detail:
            conversionError instanceof PreviewConversionError
              ? conversionError.detail
              : undefined,
        });
        return Response.json(
          {
            error:
              "Impossible de générer l’aperçu de ce document. Téléchargez l’original pour le consulter.",
            code: reason,
          },
          { status: 422 },
        );
      }
    }

    // 3. Unsupported format
    return Response.json(
      {
        error: "Impossible de générer l’aperçu de ce document.",
        code: "unsupported_format",
      },
      { status: 415 },
    );
  } catch (error) {
    return apiError(error);
  }
}
