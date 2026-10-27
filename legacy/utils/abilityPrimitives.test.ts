import { describe, it, expect } from 'vitest';
import { applyDamage, applyCondition, removeActiveEffects } from './abilityPrimitives';
import type { ArsenalActorState } from './arsenalPipeline';
import type { ArsenalEffect } from './arsenal';
import { getPredefinedEffect } from './arsenalEffects';

const actor = (over: Partial<ArsenalActorState> = {}): ArsenalActorState => ({
  id: 't', teamId: 'B', name: 'Alvo', currentHp: 30, maxHp: 30, currentAura: 0, maxAura: 0,
  currentAmmo: 0, maxAmmo: 0, defense: 10, speed: 5, tags: [], equippedWeaponIds: [],
  activeFormIds: [], effects: [], holdings: [], isCurrentTurn: false, inCombat: true, ...over,
});

describe('applyDamage', () => {
  it('desconta dano cru sem elemento', () => {
    const r = applyDamage(actor(), 8, null, () => 0);
    expect(r.target.currentHp).toBe(22);
    expect(r.appliedDamage).toBe(8);
  });

  it('aplica afinidade de resistência (50%) do alvo', () => {
    const molhado = getPredefinedEffect('molhado')!;
    const target = actor({ effects: [{ effect: { ...molhado, elementalAffinities: [{ element: 'fogo', kind: 'resistencia', percent: 50 }] }, stacks: 1 }] });
    const r = applyDamage(target, 10, 'fogo', () => 0);
    expect(r.appliedDamage).toBe(5);
  });
});

describe('applyDamage perfurante (ignora a Defesa)', () => {
  const withDefense = actor({
    defenseMax: 20, defenseCurrent: 20, defenseReduction: 0.2, defenseRegeneration: 1, defenseActivationThreshold: 0.2,
    staggerMax: 100, staggerCurrent: 0, staggerRecovery: 15, staggerDamageMultiplier: 1.4, staggerDuration: 1,
    isDefenseBroken: false, isStaggered: false, staggerTurnsRemaining: 0,
  } as Partial<ArsenalActorState>);

  it('sem perfurante, a Defesa reduz o dano e absorve parte no escudo', () => {
    const r = applyDamage(withDefense, 10, null, () => 0);
    expect(r.appliedDamage).toBe(8); // 10 * (1 - 0.2) = 8
    expect(r.target.defenseCurrent).toBe(10); // consumiu 10 pontos de escudo
  });

  it('com perfurante, o dano vai direto ao HP e o escudo não é tocado', () => {
    const r = applyDamage(withDefense, 10, null, () => 0, true);
    expect(r.appliedDamage).toBe(10);
    expect(r.target.defenseCurrent).toBe(20);
    expect(r.target.isDefenseBroken).toBe(false);
  });
});

describe('applyDamage com escudo', () => {
  it('escudo absorve o dano até se esgotar; excedente vai para o HP', () => {
    const shield = getPredefinedEffect('molhado')!; // efeito base qualquer; sobrescrevemos com shield
    const target = actor({ effects: [{ effect: { ...shield, id: 'shield-1', shield: { flat: 5 } }, stacks: 1 }] });
    const r = applyDamage(target, 8, null, () => 0);
    expect(r.target.currentHp).toBe(27); // 30 - (8 - 5)
    expect(r.target.effects.find(e => e.effect.id === 'shield-1')?.effect.shield).toEqual({ flat: 0 });
  });

  it('escudo maior que o dano absorve tudo e sobrevive parcialmente', () => {
    const shield = getPredefinedEffect('molhado')!;
    const target = actor({ effects: [{ effect: { ...shield, id: 'shield-2', shield: { flat: 10 } }, stacks: 1 }] });
    const r = applyDamage(target, 4, null, () => 0);
    expect(r.target.currentHp).toBe(30);
    expect(r.target.effects.find(e => e.effect.id === 'shield-2')?.effect.shield).toEqual({ flat: 6 });
  });
});

