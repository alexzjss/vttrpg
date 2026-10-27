import { describe, expect, it } from 'vitest';
import { createCampaign, defaultResources } from './campaign';
import type { Command } from './commands';
import { decide } from './decide';
import { diffProjection, applyChanges } from './diff';
import type { Actor, CampaignState, Character } from './model';
import { actorAudience, audienceKey, hpBand, project, type Audience } from './projection';
import { applyEvents } from './reducer';

const GM: Audience = { kind: 'gm' };
const P1: Audience = { kind: 'player', characterId: 'p1' };

function char(id: string, over: Partial<Character> = {}): Character {
  return {
    id, kind: 'pc', name: id, portrait: '', fullBodyArt: '', tokenImage: '',
    resources: defaultResources(), speed: 5, hpVisibility: 'exact', ...over,
  };
}
function world(): CampaignState {
  const s = createCampaign('c', 'C');
  s.characters.p1 = char('p1');
  s.characters.p2 = char('p2');
  s.characters.n1 = char('n1', { kind: 'npc', hpVisibility: 'band' });
  s.characters.n2 = char('n2', { kind: 'npc', hpVisibility: 'exact' });
  s.characters.n3 = char('n3', { kind: 'npc', hpVisibility: 'hidden' });
  const tok = (id: string, characterId: string, col: number, hidden = false) => ({
    id, characterId, cell: { col, row: 0 }, size: 1 as const, hidden,
  });
  s.scene.tokens = {
    t1: tok('t1', 'p1', 0), t2: tok('t2', 'p2', 1), tn1: tok('tn1', 'n1', 2),
    tn2: tok('tn2', 'n2', 3), tn3: tok('tn3', 'n3', 4, true),
  };
  return s;
}

describe('hpBand', () => {
  it('faixas', () => {
    expect(hpBand({ current: 20, max: 20 })).toBe('ileso');
    expect(hpBand({ current: 11, max: 20 })).toBe('ferido');
    expect(hpBand({ current: 10, max: 20 })).toBe('grave');
    expect(hpBand({ current: 5, max: 20 })).toBe('beira');
    expect(hpBand({ current: 0, max: 20 })).toBe('beira');
  });
});

describe('audience', () => {
  it('chaves e atores', () => {
    expect(audienceKey(GM)).toBe('gm');
    expect(audienceKey(P1)).toBe('player:p1');
    expect(actorAudience({ role: 'gm' })).toEqual(GM);
    expect(actorAudience({ role: 'player', characterId: 'p1' })).toEqual(P1);
  });
});

describe('project', () => {
  it('jogador não vê token oculto nem o NPC dele; GM vê', () => {
    const s = world();
    const p = project(s, P1);
    expect(p.scene.tokens.tn3).toBeUndefined();
    expect(p.characters.n3).toBeUndefined();
    const g = project(s, GM);
    expect(g.scene.tokens.tn3).toBeDefined();
    expect(g.characters.n3).toBeDefined();
    expect(g.characters.n3!.resources).not.toBeNull();
  });

  it('NPC band expõe só faixa, sem vazar números', () => {
    const s = world();
    s.characters.n1!.resources.hp = { current: 8, max: 20 };
    const p = project(s, P1);
    expect(p.characters.n1!.resources).toBeNull();
    expect(p.characters.n1!.hpBand).toBe('grave');
    expect(JSON.stringify(p)).not.toContain('"current":8');
  });

  it('NPC exact tem recursos; hidden não tem nada', () => {
    const s = world();
    s.scene.tokens.tn3!.hidden = false;
    const p = project(s, P1);
    expect(p.characters.n2!.resources).not.toBeNull();
    expect(p.characters.n2!.hpBand).toBeNull();
    expect(p.characters.n3!.resources).toBeNull();
    expect(p.characters.n3!.hpBand).toBeNull();
  });

  it('outro PC aparece com recursos exatos', () => {
    expect(project(world(), P1).characters.p2!.resources).toEqual(defaultResources());
  });

  it('currentTokenId é null para o jogador quando o token atual está oculto', () => {
    const s = applyEvents(world(), [
      { type: 'encounterStarted', order: [{ tokenId: 'tn3', initiative: 20 }, { tokenId: 't1', initiative: 10 }] },
    ]);
    const p = project(s, P1);
    expect(p.encounter.currentTokenId).toBeNull();
    expect(p.encounter.order.map((e) => e.tokenId)).toEqual(['t1']);
    expect(project(s, GM).encounter.currentTokenId).toBe('tn3');
  });

  it('jogador sem personagem próprio recebe projeção válida', () => {
    const p = project(world(), { kind: 'player', characterId: 'nope' });
    expect(p.characters.p1).toBeDefined();
  });
});

describe('Review Focus 1: revelar NPC', () => {
  it('diff contém upsertCharacter antes de upsertToken', () => {
    const s = world();
    s.scene.tokens = { t1: s.scene.tokens.t1!, tn3: s.scene.tokens.tn3! };
    const r = decide(s, { type: 'setTokenHidden', tokenId: 'tn3', hidden: false }, { actor: { role: 'gm' }, newId: () => 'x' });
    if (!r.ok) throw new Error(r.error);
    const s2 = applyEvents(s, r.events);
    const kinds = diffProjection(project(s, P1), project(s2, P1)).map((c) => c.kind);
    expect(kinds).toEqual(['upsertCharacter', 'upsertToken']);
  });
});

