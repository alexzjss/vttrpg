import { describe, expect, it } from 'vitest';
import type { RollResult } from './dice';
import { payCosts, resolveV2, type ActionInput, type CombatantSnapshot, type Roller } from './resolve';

/** Snapshot de combatente com defaults convenientes. */
export function snap(partial: Partial<CombatantSnapshot> = {}): CombatantSnapshot {
  return {
    id: 'x', name: 'X',
    currentHp: 20, maxHp: 20, currentAura: 10, maxAura: 10, currentAmmo: 5, maxAmmo: 5,
    conditions: [],
    ...partial,
  };
}

/** Roller determinístico: devolve a fila de resultados na ordem chamada.
 *  Atenção: passe individualRolls/dieRoll explícitos quando total incluir bônus,
 *  senão o default [total] pode disparar crítico/fumble acidental. */
export function seqRoller(seq: Array<Partial<RollResult> & { total: number }>): Roller {
  let i = 0;
  return (notation: string): RollResult => {
    const s = seq[Math.min(i++, seq.length - 1)];
    const dieRoll = s.dieRoll ?? s.total;
    return {
      total: s.total, dieRoll, bonus: s.bonus ?? s.total - dieRoll,
      notation, individualRolls: s.individualRolls ?? [dieRoll],
      numSides: s.numSides ?? 20, numDice: s.numDice ?? 1,
    };
  };
}

const strike: ActionInput = {
  name: 'Golpe',
  profile: {
    actionType: 'principal', targeting: 'inimigo', attackDice: '1d20',
    costs: { aura: 3, ammo: 1 },
    effects: [{ kind: 'damage', dice: '2d6', element: 'fisico' }],
  },
};

describe('payCosts', () => {
  it('paga aura/munição como delta negativo', () => {
    const r = payCosts(snap({ name: 'A' }), strike);
    expect(r.blocked).toBeUndefined();
    expect(r.actorDelta).toEqual({ aura: -3, ammo: -1 });
  });

  it('bloqueia sem aura', () => {
    const r = payCosts(snap({ currentAura: 2 }), strike);
    expect(r.blocked).toBe('Aura insuficiente');
    expect(r.actorDelta).toEqual({});
    expect(r.log[0].text).toContain('Aura insuficiente');
  });

  it('bloqueia sem munição', () => {
    const r = payCosts(snap({ currentAmmo: 0 }), strike);
    expect(r.blocked).toBe('Munição insuficiente');
  });

  it('custo de HP não pode derrubar o ator', () => {
    const blood: ActionInput = { name: 'Rito', profile: { actionType: 'principal', targeting: 'inimigo', costs: { hp: 5 }, effects: [] } };
    expect(payCosts(snap({ currentHp: 5 }), blood).blocked).toBe('HP insuficiente');
    expect(payCosts(snap({ currentHp: 6 }), blood).actorDelta).toEqual({ hp: -5 });
  });

  it('sem custos, delta vazio', () => {
    const free: ActionInput = { name: 'Livre', profile: { actionType: 'menor', targeting: 'self', effects: [] } };
    expect(payCosts(snap(), free)).toEqual({ actorDelta: {}, log: [] });
  });

  it('custo igual à aura/munição atual é permitido (zera o recurso)', () => {
    const r = payCosts(snap({ currentAura: 3, currentAmmo: 1 }), strike);
    expect(r.blocked).toBeUndefined();
    expect(r.actorDelta).toEqual({ aura: -3, ammo: -1 });
  });
});

import { rollAttack } from './resolve';

