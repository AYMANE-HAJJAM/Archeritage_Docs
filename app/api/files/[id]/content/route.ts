import { db } from "@/lib/db";
import { authenticate, apiError, HttpError } from "@/lib/http";
import { assertFileDownloadable, assertFileReadable } from "@/lib/access";
import { isVideoFile, videoContentType } from "@/lib/documents/file-kind";
import { contentDisposition } from "@/lib/validation/file";
import { readObject } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await authenticate(request);
    const { id } = await context.params;
    const file = await db.file.findUnique({ where: { id } });
    if (!file) throw new HttpError(404, "Fichier introuvable.");

    const url = new URL(request.url);
    const image = file.storageProvider === "CLOUDINARY";
    const video = isVideoFile(file);
    const forceDownload =
      url.searchParams.has("download") ||
      (!image &&
        !video &&
        file.mimeType !== "application/pdf" &&
        !url.searchParams.has("thumbnail"));

    if (forceDownload) {
      await assertFileDownloadable(user, file);
    } else {
      // Inline image/PDF/video consultation or thumbnail — view/preview only.
      await assertFileReadable(user, file);
    }

    const range = image ? null : request.headers.get("range");
    if (range && !/^bytes=\d*-\d*$/.test(range)) {
      throw new HttpError(416, "Plage invalide.");
    }
    const result = await readObject(
      file,
      url.searchParams.has("thumbnail"),
      range,
      forceDownload,
    );
    const downloadName =
      file.extension &&
      !file.displayName.toLowerCase().endsWith(`.${file.extension}`)
        ? `${file.displayName}.${file.extension}`
        : file.displayName;
    // Prefer extension-derived video MIME — stored type may be octet-stream.
    const contentType = video
      ? videoContentType(file)
      : result.contentType;
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition(downloadName, !forceDownload),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (result.length) headers.set("Content-Length", result.length);
    if (result.contentRange) headers.set("Content-Range", result.contentRange);
    if (!image) headers.set("Accept-Ranges", "bytes");
    return new Response(result.body as ReadableStream, {
      status: result.status,
      headers,
    });
  } catch (error) {
    return apiError(error);
  }
}
