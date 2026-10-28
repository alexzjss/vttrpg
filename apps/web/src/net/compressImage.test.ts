import { describe, expect, it } from 'vitest';
import { fitWithin } from './compressImage';

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
