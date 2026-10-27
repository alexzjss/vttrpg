import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry, getNodeType } from '../nodeRegistry';
import { registerCoreNodes } from './coreNodes';
import type { InterpretCtx } from '../abilityInterpreter';
import type { ArsenalActorState } from '../arsenalPipeline';

const alvo = (over: Partial<ArsenalActorState> = {}): ArsenalActorState => ({
  id: 't', teamId: 'B', name: 'Alvo', currentHp: 30, maxHp: 30, currentAura: 0, maxAura: 0,
  currentAmmo: 0, maxAmmo: 0, defense: 10, speed: 5, tags: [], equippedWeaponIds: [],
  activeFormIds: [], effects: [], holdings: [], isCurrentTurn: false, inCombat: true, ...over,
});

function ctx(over: Partial<InterpretCtx> = {}): InterpretCtx {
  return {
    actor: alvo(),
    scope: [alvo()],
    roller: () => 4,
    element: 'fogo',
    trace: [],
    ...over,
  } as InterpretCtx;
}

describe('registerCoreNodes', () => {
  beforeEach(() => { _resetRegistry(); registerCoreNodes(); });

  it('nó dano desconta do alvo no escopo', () => {
    const c = ctx();
    getNodeType('dano')!.interpret!({ dice: '1d6', flat: 2, element: 'fogo' }, c);
    expect(c.scope[0].currentHp).toBe(24); // 30 - (4 + 2)
    expect(c.trace.some(t => t.detail?.includes('dano'))).toBe(true);
  });

  it('nó alvo troca o escopo para próprio usuário', () => {
    const c = ctx();
    getNodeType('alvo')!.interpret!({ scope: 'proprio' }, c);
    expect(c.scope[0].id).toBe(c.actor.id);
  });

  it('nó alvo "aleatório inimigo" escolhe 1 alvo determinístico via roller', () => {
    const enemyA = alvo({ id: 'e1', teamId: 'B' });
    const enemyB = alvo({ id: 'e2', teamId: 'B' });
    const c = ctx({ actor: alvo({ id: 'actor', teamId: 'A' }), allTargets: [enemyA, enemyB], roller: () => 2 });
    getNodeType('alvo')!.interpret!({ scope: 'aleatorio_inimigo' }, c);
    expect(c.scope).toEqual([enemyB]);
  });

  it('nó alvo "aleatório aliado" nunca escolhe alguém do time inimigo', () => {
    const ally = alvo({ id: 'ally', teamId: 'A' });
    const enemy = alvo({ id: 'enemy', teamId: 'B' });
    const c = ctx({ actor: alvo({ id: 'actor', teamId: 'A' }), allTargets: [ally, enemy], roller: () => 1 });
    getNodeType('alvo')!.interpret!({ scope: 'aleatorio_aliado' }, c);
    expect(c.scope).toEqual([ally]);
  });

  it('nó alvo aleatório sem candidatos no time resulta em escopo vazio', () => {
    const ally = alvo({ id: 'ally', teamId: 'A' });
    const c = ctx({ actor: alvo({ id: 'actor', teamId: 'A' }), allTargets: [ally] });
    getNodeType('alvo')!.interpret!({ scope: 'aleatorio_inimigo' }, c);
    expect(c.scope).toEqual([]);
  });

  it.each(['linha', 'raio', 'cone', 'quadrado'] as const)('nó alvo escopo geométrico "%s" usa ctx.areaTargets (resolvido fora, pela Cena)', (scope) => {
    const inArea = alvo({ id: 'in-area' });
    const c = ctx({ areaTargets: [inArea] });
    getNodeType('alvo')!.interpret!({ scope, distance: 3, width: 1, radius: 2, range: 3, angle: 60, size: 2 }, c);
    expect(c.scope).toEqual([inArea]);
  });

  it('nó alvo escopo geométrico sem ctx.areaTargets resolvido resulta em escopo vazio', () => {
    const c = ctx();
    getNodeType('alvo')!.interpret!({ scope: 'raio', distance: 3, width: 1, radius: 2, range: 3, angle: 60, size: 2 }, c);
    expect(c.scope).toEqual([]);
  });

  it('nó dano com "hits" > 1 rola e aplica cada golpe independentemente', () => {
    const rolls = [3, 5, 2];
    const c = ctx({ roller: () => rolls.shift()! });
    getNodeType('dano')!.interpret!({ dice: '1d6', flat: 0, element: 'fogo', perfurante: false, hits: 3 }, c);
    // 30 - (3+5+2) = 20
    expect(c.scope[0].currentHp).toBe(20);
    expect(c.trace.filter(t => t.detail?.includes('golpe'))).toHaveLength(3);
  });

  it('gatilho "quando alvejado" existe e não tem campos', () => {
    expect(getNodeType('ao_ser_alvejado')).toBeTruthy();
    expect(getNodeType('ao_ser_alvejado')!.fields).toEqual([]);
  });

  it('nó aplicar_condicao usa os campos específicos configurados como overrides', () => {
    const c = ctx();
    getNodeType('aplicar_condicao')!.interpret!({
      conditionName: 'Vulnerável', intensity: 'normal', rounds: 3, chance: 100,
      savingThrowDice: '', savingThrowMinimum: 0, maxStacks: 1,
      element: 'raio', extraDamagePercent: 80,
    }, c);
    const active = c.scope[0].effects[0];
    expect(active.effect.elementalAffinities).toEqual([{ element: 'raio', kind: 'vulnerabilidade', percent: 80 }]);
    expect(active.effect.duration).toEqual({ type: 'rodadas', amount: 3 });
  });

  it('nó aplicar_condicao respeita o teste de resistência configurado', () => {
    const c = ctx({ roller: (dice: string) => (dice === '1d20' ? 15 : 4) });
    getNodeType('aplicar_condicao')!.interpret!({
      conditionName: 'Sangrando', intensity: 'normal', rounds: 2, chance: 100,
      savingThrowDice: '1d20', savingThrowMinimum: 12, maxStacks: 1,
    }, c);
    expect(c.scope[0].effects).toEqual([]);
    expect(c.trace.some(t => t.detail?.includes('resistiu'))).toBe(true);
  });

  it('buff unificado aplica modificador de stat de combate', () => {
    const c = ctx();
    getNodeType('buff')!.interpret!({ stat: 'ataque', operation: 'somar', value: 3, rounds: 2 }, c);
    const active = c.scope[0].effects[0];
    expect(active.effect.modifiers).toEqual([{ stat: 'ataque', operation: 'somar', value: 3 }]);
  });

  it('buff unificado com stat vida_maxima grava o modificador correspondente', () => {
    const c = ctx();
    getNodeType('buff')!.interpret!({ stat: 'vida_maxima', operation: 'somar', value: 10, rounds: 5 }, c);
    const active = c.scope[0].effects[0];
    expect(active.effect.modifiers).toEqual([{ stat: 'vida_maxima', operation: 'somar', value: 10 }]);
  });

  it('gatilho "em combo" existe com campos de stackKey/maxStacks', () => {
    const def = getNodeType('em_combo')!;
    expect(def.family).toBe('gatilho');
    expect(def.fields.map(f => f.key)).toEqual(['stackKey', 'maxStacks']);
  });

  it('nó custo não altera estado, só registra no trace', () => {
    const c = ctx();
    getNodeType('custo')!.interpret!({ recurso: 'aura', amount: 3 }, c);
    expect(c.trace.some(t => t.detail?.includes('3 de aura'))).toBe(true);
    expect(c.scope[0].currentHp).toBe(30);
  });

  it('aplicar_como_efeito carrega ctx.pendingReactions para o ongoingEffectIntent emitido', () => {
    const c = ctx({ pendingReactions: [{ eventType: 'ao_ser_alvejado', nodeIds: ['d'] }] });
    getNodeType('aplicar_como_efeito')!.interpret!({ alvo: 'proprio', rounds: 3 }, c);
    expect(c.ongoingEffectIntents?.[0]).toMatchObject({
      pendingReactions: [{ eventType: 'ao_ser_alvejado', nodeIds: ['d'] }],
    });
  });

  it('aplicar_como_efeito sem pendingReactions não inclui o campo no ongoingEffectIntent', () => {
    const c = ctx();
    getNodeType('aplicar_como_efeito')!.interpret!({ alvo: 'proprio', rounds: 3 }, c);
    expect(c.ongoingEffectIntents?.[0]).not.toHaveProperty('pendingReactions');
  });

  it('nó bonus_dado aplica DiceBonus filtrado por elemento no alvo', () => {
    const c = ctx();
    getNodeType('bonus_dado')!.interpret!({ target: 'teste', bonusDice: '1d4', bonusFlat: 2, elemento: 'fogo', rounds: 3 }, c);
    const active = c.scope[0].effects[0];
    expect(active.effect.diceBonuses).toEqual([
      { target: 'teste', bonusDice: '1d4', bonusFlat: 2, filter: { damageType: ['fogo'] } },
    ]);
    expect(active.remaining).toBe(3);
  });

  it('nó bonus_dado sem elemento não tem filtro (vale pra qualquer dano/teste)', () => {
    const c = ctx();
    getNodeType('bonus_dado')!.interpret!({ target: 'dano', bonusDice: undefined, bonusFlat: 3, elemento: null, rounds: 2 }, c);
    const active = c.scope[0].effects[0];
    expect(active.effect.diceBonuses).toEqual([
      { target: 'dano', bonusDice: null, bonusFlat: 3, filter: undefined },
    ]);
  });

  it('nó regeneracao de vida aplica periodicHealing', () => {
    const c = ctx();
    getNodeType('regeneracao')!.interpret!({ recurso: 'vida', dice: '1d4', flat: 1, rounds: 3 }, c);
    const active = c.scope[0].effects[0];
    expect(active.effect.periodicHealing).toEqual({ flat: 1, dice: '1d4' });
    expect(active.effect.auraRestored).toBeNull();
  });

  it('nó regeneracao de aura aplica auraRestored', () => {
    const c = ctx();
    getNodeType('regeneracao')!.interpret!({ recurso: 'aura', dice: undefined, flat: 2, rounds: 2 }, c);
    const active = c.scope[0].effects[0];
    expect(active.effect.auraRestored).toEqual({ flat: 2, dice: undefined });
    expect(active.effect.periodicHealing).toBeNull();
  });

  it('nó dispersar remove o efeito negativo mais recente do alvo', () => {
    const buffEfeito = {
      id: 'buff-1', name: 'Buff', description: '', tags: [], duration: { type: 'rodadas' as const, amount: 2 },
      stackBehavior: 'nao_acumula' as const, maxStacks: 1, triggers: [],
      modifiers: [{ stat: 'ataque' as const, operation: 'somar' as const, value: 3 }],
      periodicDamage: null, periodicHealing: null, auraConsumed: null, auraRestored: null,
      attackModifier: 0, defenseModifier: 0, speedModifier: 0, customEffect: null,
    };
    const queimaduraEfeito = {
      ...buffEfeito, id: 'queimadura-1', name: 'Queimadura', modifiers: [],
      periodicDamage: { flat: 2, dice: null },
    };
    const c = ctx({ scope: [alvo({ effects: [{ effect: buffEfeito, stacks: 1 }, { effect: queimaduraEfeito, stacks: 1 }] })] });
    getNodeType('dispersar')!.interpret!({ categoria: 'negativo', quantidade: 1 }, c);
    expect(c.scope[0].effects.map(e => e.effect.id)).toEqual(['buff-1']);
    expect(c.trace.some(t => t.detail?.includes('Queimadura'))).toBe(true);
  });

  it('nó dispersar sem efeitos elegíveis não remove nada e registra no trace', () => {
    const c = ctx({ scope: [alvo({ effects: [] })] });
    getNodeType('dispersar')!.interpret!({ categoria: 'negativo', quantidade: 1 }, c);
    expect(c.scope[0].effects).toEqual([]);
    expect(c.trace.some(t => t.detail?.includes('Nada para remover'))).toBe(true);
  });
});
