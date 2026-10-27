import { registerNodeType } from '../nodeRegistry';

export function registerConditionNodes(): void {
  registerNodeType<{ comparacao: 'abaixo' | 'acima'; percent: number }>({
    type: 'se_vida_alvo', family: 'ramo', label: 'SE vida do alvo',
    fields: [
      { key: 'comparacao', kind: 'select', label: 'Comparação', options: [{ value: 'abaixo', label: 'Abaixo de' }, { value: 'acima', label: 'Acima de' }] },
      { key: 'percent', kind: 'numero', label: 'Percentual' },
    ],
    defaults: () => ({ comparacao: 'abaixo', percent: 30 }),
    summarize: p => `Se vida ${p.comparacao === 'abaixo' ? '<' : '>'} ${p.percent}%`,
    evaluate: (p, ctx) => {
      const t = ctx.scope[0];
      if (!t || t.maxHp <= 0) return false;
      const pct = (t.currentHp / t.maxHp) * 100;
      return p.comparacao === 'abaixo' ? pct < p.percent : pct > p.percent;
    },
  });

  registerNodeType<{ conditionName: string }>({
    type: 'se_condicao_ativa', family: 'ramo', label: 'SE condição ativa no alvo',
    fields: [{ key: 'conditionName', kind: 'select', label: 'Condição', options: [
      'Vulnerável', 'Exposto', 'Marcado', 'Sangrando', 'Queimando', 'Congelado', 'Eletrizado',
      'Molhado', 'Enraizado', 'Frágil', 'Silenciado', 'Atordoado', 'Derrubado', 'Cego', 'Amedrontado',
    ].map(k => ({ value: k, label: k })) }],
    defaults: () => ({ conditionName: 'Molhado' }),
    summarize: p => `Se alvo tem ${p.conditionName}`,
    evaluate: (p, ctx) => {
      const t = ctx.scope[0];
      const key = p.conditionName.toLocaleLowerCase('pt-BR');
      return t ? t.effects.some(e => e.effect.name.toLocaleLowerCase('pt-BR') === key) : false;
    },
  });

  registerNodeType<{ amount: number }>({
    type: 'se_aura_minima', family: 'ramo', label: 'SE aura mínima do usuário',
    fields: [{ key: 'amount', kind: 'numero', label: 'Aura mínima' }],
    defaults: () => ({ amount: 3 }),
    summarize: p => `Se aura ≥ ${p.amount}`,
    evaluate: (p, ctx) => ctx.actor.currentAura >= p.amount,
  });

  registerNodeType<{ weaponId: string }>({
    type: 'se_arma_equipada', family: 'ramo', label: 'SE arma equipada',
    fields: [{ key: 'weaponId', kind: 'texto', label: 'ID da arma (vazio = qualquer arma)' }],
    defaults: () => ({ weaponId: '' }),
    summarize: p => p.weaponId ? `Se arma ${p.weaponId} equipada` : 'Se qualquer arma equipada',
    evaluate: (p, ctx) => p.weaponId ? ctx.actor.equippedWeaponIds.includes(p.weaponId) : ctx.actor.equippedWeaponIds.length > 0,
  });

  registerNodeType<{ formId: string }>({
    type: 'se_forma_ativa', family: 'ramo', label: 'SE forma ativa',
    fields: [{ key: 'formId', kind: 'texto', label: 'ID da forma (vazio = qualquer forma)' }],
    defaults: () => ({ formId: '' }),
    summarize: p => p.formId ? `Se forma ${p.formId} ativa` : 'Se qualquer forma ativa',
    evaluate: (p, ctx) => p.formId ? ctx.actor.activeFormIds.includes(p.formId) : ctx.actor.activeFormIds.length > 0,
  });

  registerNodeType<{ element: string }>({
    type: 'se_elemento_carta', family: 'ramo', label: 'SE elemento da carta',
    fields: [{ key: 'element', kind: 'elemento', label: 'Elemento' }],
    defaults: () => ({ element: 'fogo' }),
    summarize: p => `Se elemento da carta é ${p.element}`,
    evaluate: (p, ctx) => ctx.element === p.element,
  });
}
