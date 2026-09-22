import "server-only";
import { randomUUID } from "node:crypto";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { File as StoredFile } from "@/generated/prisma/client";

function required(key: string) { const value = process.env[key]; if (!value) throw new Error(`Missing ${key}`); return value; }
function cloud() {
  cloudinary.config({ cloud_name: required("CLOUDINARY_CLOUD_NAME"), api_key: required("CLOUDINARY_API_KEY"), api_secret: required("CLOUDINARY_API_SECRET"), secure: true });
  return cloudinary;
}
function b2() {
  return new S3Client({ endpoint: required("B2_ENDPOINT"), region: required("B2_REGION"), credentials: { accessKeyId: required("B2_KEY_ID"), secretAccessKey: required("B2_APPLICATION_KEY") }, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" });
}
export async function uploadObject(bytes: Buffer, provider: StoredFile["storageProvider"], mimeType: string) {
  const key = `archeritage/${randomUUID()}`;
  if (provider === "CLOUDINARY") {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      cloud().uploader.upload_stream({ public_id: key, resource_type: "image", type: "authenticated", allowed_formats: ["jpg", "png", "webp"], overwrite: false }, (error, result) => error ? reject(error) : result ? resolve(result) : reject(new Error("Upload failed"))).end(bytes);
    });
    return { storageKey: result.public_id, storageVersion: String(result.version) };
  }
  const result = await b2().send(new PutObjectCommand({ Bucket: required("B2_BUCKET_NAME"), Key: key, Body: bytes, ContentType: mimeType, ContentLength: bytes.length }));
  return { storageKey: key, storageVersion: result.VersionId ?? null };
}
type ObjectRef = Pick<StoredFile, "storageProvider" | "storageKey" | "storageVersion">;
export async function deleteObject(file: ObjectRef) {
  if (file.storageProvider === "CLOUDINARY") {
    const result = await cloud().uploader.destroy(file.storageKey, { resource_type: "image", type: "authenticated", invalidate: true });
    if (result.result !== "ok" && result.result !== "not found") throw new Error("Storage deletion failed");
  } else {
    await b2().send(new DeleteObjectCommand({ Bucket: required("B2_BUCKET_NAME"), Key: file.storageKey, VersionId: file.storageVersion ?? undefined }));
  }
}
export async function readObject(file: StoredFile, thumbnail: boolean, range: string | null, download: boolean) {
  if (file.storageProvider === "CLOUDINARY") {
    const client = cloud();
    const url = download
      ? client.utils.private_download_url(file.storageKey, file.extension === "jpeg" ? "jpg" : file.extension, { resource_type: "image", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 60 })
      : client.url(file.storageKey, { type: "authenticated", resource_type: "image", sign_url: true, secure: true, version: Number(file.storageVersion), transformation: [{ width: thumbnail ? 560 : 1800, height: thumbnail ? 400 : 1800, crop: thumbnail ? "fill" : "limit", quality: "auto", fetch_format: "auto" }] });
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

export async function putCachedPreviewObject(previewKey: string, bytes: Buffer): Promise<void> {
  try {
    await b2().send(new PutObjectCommand({
      Bucket: required("B2_BUCKET_NAME"),
      Key: previewKey,
      Body: bytes,
      ContentType: "application/pdf",
      ContentLength: bytes.length,
    }));
  } catch (error) {
    console.warn("Failed to persist preview object to B2:", error instanceof Error ? error.message : "UnknownError");
  }
}
