import { describe, expect, it } from 'vitest';
import { parseLegacyBackup, LEGACY_MAX_VERSION } from './importLegacy';
import { defaultResources } from './campaign';
import backup from './fixtures/legacy-backup.json';

function drafts(json: unknown) {
  const r = parseLegacyBackup(json);
  if (!r.ok) throw new Error('esperava ok');
  return r.characters;
}
const one = (c: Record<string, unknown>) => drafts({ version: 8, characters: [c] })[0];

describe('parseLegacyBackup', () => {
  it('mapeia o personagem completo', () => {
    const [full] = drafts(backup);
    expect(full.legacyId).toBe('leg-1');
    expect(full.input.name).toBe('Aria Teste');
    expect(full.input.resources).toEqual({
      hp: { current: 22, max: 30 },
      aura: { current: 7, max: 12 },
      ammo: { current: 4, max: 6 },
    });
    expect(full.input.speed).toBe(8);
    expect(full.input.portrait).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(full.input.tokenImage).toBe(full.input.portrait);
    expect(full.input.fullBodyArt).toBe('data:image/png;base64,AAAA');
    expect(full.images).toEqual({
      portrait: full.input.portrait,
      tokenImage: full.input.portrait,
      fullBodyArt: 'data:image/png;base64,AAAA',
    });
  });

  it('personagem só com obrigatórios: speed 5, imagens vazias', () => {
    const min = drafts(backup)[1];
    expect(min.input.speed).toBe(5);
    expect(min.input.portrait).toBe('');
    expect(min.input.fullBodyArt).toBe('');
    expect(min.input.tokenImage).toBe('');
    expect(min.images).toEqual({});
  });

  it('kind e hpVisibility seguem role', () => {
    const [pc, , npc] = drafts(backup);
    expect(pc.input.kind).toBe('pc');
    expect(pc.input.hpVisibility).toBe('exact');
    expect(npc.input.kind).toBe('npc');
    expect(npc.input.hpVisibility).toBe('band');
  });

  it('limita current ao max', () => {
    const c = one({ id: 'x', name: 'A', maxHp: 10, currentHp: 99, maxAura: 5, currentAura: 6, maxAmmo: 1, currentAmmo: 2 });
    expect(c.input.resources.hp).toEqual({ current: 10, max: 10 });
    expect(c.input.resources.aura).toEqual({ current: 5, max: 5 });
    expect(c.input.resources.ammo).toEqual({ current: 1, max: 1 });
  });

  it('valores não finitos ou inválidos viram o padrão', () => {
    const c = one({ id: 'x', name: 'A', maxHp: 'abc', currentHp: NaN, maxAura: Infinity, currentAura: null, speed: NaN });
    expect(c.input.resources).toEqual(defaultResources());
    expect(c.input.speed).toBe(5);
  });

  it('nome ausente ou não-string vira "Sem nome"; id ausente ganha legacyId', () => {
    expect(one({ id: 'x', maxHp: 1, currentHp: 1 }).input.name).toBe('Sem nome');
    expect(one({ id: 'x', name: 42 }).input.name).toBe('Sem nome');
    const d = drafts({ version: 8, characters: [{ name: 'A' }, { name: 'B' }] });
    expect(d[0].legacyId).not.toBe(d[1].legacyId);
    expect(d[0].legacyId).toBeTruthy();
  });

  it('imagens não-string viram vazio', () => {
    const c = one({ id: 'x', name: 'A', icon: 5, bannerImage: {} });
    expect(c.input.portrait).toBe('');
    expect(c.input.fullBodyArt).toBe('');
    expect(c.images).toEqual({});
  });

  it('ignora entradas de personagens que não são objetos', () => {
    expect(drafts({ version: 8, characters: [null, 3, { id: 'a', name: 'A' }] })).toHaveLength(1);
  });

  it('rejeita arquivo inválido', () => {
    for (const bad of [null, 'x', 42, [], {}, { characters: 'no' }, { version: 8 }]) {
      expect(parseLegacyBackup(bad)).toEqual({ ok: false, error: 'invalid_file' });
    }
  });

  it('rejeita versão maior que a suportada, aceita a suportada', () => {
    expect(LEGACY_MAX_VERSION).toBe(8);
    expect(parseLegacyBackup({ version: 9, characters: [] })).toEqual({ ok: false, error: 'unsupported_version' });
    expect(parseLegacyBackup({ version: 8, characters: [] })).toEqual({ ok: true, characters: [] });
  });
});