describe('applyDamage com marcar vulnerável e conversão de dano', () => {
  it('marca vulnerável amplifica o próximo dano e é consumida', () => {
    const mark = getPredefinedEffect('molhado')!;
    const target = actor({ effects: [{ effect: { ...mark, id: 'mark-1', markVulnerable: { amplifyPercent: 50 } }, stacks: 1 }] });
    const r = applyDamage(target, 10, null, () => 0);
    expect(r.appliedDamage).toBe(15);
    expect(r.target.effects.find(e => e.effect.id === 'mark-1')).toBeUndefined();
  });

  it('conversão de dano troca o elemento antes de calcular afinidade', () => {
    const conv = getPredefinedEffect('molhado')!;
    const target = actor({
      effects: [
        { effect: { ...conv, id: 'conv-1', elementalAffinities: [], damageConversion: { from: 'fisico', to: 'fogo' } }, stacks: 1 },
        { effect: { ...conv, id: 'aff-1', elementalAffinities: [{ element: 'fogo', kind: 'imunidade', percent: 100 }] }, stacks: 1 },
      ],
    });
    const r = applyDamage(target, 10, 'fisico', () => 0);
    expect(r.appliedDamage).toBe(0); // convertido para fogo, e o alvo é imune a fogo
  });
});

describe('applyCondition', () => {
  it('empilha o efeito no alvo', () => {
    const burn = getPredefinedEffect('queimadura')!;
    const r = applyCondition(actor(), burn, () => 20);
    expect(r.effects.some(e => e.effect.id === burn.id)).toBe(true);
  });

  it('respeita imunidade', () => {
    const burn = getPredefinedEffect('queimadura')!;
    const immune = actor({ effects: [{ effect: { ...burn, id: 'immune-src', immunities: [burn.id] }, stacks: 1 }] });
    const r = applyCondition(immune, burn, () => 20);
    expect(r.effects.filter(e => e.effect.id === burn.id)).toHaveLength(0);
  });
});

describe('removeActiveEffects', () => {
  const mkEffect = (id: string, over: Partial<ArsenalEffect> = {}): ArsenalEffect => ({
    id, name: id, description: '', tags: [], duration: { type: 'rodadas', amount: 2 },
    stackBehavior: 'nao_acumula', maxStacks: 1, triggers: [], modifiers: [],
    periodicDamage: null, periodicHealing: null, auraConsumed: null, auraRestored: null,
    attackModifier: 0, defenseModifier: 0, speedModifier: 0, customEffect: null, ...over,
  });

  it('remove o efeito negativo mais recente quando categoria é negativo', () => {
    const alvo = actor({
      effects: [
        { effect: mkEffect('buff-1', { modifiers: [{ stat: 'ataque', operation: 'somar', value: 3 }] }), stacks: 1 },
        { effect: mkEffect('queimadura-1', { periodicDamage: { flat: 2, dice: null } }), stacks: 1 },
      ],
    });
    const r = removeActiveEffects(alvo, 'negativo', 1);
    expect(r.target.effects.map(e => e.effect.id)).toEqual(['buff-1']);
    expect(r.removedNames).toEqual(['queimadura-1']);
  });

  it('remove efeitos positivos sem tocar nos negativos', () => {
    const alvo = actor({
      effects: [
        { effect: mkEffect('buff-1', { modifiers: [{ stat: 'ataque', operation: 'somar', value: 3 }] }), stacks: 1 },
        { effect: mkEffect('queimadura-1', { periodicDamage: { flat: 2, dice: null } }), stacks: 1 },
      ],
    });
    const r = removeActiveEffects(alvo, 'positivo', 1);
    expect(r.target.effects.map(e => e.effect.id)).toEqual(['queimadura-1']);
  });

  it('categoria "qualquer" remove independente de polaridade, mais recentes primeiro', () => {
    const alvo = actor({
      effects: [
        { effect: mkEffect('buff-1'), stacks: 1 },
        { effect: mkEffect('queimadura-1', { periodicDamage: { flat: 2, dice: null } }), stacks: 1 },
        { effect: mkEffect('buff-2'), stacks: 1 },
      ],
    });
    const r = removeActiveEffects(alvo, 'qualquer', 2);
    expect(r.target.effects.map(e => e.effect.id)).toEqual(['buff-1']);
  });

  it('quantidade 0 não remove nada', () => {
    const alvo = actor({ effects: [{ effect: mkEffect('buff-1'), stacks: 1 }] });
    const r = removeActiveEffects(alvo, 'qualquer', 0);
    expect(r.target.effects.map(e => e.effect.id)).toEqual(['buff-1']);
    expect(r.removedNames).toEqual([]);
  });

  it('quantidade maior que o disponível remove todos os elegíveis', () => {
    const alvo = actor({
      effects: [
        { effect: mkEffect('buff-1'), stacks: 1 },
        { effect: mkEffect('buff-2'), stacks: 1 },
      ],
    });
    const r = removeActiveEffects(alvo, 'positivo', 10);
    expect(r.target.effects).toEqual([]);
  });
});
