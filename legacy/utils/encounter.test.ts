import { describe, it, expect } from 'vitest';
import { sortInitiative, startEncounter, advanceTurn, prevTurn, reorderEncounter, moveInOrder, endEncounter, rerollInitiativeOrder, type InitiativeParticipant } from './encounter';
import { createDefaultCena, createDefaultEncounter, type EncounterEntry, type EncounterState } from './cena';
import {
  addBuff, buffTotal, canReact, markReaction, markSlot, slotAvailable, tickBuffs,
} from './encounter';

const P = (id: string, side: 'party' | 'npc', baseInitiative: number): InitiativeParticipant =>
  ({ id, side, name: id, baseInitiative });

describe('sortInitiative', () => {
  it('ordena por total desc, empate por baseInitiative desc', () => {
    const order = sortInitiative([
      { id: 'a', side: 'party', baseInitiative: 1, total: 15 },
      { id: 'b', side: 'npc', baseInitiative: 5, total: 20 },
      { id: 'c', side: 'party', baseInitiative: 9, total: 15 },
    ]);
    expect(order.map(e => e.refId)).toEqual(['b', 'c', 'a']);
    expect(order[0]).toEqual({ refId: 'b', side: 'npc', initiative: 20 });
  });
});

describe('startEncounter', () => {
  it('ativa o encounter, monta a ordem e loga', () => {
    const next = startEncounter(createDefaultCena(), [P('a', 'party', 2), P('b', 'npc', 0)]);
    expect(next.encounter.isActive).toBe(true);
    expect(next.encounter.round).toBe(1);
    expect(next.encounter.turnIndex).toBe(0);
    expect(next.encounter.order).toHaveLength(2);
    for (const e of next.encounter.order) {
      const base = e.refId === 'a' ? 2 : 0;
      expect(e.initiative).toBeGreaterThanOrEqual(1 + base);
      expect(e.initiative).toBeLessThanOrEqual(20 + base);
    }
    expect(next.log.length).toBeGreaterThanOrEqual(3);
  });
});

describe('rerollInitiativeOrder', () => {
  it('rerola e reordena, resetando turnIndex/turn/reactionsUsed e preservando round/fieldEffects', () => {
    const base: EncounterState = {
      ...createDefaultEncounter(), isActive: true, round: 3, turnIndex: 1,
      turn: { majorUsed: true, minorUsed: true },
      reactionsUsed: { a: true },
      fieldEffects: [{ id: 'fx1', sourceId: 'a', sourceName: 'A', entryId: 'e1', effect: {} as any, roundsRemaining: 2 }],
      order: [
        { refId: 'a', side: 'party', initiative: 5 },
        { refId: 'b', side: 'npc', initiative: 30 },
      ],
    };
    const { encounter, log } = rerollInitiativeOrder(base, [P('a', 'party', 0), P('b', 'npc', 0)]);
    expect(encounter.turnIndex).toBe(0);
    expect(encounter.turn).toEqual({ majorUsed: false, minorUsed: false });
    expect(encounter.reactionsUsed).toEqual({});
    expect(encounter.round).toBe(3);
    expect(encounter.fieldEffects).toEqual(base.fieldEffects);
    expect(encounter.order).toHaveLength(2);
    expect(log.length).toBeGreaterThanOrEqual(3);
    expect(log[0].text).toContain('rerolada');
  });
});

