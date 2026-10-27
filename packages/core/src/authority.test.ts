import { describe, expect, it } from 'vitest';
import { Authority, type AudienceUpdate } from './authority';
import { createCampaign, defaultResources } from './campaign';
import type { Command } from './commands';
import type { Actor, Character, Id } from './model';
import { applyChanges } from './diff';
import { audienceKey, type Audience, type ProjectedState } from './projection';

const GM: Actor = { role: 'gm' };
const base = { portrait: '', fullBodyArt: '', tokenImage: '', speed: 5 };
const mkChar = (
  kind: 'pc' | 'npc', name: string, hpVisibility: Character['hpVisibility'],
): Omit<Character, 'id'> => ({ kind, name, hpVisibility, resources: defaultResources(), ...base });

function make() {
  let n = 0;
  return new Authority(createCampaign('c', 'C'), { newId: () => `id${++n}` });
}
const keys = (u: AudienceUpdate[]) => u.map((x) => audienceKey(x.audience)).sort();

describe('Authority', () => {
  it('comando inválido não altera estado nem revisão', () => {
    const a = make();
    const before = JSON.stringify(a.getState());
    const out = a.handle(GM, { type: 'deleteCharacter', characterId: 'nope' });
    expect(out.result).toEqual({ ok: false, error: 'not_found' });
    expect(out.updates).toEqual([]);
    expect(JSON.stringify(a.getState())).toBe(before);
    expect(a.getState().revision).toBe(0);
  });

  it('createCharacter de PC gera update para gm e para o novo jogador', () => {
    const a = make();
    const out = a.handle(GM, { type: 'createCharacter', input: mkChar('pc', 'Ana', 'exact') });
    expect(out.result).toEqual({ ok: true, revision: 1 });
    expect(keys(out.updates)).toEqual(['gm', 'player:id1']);
  });

  it('setResource em NPC hidden gera update só para o gm', () => {
    const a = make();
    a.handle(GM, { type: 'createCharacter', input: mkChar('pc', 'Ana', 'exact') });
    a.handle(GM, { type: 'createCharacter', input: mkChar('npc', 'Orc', 'hidden') });
    const out = a.handle(GM, { type: 'setResource', characterId: 'id2', resource: 'hp', current: 3 });
    expect(keys(out.updates)).toEqual(['gm']);
  });

  it('moveToken de tokens diferentes para a mesma célula: segundo cell_occupied', () => {
    const a = make();
    a.handle(GM, { type: 'createCharacter', input: mkChar('pc', 'Ana', 'exact') });
    a.handle(GM, { type: 'createCharacter', input: mkChar('pc', 'Bia', 'exact') });
    a.handle(GM, { type: 'placeToken', characterId: 'id1', cell: { col: 0, row: 0 } }); // id3
    a.handle(GM, { type: 'placeToken', characterId: 'id2', cell: { col: 1, row: 0 } }); // id4
    const first = a.handle(GM, { type: 'moveToken', tokenId: 'id3', to: { col: 5, row: 5 } });
    const second = a.handle(GM, { type: 'moveToken', tokenId: 'id4', to: { col: 5, row: 5 } });
    expect(first.result.ok).toBe(true);
    expect(second.result).toEqual({ ok: false, error: 'cell_occupied' });
  });

  it('baseRevision é a última revisão entregue à audiência; ocultas não avançam', () => {
    const a = make();
    a.handle(GM, { type: 'createCharacter', input: mkChar('pc', 'Ana', 'exact') }); // rev 1
    a.handle(GM, { type: 'createCharacter', input: mkChar('npc', 'Orc', 'hidden') }); // rev 2
    const player: Audience = { kind: 'player', characterId: 'id1' };
    expect(a.snapshotFor(player).revision).toBe(2);
    const hiddenOnly = a.handle(GM, { type: 'setResource', characterId: 'id2', resource: 'hp', current: 3 }); // rev 3
    expect(keys(hiddenOnly.updates)).toEqual(['gm']);
    const gmU = hiddenOnly.updates[0]!.update;
    expect(gmU.baseRevision).toBe(2);
    const visible = a.handle(GM, { type: 'setResource', characterId: 'id1', resource: 'hp', current: 4 }); // rev 4
    const p = visible.updates.find((u) => audienceKey(u.audience) === 'player:id1')!.update;
    expect(p.revision).toBe(4);
    expect(p.baseRevision).toBe(2); // pulou a 3, invisível a ele
    const g = visible.updates.find((u) => audienceKey(u.audience) === 'gm')!.update;
    expect(g.baseRevision).toBe(3);
    const next = a.handle(GM, { type: 'setResource', characterId: 'id1', resource: 'hp', current: 5 });
    expect(next.updates.find((u) => audienceKey(u.audience) === 'player:id1')!.update.baseRevision).toBe(4);
  });

  it('comando ok sem eventos não muda a revisão nem gera updates', () => {
    const a = make();
    a.handle(GM, { type: 'createCharacter', input: mkChar('pc', 'Ana', 'exact') });
    a.handle(GM, { type: 'placeToken', characterId: 'id1', cell: { col: 0, row: 0 } }); // id2
    const out = a.handle(GM, { type: 'moveToken', tokenId: 'id2', to: { col: 0, row: 0 } });
    expect(out.result).toEqual({ ok: true, revision: 2 });
    expect(out.updates).toEqual([]);
  });

  it('update.revision é igual a getState().revision após cada comando aceito', () => {
    const a = make();
    const cmds: Command[] = [
      { type: 'createCharacter', input: mkChar('pc', 'Ana', 'exact') },
      { type: 'placeToken', characterId: 'id1', cell: { col: 1, row: 1 } },
      { type: 'moveToken', tokenId: 'id2', to: { col: 2, row: 1 } },
    ];
    for (const c of cmds) {
      const out = a.handle(GM, c);
      expect(out.result.ok).toBe(true);
      expect(out.updates.length).toBeGreaterThan(0);
      for (const u of out.updates) expect(u.update.revision).toBe(a.getState().revision);
    }
  });

  it('PC deletado ainda recebe o update de remoção (audiência antes ou depois)', () => {
    const a = make();
    a.handle(GM, { type: 'createCharacter', input: mkChar('pc', 'Ana', 'exact') });
    const out = a.handle(GM, { type: 'deleteCharacter', characterId: 'id1' });
    expect(keys(out.updates)).toContain('player:id1');
  });
});

