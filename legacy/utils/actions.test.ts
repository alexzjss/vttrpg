import { describe, it, expect } from 'vitest';
import { normalizeCard, normalizeSeal, normalizeWeapon, normalizeItem, normalizeAbilityGraph, actorActions, GUARD_ACTION, resetVitals } from './actions';
import type { Card, Seal, Weapon } from '../types';
import type { ResolvedItem } from './items';
import { createAbilityGraph, type AbilityGraph } from './abilityGraph';

const card = (over: Partial<Card> = {}): Card => ({ id: 'c1', name: 'Golpe', image: '', auraCost: 2, type: 'ataque', description: '', ...over });
const seal = (over: Partial<Seal> = {}): Seal => ({ id: 's1', name: 'Selo', code: '', image: '', description: '', ...over });
const weapon = (over: Partial<Weapon> = {}): Weapon => ({ id: 'w1', name: 'Espada', description: '', image: '', ...over });
const item = (over: Partial<ResolvedItem> = {}): ResolvedItem => ({ id: 'i1', name: 'Poção', description: '', image: '', quantity: 1, ...over });

describe('normalizeCard', () => {
  it('ataque → categoria atacar; mapeia dano e custo', () => {
    const a = normalizeCard(card({ type: 'ataque', damage: 7, damageType: 'fogo', auraCost: 3, diceRoll: '1d20+2' }));
    expect(a.category).toBe('atacar');
    expect(a).toMatchObject({ source: 'card', damage: 7, damageType: 'fogo', auraCost: 3, diceRoll: '1d20+2', targeting: 'other' });
  });
  it('forma sem dano e outros tipos → habilidade', () => {
    expect(normalizeCard(card({ type: 'forma' })).category).toBe('habilidade');
    expect(normalizeCard(card({ type: 'reforço' })).category).toBe('habilidade');
  });
  it('qualquer habilidade com dano → atacar', () => {
    expect(normalizeCard(card({ type: 'reforço', damage: 3 })).category).toBe('atacar');
    expect(normalizeSeal(seal({ damage: 4 })).category).toBe('atacar');
  });
  it('diceRoll default 1d20', () => {
    expect(normalizeCard(card({ diceRoll: undefined })).diceRoll).toBe('1d20');
  });
});

describe('normalizeSeal', () => {
  it('cura sem dano → targeting self', () => {
    const a = normalizeSeal(seal({ healHp: 5, cost: { aura: 1 } }));
    expect(a.targeting).toBe('self');
    expect(a).toMatchObject({ source: 'seal', category: 'habilidade', healHp: 5, auraCost: 1 });
  });
  it('com dano → targeting other', () => {
    expect(normalizeSeal(seal({ damage: 4 })).targeting).toBe('other');
  });
});

describe('normalizeWeapon / normalizeItem', () => {
  it('arma usa combat* com fallback', () => {
    const a = normalizeWeapon(weapon({ combatDamage: 6, combatDiceRoll: '1d20+1' }));
    expect(a).toMatchObject({ source: 'weapon', category: 'atacar', damage: 6, diceRoll: '1d20+1', targeting: 'other' });
  });
  it('item de cura → self; categoria item', () => {
    const a = normalizeItem(item({ combatHeal: 8 }));
    expect(a).toMatchObject({ source: 'item', category: 'item', healHp: 8, targeting: 'self' });
  });
});

describe('normalizeCard / normalizeWeapon / normalizeItem — imagem', () => {
  it('normalizeCard propaga card.image', () => {
    expect(normalizeCard(card({ image: 'https://x/card.png' })).image).toBe('https://x/card.png');
  });
  it('normalizeWeapon propaga w.image', () => {
    expect(normalizeWeapon(weapon({ image: 'https://x/weapon.png' })).image).toBe('https://x/weapon.png');
  });
  it('normalizeItem propaga i.image', () => {
    expect(normalizeItem(item({ image: 'https://x/item.png' })).image).toBe('https://x/item.png');
  });
  it('normalizeSeal propaga seal.image', () => {
    expect(normalizeSeal(seal({ image: 'https://x/seal.png' })).image).toBe('https://x/seal.png');
  });
});

