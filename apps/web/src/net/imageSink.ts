import { readImageFile } from '../gm/imageInput';
import { uploadImage, type UploadApi } from './uploadImage';

/**
 * Destino das imagens escolhidas pelo mestre: devolve a URL a guardar no estado.
 * `maxSide` só vale para o modo local (data URL); o upload usa o limite do compressImage.
 */
export type ImageSink = (file: File, maxSide?: number) => Promise<string>;

/** Modo local: redimensiona e devolve um data URL WebP. */
export const localImageSink: ImageSink = (file, maxSide) => readImageFile(file, maxSide);

/** Modo online: envia ao Storage e devolve a URL pública. */
export const createUploadSink =
  (campaignId: string, api: UploadApi): ImageSink =>
  (file) =>
    uploadImage(file, campaignId, api);
