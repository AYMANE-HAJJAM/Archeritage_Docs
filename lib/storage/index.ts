import "server-only";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { File as StoredFile } from "@/generated/prisma/client";
import { isVideoFile } from "@/lib/documents/file-kind";

function required(key: string) { const value = process.env[key]; if (!value) throw new Error(`Missing ${key}`); return value; }
function cloud() {
  cloudinary.config({ cloud_name: required("CLOUDINARY_CLOUD_NAME"), api_key: required("CLOUDINARY_API_KEY"), api_secret: required("CLOUDINARY_API_SECRET"), secure: true });
  return cloudinary;
}
function b2() {
  return new S3Client({
    endpoint: required("B2_ENDPOINT"),
    region: required("B2_REGION"),
    credentials: {
      accessKeyId: required("B2_KEY_ID"),
      secretAccessKey: required("B2_APPLICATION_KEY"),
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export async function uploadObject(
  bytes: Buffer,
  provider: StoredFile["storageProvider"],
  mimeType: string,
  storageKey?: string,
) {
  return uploadObjectBody(bytes, bytes.length, provider, mimeType, storageKey);
}

/**
 * Upload bytes or a Node readable stream to Cloudinary (images) / B2 (documents).
 * Prefer streaming for large B2 objects to avoid duplicating the full payload in RAM.
 */
export async function uploadObjectBody(
  body: Buffer | Readable,
  contentLength: number,
  provider: StoredFile["storageProvider"],
  mimeType: string,
  storageKey?: string,
) {
  const key = storageKey || `archeritage/${randomUUID()}`;
  if (key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    throw new Error("Unsafe storage key rejected.");
  }
  if (provider === "CLOUDINARY") {
    if (!Buffer.isBuffer(body)) {
      throw new Error("Cloudinary upload requires a buffered body.");
    }
    const isVideo = mimeType.startsWith("video/");
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      cloud()
        .uploader.upload_stream(
          {
            public_id: key,
            resource_type: isVideo ? "video" : "image",
            type: "authenticated",
            overwrite: false,
            ...(isVideo
              ? {}
              : { allowed_formats: ["jpg", "png", "webp"] }),
          },
          (error, result) =>
            error
              ? reject(error)
              : result
                ? resolve(result)
                : reject(new Error("Upload failed")),
        )
        .end(body);
    });
    return { storageKey: result.public_id, storageVersion: String(result.version) };
  }

  try {
    const result = await b2().send(
      new PutObjectCommand({
        Bucket: required("B2_BUCKET_NAME"),
        Key: key,
        Body: body,
        ContentType: mimeType,
        ContentLength: contentLength,
      }),
    );
    return { storageKey: key, storageVersion: result.VersionId ?? null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const err = error as {
      name?: string;
      Code?: string;
      $metadata?: { httpStatusCode?: number; requestId?: string };
    };
    console.error("[storage] B2 PutObject failed", {
      key,
      contentLength,
      mimeType,
      name: err.name,
      code: err.Code,
      httpStatus: err.$metadata?.httpStatusCode,
      requestId: err.$metadata?.requestId,
      detail: detail.slice(0, 500),
    });
    throw new Error(`B2 upload failed: ${detail.slice(0, 280)}`);
  }
}

/** Stream a Web File/Blob to B2 without buffering the whole object in Node. */
export async function uploadWebFileToB2(
  file: Blob,
  mimeType: string,
  storageKey?: string,
) {
  const nodeStream = Readable.fromWeb(
    file.stream() as import("node:stream/web").ReadableStream,
  );
  return uploadObjectBody(
    nodeStream,
    file.size,
    "BACKBLAZE_B2",
    mimeType,
    storageKey,
  );
}
type ObjectRef = Pick<StoredFile, "storageProvider" | "storageKey" | "storageVersion"> & {
  mimeType?: string | null;
};
export async function deleteObject(file: ObjectRef) {
  if (file.storageProvider === "CLOUDINARY") {
    const resourceType = file.mimeType?.toLowerCase().startsWith("video/")
      ? "video"
      : "image";
    const result = await cloud().uploader.destroy(file.storageKey, { resource_type: resourceType, type: "authenticated", invalidate: true });
    if (result.result !== "ok" && result.result !== "not found") throw new Error("Storage deletion failed");
  } else {
    await b2().send(new DeleteObjectCommand({ Bucket: required("B2_BUCKET_NAME"), Key: file.storageKey, VersionId: file.storageVersion ?? undefined }));
  }
}
export async function readObject(file: StoredFile, thumbnail: boolean, range: string | null, download: boolean) {
  void thumbnail;
  if (file.storageProvider === "CLOUDINARY") {
    const client = cloud();
    const video = isVideoFile(file);
    const resourceType = video ? "video" : "image";
    const url = download || !video
      ? client.utils.private_download_url(file.storageKey, file.extension === "jpeg" ? "jpg" : file.extension, { resource_type: resourceType, type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 120 })
      : client.url(file.storageKey, { type: "authenticated", resource_type: "video", sign_url: true, secure: true, version: Number(file.storageVersion) });
    // The signed provider URL stays on the server; browsers only receive bytes.
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.body) throw new Error("Storage read failed");
    return { body: response.body, contentType: response.headers.get("content-type") || file.mimeType, length: response.headers.get("content-length"), contentRange: null, status: 200 };
  }
  const result = await b2().send(new GetObjectCommand({ Bucket: required("B2_BUCKET_NAME"), Key: file.storageKey, VersionId: file.storageVersion ?? undefined, Range: range ?? undefined }));
  if (!result.Body) throw new Error("Storage read failed");
  return { body: result.Body.transformToWebStream(), contentType: file.mimeType, length: result.ContentLength?.toString(), contentRange: result.ContentRange, status: result.ContentRange ? 206 : 200 };
}

export async function readRawObjectBytes(file: StoredFile): Promise<Buffer> {
  const result = await b2().send(new GetObjectCommand({
    Bucket: required("B2_BUCKET_NAME"),
    Key: file.storageKey,
    VersionId: file.storageVersion ?? undefined,
  }));
  if (!result.Body) throw new Error("Storage read failed");
  const bytes = await result.Body.transformToByteArray();
  return Buffer.from(bytes);
}

export async function getCachedPreviewObject(previewKey: string): Promise<Buffer | null> {
  try {
    const result = await b2().send(new GetObjectCommand({
      Bucket: required("B2_BUCKET_NAME"),
      Key: previewKey,
    }));
    if (!result.Body) return null;
    const bytes = await result.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (error: unknown) {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.warn("B2 preview cache lookup failed:", err.name ?? "UnknownError");
    return null;
  }
}

export async function putCachedPreviewObject(
  previewKey: string,
  bytes: Buffer,
  contentType = "application/pdf",
): Promise<void> {
  try {
    await b2().send(new PutObjectCommand({
      Bucket: required("B2_BUCKET_NAME"),
      Key: previewKey,
      Body: bytes,
      ContentType: contentType,
      ContentLength: bytes.length,
    }));
  } catch (error) {
    console.warn("Failed to persist preview object to B2:", error instanceof Error ? error.message : "UnknownError");
  }
}

/** Best-effort removal of a cached preview derivative in B2 (PDF or MP4). */
export async function deleteCachedPreviewObject(previewKey: string): Promise<void> {
  try {
    await b2().send(new DeleteObjectCommand({
      Bucket: required("B2_BUCKET_NAME"),
      Key: previewKey,
    }));
  } catch (error: unknown) {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return;
    }
    console.warn(
      "Failed to delete B2 preview cache object:",
      error instanceof Error ? error.message : "UnknownError",
    );
  }
}
