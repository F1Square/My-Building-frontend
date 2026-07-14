import api from './api';

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
