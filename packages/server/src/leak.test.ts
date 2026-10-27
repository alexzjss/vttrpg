import { describe, expect, it } from 'vitest';
import { createCampaign, defaultResources, type Actor, type Character, type Command } from '@vtt/core';
import { processCommand } from './commands';
import { MemoryStore } from './memoryStore';

const GM: Actor = { role: 'gm' };
const base = { portrait: '', fullBodyArt: '', tokenImage: '', speed: 5 };
const mkChar = (
  kind: 'pc' | 'npc', name: string, hpVisibility: Character['hpVisibility'],
): Omit<Character, 'id'> => ({ kind, name, hpVisibility, resources: defaultResources(), ...base });

describe('pipeline do servidor: não-vazamento para jogadores', () => {
  it('broadcasts de player nunca citam tokens/NPCs ocultos nem resources de NPC band/hidden', async () => {
    const store = new MemoryStore();
    store.seed(createCampaign('c1', 'Mesa'));
    let n = 0;
    const newId = () => `id${++n}`;
    let seen = 0;

    const run = async (cmd: Command) => {
      const res = await processCommand(store, 'c1', GM, cmd, newId);
      expect(res.ok).toBe(true);
      const state = (await store.load('c1'))!;
      const visible = new Set(
        Object.values(state.scene.tokens).filter((t) => !t.hidden).map((t) => t.characterId),
      );
      const forbidden = [
        ...Object.values(state.scene.tokens).filter((t) => t.hidden).map((t) => t.id),
        ...Object.values(state.characters).filter((c) => c.kind === 'npc' && !visible.has(c.id)).map((c) => c.id),
      ];
      const fresh = store.broadcasts.slice(seen);
      seen = store.broadcasts.length;
      for (const b of fresh.filter((x) => x.topic.includes(':player:'))) {
        // remoções de ids já conhecidos são legítimas; o resto não pode citar ids proibidos
        const rest = {
          ...b.payload,
          changes: b.payload.changes.filter((c) => c.kind !== 'removeToken' && c.kind !== 'removeCharacter'),
        };
        const json = JSON.stringify(rest);
        for (const id of forbidden) expect(json, `vazou ${id}`).not.toContain(JSON.stringify(id));
        for (const ch of b.payload.changes) {
          if (ch.kind !== 'upsertCharacter') continue;
          const real = state.characters[ch.character.id];
          if (real && real.kind === 'npc' && real.hpVisibility !== 'exact') {
            expect(ch.character.resources).toBeNull();
          }
        }
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
