import { rollDice, type RollResult } from './dice';
import type { ActiveBuff, ActiveFieldEffect, CenaState, CenaLogEntry, EncounterEntry, EncounterState } from './cena';
import { appendLog, logEntry, createDefaultEncounter } from './cena';
import type { ActionType, BuffStat } from './grimoire';
import type { StatDelta } from './actions';

export interface InitiativeParticipant {
  id: string;
  side: 'party' | 'npc';
  name: string;
  baseInitiative: number;
}

/** Rola 1d20 + baseInitiative. */
export function rollInitiative(baseInitiative: number, onRoll?: (roll: RollResult) => void): number {
  const roll = rollDice('1d20', baseInitiative);
  onRoll?.(roll);
  return roll.total;
}

/** Ordena por total desc; empate por baseInitiative desc. Puro. */
export function sortInitiative(
  rolled: { id: string; side: 'party' | 'npc'; baseInitiative: number; total: number }[],
): EncounterEntry[] {
  return [...rolled]
    .sort((a, b) => b.total - a.total || b.baseInitiative - a.baseInitiative)
    .map(r => ({ refId: r.id, side: r.side, initiative: r.total }));
}

/** Inicia o combate: rola iniciativa de todos, monta a ordem, loga. */
export function startEncounter(
  cena: CenaState,
  participants: InitiativeParticipant[],
  onRoll?: (event: { participant: InitiativeParticipant; roll: RollResult; logEntryId: string }) => void,
): CenaState {
  const rolled = participants.map(p => {
    let detail!: RollResult;
    const total = rollInitiative(p.baseInitiative, roll => { detail = roll; });
    return { ...p, total, detail };
  });
  const order = sortInitiative(rolled);
  const orderedRolls = rolled.slice().sort((a, b) => b.total - a.total || b.baseInitiative - a.baseInitiative);
  const rollLogs = orderedRolls.map(r => logEntry('roll', `${r.name} rolou iniciativa ${r.total}.`, {
    notation: r.detail.notation, total: r.detail.total,
    individualRolls: r.detail.individualRolls, numSides: r.detail.numSides,
    bonus: r.detail.bonus, actorLabel: r.name, success: true,
  }));
  const logs: CenaLogEntry[] = [
    logEntry('system', `Combate iniciado — ${order.length} combatente(s).`),
    ...rollLogs,
  ];
  orderedRolls.forEach((r, index) => onRoll?.({ participant: r, roll: r.detail, logEntryId: rollLogs[index].id }));
  return appendLog({ ...cena, encounter: { ...createDefaultEncounter(), isActive: true, order } }, logs);
}

export interface RerollResult { encounter: EncounterState; log: CenaLogEntry[] }

/**
 * Re-rola a iniciativa dos participantes informados e reordena o turno.
 * Zera turnIndex e os slots/reações da rodada, mas preserva round, fieldEffects,
 * preparations e activeBuffs — pensada para o mestre corrigir a ordem no meio do combate.
 */
export function rerollInitiativeOrder(
  enc: EncounterState,
  participants: InitiativeParticipant[],
): RerollResult {
  const rolled = participants.map(p => {
    let detail!: RollResult;
    const total = rollInitiative(p.baseInitiative, roll => { detail = roll; });
    return { ...p, total, detail };
  });
  const order = sortInitiative(rolled);
  const orderedRolls = rolled.slice().sort((a, b) => b.total - a.total || b.baseInitiative - a.baseInitiative);
  const rollLogs = orderedRolls.map(r => logEntry('roll', `${r.name} rolou iniciativa ${r.total}.`, {
    notation: r.detail.notation, total: r.detail.total,
    individualRolls: r.detail.individualRolls, numSides: r.detail.numSides,
    bonus: r.detail.bonus, actorLabel: r.name, success: true,
  }));
  const log: CenaLogEntry[] = [logEntry('system', 'A iniciativa foi rerolada pelo mestre.'), ...rollLogs];
  return {
    encounter: { ...enc, order, turnIndex: 0, turn: { majorUsed: false, minorUsed: false }, reactionsUsed: {} },
    log,
  };
}

