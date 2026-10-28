import { compressImage } from './compressImage';

export interface UploadApi {
  requestUploadUrl(body: {
    campaignId: string;
    contentType: string;
    bytes: number;
  }): Promise<{ path: string; token: string; publicUrl: string }>;
  uploadToSignedUrl(path: string, token: string, blob: Blob): Promise<void>;
}

/** Comprime, pede a URL assinada, envia e devolve a URL pública da imagem. */
export async function uploadImage(
  file: File,
  campaignId: string,
  api: UploadApi,
  compress: (file: File) => Promise<Blob> = compressImage,
): Promise<string> {
  const blob = await compress(file);
  const { path, token, publicUrl } = await api.requestUploadUrl({
    campaignId,
    contentType: blob.type,
    bytes: blob.size,
  });
  await api.uploadToSignedUrl(path, token, blob);
  return publicUrl;
}
