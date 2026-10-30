import { describe, expect, it } from 'vitest';
import { ImageTooLargeError, fitWithin, pickBlob } from './compressImage';

describe('fitWithin', () => {
  it('reduz mantendo a proporção', () => {
    expect(fitWithin(5000, 2500)).toEqual({ w: 2560, h: 1280 });
    expect(fitWithin(2500, 5000)).toEqual({ w: 1280, h: 2560 });
  });
  it('não aumenta imagens pequenas', () => {
    expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 });
  });
  it('respeita um máximo customizado e nunca zera um lado', () => {
    expect(fitWithin(1000, 10, 100)).toEqual({ w: 100, h: 1 });
  });
});

describe('pickBlob', () => {
  const blob = (n: number) => new Blob([new Uint8Array(n)]);
  it('mantém o primeiro quando é pequeno', async () => {
    const first = blob(500_000);
    expect(await pickBlob(first, async () => blob(1))).toBe(first);
  });
  it('usa o segundo quando o primeiro passa de 1 MB', async () => {
    const second = blob(900_000);
    expect(await pickBlob(blob(1_200_000), async () => second)).toBe(second);
  });
  it('rejeita se ainda passar de 1,5 MB', async () => {
    await expect(pickBlob(blob(1_600_000), async () => blob(1_550_000))).rejects.toBeInstanceOf(ImageTooLargeError);
    await expect(pickBlob(blob(1_600_000), null)).rejects.toBeInstanceOf(ImageTooLargeError);
  });
});
