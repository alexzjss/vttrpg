import { describe, expect, it } from 'vitest';
import { createCampaign } from './campaign';
import { migrateState, sanitizeDefense, sanitizeStagger } from './migrate';
import { defaultDefense, defaultStagger } from './rules/defense';
import { makeCharacter } from './testing';

/** Estado salvo pela Fase 2: sem `version`, `settings`, `log`, `requests` nem campos v2 nos personagens. */
function v1State() {
  const s = createCampaign('c', 'C') as unknown as Record<string, unknown>;
  delete s.version; delete s.settings; delete s.log; delete s.requests;
  const { id, defense: _d, stagger: _s, affinities: _a, conditions: _c, actions: _ac, cooldowns: _cd, ...legacy } = makeCharacter({ id: 'p1', name: 'Ana' });
  (s.characters as Record<string, unknown>).p1 = { id, ...legacy };
  s.revision = 7;
  s.audienceSeq = { gm: 3 };
  return s;
}

describe('migrateState', () => {
  it('v1 vira v2 preservando revision e audienceSeq', () => {
    const out = migrateState(v1State())!;
    expect(out.version).toBe(2);
    expect(out.revision).toBe(7);
    expect(out.audienceSeq).toEqual({ gm: 3 });
    expect(out.settings).toEqual({ requireApproval: false });
    expect(out.log).toEqual([]);
    expect(out.requests).toEqual({});
    const c = out.characters.p1!;
    expect(c.defense).toEqual(defaultDefense());
    expect(c.defense.armor).toBe(10);
    expect(c.stagger).toEqual(defaultStagger());
    expect(c.conditions).toEqual([]);
    expect(c.actions).toEqual([]);
    expect(c.affinities).toEqual({});
    expect(c.cooldowns).toEqual({});
  });
  it('v2 passa inalterado (idempotente), inclusive após JSON', () => {
    const v2 = createCampaign('c', 'C');
    v2.characters.p1 = makeCharacter({ id: 'p1', affinities: { fogo: 'fraco' }, conditions: [{ id: 'cego', duration: 2 }] });
    const once = migrateState(JSON.parse(JSON.stringify(v2)));
    expect(once).toEqual(v2);
    expect(migrateState(once)).toEqual(v2);
  });
  it('forma mínima inválida vira null', () => {
    for (const bad of [{}, null, undefined, 3, [], { ...createCampaign('c', 'C'), revision: 'x' },
      { ...createCampaign('c', 'C'), characters: [] }, { ...createCampaign('c', 'C'), encounter: null }]) {
      expect(migrateState(bad)).toBeNull();
    }
    const s = createCampaign('c', 'C') as unknown as { characters: Record<string, unknown> };
    s.characters.x = { id: 'x' };
    expect(migrateState(s)).toBeNull();
  });
  it('descarta condições e ações inválidas e afinidades desconhecidas', () => {
    const s = createCampaign('c', 'C');
    s.characters.p1 = makeCharacter({
      id: 'p1',
      conditions: [{ id: 'cego', duration: 1 }, { id: 'xx', duration: 1 }, { id: 'cego', duration: -1 }] as never,
      actions: [{ id: 'a' }] as never,
      affinities: { fogo: 'fraco', plasma: 'fraco', raio: 'bogus' } as never,
      cooldowns: { a: 2, b: -1, c: 'x' } as never,
    });
    const c = migrateState(s)!.characters.p1!;
    expect(c.conditions).toEqual([{ id: 'cego', duration: 1 }]);
    expect(c.actions).toEqual([]);
    expect(c.affinities).toEqual({ fogo: 'fraco' });
    expect(c.cooldowns).toEqual({ a: 2 });
  });
  it('sanitiza defesa e stagger corrompidos do estado salvo', () => {
    const s = createCampaign('c', 'C');
    s.characters.p1 = makeCharacter({ id: 'p1', defense: { ...defaultDefense(), reduction: 5 }, stagger: { ...defaultStagger(), duration: 99 } });
    const c = migrateState(s)!.characters.p1!;
    expect(c.defense.reduction).toBe(defaultDefense().reduction);
    expect(c.stagger.duration).toBe(1);
  });
});

describe('sanitizeDefense', () => {
  it('lixo vira o padrão, com armor opcional', () => {
    expect(sanitizeDefense(undefined)).toEqual(defaultDefense());
    expect(sanitizeDefense('x', 14)).toEqual(defaultDefense(14));
    expect(sanitizeDefense({ armor: -1 }, 14).armor).toBe(14);
  });
  it('recusa NaN, Infinity, negativos e fora de [0,1]', () => {
    const d = sanitizeDefense({ armor: NaN, max: Infinity, current: -3, reduction: 1.5, regeneration: -1, activationThreshold: -0.1, broken: 'x' });
    expect(d).toEqual(defaultDefense());
  });
  it('current nunca passa de max', () => {
    expect(sanitizeDefense({ max: 10, current: 50 }).current).toBe(10);
  });
  it('mantém valores válidos', () => {
    const d = { armor: 12, max: 30, current: 7, reduction: 0.5, regeneration: 2, activationThreshold: 1, broken: true };
    expect(sanitizeDefense(d)).toEqual(d);
  });
});

describe('sanitizeStagger', () => {
  it('lixo vira o padrão', () => {
    expect(sanitizeStagger(null)).toEqual(defaultStagger());
    expect(sanitizeStagger({ max: NaN, current: Infinity, recovery: -1, damageMultiplier: 'x' })).toEqual(defaultStagger());
  });
  it('duration inteira de 1 a 10 e turnsRemaining inteiro >= 0', () => {
    for (const duration of [0, 11, 1.5, NaN]) expect(sanitizeStagger({ duration }).duration).toBe(1);
    expect(sanitizeStagger({ duration: 10 }).duration).toBe(10);
    for (const turnsRemaining of [-1, 1.5, Infinity]) expect(sanitizeStagger({ turnsRemaining }).turnsRemaining).toBe(0);
    expect(sanitizeStagger({ turnsRemaining: 3 }).turnsRemaining).toBe(3);
  });
  it('current acima de max volta ao padrão', () => {
    expect(sanitizeStagger({ max: 50, current: 80 }).current).toBe(0);
  });
});
