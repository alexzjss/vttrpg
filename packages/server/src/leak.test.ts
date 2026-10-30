import { describe, expect, it } from 'vitest';
import {
  createCampaign, defaultResources, type Actor, type CampaignState, type Character, type Command, type ProjectedUpdate,
} from '@vtt/core';
import { makeCharacter } from '../../core/src/testing';
import { processCommand } from './commands';
import { MemoryStore } from './memoryStore';

const GM: Actor = { role: 'gm' };
const base = { portrait: '', fullBodyArt: '', tokenImage: '', speed: 5 };
const mkChar = (
  kind: 'pc' | 'npc', name: string, hpVisibility: Character['hpVisibility'],
): Omit<Character, 'id'> => {
  const { id: _id, ...rest } = makeCharacter({ kind, name, hpVisibility, resources: defaultResources(), ...base });
  return rest;
};

const hiddenIds = (state: CampaignState): string[] => {
  const visible = new Set(
    Object.values(state.scene.tokens).filter((t) => !t.hidden).map((t) => t.characterId),
  );
  return [
    ...Object.values(state.scene.tokens).filter((t) => t.hidden).map((t) => t.id),
    ...Object.values(state.characters).filter((c) => c.kind === 'npc' && !visible.has(c.id)).map((c) => c.id),
  ];
};

/**
 * Confere um broadcast de player. `known` = ids que esse tópico já recebeu por upsert;
 * remoção só é legítima para id conhecido. Atualiza `known` ao final.
 */
function checkPlayerPayload(
  payload: ProjectedUpdate, known: Set<string>, pre: CampaignState, post: CampaignState,
): void {
  const visibleNow = new Set([
    ...Object.values(post.scene.tokens).filter((t) => !t.hidden).map((t) => t.id),
    ...Object.values(post.scene.tokens).filter((t) => !t.hidden).map((t) => t.characterId),
  ]);
  const forbidden = [...new Set([...hiddenIds(pre), ...hiddenIds(post)])].filter((id) => !visibleNow.has(id));

  for (const ch of payload.changes) {
    if (ch.kind === 'removeToken' || ch.kind === 'removeCharacter') {
      if (!known.has(ch.id)) throw new Error(`remoção de id nunca revelado: ${ch.id}`);
    }
  }
  const rest = {
    ...payload,
    changes: payload.changes.filter((c) => c.kind !== 'removeToken' && c.kind !== 'removeCharacter'),
  };
  const json = JSON.stringify(rest);
  for (const id of forbidden) {
    if (json.includes(JSON.stringify(id))) throw new Error(`vazou ${id}`);
  }
  for (const ch of payload.changes) {
    if (ch.kind === 'upsertCharacter') {
      const real = post.characters[ch.character.id];
      if (real && real.kind === 'npc' && real.hpVisibility !== 'exact' && ch.character.resources !== null) {
        throw new Error(`resources de NPC ${real.id}`);
      }
      known.add(ch.character.id);
    } else if (ch.kind === 'upsertToken') {
      known.add(ch.token.id);
    } else if (ch.kind === 'removeToken' || ch.kind === 'removeCharacter') {
      known.delete(ch.id);
    }
  }
}

describe('verificador de vazamento (autoteste)', () => {
  it('sinaliza remoção de token oculto nunca revelado', () => {
    const state = createCampaign('c1', 'Mesa');
    state.scene.tokens.t9 = { id: 't9', characterId: 'n9', cell: { col: 0, row: 0 }, size: 1, hidden: true };
    const fake: ProjectedUpdate = { seq: 1, changes: [{ kind: 'removeToken', id: 't9' }], cues: [] };
    expect(() => checkPlayerPayload(fake, new Set(), state, state)).toThrow(/nunca revelado/);
    expect(() => checkPlayerPayload(fake, new Set(['t9']), state, state)).not.toThrow();
  });
  it('sinaliza upsert de token oculto', () => {
    const state = createCampaign('c1', 'Mesa');
    const tok = { id: 't9', characterId: 'n9', cell: { col: 0, row: 0 }, size: 1 as const, hidden: true };
    state.scene.tokens.t9 = tok;
    const fake: ProjectedUpdate = { seq: 1, changes: [{ kind: 'upsertToken', token: tok }], cues: [] };
    expect(() => checkPlayerPayload(fake, new Set(), state, state)).toThrow(/vazou/);
  });
});

describe('pipeline do servidor: não-vazamento para jogadores', () => {
  it('broadcasts de player nunca citam tokens/NPCs ocultos nem resources de NPC band/hidden', async () => {
    const store = new MemoryStore();
    store.seed(createCampaign('c1', 'Mesa'));
    let n = 0;
    const newId = () => `id${++n}`;
    let seen = 0;
    const knownByTopic = new Map<string, Set<string>>();

    const run = async (cmd: Command) => {
      const pre = (await store.load('c1'))!;
      const res = await processCommand(store, 'c1', GM, cmd, newId);
      expect(res.ok).toBe(true);
      const post = (await store.load('c1'))!;
      const fresh = store.broadcasts.slice(seen);
      seen = store.broadcasts.length;
      for (const b of fresh.filter((x) => x.topic.includes(':player:'))) {
        const known = knownByTopic.get(b.topic) ?? new Set<string>();
        knownByTopic.set(b.topic, known);
        checkPlayerPayload(b.payload, known, pre, post);
      }
    };

    await run({ type: 'createCharacter', input: mkChar('pc', 'Ana', 'exact') }); // id1
    await run({ type: 'createCharacter', input: mkChar('npc', 'Orc', 'band') }); // id2
    await run({ type: 'createCharacter', input: mkChar('npc', 'Lich', 'hidden') }); // id3
    await run({ type: 'placeToken', characterId: 'id1', cell: { col: 0, row: 0 } }); // id4
    await run({ type: 'placeToken', characterId: 'id2', cell: { col: 3, row: 3 }, hidden: true }); // id5
    await run({ type: 'placeToken', characterId: 'id3', cell: { col: 4, row: 3 }, hidden: true }); // id6
    await run({ type: 'moveToken', tokenId: 'id5', to: { col: 3, row: 4 } });
    await run({ type: 'setResource', characterId: 'id2', resource: 'hp', current: 5 });
    await run({ type: 'setResource', characterId: 'id3', resource: 'hp', current: 2 });
    await run({ type: 'setTokenHidden', tokenId: 'id5', hidden: false }); // revela o Orc
    await run({ type: 'setResource', characterId: 'id2', resource: 'hp', current: 2 });
    await run({ type: 'setTokenHidden', tokenId: 'id5', hidden: true });
    await run({ type: 'moveToken', tokenId: 'id5', to: { col: 8, row: 8 } });
    await run({ type: 'removeToken', tokenId: 'id6' });
    await run({ type: 'deleteCharacter', characterId: 'id3' });

    const playerCasts = store.broadcasts.filter((b) => b.topic.includes(':player:'));
    expect(playerCasts.length).toBeGreaterThan(0);
    // o Orc revelado chegou ao jogador só com banda, e o Lich nunca chegou
    const json = JSON.stringify(playerCasts);
    expect(json).toContain('"hpBand"');
    expect(json).not.toContain('Lich');
    expect(store.broadcasts.some((b) => b.topic.endsWith(':gm'))).toBe(true);
  });
});