/** Próximo turno: pula caídos; ao dar a volta, round++. Se todos caídos, não move. */
export function advanceTurn(enc: EncounterState, isDefeated: (e: EncounterEntry) => boolean): EncounterState {
  const n = enc.order.length;
  if (n === 0) return enc;
  let idx = enc.turnIndex;
  let round = enc.round;
  for (let step = 0; step < n; step++) {
    idx += 1;
    if (idx >= n) { idx = 0; round += 1; }
    if (!isDefeated(enc.order[idx])) {
      const wrapped = round > enc.round;
      return {
        ...enc, turnIndex: idx, round,
        turn: { majorUsed: false, minorUsed: false },
        reactionsUsed: wrapped ? {} : enc.reactionsUsed,
        preparations: wrapped ? enc.preparations.map(preparation=>({...preparation,roundsRemaining:Math.max(0,preparation.roundsRemaining-1)})) : enc.preparations,
      };
    }
  }
  return enc;
}

/**
 * Turno anterior: pula caídos; ao dar a volta, round-- (mín 1).
 * Limitação conhecida: `reactionsUsed` não é revertido ao voltar de rodada
 * (não há histórico por rodada) — uso é para correção manual do mestre.
 */
export function prevTurn(enc: EncounterState, isDefeated: (e: EncounterEntry) => boolean): EncounterState {
  const n = enc.order.length;
  if (n === 0) return enc;
  let idx = enc.turnIndex;
  let round = enc.round;
  for (let step = 0; step < n; step++) {
    idx -= 1;
    if (idx < 0) { idx = n - 1; round = Math.max(1, round - 1); }
    if (!isDefeated(enc.order[idx])) {
      return { ...enc, turnIndex: idx, round, turn: { majorUsed: false, minorUsed: false } };
    }
  }
  return enc;
}

/**
 * Insere um novo participante na ordem já em andamento, rolando iniciativa só
 * para ele e mantendo o turno atual apontando para o mesmo ator (mesmo que a
 * inserção desloque índices). Preserva round, activeBuffs, fieldEffects,
 * preparations e reactionsUsed. Idempotente: se o id já está na ordem, não faz nada.
 */
export function addParticipantToOrder(
  enc: EncounterState,
  participant: InitiativeParticipant,
): { encounter: EncounterState; log: CenaLogEntry[] } {
  if (enc.order.some(e => e.refId === participant.id)) return { encounter: enc, log: [] };
  const currentId = enc.order[enc.turnIndex]?.refId;
  let detail!: RollResult;
  const total = rollInitiative(participant.baseInitiative, roll => { detail = roll; });
  const entry: EncounterEntry = { refId: participant.id, side: participant.side, initiative: total };
  const insertAt = enc.order.findIndex(e => e.initiative < total);
  const order = insertAt === -1 ? [...enc.order, entry] : [...enc.order.slice(0, insertAt), entry, ...enc.order.slice(insertAt)];
  const turnIndex = currentId ? Math.max(0, order.findIndex(e => e.refId === currentId)) : enc.turnIndex;
  const log: CenaLogEntry[] = [logEntry('roll', `${participant.name} entra na cena e rola iniciativa ${total}.`, {
    notation: detail.notation, total: detail.total, individualRolls: detail.individualRolls,
    numSides: detail.numSides, bonus: detail.bonus, actorLabel: participant.name, success: true,
  })];
  return { encounter: { ...enc, order, turnIndex }, log };
}

