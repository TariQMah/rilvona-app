export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function assertUploadAllowed(mimeType: string, byteSize: number) {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { ok: false as const, code: 'UNSUPPORTED_MEDIA', message: 'Upload a JPEG, PNG, or WebP image' };
  }
  if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > MAX_UPLOAD_BYTES) {
    return { ok: false as const, code: 'FILE_TOO_LARGE', message: 'Images must be 5 MB or smaller' };
  }
  return { ok: true as const };
}
