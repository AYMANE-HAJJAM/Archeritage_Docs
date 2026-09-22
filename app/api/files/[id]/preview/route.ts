import { db } from "@/lib/db";
import { authenticate, apiError, HttpError } from "@/lib/http";
import { assertFileReadable } from "@/lib/access";
import { contentDisposition } from "@/lib/validation/file";
import { readObject } from "@/lib/storage";
import { isConvertibleOfficeDocument } from "@/lib/documents/converter";
import { getOrGeneratePreviewPdf } from "@/lib/storage/preview-cache";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
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
          if (start < total && end < total && start <= end) {
            status = 206;
            responseBuffer = pdfBuffer.subarray(start, end + 1);
            headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
          }
        }

        headers.set("Content-Length", String(responseBuffer.length));

        return new Response(new Uint8Array(responseBuffer), {
          status,
          headers,
        });
      } catch (conversionError) {
        const message =
          conversionError instanceof Error
            ? conversionError.message
            : "Aperçu indisponible pour ce fichier.";
        const missingLibreOffice = /LibreOffice/i.test(message);
        console.error(
          `[preview] Document conversion failed for file ${file.id} (${file.displayName}):`,
          message,
          missingLibreOffice
            ? "(install LibreOffice or set SOFFICE_PATH)"
            : "",
        );
        return Response.json(
          {
            error:
              "Aperçu indisponible pour ce fichier. Téléchargez l’original pour le consulter.",
            code: missingLibreOffice
              ? "PREVIEW_LIBREOFFICE_MISSING"
              : "PREVIEW_CONVERSION_FAILED",
          },
          { status: 422 },
        );
      }
    }

    // 3. Unsupported format
    return Response.json(
      { error: "Aperçu indisponible pour ce fichier." },
      { status: 415 }
    );
  } catch (error) {
    return apiError(error);
  }
}