describe('propriedade: applyChanges(diff) == project', () => {
  type Step = { actor: Actor; cmd: Command };
  const gm = (cmd: Command): Step => ({ actor: { role: 'gm' }, cmd });
  const mk = (name: string, kind: 'pc' | 'npc', hpVisibility: Character['hpVisibility'] = 'exact'): Command => ({
    type: 'createCharacter',
    input: { kind, name, portrait: '', fullBodyArt: '', tokenImage: '', resources: defaultResources(), speed: 5, hpVisibility },
  });
  // ids gerados: char-1, char-2...; tokens: tk-N
  const setup: Step[] = [
    gm(mk('Ana', 'pc')), gm(mk('Orc', 'npc', 'band')), gm(mk('Elfo', 'npc', 'hidden')),
    gm({ type: 'placeToken', characterId: 'id-1', cell: { col: 0, row: 0 } }),
    gm({ type: 'placeToken', characterId: 'id-2', cell: { col: 1, row: 0 }, hidden: true }),
    gm({ type: 'placeToken', characterId: 'id-3', cell: { col: 2, row: 0 }, hidden: true }),
  ];
  const scenarios: Step[][] = [
    [gm({ type: 'setTokenHidden', tokenId: 'id-5', hidden: false })],
    [gm({ type: 'setTokenHidden', tokenId: 'id-5', hidden: false }), gm({ type: 'setTokenHidden', tokenId: 'id-5', hidden: true })],
    [gm({ type: 'moveToken', tokenId: 'id-5', to: { col: 5, row: 5 } })],
    [gm({ type: 'moveToken', tokenId: 'id-4', to: { col: 5, row: 5 } })],
    [gm({ type: 'setResource', characterId: 'id-2', resource: 'hp', current: 3 })],
    [gm({ type: 'setResource', characterId: 'id-1', resource: 'hp', current: 3 })],
    [gm({ type: 'setTokenHidden', tokenId: 'id-5', hidden: false }), gm({ type: 'setResource', characterId: 'id-2', resource: 'hp', current: 3 })],
    [gm({ type: 'startEncounter', entries: [{ tokenId: 'id-4', initiative: 10 }, { tokenId: 'id-5', initiative: 15 }, { tokenId: 'id-6', initiative: 5 }] })],
    [gm({ type: 'startEncounter', entries: [{ tokenId: 'id-4', initiative: 10 }, { tokenId: 'id-5', initiative: 15 }] }), gm({ type: 'nextTurn' }), gm({ type: 'nextTurn' })],
    [gm({ type: 'startEncounter', entries: [{ tokenId: 'id-4', initiative: 10 }, { tokenId: 'id-5', initiative: 15 }] }), gm({ type: 'endEncounter' })],
    [gm({ type: 'deleteCharacter', characterId: 'id-2' })],
    [gm({ type: 'deleteCharacter', characterId: 'id-1' })],
    [gm({ type: 'removeToken', tokenId: 'id-6' }), gm({ type: 'setTokenHidden', tokenId: 'id-5', hidden: false }), gm({ type: 'removeToken', tokenId: 'id-5' })],
    [gm({ type: 'updateGrid', grid: { cols: 10, rows: 10, cellSize: 32, visible: false }, background: 'bg' }), gm(mk('Novo', 'pc'))],
    [gm({ type: 'updateCharacter', characterId: 'id-2', patch: { name: 'Orc Chefe', hpVisibility: 'exact' } }), gm({ type: 'setTokenHidden', tokenId: 'id-5', hidden: false })],
  ];

  function run(steps: Step[]): CampaignState[] {
    let n = 0;
    let s = createCampaign('c', 'C');
    const states = [s];
    for (const { actor, cmd } of [...setup, ...steps]) {
      const r = decide(s, cmd, { actor, newId: () => `id-${++n}` });
      if (!r.ok) throw new Error(`${cmd.type}: ${r.error}`);
      s = { ...applyEvents(s, r.events), revision: s.revision + 1 };
      states.push(s);
    }
    return states;
  }

  scenarios.forEach((steps, i) => {
    it(`cenário ${i + 1}`, () => {
      const states = run(steps);
      const audiences: Audience[] = [GM, { kind: 'player', characterId: 'id-1' }, { kind: 'player', characterId: 'ghost' }];
      for (let k = setup.length; k < states.length - 1; k++) {
        for (const a of audiences) {
          const s = states[k]!;
          const s2 = states[k + 1]!;
          const p = project(s, a);
          const p2 = project(s2, a);
          expect(applyChanges(p, diffProjection(p, p2), s2.revision)).toEqual(p2);
        }
      }
      // também do estado inicial até o final
      for (const a of audiences) {
        const p = project(states[setup.length]!, a);
        const last = states[states.length - 1]!;
        const p2 = project(last, a);
        expect(applyChanges(p, diffProjection(p, p2), last.revision)).toEqual(p2);
      }
    });
  });
});