describe('rollAttack', () => {
  const atk: ActionInput = {
    name: 'Golpe',
    profile: { actionType: 'principal', targeting: 'inimigo', attackDice: '1d20', effects: [] },
  };

  it('acerta quando total >= defesa (com bônus e penalidade nomeados)', () => {
    const roll = seqRoller([{ total: 12, individualRolls: [12] }]);
    const out = rollAttack(snap({ id: 'a', name: 'Atacante' }), snap({ id: 'b', defense: 12 }), atk, { roll });
    expect(out.attempted).toBe(true);
    expect(out.hit).toBe(true);
    expect(out.attackTotal).toBe(12);
    expect(out.defenseValue).toBe(12);
  });

  it('erra quando total < defesa', () => {
    const roll = seqRoller([{ total: 9, individualRolls: [9] }]);
    const out = rollAttack(snap({ id: 'a' }), snap({ id: 'b', defense: 10 }), atk, { roll });
    expect(out.hit).toBe(false);
  });

  it('usa DEFAULT_DEFENSE (10) quando o alvo não tem defesa', () => {
    const roll = seqRoller([{ total: 10, individualRolls: [10] }]);
    const out = rollAttack(snap({ id: 'a' }), snap({ id: 'b' }), atk, { roll });
    expect(out.defenseValue).toBe(10);
    expect(out.hit).toBe(true);
  });

  it('buff de defesa entra na defesa efetiva', () => {
    const roll = seqRoller([{ total: 11, individualRolls: [11] }]);
    const out = rollAttack(snap({ id: 'a' }), snap({ id: 'b', defense: 10 }), atk, { roll, defenseBonus: 2 });
    expect(out.defenseValue).toBe(12);
    expect(out.hit).toBe(false);
  });

  it('buff de acerto soma no total', () => {
    const roll = seqRoller([{ total: 9, individualRolls: [9] }]);
    const out = rollAttack(snap({ id: 'a' }), snap({ id: 'b', defense: 10 }), atk, { roll, attackBonus: 1 });
    expect(out.attackTotal).toBe(10);
    expect(out.hit).toBe(true);
  });

  it('Amaldiçoado penaliza a rolagem (valor do preset = 2)', () => {
    const roll = seqRoller([{ total: 11, individualRolls: [11] }]);
    const actor = snap({ id: 'a', conditions: [{ name: 'Amaldiçoado', duration: 2 }] });
    const out = rollAttack(actor, snap({ id: 'b', defense: 10 }), atk, { roll });
    expect(out.attackTotal).toBe(9);
    expect(out.hit).toBe(false);
  });

  it('nat 20 é crítico e acerta mesmo abaixo da defesa', () => {
    const roll = seqRoller([{ total: 20, individualRolls: [20], numSides: 20 }]);
    const out = rollAttack(snap({ id: 'a' }), snap({ id: 'b', defense: 30 }), atk, { roll });
    expect(out.crit).toBe(true);
    expect(out.hit).toBe(true);
  });

  it('nat 1 é erro automático mesmo acima da defesa', () => {
    const roll = seqRoller([{ total: 21, dieRoll: 1, bonus: 20, individualRolls: [1], numSides: 20 }]);
    const out = rollAttack(snap({ id: 'a' }), snap({ id: 'b', defense: 5 }), atk, { roll });
    expect(out.fumble).toBe(true);
    expect(out.hit).toBe(false);
  });

  it('reação substitui a defesa fixa pela rolagem do alvo', () => {
    const roll = seqRoller([
      { total: 15, individualRolls: [15] }, // acerto do atacante
      { total: 16, individualRolls: [16] }, // reação do alvo
    ]);
    const out = rollAttack(snap({ id: 'a' }), snap({ id: 'b', defense: 5 }), atk, { roll, reactionDice: '1d20+3' });
    expect(out.reactionRoll?.total).toBe(16);
    expect(out.defenseValue).toBe(16);
    expect(out.hit).toBe(false);
  });

  it('sem attackDice ou em si mesmo não há teste (auto-acerto)', () => {
    const heal: ActionInput = { name: 'Cura', profile: { actionType: 'principal', targeting: 'self', effects: [] } };
    const self = snap({ id: 'a' });
    const out = rollAttack(self, self, heal);
    expect(out.attempted).toBe(false);
    expect(out.hit).toBe(true);
  });

  it('attackDice multi-dado não tem crítico nem fumble', () => {
    const roll = seqRoller([{ total: 20, dieRoll: 20, individualRolls: [10, 10], numDice: 2, numSides: 10 }]);
    const atk2 = { name: 'Rajada', profile: { actionType: 'principal', targeting: 'inimigo', attackDice: '2d10', effects: [] } } as ActionInput;
    const out = rollAttack(snap({ id: 'a' }), snap({ id: 'b', defense: 15 }), atk2, { roll });
    expect(out.natural).toBeUndefined();
    expect(out.crit).toBe(false);
    expect(out.fumble).toBe(false);
    expect(out.hit).toBe(true); // 20 >= 15 normalmente
  });
});