describe('advanceTurn / prevTurn', () => {
  const enc = (turnIndex: number, round = 1): EncounterState => ({
    ...createDefaultEncounter(),
    isActive: true, round, turnIndex,
    order: [
      { refId: 'a', side: 'party', initiative: 30 },
      { refId: 'b', side: 'npc', initiative: 20 },
      { refId: 'c', side: 'party', initiative: 10 },
    ] as EncounterEntry[],
  });
  const none = () => false;

  it('avança o turno', () => {
    expect(advanceTurn(enc(0), none).turnIndex).toBe(1);
  });
  it('dá a volta e incrementa a rodada', () => {
    const r = advanceTurn(enc(2, 1), none);
    expect(r.turnIndex).toBe(0);
    expect(r.round).toBe(2);
  });
  it('avança o tempo das preparações somente ao virar a rodada', () => {
    const state={...enc(1,1),preparations:[{ownerId:'a',entryId:'ritual',roundsRemaining:2,participantIds:[]}]};
    expect(advanceTurn(state,none).preparations[0].roundsRemaining).toBe(2);
    const wrapped={...state,turnIndex:2};
    expect(advanceTurn(wrapped,none).preparations[0].roundsRemaining).toBe(1);
  });
  it('pula caídos', () => {
    const defeatedB = (e: EncounterEntry) => e.refId === 'b';
    expect(advanceTurn(enc(0), defeatedB).turnIndex).toBe(2);
  });
  it('todos caídos: não move', () => {
    expect(advanceTurn(enc(0), () => true).turnIndex).toBe(0);
  });
  it('prevTurn retrocede e decrementa rodada na volta (min 1)', () => {
    expect(prevTurn(enc(1), none).turnIndex).toBe(0);
    const r = prevTurn(enc(0, 2), none);
    expect(r.turnIndex).toBe(2);
    expect(r.round).toBe(1);
  });
});

describe('endEncounter', () => {
  it('desliga, limpa a ordem e apaga totalmente o log de combate', () => {
    const started = startEncounter(createDefaultCena(), [P('a', 'party', 0)]);
    const ended = endEncounter(started);
    expect(ended.encounter.isActive).toBe(false);
    expect(ended.encounter.order).toEqual([]);
    expect(ended.encounter.round).toBe(1);
    expect(ended.log).toEqual([]);
  });
});

describe('ordem efetiva',()=>{
  it('mantem a ordem manual ao avancar o turno',()=>{
    const state={...createDefaultEncounter(),isActive:true,turnIndex:0,order:[
      {refId:'a',side:'party' as const,initiative:30},{refId:'b',side:'party' as const,initiative:20},{refId:'c',side:'npc' as const,initiative:10},
    ]};
    const moved=moveInOrder(state,2,0);
    const next=advanceTurn(moved,()=>false);
    expect(moved.order.map(entry=>entry.refId)).toEqual(['c','a','b']);
    expect(next.order.map(entry=>entry.refId)).toEqual(['c','a','b']);
    expect(next.order[next.turnIndex]?.refId).toBe('b');
  });

  it('aplica velocidade e deslocamentos sem alterar a iniciativa original',()=>{
    const state={...createDefaultEncounter(),isActive:true,turnIndex:0,order:[
      {refId:'a',side:'party' as const,initiative:20},{refId:'b',side:'party' as const,initiative:15},{refId:'c',side:'npc' as const,initiative:10},
    ]};
    const reordered=reorderEncounter(state,{a:{speed:0,positions:1},b:{speed:0,positions:0},c:{speed:10,positions:0}});
    expect(reordered.order.map(entry=>entry.refId)).toEqual(['c','a','b']);
    expect(reordered.order.find(entry=>entry.refId==='a')?.initiative).toBe(20);
    const restored=reorderEncounter({...reordered,turnIndex:reordered.order.findIndex(entry=>entry.refId==='a')},{a:{speed:0,positions:0},b:{speed:0,positions:0},c:{speed:0,positions:0}});
    expect(restored.order.map(entry=>entry.refId)).toEqual(['a','b','c']);
  });
});

function enc2(overrides: Partial<ReturnType<typeof createDefaultEncounter>> = {}) {
  return { ...createDefaultEncounter(), isActive: true, ...overrides };
}