describe('actorActions', () => {
  it('agrupa por categoria e inclui formas e GUARDA em habilidades', () => {
    const groups = actorActions({
      cards: [card({ type: 'ataque' }), card({ id: 'c2', type: 'forma' })],
      seals: [seal()],
      weapons: [weapon()],
      items: [item({ usableInCombat: true })],
    });
    expect(groups.atacar.map(a => a.source).sort()).toEqual(['card', 'weapon']);
    expect(groups.habilidade.map(a => a.source)).toEqual(['guard', 'card', 'seal']);
    expect(groups.item).toHaveLength(1);
    expect(groups.habilidade).toContain(GUARD_ACTION);
  });
  it('ignora itens não usáveis em combate', () => {
    const groups = actorActions({ cards: [], seals: [], weapons: [], items: [item({ usableInCombat: false })] });
    expect(groups.item).toHaveLength(0);
  });
  it('inclui habilidades-grafo na categoria correta', () => {
    const groups = actorActions({
      cards: [], seals: [], weapons: [], items: [],
      abilityGraphs: [{ graph: danoGraph(), level: 1 }],
    });
    expect(groups.atacar.map(a => a.source)).toEqual(['arsenal']);
    expect(groups.atacar[0].abilityGraph?.id).toBe('g1');
  });
});

import { applyStatDelta, computeResolution, type StatSnapshot, type ResolvedAction as RA } from './actions';
import { normalizeArsenalCard } from './actions';
import { createArsenalCard } from './arsenal';

describe('normalizeArsenalCard — imagem', () => {
  it('propaga card.icon como image', () => {
    const a = normalizeArsenalCard(createArsenalCard({ id: 'a1', name: 'Lâmina', category: 'habilidade', icon: 'https://x/icon.png' }));
    expect(a.image).toBe('https://x/icon.png');
  });
  it('manda dano direto ou periódico para ataques e forma sem dano para habilidades', () => {
    expect(normalizeArsenalCard(createArsenalCard({ id: 'hit', damage: { flat: 4 } })).category).toBe('atacar');
    expect(normalizeArsenalCard(createArsenalCard({ id: 'dot', extraDamageDice: '1d4' })).category).toBe('atacar');
    expect(normalizeArsenalCard(createArsenalCard({ id: 'form', abilityType: 'forma' })).category).toBe('habilidade');
  });
});

