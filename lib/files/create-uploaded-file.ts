/**
 * Shared upload service for the UI route and the future batch importer.
 * Provider, path, and File row are decided here — callers must not create File rows themselves.
 *
 * Rename of labels does not rewrite this object's key. The key is built once, at upload time.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { assertCanUpload } from "@/lib/access";
import { assertWithinUploadLimit, validateFile } from "@/lib/validation/file";
import {
  deleteObject,
  uploadObject,
  uploadObjectBody,
  uploadWebFileToB2,
} from "@/lib/storage";
import { buildDocumentStoragePath } from "@/lib/storage/path-builder";
import { resolveStorageProvider } from "@/lib/storage/provider";
import { resolveUploadContext } from "@/lib/structure/upload-context";
import {
  classifyStorageFailure,
  UploadError,
} from "@/lib/files/upload-error";

export type UploadSource =
  | Blob
  | Buffer
  | { stream: Readable; sizeBytes: number };

export type CreateUploadedFileInput = {
  userId: string;
  /** When set, must match the section's project. */
  projectId?: string | null;
  /** When set, must match the section group's part. */
  partId?: string | null;
  sectionId: string;
  folderId?: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  source: UploadSource;
  /** First bytes for signature checks. Required when source is a stream. */
  headBytes?: Buffer;
};

function isStreamSource(
  source: UploadSource,
): source is { stream: Readable; sizeBytes: number } {
  return (
    typeof source === "object" &&
    source !== null &&
    "stream" in source &&
    !Buffer.isBuffer(source) &&
    !(source instanceof Blob)
  );
}

async function headOf(source: UploadSource, headBytes?: Buffer): Promise<Buffer> {
  if (headBytes) return headBytes;
  if (Buffer.isBuffer(source)) return source.subarray(0, 64);
  if (source instanceof Blob) {
    return Buffer.from(await source.slice(0, 64).arrayBuffer());
  }
  throw new UploadError(
    "unsupported_file_type",
    "En-tête du fichier manquant.",
  );
}

export async function createUploadedFile(input: CreateUploadedFileInput) {
  if (!input.sectionId?.trim()) {
    throw new UploadError("invalid_upload_context", "Section manquante.");
  }

  try {
    assertWithinUploadLimit(input.sizeBytes);
  } catch {
    throw new UploadError(
      "file_too_large",
      "Le fichier dépasse la taille autorisée.",
    );
  }

  if (Buffer.isBuffer(input.source) && input.source.length !== input.sizeBytes) {
    throw new UploadError("invalid_upload_context", "Taille du fichier incohérente.");
  }
  if (input.source instanceof Blob && input.source.size !== input.sizeBytes) {
    throw new UploadError("invalid_upload_context", "Taille du fichier incohérente.");
  }
  if (isStreamSource(input.source) && input.source.sizeBytes !== input.sizeBytes) {
    throw new UploadError("invalid_upload_context", "Taille du fichier incohérente.");
  }

  const head = await headOf(input.source, input.headBytes);
  let metadata;
  try {
    metadata = validateFile(
      input.originalName,
      input.mimeType,
      head,
      input.sizeBytes,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fichier invalide.";
    if (/trop volumineux|MAX_UPLOAD_MB/i.test(message)) {
      throw new UploadError("file_too_large", "Le fichier dépasse la taille autorisée.");
    }
    throw new UploadError("unsupported_file_type", message);
  }

  let ctx;
  try {
    ctx = await resolveUploadContext({
      sectionId: input.sectionId,
      folderId: input.folderId ?? null,
    });
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) {
      throw new UploadError("forbidden", error.message);
    }
    if (error instanceof HttpError) {
      throw new UploadError("invalid_upload_context", error.message);
    }
    throw error;
  }

  if (input.projectId && input.projectId !== ctx.projectId) {
    throw new UploadError(
      "invalid_upload_context",
      "Le projet ne correspond pas à la section.",
    );
  }
  if (input.partId && input.partId !== ctx.partId) {
    throw new UploadError(
      "invalid_upload_context",
      "La partie ne correspond pas à la section.",
    );
  }

  const actor = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, role: true, status: true },
  });
  if (!actor || actor.status === "DISABLED") {
    throw new UploadError("forbidden", "Permission insuffisante pour cette opération.");
  }
  try {
    await assertCanUpload(actor, ctx.projectId);
  } catch (error) {
    if (error instanceof HttpError) {
      throw new UploadError("forbidden", error.message);
    }
    throw error;
  }

  const storageProvider = resolveStorageProvider({
    fileName: input.originalName,
    mimeType: metadata.mimeType,
    extension: metadata.extension,
    sizeBytes: input.sizeBytes,
  });

  const storageKey = buildDocumentStoragePath({
    territoireCode: ctx.territoireCode,
    projectSlug: ctx.projectSlug,
    partSlug: ctx.partSlug,
    sectionSegment: ctx.sectionSegment,
    folderNames: ctx.folderNames,
    originalFilename: input.originalName,
    fileId: randomUUID(),
  });

  let object: { storageKey: string; storageVersion: string | null };
  try {
    if (storageProvider === "CLOUDINARY") {
      const bytes = Buffer.isBuffer(input.source)
        ? input.source
        : input.source instanceof Blob
          ? Buffer.from(await input.source.arrayBuffer())
          : Buffer.from(await streamToBuffer(input.source.stream));
      object = await uploadObject(
        bytes,
        "CLOUDINARY",
        metadata.mimeType,
        storageKey,
      );
    } else if (Buffer.isBuffer(input.source)) {
      object = await uploadObject(
        input.source,
        "BACKBLAZE_B2",
        metadata.mimeType,
        storageKey,
      );
    } else if (input.source instanceof Blob) {
      object = await uploadWebFileToB2(
        input.source,
        metadata.mimeType,
        storageKey,
      );
    } else {
      object = await uploadObjectBody(
        input.source.stream,
        input.sizeBytes,
        "BACKBLAZE_B2",
        metadata.mimeType,
        storageKey,
      );
    }
  } catch (error) {
    if (error instanceof UploadError) throw error;
    console.error("[createUploadedFile] storage failed", {
      provider: storageProvider,
      message: error instanceof Error ? error.message.slice(0, 400) : String(error),
    });
    throw classifyStorageFailure(storageProvider, error);
  }

  try {
    return await db.file.create({
      data: {
        extension: metadata.extension,
        mimeType: metadata.mimeType,
        storageProvider,
        storageKey: object.storageKey,
        storageVersion: object.storageVersion,
        originalName: input.originalName,
        displayName: input.originalName,
        size: input.sizeBytes,
        sectionId: ctx.sectionId,
        folderId: ctx.folderId,
        uploadedById: actor.id,
      },
      select: {
        id: true,
        displayName: true,
        originalName: true,
        extension: true,
        mimeType: true,
        size: true,
        storageProvider: true,
        storageKey: true,
        sectionId: true,
        folderId: true,
        createdAt: true,
        uploadedById: true,
        uploadedBy: { select: { name: true } },
        folder: { select: { name: true } },
        section: { select: { name: true, code: true } },
      },
    });
  } catch (error) {
    try {
      await deleteObject({
        storageProvider,
        storageKey: object.storageKey,
        storageVersion: object.storageVersion,
        mimeType: metadata.mimeType,
      });
    } catch {
      console.error("Orphaned upload requires cleanup", object.storageKey);
    }
    throw error;
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
