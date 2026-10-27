import type { ArsenalEffect, EffectDuration } from './arsenal';
import { CONDITION_KINDS, CONDITION_NAMES, buildConditionEffect, conditionKindByName } from './conditionPresets';

interface AdvancedSeed {
  name: string;
  description: string;
  tags: string[];
  duration: EffectDuration;
  overrides: Partial<ArsenalEffect>;
}

/** Presets que usam os poderes avançados (controle, defesa, suporte, especiais) não ligados às 15 condições base. */
const advancedSeeds: AdvancedSeed[] = [
  { name: 'Provocado', description: 'Força os inimigos a mirarem o portador enquanto durar.', tags: ['controle', 'defensivo'],
    duration: { type: 'rodadas', amount: 2 }, overrides: { taunt: true } },
  { name: 'Camuflado', description: 'Torna o portador indetectável; quebra ao agir ou sofrer dano.', tags: ['controle', 'buff'],
    duration: { type: 'rodadas', amount: 2 }, overrides: { invisibility: { breaksOnAction: true, breaksOnDamage: true } } },
  { name: 'Arremesso', description: 'Empurra o alvo 2 células para longe do usuário.', tags: ['controle', 'interacao'],
    duration: { type: 'usos', amount: 1 }, overrides: { movement: { kind: 'empurrar', distance: 2 } } },

  { name: 'Escudo Menor', description: 'Concede uma barreira que absorve dano antes da vitalidade.', tags: ['defensivo', 'buff'],
    duration: { type: 'rodadas', amount: 3 }, overrides: { shield: { flat: 8, dice: null } } },
  { name: 'Escudo Maior', description: 'Concede uma barreira robusta que absorve dano antes da vitalidade.', tags: ['defensivo', 'buff'],
    duration: { type: 'rodadas', amount: 3 }, overrides: { shield: { flat: 15, dice: '1d6' } } },
  { name: 'Purificação', description: 'Remove os 2 efeitos negativos mais recentes do alvo.', tags: ['defensivo', 'interacao'],
    duration: { type: 'usos', amount: 1 }, overrides: { dispel: { category: 'negativo', count: 2 } } },

  { name: 'Ímpeto', description: 'Concede uma ação extra imediata.', tags: ['suporte', 'buff'],
    duration: { type: 'usos', amount: 1 }, overrides: { extraActions: { kind: 'acao', amount: 1 } } },
  { name: 'Fluxo Ampliado', description: 'Restaura 3 pontos de aura ao portador.', tags: ['suporte', 'buff'],
    duration: { type: 'usos', amount: 1 }, overrides: { resourceGeneration: { resource: 'aura', amount: 3 } } },
  { name: 'Recarga Tática', description: 'Concede 1 carga extra de habilidade ao portador.', tags: ['suporte', 'buff'],
    duration: { type: 'usos', amount: 1 }, overrides: { resourceGeneration: { resource: 'carga', amount: 1 } } },
  { name: 'Bênção Econômica', description: 'Reduz o custo de aura e o cooldown de outras cartas enquanto durar.', tags: ['suporte', 'buff'],
    duration: { type: 'rodadas', amount: 2 }, overrides: { costReduction: { auraDelta: -2, cooldownTurnsDelta: -1 } } },

  { name: 'Elo Espectral', description: 'Invoca um aliado temporário para lutar ao lado do portador.', tags: ['especial', 'interacao'],
    duration: { type: 'rodadas', amount: 3 }, overrides: { summon: { entityId: '', duration: { type: 'rodadas', amount: 3 } } } },
  { name: 'Metamorfose', description: 'Transforma o portador em outra forma enquanto durar.', tags: ['especial', 'interacao'],
    duration: { type: 'ate_removido', amount: 0 }, overrides: { transform: { intoFormId: '' } } },
  { name: 'Fio da Vida', description: 'Ressuscita o portador com uma fração da vitalidade ao ser derrotado.', tags: ['especial', 'buff'],
    duration: { type: 'permanente', amount: 0 }, overrides: { revive: { hpPercent: 25, usesLeft: 1 } } },
  { name: 'Corrente Ressonante', description: 'Ricocheteia o efeito de origem para até 2 alvos adicionais, com atenuação por salto.', tags: ['especial', 'interacao'],
    duration: { type: 'usos', amount: 1 }, overrides: { chain: { maxBounces: 2, falloffPercent: 25 } } },
  { name: 'Sorte Selvagem', description: 'Sorteia um efeito dentre uma tabela configurável ao ser aplicado.', tags: ['especial', 'aleatorio'],
    duration: { type: 'usos', amount: 1 }, overrides: { randomTable: [] } },
];

function slug(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function makeAdvanced(seed: AdvancedSeed): ArsenalEffect {
  return {
    id: `preset-${slug(seed.name)}`, name: seed.name, description: seed.description, tags: seed.tags,
    duration: seed.duration, stackBehavior: 'renova_duracao', maxStacks: 1,
    triggers: [], modifiers: [], periodicDamage: null, periodicHealing: null, auraConsumed: null, auraRestored: null,
    attackModifier: 0, defenseModifier: 0, speedModifier: 0, customEffect: null,
    ...seed.overrides,
  };
}

/** As 15 condições base (intensidade normal) + os presets de poderes avançados. */
export const PREDEFINED_ARSENAL_EFFECTS: readonly ArsenalEffect[] = Object.freeze([
  ...CONDITION_KINDS.map(kind => buildConditionEffect(kind, 'normal')),
  ...advancedSeeds.map(makeAdvanced),
]);

export function getPredefinedEffect(idOrName: string): ArsenalEffect | undefined {
  const conditionKind = conditionKindByName(idOrName);
  if (conditionKind) return buildConditionEffect(conditionKind, 'normal');
  const normalized = idOrName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
  const key = normalized;
  const found = PREDEFINED_ARSENAL_EFFECTS.find(effect => effect.id === idOrName || effect.name.toLocaleLowerCase('pt-BR') === key);
  return found ? structuredClone(found) : undefined;
}

export { CONDITION_NAMES };