import { applyEffects } from './resolve';

describe('applyEffects', () => {
  it('rola o dano e aplica como delta negativo de HP', () => {
    const roll = seqRoller([{ total: 8, dieRoll: 8 }]);
    const r = applyEffects('A', snap({ id: 'b' }), [{ kind: 'damage', dice: '2d6', element: 'fisico' }], { roll });
    expect(r.damages[0].final).toBe(8);
    expect(r.targetDelta).toEqual({ hp: -8 });
  });

  it('crítico dobra os dados (não o bônus fixo)', () => {
    const roll = seqRoller([{ total: 10, dieRoll: 7, bonus: 3 }]); // 2d6+3 → dados 7
    const r = applyEffects('A', snap({ id: 'b' }), [{ kind: 'damage', dice: '2d6+3', element: 'fisico' }], { roll, crit: true });
    expect(r.damages[0].final).toBe(17); // 7*2 + 3
  });

  it('afinidade fraco ×1.5 (arredonda para baixo)', () => {
    const roll = seqRoller([{ total: 7, dieRoll: 7 }]);
    const target = snap({ id: 'b', affinities: { fogo: 'fraco' } });
    const r = applyEffects('A', target, [{ kind: 'damage', dice: '2d6', element: 'fogo' }], { roll });
    expect(r.damages[0].final).toBe(10); // floor(7*1.5)
  });

  it('imune zera o dano', () => {
    const roll = seqRoller([{ total: 12, dieRoll: 12 }]);
    const target = snap({ id: 'b', affinities: { raio: 'imune' } });
    const r = applyEffects('A', target, [{ kind: 'damage', dice: '3d6', element: 'raio' }], { roll });
    expect(r.damages[0].final).toBe(0);
    expect(r.targetDelta.hp).toBe(0);
  });

  it('raio em alvo Molhado: +5 flat e consome Molhado', () => {
    const roll = seqRoller([{ total: 6, dieRoll: 6 }]);
    const target = snap({ id: 'b', conditions: [{ name: 'Molhado', duration: 2 }] });
    const r = applyEffects('A', target, [{ kind: 'damage', dice: '2d6', element: 'raio' }], { roll });
    expect(r.damages[0].final).toBe(11);
    expect(r.targetConditions).toEqual([]);
  });

  it('água aplica Molhado e apaga Queimando', () => {
    const roll = seqRoller([{ total: 4, dieRoll: 4 }]);
    const target = snap({ id: 'b', conditions: [{ name: 'Queimando', duration: 3 }] });
    const r = applyEffects('A', target, [{ kind: 'damage', dice: '1d6', element: 'água' }], { roll });
    expect(r.targetConditions).toEqual([{ name: 'Molhado', duration: 2 }]);
  });

  it('Protegido reduz o dano final (valor do preset = 3, mínimo 0)', () => {
    const roll = seqRoller([{ total: 2, dieRoll: 2 }]);
    const target = snap({ id: 'b', conditions: [{ name: 'Protegido', duration: 2 }] });
    const r = applyEffects('A', target, [{ kind: 'damage', dice: '1d4', element: 'fisico' }], { roll });
    expect(r.damages[0].final).toBe(0); // max(0, 2-3)
  });

  it('ordem: interação → afinidade (fogo ÷2 em Molhado, depois fraco ×1.5)', () => {
    const roll = seqRoller([{ total: 10, dieRoll: 10 }]);
    const target = snap({ id: 'b', conditions: [{ name: 'Molhado', duration: 2 }], affinities: { fogo: 'fraco' } });
    const r = applyEffects('A', target, [{ kind: 'damage', dice: '3d6', element: 'fogo' }], { roll });
    expect(r.damages[0].final).toBe(7); // floor(floor(10*0.5)*1.5)
  });

  it('cura rolada e cura flat', () => {
    const roll = seqRoller([{ total: 5, dieRoll: 5 }]);
    const r1 = applyEffects('A', snap({ id: 'b' }), [{ kind: 'heal', stat: 'hp', dice: '1d8' }], { roll });
    expect(r1.targetDelta).toEqual({ hp: 5 });
    const r2 = applyEffects('A', snap({ id: 'b' }), [{ kind: 'heal', stat: 'aura', dice: '4' }], { roll });
    expect(r2.targetDelta).toEqual({ aura: 4 });
  });

  it('condição nova é aplicada; repetida renova para a maior duração', () => {
    const target = snap({ id: 'b', conditions: [{ name: 'Queimando', duration: 1 }] });
    const r = applyEffects('A', target, [
      { kind: 'condition', name: 'Queimando', duration: 3 },
      { kind: 'condition', name: 'Envenenado', duration: 4 },
    ]);
    expect(r.targetConditions).toEqual([
      { name: 'Queimando', duration: 3 },
      { name: 'Envenenado', duration: 4 },
    ]);
  });

  it('buffs são coletados para o encounter registrar', () => {
    const r = applyEffects('A', snap({ id: 'b' }), [{ kind: 'buff', stat: 'defesa', value: 2, duration: 1 }]);
    expect(r.buffs).toEqual([{ stat: 'defesa', value: 2, duration: 1 }]);
  });

  it('múltiplos efeitos acumulam num só resultado', () => {
    const roll = seqRoller([{ total: 6, dieRoll: 6 }]);
    const r = applyEffects('A', snap({ id: 'b' }), [
      { kind: 'damage', dice: '2d6', element: 'fogo' },
      { kind: 'condition', name: 'Queimando', duration: 3 },
    ], { roll });
    expect(r.targetDelta).toEqual({ hp: -6 });
    expect(r.targetConditions).toEqual([{ name: 'Queimando', duration: 3 }]);
  });

  it('damageBonus entra antes dos multiplicadores (amplificado por fraqueza)', () => {
    const roll = seqRoller([{ total: 6, dieRoll: 6 }]);
    const target = snap({ id: 'b', affinities: { fogo: 'fraco' } });
    const r = applyEffects('A', target, [{ kind: 'damage', dice: '2d6', element: 'fogo' }], { roll, damageBonus: 2 });
    expect(r.damages[0].final).toBe(12); // floor((6+2)*1.5)
  });

  it('crítico combina com afinidade (dobra antes do multiplicador)', () => {
    const roll = seqRoller([{ total: 7, dieRoll: 7 }]);
    const target = snap({ id: 'b', affinities: { fogo: 'fraco' } });
    const r = applyEffects('A', target, [{ kind: 'damage', dice: '2d6', element: 'fogo' }], { roll, crit: true });
    expect(r.damages[0].final).toBe(21); // floor(7*2*1.5)
  });

  it('dois efeitos de dano na mesma ação: o segundo vê as condições do primeiro', () => {
    const roll = seqRoller([
      { total: 4, dieRoll: 4 }, // água
      { total: 6, dieRoll: 6 }, // raio
    ]);
    const r = applyEffects('A', snap({ id: 'b' }), [
      { kind: 'damage', dice: '1d6', element: 'água' },
      { kind: 'damage', dice: '2d6', element: 'raio' },
    ], { roll });
    expect(r.damages[0].final).toBe(4);
    expect(r.damages[1].final).toBe(11); // 6 + 5 do Molhado aplicado pela água
    expect(r.targetDelta).toEqual({ hp: -15 });
    expect(r.targetConditions).toEqual([]); // raio consumiu o Molhado
  });
});