function danoGraph(over: Partial<AbilityGraph['header']> = {}): AbilityGraph {
  return {
    ...createAbilityGraph({ id: 'g1', name: 'Golpe Solar', ...over }),
    nodes: [
      { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
      { id: 'd', type: 'dano', family: 'efeito', props: { dice: '1d6', flat: 0, element: 'fogo' } },
    ],
    edges: [{ id: 'e1', from: 'g', to: 'd' }],
  };
}

describe('normalizeAbilityGraph', () => {
  it('grafo com nó de dano alcançável → categoria atacar', () => {
    const a = normalizeAbilityGraph(danoGraph(), 1);
    expect(a).toMatchObject({ source: 'arsenal', category: 'atacar', name: 'Golpe Solar', targeting: 'other' });
    expect(a.abilityGraph?.id).toBe('g1');
    expect(a.abilityGraphLevel).toBe(1);
  });

  it('grafo sem nó de dano → categoria habilidade', () => {
    const graph: AbilityGraph = {
      ...createAbilityGraph({ id: 'g2', name: 'Cura' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
        { id: 'c', type: 'cura', family: 'efeito', props: { dice: '1d4', flat: 0 } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'c' }],
    };
    expect(normalizeAbilityGraph(graph, 1).category).toBe('habilidade');
  });

  it('alvo próprio_usuário → targeting self', () => {
    const graph: AbilityGraph = { ...danoGraph(), header: { ...danoGraph().header, target: { type: 'proprio_usuario' } } };
    expect(normalizeAbilityGraph(graph, 1).targeting).toBe('self');
  });
});

const snap = (over: Partial<StatSnapshot> = {}): StatSnapshot => ({
  currentHp: 20, maxHp: 20, currentAura: 10, maxAura: 10, currentAmmo: 5, maxAmmo: 5, defense: 12, conditions: [], ...over,
});
const atk = (over: Partial<RA> = {}): RA => ({ source: 'card', id: 'a', name: 'Golpe', category: 'atacar', diceRoll: '1d20', targeting: 'other', damage: 6, ...over });

describe('applyStatDelta', () => {
  it('clampa HP/Aura/Ammo em [0,max]', () => {
    expect(applyStatDelta(snap({ currentHp: 5 }), { hp: -9 })).toMatchObject({ currentHp: 0 });
    expect(applyStatDelta(snap({ currentHp: 18 }), { hp: 9 })).toMatchObject({ currentHp: 20 });
    expect(applyStatDelta(snap({ currentAura: 2 }), { aura: -5 })).toMatchObject({ currentAura: 0 });
  });
});

describe('computeResolution', () => {
  it('acerto (total ≥ defesa) aplica dano e desconta custo', () => {
    const r = computeResolution('A', snap({ currentAura: 10 }), 'B', snap({ defense: 12 }), atk({ damage: 6, auraCost: 2 }), 15);
    expect(r.success).toBe(true);
    expect(r.targetDelta.hp).toBe(-6);
    expect(r.actorDelta.aura).toBe(-2);
    expect(r.log.length).toBeGreaterThanOrEqual(2);
  });
  it('erro (total < defesa) não aplica dano, mas desconta custo', () => {
    const r = computeResolution('A', snap(), 'B', snap({ defense: 18 }), atk({ damage: 6, auraCost: 2 }), 10);
    expect(r.success).toBe(false);
    expect(r.targetDelta.hp).toBeUndefined();
    expect(r.actorDelta.aura).toBe(-2);
  });
  it('cura (self) sempre sucede e cura HP/Aura', () => {
    const r = computeResolution('A', snap(), 'A', snap(), atk({ source: 'seal', damage: undefined, healHp: 5, targeting: 'self' }), 1);
    expect(r.success).toBe(true);
    expect(r.targetDelta.hp).toBe(5);
  });
  it('bloqueia se faltar aura', () => {
    const r = computeResolution('A', snap({ currentAura: 1 }), 'B', snap(), atk({ auraCost: 3 }), 20);
    expect(r.blocked).toBeTruthy();
    expect(r.actorDelta).toEqual({});
  });
  it('aplica condição no sucesso', () => {
    const r = computeResolution('A', snap(), 'B', snap({ defense: 5 }), atk({ conditionName: 'Queimando', conditionDuration: 3 }), 20);
    expect(r.conditionApplied).toEqual({ name: 'Queimando', duration: 3 });
  });
  it('anexa a comparação estruturada à entrada de rolagem', () => {
    const rolled = { total: 12, dieRoll: 10, bonus: 2, notation: '1d20+2', individualRolls: [10], numSides: 20, numDice: 1 };
    const r = computeResolution('A', snap(), 'B', snap({ defense: 12 }), atk(), rolled.total, rolled);
    expect(r.log[0].roll).toMatchObject({ total: 12, targetValue: 12, actorLabel: 'A', targetLabel: 'B', success: true });
  });
});

describe('resetVitals', () => {
  it('restaura HP/Aura/Munição ao máximo e limpa condições/efeitos ativos', () => {
    const character: any = {
      maxHp: 20, currentHp: 3, maxAura: 10, currentAura: 1, maxAmmo: 4, currentAmmo: 0,
      conditions: [{ name: 'Queimando', duration: 2 }],
      activeEffects: [{ effect: { name: 'Queimadura' }, stacks: 1, remaining: 2 }],
    };
    expect(resetVitals(character)).toMatchObject({
      currentHp: 20, currentAura: 10, currentAmmo: 4, conditions: [], activeEffects: [],
    });
  });

  it('restaura a Defesa ao máximo e o Stagger ao mínimo, limpando quebra e atordoamento', () => {
    const character: any = {
      maxHp: 20, currentHp: 3, maxAura: 10, currentAura: 1, maxAmmo: 4, currentAmmo: 0,
      conditions: [], activeEffects: [],
      defenseMax: 20, defenseCurrent: 0, staggerMax: 100, staggerCurrent: 100,
      isDefenseBroken: true, isStaggered: true, staggerTurnsRemaining: 1,
    };
    expect(resetVitals(character)).toMatchObject({
      defenseCurrent: 20, staggerCurrent: 0, isDefenseBroken: false, isStaggered: false, staggerTurnsRemaining: 0,
    });
  });

  it('não mexe em maxHp/maxAura/maxAmmo', () => {
    const character: any = { maxHp: 20, currentHp: 20, maxAura: 10, currentAura: 10, maxAmmo: 4, currentAmmo: 4, conditions: [], activeEffects: [] };
    const result: any = resetVitals(character);
    expect(result.maxHp).toBeUndefined();
    expect(result.maxAura).toBeUndefined();
    expect(result.maxAmmo).toBeUndefined();
  });
});
