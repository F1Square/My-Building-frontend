import api from './api';

export const MAX_COMPLAINT_PHOTOS = 5;

/**
 * Upload a local image URI to Cloudinary via /complaints/upload-attachment.
 * Returns the hosted photo_url, or null on failure.
 */
export async function uploadComplaintPhoto(
  uri: string,
  mimeHint?: string | null,
): Promise<string | null> {
  if (!uri || uri.startsWith('http') || uri.startsWith('data:')) {
    return uri?.startsWith('http') ? uri : null;
  }

  const formData = new FormData();
  const uriClean = uri.split('?')[0];
  const extGuess = uriClean.includes('.') ? uriClean.split('.').pop()!.toLowerCase() : 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(extGuess) ? extGuess : 'jpg';
  const mime =
    mimeHint ||
    (safeExt === 'png' ? 'image/png' : safeExt === 'webp' ? 'image/webp' : 'image/jpeg');

  formData.append('attachment', {
    uri,
    name: `complaint.${safeExt}`,
    type: mime,
  } as any);

  const res = await api.post('/complaints/upload-attachment', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data?.photo_url || null;
}

/** Upload up to MAX_COMPLAINT_PHOTOS local URIs sequentially. */
export async function uploadComplaintPhotos(uris: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const uri of uris.slice(0, MAX_COMPLAINT_PHOTOS)) {
    try {
      const url = await uploadComplaintPhoto(uri);
      if (url) urls.push(url);
    } catch {
      /* skip failed uploads; others may still succeed */
    }
  }
  return urls;
}

/** Normalize detail/list payloads that may have photo_url and/or photo_urls. */
export function getComplaintPhotos(item: { photo_url?: string | null; photo_urls?: string[] } | null | undefined): string[] {
  if (!item) return [];
  if (Array.isArray(item.photo_urls) && item.photo_urls.length) {
    return item.photo_urls.filter(Boolean).slice(0, MAX_COMPLAINT_PHOTOS);
  }
  if (item.photo_url) return [item.photo_url];
  return [];
}
