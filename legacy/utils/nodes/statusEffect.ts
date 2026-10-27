import type { ArsenalEffect } from '../arsenal';

/** Fábrica DRY de ArsenalEffect para nós que só concedem um status temporário por N rodadas. */
export function createStatusEffect(overrides: Partial<ArsenalEffect> & { name: string; rounds: number }): ArsenalEffect {
  const { rounds, ...rest } = overrides;
  return {
    id: `status-${rest.name}-${crypto.randomUUID()}`,
    name: rest.name,
    description: '',
    tags: [],
    duration: { type: 'rodadas', amount: rounds },
    stackBehavior: 'renova_duracao',
    maxStacks: 1,
    triggers: [],
    modifiers: [],
    periodicDamage: null,
    periodicHealing: null,
    auraConsumed: null,
    auraRestored: null,
    attackModifier: 0,
    defenseModifier: 0,
    speedModifier: 0,
    customEffect: null,
    ...rest,
  };
}
