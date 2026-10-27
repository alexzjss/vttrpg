import { describe, expect, it } from 'vitest';
import { createCampaign, defaultResources } from './campaign';
import { cuesFor } from './cues';
import type { GameEvent } from './events';
import type { CampaignState } from './model';
import { project, type Audience } from './projection';
import { applyEvents } from './reducer';

function world(): CampaignState {
  const s = createCampaign('c', 'C');
  const base = { portrait: '', fullBodyArt: '', tokenImage: '', resources: defaultResources(), speed: 5 };
  s.characters.p1 = { id: 'p1', kind: 'pc', name: 'Ana', hpVisibility: 'exact', ...base };
  s.characters.n1 = { id: 'n1', kind: 'npc', name: 'Orc', hpVisibility: 'band', ...base };
  s.scene.tokens = {
    t1: { id: 't1', characterId: 'p1', cell: { col: 0, row: 0 }, size: 1, hidden: false },
    tn: { id: 'tn', characterId: 'n1', cell: { col: 1, row: 0 }, size: 1, hidden: true },
  };
  return s;
}
const run = (events: GameEvent[], a: Audience) => {
  const before = world();
  return cuesFor(events, before, project(applyEvents(before, events), a));
};
const P: Audience = { kind: 'player', characterId: 'p1' };
const GM: Audience = { kind: 'gm' };

describe('cuesFor', () => {
  const move: GameEvent = { type: 'tokenMoved', tokenId: 'tn', from: { col: 1, row: 0 }, to: { col: 2, row: 0 } };
  it('mover token oculto não gera cue para jogador, mas gera para GM', () => {
    expect(run([move], P)).toEqual([]);
    expect(run([move], GM)).toHaveLength(1);
  });
  it('token visível gera token-moved', () => {
    const ev: GameEvent = { type: 'tokenMoved', tokenId: 't1', from: { col: 0, row: 0 }, to: { col: 1, row: 1 } };
    expect(run([ev], P)).toEqual([{ type: 'token-moved', tokenId: 't1', from: ev.from, to: ev.to }]);
  });
  it('resourceSet de NPC band: sem cue para jogador, com para GM', () => {
    const ev: GameEvent = { type: 'resourceSet', characterId: 'n1', resource: 'hp', pool: { current: 5, max: 20 } };
    expect(run([ev], P)).toEqual([]);
    expect(run([ev], GM)).toEqual([{ type: 'resource-changed', characterId: 'n1', resource: 'hp', delta: -15 }]);
  });
  it('resourceSet de PC gera delta para jogador', () => {
    const ev: GameEvent = { type: 'resourceSet', characterId: 'p1', resource: 'hp', pool: { current: 25, max: 25 } };
    expect(run([ev], P)).toEqual([{ type: 'resource-changed', characterId: 'p1', resource: 'hp', delta: 5 }]);
  });
  it('turn-started: um por chamada, token atual; nenhum se oculto para o jogador', () => {
    const start: GameEvent = { type: 'encounterStarted', order: [{ tokenId: 't1', initiative: 9 }, { tokenId: 'tn', initiative: 1 }] };
    const adv: GameEvent = { type: 'turnAdvanced', turnIndex: 0, round: 1 };
    expect(run([start, adv], P)).toEqual([{ type: 'turn-started', tokenId: 't1', round: 1 }]);
    const hiddenFirst: GameEvent = { type: 'encounterStarted', order: [{ tokenId: 'tn', initiative: 9 }] };
    expect(run([hiddenFirst], P)).toEqual([]);
    expect(run([hiddenFirst], GM)).toEqual([{ type: 'turn-started', tokenId: 'tn', round: 1 }]);
  });
});