describe('resolveV2', () => {
  const fireball: ActionInput = {
    name: 'Bola de Fogo',
    profile: {
      actionType: 'principal', targeting: 'inimigo', attackDice: '1d20',
      costs: { aura: 2 },
      effects: [
        { kind: 'damage', dice: '2d6', element: 'fogo' },
        { kind: 'condition', name: 'Queimando', duration: 3 },
      ],
    },
  };

  it('bloqueio de custo interrompe tudo', () => {
    const r = resolveV2(snap({ id: 'a', currentAura: 1 }), snap({ id: 'b' }), fireball);
    expect(r.blocked).toBe('Aura insuficiente');
    expect(r.outcome).toBeUndefined();
    expect(r.effects).toBeUndefined();
  });

  it('erro no acerto: paga custos, sem efeitos', () => {
    const roll = seqRoller([{ total: 3, individualRolls: [3] }]);
    const r = resolveV2(snap({ id: 'a' }), snap({ id: 'b', defense: 15 }), fireball, { roll });
    expect(r.blocked).toBeUndefined();
    expect(r.actorDelta).toEqual({ aura: -2 });
    expect(r.outcome?.hit).toBe(false);
    expect(r.effects).toBeUndefined();
  });

  it('acerto completo: custos + dano + condição, log encadeado', () => {
    const roll = seqRoller([
      { total: 15, individualRolls: [15] }, // acerto
      { total: 7, dieRoll: 7 },             // dano
    ]);
    const r = resolveV2(snap({ id: 'a', name: 'Mago' }), snap({ id: 'b', name: 'Ogro', defense: 10 }), fireball, { roll });
    expect(r.actorDelta).toEqual({ aura: -2 });
    expect(r.effects?.targetDelta).toEqual({ hp: -7 });
    expect(r.effects?.targetConditions).toEqual([{ name: 'Queimando', duration: 3 }]);
    expect(r.log.length).toBeGreaterThanOrEqual(3); // acerto + dano + condição
  });

  it('crítico propaga para o dano', () => {
    const roll = seqRoller([
      { total: 20, individualRolls: [20], numSides: 20 },
      { total: 7, dieRoll: 7 },
    ]);
    const r = resolveV2(snap({ id: 'a' }), snap({ id: 'b', defense: 10 }), fireball, { roll });
    expect(r.outcome?.crit).toBe(true);
    expect(r.effects?.damages[0].final).toBe(14); // 7*2
  });

  it('reação pelo resolveV2: 3 rolagens na ordem acerto→reação→dano', () => {
    const roll = seqRoller([
      { total: 15, individualRolls: [15] }, // acerto do atacante
      { total: 18, individualRolls: [18] }, // reação do alvo (substitui defesa)
      { total: 9, dieRoll: 9 },             // dano (não deve ser puxado: errou)
    ]);
    const r = resolveV2(snap({ id: 'a' }), snap({ id: 'b', defense: 5 }), fireball, { roll, reactionDice: '1d20' });
    expect(r.outcome?.reactionRoll?.total).toBe(18);
    expect(r.outcome?.hit).toBe(false); // 15 < 18
    expect(r.actorDelta).toEqual({ aura: -2 }); // custo pago mesmo errando
    expect(r.effects).toBeUndefined();
  });

  it('buff pelo resolveV2 é coletado em effects.buffs', () => {
    const guard: ActionInput = {
      name: 'Guarda',
      profile: { actionType: 'menor', targeting: 'self', effects: [{ kind: 'buff', stat: 'defesa', value: 2, duration: 1 }] },
    };
    const self = snap({ id: 'a', name: 'Herói' });
    const r = resolveV2(self, self, guard); // self-target: ator é o próprio alvo
    expect(r.outcome?.attempted).toBe(false); // sem teste de acerto
    expect(r.effects?.buffs).toEqual([{ stat: 'defesa', value: 2, duration: 1 }]);
  });
});
