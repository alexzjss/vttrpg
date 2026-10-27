import { describe, it, expect, beforeEach } from 'vitest';
import { interpretAbility } from './abilityInterpreter';
import { _resetRegistry } from './nodeRegistry';
import { registerCoreNodes } from './nodes/coreNodes';
import { registerConditionNodes } from './nodes/conditionNodes';
import { registerControlNodes } from './nodes/controlNodes';
import { registerDefenseNodes } from './nodes/defenseNodes';
import { createAbilityGraph, type AbilityGraph } from './abilityGraph';
import type { ArsenalActorState } from './arsenalPipeline';

const actor = (over: Partial<ArsenalActorState> = {}): ArsenalActorState => ({
  id: 'a', teamId: 'A', name: 'Herói', currentHp: 40, maxHp: 40, currentAura: 10, maxAura: 10,
  currentAmmo: 0, maxAmmo: 0, defense: 12, speed: 8, tags: [], equippedWeaponIds: [],
  activeFormIds: [], effects: [], holdings: [], isCurrentTurn: true, inCombat: true, ...over,
});
const enemy = (over: Partial<ArsenalActorState> = {}): ArsenalActorState => actor({ id: 'e', teamId: 'B', name: 'Inimigo', currentHp: 30, maxHp: 30, isCurrentTurn: false, ...over });

