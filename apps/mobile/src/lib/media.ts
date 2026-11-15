import { API_ORIGIN } from '../config';

export function mediaUrl(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
}

export function base64ByteSize(value: string) {
  const cleaned = value.replace(/\s/g, '');
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  return Math.floor((cleaned.length * 3) / 4) - padding;
}

export function normalizeImageMime(type: string | null | undefined) {
  if (type === 'image/jpg' || type === 'image/jpeg')
    return 'image/jpeg' as const;
  if (type === 'image/png') return 'image/png' as const;
  if (type === 'image/webp') return 'image/webp' as const;
  return null;
}