describe('slots de ação', () => {
  it('principal e menor começam livres; reação não consome slot', () => {
    const e = enc2();
    expect(slotAvailable(e, 'principal')).toBe(true);
    expect(slotAvailable(e, 'menor')).toBe(true);
    expect(slotAvailable(e, 'reação')).toBe(true);
  });

  it('markSlot consome o slot correspondente', () => {
    let e = markSlot(enc2(), 'principal');
    expect(slotAvailable(e, 'principal')).toBe(false);
    expect(slotAvailable(e, 'menor')).toBe(true);
    e = markSlot(e, 'menor');
    expect(slotAvailable(e, 'menor')).toBe(false);
  });

  it('markSlot é idempotente (chamar duas vezes não quebra)', () => {
    const e = markSlot(markSlot(enc2(), 'principal'), 'principal');
    expect(slotAvailable(e, 'principal')).toBe(false);
    expect(slotAvailable(e, 'menor')).toBe(true);
  });

  it('advanceTurn reseta os slots', () => {
    const base = enc2({
      order: [
        { refId: 'a', side: 'party', initiative: 15 },
        { refId: 'b', side: 'npc', initiative: 10 },
      ],
    });
    const used = markSlot(markSlot(base, 'principal'), 'menor');
    const next = advanceTurn(used, () => false);
    expect(next.turn).toEqual({ majorUsed: false, minorUsed: false });
  });
});

describe('reações', () => {
  it('canReact/markReaction controlam 1 reação por rodada', () => {
    let e = enc2();
    expect(canReact(e, 'a')).toBe(true);
    e = markReaction(e, 'a');
    expect(canReact(e, 'a')).toBe(false);
    expect(canReact(e, 'b')).toBe(true);
  });

  it('nova rodada (wrap do advanceTurn) limpa as reações', () => {
    const base = enc2({
      order: [
        { refId: 'a', side: 'party', initiative: 15 },
        { refId: 'b', side: 'npc', initiative: 10 },
      ],
      turnIndex: 1,
    });
    const used = markReaction(base, 'a');
    const next = advanceTurn(used, () => false); // volta ao índice 0 → round++
    expect(next.round).toBe(2);
    expect(next.reactionsUsed).toEqual({});
  });
});

describe('buffs', () => {
  it('addBuff registra e buffTotal soma por alvo e stat', () => {
    let e = addBuff(enc2(), { targetId: 'a', stat: 'defesa', value: 2, roundsRemaining: 1, source: 'Guarda' });
    e = addBuff(e, { targetId: 'a', stat: 'defesa', value: 1, roundsRemaining: 2, source: 'Selo' });
    e = addBuff(e, { targetId: 'a', stat: 'acerto', value: 3, roundsRemaining: 1, source: 'Benção' });
    expect(buffTotal(e, 'a', 'defesa')).toBe(3);
    expect(buffTotal(e, 'a', 'acerto')).toBe(3);
    expect(buffTotal(e, 'b', 'defesa')).toBe(0);
  });

  it('tickBuffs decrementa só os buffs do dono e expira em 0 com log', () => {
    let e = addBuff(enc2(), { targetId: 'a', stat: 'defesa', value: 2, roundsRemaining: 1, source: 'Guarda' });
    e = addBuff(e, { targetId: 'b', stat: 'dano', value: 1, roundsRemaining: 1, source: 'Fúria' });
    const r = tickBuffs(e, 'a', 'Alice');
    expect(buffTotal(r.enc, 'a', 'defesa')).toBe(0);
    expect(buffTotal(r.enc, 'b', 'dano')).toBe(1); // intocado
    expect(r.log[0].text).toContain('Guarda');
    expect(r.log[0].text).toContain('expirou');
  });

  it('buff com mais rodadas sobrevive ao tick', () => {
    const e = addBuff(enc2(), { targetId: 'a', stat: 'defesa', value: 1, roundsRemaining: 2, source: 'Selo' });
    const r = tickBuffs(e, 'a', 'Alice');
    expect(buffTotal(r.enc, 'a', 'defesa')).toBe(1);
    expect(r.log).toEqual([]);
  });

  it('um buff expira e outro do mesmo dono sobrevive no mesmo tick', () => {
    let e = addBuff(enc2(), { targetId: 'a', stat: 'defesa', value: 2, roundsRemaining: 1, source: 'Guarda' });
    e = addBuff(e, { targetId: 'a', stat: 'acerto', value: 1, roundsRemaining: 2, source: 'Selo' });
    const r = tickBuffs(e, 'a', 'Alice');
    expect(buffTotal(r.enc, 'a', 'defesa')).toBe(0);
    expect(buffTotal(r.enc, 'a', 'acerto')).toBe(1);
    expect(r.log).toHaveLength(1);
    expect(r.log[0].text).toContain('Guarda');
  });
});