describe('Authority: varredura de vazamento', () => {
  it('jogadores nunca recebem tokens ocultos, NPCs sem token visível nem recursos de NPC band/hidden', () => {
    const a = make();
    const player: Audience = { kind: 'player', characterId: 'id1' };

    /** Ids (tokens e NPCs) que o jogador não pode conhecer no estado atual. */
    const forbiddenNow = (): Id[] => {
      const s = a.getState();
      const visible = new Set(
        Object.values(s.scene.tokens).filter((t) => !t.hidden).map((t) => t.characterId),
      );
      const hiddenTokens = Object.values(s.scene.tokens).filter((t) => t.hidden).map((t) => t.id);
      const unseenNpcs = Object.values(s.characters)
        .filter((c) => c.kind === 'npc' && !visible.has(c.id)).map((c) => c.id);
      return [...hiddenTokens, ...unseenNpcs];
    };
    const knownIds = (): Set<Id> => {
      const snap = a.snapshotFor(player);
      return new Set([...Object.keys(snap.characters), ...Object.keys(snap.scene.tokens)]);
    };
    const assertNoLeak = (json: string, forbidden: Id[]) => {
      for (const id of forbidden) expect(json, `vazou ${id}`).not.toContain(JSON.stringify(id));
    };
    const assertSnapshotClean = () => {
      const snap = a.snapshotFor(player);
      assertNoLeak(JSON.stringify(snap), forbiddenNow());
      for (const c of Object.values(snap.characters)) {
        const real = a.getState().characters[c.id]!;
        if (real.kind === 'npc' && real.hpVisibility !== 'exact') expect(c.resources).toBeNull();
      }
    };

    // Espelho do cliente: parte do snapshot inicial e aplica só os updates recebidos.
    let mirror: ProjectedState = a.snapshotFor(player);

    const run = (cmd: Command) => {
      const known = knownIds(); // o que o cliente já conhecia
      const out = a.handle(GM, cmd);
      expect(out.result.ok).toBe(true);
      const forbidden = forbiddenNow();
      const state = a.getState();
      const playerUpdates = out.updates.filter((u) => u.audience.kind === 'player');
      for (const u of playerUpdates) {
        // ids já conhecidos só podem aparecer dentro de removeToken/removeCharacter
        const rest = {
          ...u,
          update: {
            ...u.update,
            changes: u.update.changes.filter((c) => c.kind !== 'removeToken' && c.kind !== 'removeCharacter'),
          },
        };
        assertNoLeak(JSON.stringify(rest), forbidden);
        for (const ch of u.update.changes) {
          if (ch.kind === 'removeToken') expect(forbidden.includes(ch.id) || !state.scene.tokens[ch.id]).toBe(true);
          if (ch.kind !== 'upsertCharacter') continue;
          const real = state.characters[ch.character.id]!;
          if (real.kind === 'npc' && real.hpVisibility !== 'exact') expect(ch.character.resources).toBeNull();
        }
      }
      // ids que o cliente conhecia e agora estão ocultos: a remoção tem de ser emitida
      const changes = playerUpdates.flatMap((u) => u.update.changes);
      for (const id of forbidden.filter((x) => known.has(x))) {
        const kind = state.scene.tokens[id] ? 'removeToken' : 'removeCharacter';
        expect(changes, `faltou ${kind} de ${id}`).toContainEqual({ kind, id });
      }
      // espelho do cliente == snapshot (revisão avança mesmo sem update para a audiência)
      const mine = playerUpdates[0]?.update;
      mirror = mine
        ? applyChanges(mirror, mine.changes, mine.revision)
        : { ...mirror, revision: state.revision };
      expect(mirror).toEqual(a.snapshotFor(player));
      assertSnapshotClean();
      return out;
    };

    run({ type: 'createCharacter', input: mkChar('pc', 'Ana', 'exact') }); // id1
    run({ type: 'createCharacter', input: mkChar('npc', 'Orc', 'band') }); // id2
    run({ type: 'createCharacter', input: mkChar('npc', 'Lich', 'hidden') }); // id3
    run({ type: 'createCharacter', input: mkChar('npc', 'Rato', 'band') }); // id4
    run({ type: 'placeToken', characterId: 'id1', cell: { col: 0, row: 0 } }); // id5
    run({ type: 'placeToken', characterId: 'id2', cell: { col: 3, row: 3 }, hidden: true }); // id6
    run({ type: 'placeToken', characterId: 'id3', cell: { col: 4, row: 3 }, hidden: true }); // id7
    run({ type: 'placeToken', characterId: 'id4', cell: { col: 6, row: 6 }, hidden: true }); // id8
    run({ type: 'moveToken', tokenId: 'id6', to: { col: 3, row: 4 } });
    run({ type: 'moveToken', tokenId: 'id7', to: { col: 4, row: 4 } });
    run({ type: 'setResource', characterId: 'id2', resource: 'hp', current: 5 });
    run({ type: 'setResource', characterId: 'id3', resource: 'hp', current: 2 });
    run({
      type: 'startEncounter',
      entries: [
        { tokenId: 'id5', initiative: 10 }, { tokenId: 'id6', initiative: 15 },
        { tokenId: 'id7', initiative: 12 }, { tokenId: 'id8', initiative: 1 },
      ],
    });
    run({ type: 'nextTurn' });
    run({ type: 'nextTurn' });
    run({ type: 'nextTurn' });

    // revela o Orc (band): aparece com banda e sem recursos
    const reveal = run({ type: 'setTokenHidden', tokenId: 'id6', hidden: false });
    const playerUpdate = reveal.updates.find((u) => u.audience.kind === 'player')!;
    const orc = playerUpdate.update.changes.find(
      (c) => c.kind === 'upsertCharacter' && c.character.id === 'id2',
    );
    expect(orc?.kind === 'upsertCharacter' && orc.character.resources).toBeNull();
    expect(orc?.kind === 'upsertCharacter' && orc.character.hpBand).not.toBeNull();
    expect(JSON.stringify(playerUpdate)).not.toContain('"resources":{');
    expect(JSON.stringify(a.snapshotFor(player).characters.id2)).not.toContain('"resources":{');

    // enquanto visível, mudanças de HP do Orc chegam só como banda
    run({ type: 'setResource', characterId: 'id2', resource: 'hp', current: 2 });

    // oculta de novo e continua mexendo
    run({ type: 'setTokenHidden', tokenId: 'id6', hidden: true });
    run({ type: 'moveToken', tokenId: 'id6', to: { col: 8, row: 8 } });
    run({ type: 'setResource', characterId: 'id2', resource: 'hp', current: 1 });

    // apaga o Lich (nunca visto): jogador não recebe nada que o mencione
    const del = run({ type: 'deleteCharacter', characterId: 'id3' });
    for (const u of del.updates.filter((x) => x.audience.kind === 'player')) {
      expect(JSON.stringify(u)).not.toMatch(/id3|id7/);
    }
    // apaga o Orc (visto antes, hoje oculto): remoção é legítima, mas nada além disso
    run({ type: 'deleteCharacter', characterId: 'id2' });
    assertSnapshotClean();
  });
});