/** Remove um participante da ordem (saiu da cena); mantém o turno atual na mesma posição relativa. */
export function removeParticipantFromOrder(enc: EncounterState, id: string): EncounterState {
  if (!enc.order.some(e => e.refId === id)) return enc;
  const currentId = enc.order[enc.turnIndex]?.refId;
  const order = enc.order.filter(e => e.refId !== id);
  if (order.length === 0) return { ...enc, order, turnIndex: 0 };
  const turnIndex = currentId && currentId !== id
    ? Math.max(0, order.findIndex(e => e.refId === currentId))
    : Math.min(enc.turnIndex, order.length - 1);
  return { ...enc, order, turnIndex };
}

/** Move manualmente um combatente de `fromIndex` para `toIndex` na ordem (drag-and-drop do mestre).
 *  Mantém o turno atual apontando para o mesmo ator mesmo que a posição dele mude. */
export function moveInOrder(enc: EncounterState, fromIndex: number, toIndex: number): EncounterState {
  if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= enc.order.length) return enc;
  const currentId = enc.order[enc.turnIndex]?.refId;
  const order = [...enc.order];
  const [entry] = order.splice(fromIndex, 1);
  order.splice(Math.max(0, Math.min(order.length, toIndex)), 0, entry);
  const turnIndex = currentId ? Math.max(0, order.findIndex(e => e.refId === currentId)) : enc.turnIndex;
  return { ...enc, order, turnIndex };
}

/** Encerra o combate: desliga, limpa a ordem e descarta todo o log do combate. */
export function endEncounter(cena: CenaState): CenaState {
  return { ...cena, encounter: createDefaultEncounter(), log: [] };
}

/** Recalcula a ordem efetiva sem destruir a iniciativa original de cada entrada. */
export function reorderEncounter(
  enc: EncounterState,
  adjustments: Record<string,{speed:number;positions:number}>,
): EncounterState {
  const currentId=enc.order[enc.turnIndex]?.refId;
  const baseIndex=new Map(enc.order.map((entry,index)=>[entry.refId,index]));
  const order=[...enc.order].sort((a,b)=>(b.initiative+(adjustments[b.refId]?.speed??0))-(a.initiative+(adjustments[a.refId]?.speed??0))||(baseIndex.get(a.refId)??0)-(baseIndex.get(b.refId)??0));
  for(const id of [...order].map(entry=>entry.refId)){
    const shift=Math.trunc(adjustments[id]?.positions??0);if(!shift)continue;
    const from=order.findIndex(entry=>entry.refId===id);const [entry]=order.splice(from,1);
    order.splice(Math.max(0,Math.min(order.length,from+shift)),0,entry);
  }
  return{...enc,order,turnIndex:Math.max(0,order.findIndex(entry=>entry.refId===currentId))};
}

// ─────────────────────────────────────────────────────────────────
// Economia de ações, reações e buffs (combate v2)
// ─────────────────────────────────────────────────────────────────

/** O slot do tipo de ação ainda está livre neste turno? (reação não usa slot) */
export function slotAvailable(enc: EncounterState, actionType: ActionType): boolean {
  if (actionType === 'principal') return !enc.turn.majorUsed;
  if (actionType === 'menor') return !enc.turn.minorUsed;
  return true;
}

/** Consome o slot do tipo de ação (imutável). */
export function markSlot(enc: EncounterState, actionType: ActionType): EncounterState {
  if (actionType === 'principal') return { ...enc, turn: { ...enc.turn, majorUsed: true } };
  if (actionType === 'menor') return { ...enc, turn: { ...enc.turn, minorUsed: true } };
  return enc;
}

/** O participante ainda pode reagir nesta rodada? */
export function canReact(enc: EncounterState, id: string): boolean {
  return !enc.reactionsUsed[id];
}

/** Marca a reação da rodada como usada. */
export function markReaction(enc: EncounterState, id: string): EncounterState {
  return { ...enc, reactionsUsed: { ...enc.reactionsUsed, [id]: true } };
}

/** Registra um buff temporário. Empilha de propósito: usar a mesma fonte
 *  duas vezes soma os dois efeitos (sem dedup por `source`). */
export function addBuff(enc: EncounterState, buff: ActiveBuff): EncounterState {
  return { ...enc, activeBuffs: [...enc.activeBuffs, buff] };
}