function graphSequencial(): AbilityGraph {
  return {
    ...createAbilityGraph({ id: 'g1', name: 'Golpe' }),
    nodes: [
      { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
      { id: 'd', type: 'dano', family: 'efeito', props: { dice: '1d6', flat: 0, element: 'fisico' } },
    ],
    edges: [{ id: 'e1', from: 'g', to: 'd' }],
  };
}

describe('interpretAbility', () => {
  beforeEach(() => { _resetRegistry(); registerCoreNodes(); registerConditionNodes(); });

  it('executa efeitos em sequência a partir da raiz-gatilho', () => {
    const res = interpretAbility(graphSequencial(), 1, {
      actor: actor(), primaryTargets: [enemy()], allTargets: [actor(), enemy()], roller: () => 5,
    });
    const alvo = res.targets.find(t => t.id === 'e')!;
    expect(alvo.currentHp).toBe(25);
    expect(res.trace.length).toBeGreaterThan(0);
  });

  it('ramifica: SE vida do alvo < 50% cura o próprio; SENÃO causa dano', () => {
    const g: AbilityGraph = {
      ...createAbilityGraph({ id: 'g2', name: 'Adaptável' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
        { id: 'r', type: 'se_vida_alvo', family: 'ramo', props: { comparacao: 'abaixo', percent: 50 } },
        { id: 'self', type: 'alvo', family: 'alvo', props: { scope: 'proprio' } },
        { id: 'cura', type: 'cura', family: 'efeito', props: { dice: undefined, flat: 10 } },
        { id: 'dano', type: 'dano', family: 'efeito', props: { dice: undefined, flat: 8, element: 'fisico' } },
      ],
      edges: [
        { id: 'e1', from: 'g', to: 'r' },
        { id: 'e2', from: 'r', to: 'self', branch: 'entao' },
        { id: 'e3', from: 'self', to: 'cura' },
        { id: 'e4', from: 'r', to: 'dano', branch: 'senao' },
      ],
    };
    // alvo com vida cheia → SENÃO (dano)
    const alto = interpretAbility(g, 1, { actor: actor({ currentHp: 20 }), primaryTargets: [enemy({ currentHp: 30 })], allTargets: [], roller: () => 0 });
    expect(alto.targets.find(t => t.id === 'e')!.currentHp).toBe(22);
    // alvo ferido → ENTÃO (cura no próprio)
    const baixo = interpretAbility(g, 1, { actor: actor({ currentHp: 20 }), primaryTargets: [enemy({ currentHp: 5 })], allTargets: [], roller: () => 0 });
    expect(baixo.actor.currentHp).toBe(30);
  });

  it('descobre a raiz estruturalmente (nó sem arestas de entrada), não por família/tipo', () => {
    const g: AbilityGraph = {
      ...createAbilityGraph({ id: 'g3', name: 'Estrutural' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
        { id: 'd', type: 'dano', family: 'efeito', props: { dice: undefined, flat: 4, element: 'fisico' } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'd' }],
    };
    const res = interpretAbility(g, 1, { actor: actor(), primaryTargets: [enemy()], allTargets: [actor(), enemy()], roller: () => 0 });
    expect(res.targets.find(t => t.id === 'e')!.currentHp).toBe(26);
  });

  it('com entryNodeIds explícito, inicia o walk a partir dos nós indicados (ignorando a raiz estrutural)', () => {
    const g: AbilityGraph = {
      ...createAbilityGraph({ id: 'g4', name: 'Entrada explícita' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
        { id: 'd1', type: 'dano', family: 'efeito', props: { dice: undefined, flat: 4, element: 'fisico' } },
        { id: 'evt', type: 'enquanto_ativa', family: 'gatilho', props: {} },
        { id: 'd2', type: 'dano', family: 'efeito', props: { dice: undefined, flat: 9, element: 'fisico' } },
      ],
      edges: [
        { id: 'e1', from: 'g', to: 'd1' },
        { id: 'e2', from: 'd1', to: 'evt' },
        { id: 'e3', from: 'evt', to: 'd2' },
      ],
    };
    const res = interpretAbility(g, 1, { actor: actor(), primaryTargets: [enemy()], allTargets: [actor(), enemy()], roller: () => 0 }, { entryNodeIds: ['evt'] });
    // só o dano do nó 'd2' (pendurado sob 'evt') deve ter rodado, não o 'd1' da raiz principal
    expect(res.targets.find(t => t.id === 'e')!.currentHp).toBe(21);
  });

  it('um trigger alcançado como filho (não como entrada) registra reação pendente em vez de executar', () => {
    const g: AbilityGraph = {
      ...createAbilityGraph({ id: 'g5', name: 'Reação encadeada' }),
      nodes: [
        { id: 'enquanto', type: 'enquanto_ativa', family: 'gatilho', props: {} },
        { id: 'alvejado', type: 'ao_ser_alvejado', family: 'gatilho', props: {} },
        { id: 'd', type: 'dano', family: 'efeito', props: { dice: undefined, flat: 7, element: 'fisico' } },
      ],
      edges: [
        { id: 'e1', from: 'enquanto', to: 'alvejado' },
        { id: 'e2', from: 'alvejado', to: 'd' },
      ],
    };
    const res = interpretAbility(g, 1, { actor: actor(), primaryTargets: [enemy()], allTargets: [actor(), enemy()], roller: () => 0 }, { entryNodeIds: ['enquanto'] });
    expect(res.targets.find(t => t.id === 'e')!.currentHp).toBe(30); // dano NÃO aplicado ainda
    expect(res.pendingReactions).toEqual([{ eventType: 'ao_ser_alvejado', nodeIds: ['d'] }]);
  });

  it('propaga movementIntents registrados pelo nó mover até o retorno', () => {
    _resetRegistry(); registerCoreNodes(); registerConditionNodes(); registerControlNodes();
    const g: AbilityGraph = {
      ...createAbilityGraph({ id: 'g7', name: 'Empurrão' }),
      nodes: [
        { id: 'gt', type: 'ao_ativar', family: 'gatilho', props: {} },
        { id: 'm', type: 'mover', family: 'efeito', props: { kind: 'empurrar', distance: 2 } },
      ],
      edges: [{ id: 'e1', from: 'gt', to: 'm' }],
    };
    const res = interpretAbility(g, 1, { actor: actor(), primaryTargets: [enemy()], allTargets: [actor(), enemy()], roller: () => 0 });
    expect(res.movementIntents).toEqual([{ targetId: 'e', kind: 'empurrar', distance: 2 }]);
  });

  it('propaga defenseRollOverride registrado pelo nó esquiva até o retorno', () => {
    _resetRegistry(); registerCoreNodes(); registerConditionNodes(); registerDefenseNodes();
    const g: AbilityGraph = {
      ...createAbilityGraph({ id: 'g8', name: 'Esquiva' }),
      nodes: [
        { id: 'gt', type: 'ao_ser_alvejado', family: 'gatilho', props: {} },
        { id: 'e', type: 'esquiva', family: 'efeito', props: { dice: undefined, flat: 5 } },
      ],
      edges: [{ id: 'e1', from: 'gt', to: 'e' }],
    };
    const res = interpretAbility(g, 1, { actor: actor(), primaryTargets: [actor()], allTargets: [actor()], roller: () => 0 });
    expect(res.defenseRollOverride).toBe(5);
  });

  it('propaga input.areaTargets para o nó alvo geométrico e aplica efeitos corretamente', () => {
    _resetRegistry(); registerCoreNodes(); registerConditionNodes(); registerControlNodes();
    const g: AbilityGraph = {
      ...createAbilityGraph({ id: 'g9', name: 'Explosão' }),
      nodes: [
        { id: 'gt', type: 'ao_ativar', family: 'gatilho', props: {} },
        { id: 'a', type: 'alvo', family: 'alvo', props: { scope: 'raio' } },
        { id: 'd', type: 'dano', family: 'efeito', props: { dice: undefined, flat: 5, element: 'fisico' } },
      ],
      edges: [{ id: 'e1', from: 'gt', to: 'a' }, { id: 'e2', from: 'a', to: 'd' }],
    };
    const hit = enemy({ id: 'hit', currentHp: 30 });
    const res = interpretAbility(g, 1, {
      actor: actor(), primaryTargets: [], allTargets: [actor()], areaTargets: [hit], roller: () => 0,
    });
    expect(res.targets.find(t => t.id === 'hit')!.currentHp).toBe(25);
  });

  it('o mesmo trigger, quando é o próprio ponto de entrada, executa normalmente', () => {
    const g: AbilityGraph = {
      ...createAbilityGraph({ id: 'g6', name: 'Reação direta' }),
      nodes: [
        { id: 'alvejado', type: 'ao_ser_alvejado', family: 'gatilho', props: {} },
        { id: 'd', type: 'dano', family: 'efeito', props: { dice: undefined, flat: 7, element: 'fisico' } },
      ],
      edges: [{ id: 'e1', from: 'alvejado', to: 'd' }],
    };
    const res = interpretAbility(g, 1, { actor: actor(), primaryTargets: [enemy()], allTargets: [actor(), enemy()], roller: () => 0 });
    expect(res.targets.find(t => t.id === 'e')!.currentHp).toBe(23);
    expect(res.pendingReactions ?? []).toEqual([]);
  });
});
