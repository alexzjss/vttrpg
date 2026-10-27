import { registerNodeType } from '../nodeRegistry';
import { resolveAttackAdjustments, resolveModifiedValue } from '../effectModifiers';
import type { ModifierTestKind } from '../arsenal';

export type TesteComparador = 'defesa_alvo' | 'valor_fixo' | 'aura_alvo' | 'porcentagem';

export interface TesteProps {
  dice: string;
  comparador: TesteComparador;
  valorFixo?: number;
  modificador?: number;
}

const COMPARADOR_LABEL: Record<TesteComparador, string> = {
  defesa_alvo: 'defesa do alvo',
  valor_fixo: 'valor fixo',
  aura_alvo: 'aura do usuário',
  porcentagem: 'chance (%)',
};

export function registerTestNodes(): void {
  registerNodeType<TesteProps>({
    type: 'teste', family: 'ramo', label: 'Teste', category: 'Configuração',
    fields: [
      { key: 'dice', kind: 'dado', label: 'Dado' },
      { key: 'comparador', kind: 'select', label: 'Comparar contra', options: [
        { value: 'defesa_alvo', label: 'Defesa do alvo' },
        { value: 'valor_fixo', label: 'Valor fixo' },
        { value: 'aura_alvo', label: 'Aura do usuário' },
        { value: 'porcentagem', label: 'Chance (%)' },
      ] },
      { key: 'valorFixo', kind: 'numero', label: 'Valor fixo / limiar (%)' },
      { key: 'modificador', kind: 'numero', label: 'Modificador' },
    ],
    defaults: () => ({ dice: '1d20', comparador: 'defesa_alvo', valorFixo: 0, modificador: 0 }),
    summarize: p => `Teste: ${p.comparador === 'porcentagem' ? `${p.valorFixo ?? 0}%` : p.dice} vs. ${COMPARADOR_LABEL[p.comparador]}`,
    evaluate: (p, ctx) => {
      if (p.comparador === 'porcentagem') {
        const roll = ctx.roller('1d100', 'Teste: chance');
        const result = roll <= (p.valorFixo ?? 0);
        ctx.hitTest = result;
        return result;
      }
      const target = ctx.scope[0];
      const testKind: ModifierTestKind | undefined = p.comparador === 'defesa_alvo' ? 'ataque' : p.comparador === 'aura_alvo' ? 'magico' : undefined;
      const rollResult = resolveModifiedValue({
        target: 'teste', baseDice: p.dice, baseFlat: p.modificador ?? 0, holder: ctx.actor,
        ctx: { actor: ctx.actor, other: target, element: ctx.element, cardId: ctx.cardId, cardTags: ctx.cardTags, context: ctx.context, testKind },
        roller: ctx.roller, label: 'Teste',
      });
      let threshold = p.valorFixo ?? 0;
      let attackAdjustment = { attackerBonus: 0, defensePierce: 0, fearPenalty: 0, steps: [] as string[] };
      if (p.comparador === 'defesa_alvo' && target) {
        threshold = resolveModifiedValue({
          target: 'defesa', baseFlat: target.defense, holder: target,
          ctx: { actor: target, other: ctx.actor, element: ctx.element, cardId: ctx.cardId, cardTags: ctx.cardTags, context: ctx.context },
          roller: ctx.roller, label: 'Defesa',
        }).total + (ctx.defenseBonus ?? 0);
        attackAdjustment = resolveAttackAdjustments(ctx.actor, target);
        threshold -= attackAdjustment.defensePierce;
      } else if (p.comparador === 'aura_alvo') {
        threshold = ctx.actor.currentAura;
      }
      const effectiveRoll = rollResult.total + attackAdjustment.attackerBonus - attackAdjustment.fearPenalty;
      const result = effectiveRoll >= threshold;
      const breakdown = [...rollResult.steps, ...attackAdjustment.steps].join(' · ');
      ctx.trace.push({ node: 'teste', detail: `${breakdown} vs. ${COMPARADOR_LABEL[p.comparador]} (${threshold})` });
      ctx.hitTest = result;
      return result;
    },
  });
}
