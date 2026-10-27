import { registerNodeType } from '../nodeRegistry';
import { applyCondition } from '../abilityPrimitives';
import { createStatusEffect } from './statusEffect';

export function registerDefenseNodes(): void {
  registerNodeType<{ percent: number; rounds: number }>({
    type: 'roubo_vida', family: 'efeito', label: 'Roubo de vida', category: 'Defesa',
    fields: [{ key: 'percent', kind: 'numero', label: 'Percentual' }, { key: 'rounds', kind: 'numero', label: 'Rodadas' }],
    defaults: () => ({ percent: 20, rounds: 3 }),
    summarize: p => `Roubo de vida ${p.percent}% por ${p.rounds} rod.`,
    interpret: (p, ctx) => {
      const effect = createStatusEffect({ name: 'roubo-vida', rounds: p.rounds, lifeSteal: p.percent });
      ctx.scope = ctx.scope.map(target => applyCondition(target, effect, ctx.roller));
      ctx.trace.push({ node: 'roubo_vida', detail: `${p.percent}% por ${p.rounds} rodadas` });
      ctx.commit?.();
    },
  });

  registerNodeType<{ dice?: string; flat: number }>({
    type: 'esquiva', family: 'efeito', label: 'Esquiva', category: 'Defesa',
    fields: [{ key: 'dice', kind: 'dado', label: 'Dado' }, { key: 'flat', kind: 'numero', label: 'Fixo' }],
    defaults: () => ({ dice: '1d8', flat: 0 }),
    summarize: p => `Esquiva ${p.dice ?? ''}+${p.flat}`.trim(),
    interpret: (p, ctx) => {
      const amount = (p.dice ? ctx.roller(p.dice, 'Esquiva') : 0) + p.flat;
      ctx.defenseRollOverride = amount;
      ctx.trace.push({ node: 'esquiva', detail: `Bônus de esquiva de ${amount}` });
    },
  });
}
