export const MAX_SIDE = 2560;
const FIRST_QUALITY = 0.85;
const FALLBACK_QUALITY = 0.7;
const SOFT_LIMIT_BYTES = 1_000_000;
export const MAX_UPLOAD_BYTES = 1_500_000;

export class ImageTooLargeError extends Error {
  constructor() {
    super('A imagem é grande demais mesmo depois de comprimida.');
  }
}

/** Escolhe o blob a enviar: o primeiro se couber no soft limit; senão o de menor qualidade, que deve caber no limite. */
export function pickBlob(first: Blob, second: (() => Promise<Blob>) | null, limit = MAX_UPLOAD_BYTES): Promise<Blob> {
  return (async () => {
    const blob = first.size > SOFT_LIMIT_BYTES && second ? await second() : first;
    if (blob.size > limit) throw new ImageTooLargeError();
    return blob;
  })();
}

/** Reduz mantendo a proporção para caber em `max` no lado maior; nunca aumenta. */
export function fitWithin(w: number, h: number, max = MAX_SIDE): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  if (scale === 1) return { w, h };
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Imagem inválida'));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao comprimir'))), 'image/webp', quality);
  });
}

/** Redimensiona (até 2560 px) e converte para WebP; baixa a qualidade se passar de 1 MB. */
export async function compressImage(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const { w, h } = fitWithin(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await toBlob(canvas, FIRST_QUALITY);
  return pickBlob(blob, () => toBlob(canvas, FALLBACK_QUALITY));
}
