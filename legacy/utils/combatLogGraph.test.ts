import { describe, it, expect } from 'vitest';
import { buildAbilityGraphCombatLog } from './combatLogGraph';
import { createAbilityGraph } from './abilityGraph';
import type { AbilityGraphActionResult } from './abilityGraphAction';
import type { ArsenalActorState } from './arsenalPipeline';

const actor = (over: Partial<ArsenalActorState> = {}): ArsenalActorState => ({
  id: 'a', teamId: 'A', name: 'Herói', currentHp: 30, maxHp: 30, currentAura: 10, maxAura: 10,
  currentAmmo: 0, maxAmmo: 0, defense: 12, speed: 8, tags: [], equippedWeaponIds: [],
  activeFormIds: [], effects: [], holdings: [], isCurrentTurn: true, inCombat: true, ...over,
});
const target = (over: Partial<ArsenalActorState> = {}): ArsenalActorState => actor({ id: 't', teamId: 'B', name: 'Alvo', isCurrentTurn: false, ...over });

describe('buildAbilityGraphCombatLog', () => {
  it('gera entrada de dano para alvo atingido', () => {
    const graph = createAbilityGraph({ id: 'g', name: 'Golpe' });
    const result: AbilityGraphActionResult = {
      status: 'concluida', actor: actor(), targets: [target({ currentHp: 24 })],
      rolls: {}, hitTargetIds: ['t'], defeatedIds: [], trace: [], fieldEffects: [], ongoingEffectIntents: [],
    };
    const entries = buildAbilityGraphCombatLog({ graph, beforeActor: actor(), beforeTargets: [target()], result });
    expect(entries.some(e => e.kind === 'damage' && e.text.includes('6'))).toBe(true);
  });

  it('gera entrada de "evita" para alvo que errou', () => {
    const graph = createAbilityGraph({ id: 'g', name: 'Golpe' });
    const result: AbilityGraphActionResult = {
      status: 'concluida', actor: actor(), targets: [target()],
      rolls: { test: 3 }, hitTargetIds: [], defeatedIds: [], trace: [], fieldEffects: [], ongoingEffectIntents: [],
    };
    const entries = buildAbilityGraphCombatLog({ graph, beforeActor: actor(), beforeTargets: [target()], result });
    expect(entries.some(e => e.kind === 'system' && e.text.includes('evita'))).toBe(true);
  });

  it('surge a decomposição de dano/cura/teste do trace como linhas de log', () => {
    const graph = createAbilityGraph({ id: 'g', name: 'Golpe' });
    const result: AbilityGraphActionResult = {
      status: 'concluida', actor: actor(), targets: [target({ currentHp: 24 })],
      rolls: {}, hitTargetIds: ['t'], defeatedIds: [], fieldEffects: [], ongoingEffectIntents: [],
      trace: [{ node: 'dano', detail: 'Base: 1d6 · Manto da Tempestade: +1d6 (4) · Final: 10' }],
    };
    const entries = buildAbilityGraphCombatLog({ graph, beforeActor: actor(), beforeTargets: [target()], result });
    expect(entries.some(e => e.text.includes('Manto da Tempestade'))).toBe(true);
  });

  it('gera entrada de rolagem quando há teste de acerto', () => {
    const graph = createAbilityGraph({ id: 'g', name: 'Golpe' });
    const result: AbilityGraphActionResult = {
      status: 'concluida', actor: actor(), targets: [target({ currentHp: 24 })],
      rolls: { test: 15 }, hitTargetIds: ['t'], defeatedIds: [], trace: [], fieldEffects: [], ongoingEffectIntents: [],
    };
    const entries = buildAbilityGraphCombatLog({ graph, beforeActor: actor(), beforeTargets: [target()], result });
    expect(entries.some(e => e.kind === 'roll' && e.text.includes('15'))).toBe(true);
  });
});
