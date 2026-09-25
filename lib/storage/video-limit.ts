/**
 * Cloudinary accepts videos up to this size. Larger videos go to B2.
 * Single source for the threshold — do not duplicate the number elsewhere.
 */
export const CLOUDINARY_VIDEO_MAX_MB_DEFAULT = 100;

export function resolveCloudinaryVideoMaxMb(): number {
  const raw = process.env.CLOUDINARY_VIDEO_MAX_MB;
  if (raw === undefined || raw.trim() === "") {
    return CLOUDINARY_VIDEO_MAX_MB_DEFAULT;
  }
  const mb = Number(raw);
  if (!Number.isFinite(mb) || mb < 1 || mb > 10240) {
    throw new Error(
      `CLOUDINARY_VIDEO_MAX_MB must be a number between 1 and 10240 (got ${JSON.stringify(raw)}).`,
    );
  }
  return mb;
}

export function cloudinaryVideoMaxBytes(): number {
  return resolveCloudinaryVideoMaxMb() * 1024 * 1024;
}
