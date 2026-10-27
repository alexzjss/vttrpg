import { resolveAbilityGraphAction, type AbilityGraphActionResult } from './abilityGraphAction';
import type { TraceStep } from './abilityInterpreter';
import type { AbilityGraph } from './abilityGraph';
import type { ArsenalActorState } from './arsenalPipeline';

function dummyActor(id: string, teamId: string, name: string): ArsenalActorState {
  return {
    id, teamId, name, currentHp: 50, maxHp: 50, currentAura: 20, maxAura: 20, currentAmmo: 10, maxAmmo: 10,
    defense: 10, speed: 6, tags: [], equippedWeaponIds: [], activeFormIds: [], effects: [], holdings: [],
    isCurrentTurn: teamId === 'A', inCombat: true,
  };
}

export interface SimulateOptions {
  roller?: (notation: string, label?: string) => number;
  actor?: ArsenalActorState;
  targets?: ArsenalActorState[];
}

/** Executa a ação completa do grafo (custo, cooldown, preparação, teste por alvo) contra atores
 * fictícios (ou fornecidos) — mesmo motor da Cena (resolveAbilityGraphAction), não só o walk puro. */
export function simulateAbility(graph: AbilityGraph, level: number, options: SimulateOptions = {}): AbilityGraphActionResult {
  const actor = options.actor ?? dummyActor('sim-actor', 'A', 'Usuário (simulação)');
  const targets = options.targets ?? [dummyActor('sim-target', 'B', 'Alvo (simulação)')];
  return resolveAbilityGraphAction({ graph, level, actor, targets, roller: options.roller });
}

/** Converte o trace em texto passo-a-passo para exibição. */
export function describeTrace(trace: TraceStep[]): string {
  return trace.map((s, i) => `${i + 1}. ${s.detail ?? s.node}`).join('\n');
}
