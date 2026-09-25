export type UploadErrorCode =
  | "unsupported_file_type"
  | "invalid_upload_context"
  | "forbidden"
  | "cloudinary_upload_failed"
  | "b2_upload_failed"
  | "storage_quota_exceeded"
  | "file_too_large";

const STATUS: Record<UploadErrorCode, number> = {
  unsupported_file_type: 400,
  invalid_upload_context: 400,
  forbidden: 403,
  cloudinary_upload_failed: 502,
  b2_upload_failed: 502,
  storage_quota_exceeded: 507,
  file_too_large: 413,
};

export class UploadError extends Error {
  readonly code: UploadErrorCode;
  readonly status: number;

  constructor(code: UploadErrorCode, message: string) {
    super(message);
    this.name = "UploadError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export function classifyStorageFailure(
  provider: "CLOUDINARY" | "BACKBLAZE_B2",
  error: unknown,
): UploadError {
  const detail = error instanceof Error ? error.message : String(error);
  if (/quota|storage limit|insufficient storage/i.test(detail)) {
    return new UploadError(
      "storage_quota_exceeded",
      "Le quota de stockage est atteint.",
    );
  }
  if (provider === "CLOUDINARY") {
    return new UploadError(
      "cloudinary_upload_failed",
      "L’envoi vers Cloudinary a échoué.",
    );
  }
  return new UploadError(
    "b2_upload_failed",
    "L’envoi vers le stockage documents a échoué.",
  );
}
