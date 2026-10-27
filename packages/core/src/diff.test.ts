import { describe, expect, it } from 'vitest';
import { createCampaign, defaultResources } from './campaign';
import { applyChanges, diffProjection, stableStringify } from './diff';
import { project } from './projection';

describe('stableStringify', () => {
  it('ignora a ordem das chaves', () => {
    expect(stableStringify({ a: 1, b: { c: 2, d: [1, { y: 1, x: 2 }] } }))
      .toBe(stableStringify({ b: { d: [1, { x: 2, y: 1 }], c: 2 }, a: 1 }));
  });
});

describe('diffProjection', () => {
  const base = () => {
    const s = createCampaign('c', 'C');
    s.characters.p1 = {
      id: 'p1', kind: 'pc', name: 'Ana', portrait: '', fullBodyArt: '', tokenImage: '',
      resources: defaultResources(), speed: 5, hpVisibility: 'exact',
    };
    return s;
  };
  it('sem mudanças -> vazio', () => {
    const p = project(base(), { kind: 'gm' });
    expect(diffProjection(p, project(base(), { kind: 'gm' }))).toEqual([]);
  });
  it('removes antes de upserts; personagens antes de tokens; setScene/setName', () => {
    const a = base();
    a.scene.tokens.t1 = { id: 't1', characterId: 'p1', cell: { col: 0, row: 0 }, size: 1, hidden: false };
    const b = base();
    b.name = 'Outro';
    b.scene.background = 'bg';
    b.characters.p2 = { ...b.characters.p1!, id: 'p2' };
    const changes = diffProjection(project(a, { kind: 'gm' }), project(b, { kind: 'gm' }));
    expect(changes.map((c) => c.kind)).toEqual(['removeToken', 'upsertCharacter', 'setScene', 'setName']);
  });
  it('applyChanges de setScene mantém tokens', () => {
    const a = base();
    a.scene.tokens.t1 = { id: 't1', characterId: 'p1', cell: { col: 0, row: 0 }, size: 1, hidden: false };
    const p = project(a, { kind: 'gm' });
    const r = applyChanges(p, [{ kind: 'setScene', scene: { ...p.scene, name: 'X' } }], 5);
    expect(r.scene.tokens.t1).toBeDefined();
    expect(r.scene.name).toBe('X');
    expect(r.revision).toBe(5);
  });
});
