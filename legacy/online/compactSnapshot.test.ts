import { describe, expect, it } from 'vitest';
import { compactSnapshotForUpload } from './compactSnapshot';

describe('compactSnapshotForUpload', () => {
  it('remove data URLs de imagem e preserva URLs e dados de jogo', () => {
    const source = { version: 8, characters: [{ name: 'A', icon: 'data:image/png;base64,AAA', currentHp: 7 }], cena: { scene: { image: 'https://cdn/map.webp' } } } as any;
    const result = compactSnapshotForUpload(source);
    expect(result.removedImages).toBe(1);
    expect(result.snapshot.characters[0]).toMatchObject({ name: 'A', icon: '', currentHp: 7 });
    expect(result.snapshot.cena.scene.image).toBe('https://cdn/map.webp');
    expect(source.characters[0].icon).toContain('data:image');
  });
});