/** Soma dos buffs ativos de um stat para um alvo. */
export function buffTotal(enc: EncounterState, targetId: string, stat: BuffStat): number {
  return enc.activeBuffs
    .filter(b => b.targetId === targetId && b.stat === stat)
    .reduce((acc, b) => acc + b.value, 0);
}

/**
 * Início do turno do dono: decrementa os buffs dele; expira em 0 com log.
 * (Chamar junto do tickConditions.)
 */
export function tickBuffs(
  enc: EncounterState,
  ownerId: string,
  ownerName: string,
): { enc: EncounterState; log: CenaLogEntry[] } {
  const log: CenaLogEntry[] = [];
  const next: ActiveBuff[] = [];
  for (const b of enc.activeBuffs) {
    if (b.targetId !== ownerId) { next.push(b); continue; }
    const remaining = b.roundsRemaining - 1;
    if (remaining > 0) next.push({ ...b, roundsRemaining: remaining });
    else log.push(logEntry('condition', `${b.source} (${b.value >= 0 ? '+' : ''}${b.value} ${b.stat}) expirou em ${ownerName}.`, undefined,
      { targetLabel: ownerName, sourceLabel: b.source, outcome: 'expired' }));
  }
  return { enc: { ...enc, activeBuffs: next }, log };
}

// ─────────────────────────────────────────────────────────────────
// Efeitos de campo de batalha (alvo 'campo_de_batalha' — combate v2)
// ─────────────────────────────────────────────────────────────────

export interface FieldEffectTickResult {
  fieldEffects: ActiveFieldEffect[];
  /** Delta de HP/Aura por id de combatente, para o chamador aplicar via applyDeltaTo. */
  deltas: Record<string, StatDelta>;
  log: CenaLogEntry[];
}

/**
 * Tick de virada de rodada (não de turno): aplica dano/cura periódicos de cada
 * efeito de campo ativo a TODO combatente presente, sem distinção de time —
 * inclusive quem entrou no combate depois do cast. Decrementa e remove os
 * efeitos cuja duração acabou.
 */
export function tickFieldEffects(
  enc: EncounterState,
  combatants: { id: string; name: string }[],
  roller: (notation: string) => number = notation => rollDice(notation).total,
): FieldEffectTickResult {
  const deltas: Record<string, StatDelta> = {};
  const log: CenaLogEntry[] = [];
  const addDelta = (id: string, key: 'hp', value: number) => {
    deltas[id] = { ...deltas[id], [key]: (deltas[id]?.[key] ?? 0) + value };
  };
  const next: ActiveFieldEffect[] = [];
  for (const fe of enc.fieldEffects) {
    const { periodicDamage, periodicHealing, name } = fe.effect;
    if (periodicDamage) {
      for (const c of combatants) {
        const amount = periodicDamage.flat + (periodicDamage.dice ? roller(periodicDamage.dice) : 0);
        if (amount > 0) {
          addDelta(c.id, 'hp', -amount);
          log.push(logEntry('damage', `${c.name} sofre ${amount} de dano de ${name} (campo de batalha).`));
        }
      }
    }
    if (periodicHealing) {
      for (const c of combatants) {
        const amount = periodicHealing.flat + (periodicHealing.dice ? roller(periodicHealing.dice) : 0);
        if (amount > 0) {
          addDelta(c.id, 'hp', amount);
          log.push(logEntry('damage', `${c.name} recupera ${amount} de HP de ${name} (campo de batalha).`));
        }
      }
    }
    if (fe.roundsRemaining == null) { next.push(fe); continue; }
    const remaining = fe.roundsRemaining - 1;
    if (remaining > 0) next.push({ ...fe, roundsRemaining: remaining });
    else log.push(logEntry('system', `${fe.effect.name} se dissipa do campo de batalha.`));
  }
  return { fieldEffects: next, deltas, log };
}
