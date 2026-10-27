import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry } from './nodeRegistry';
import { ensureNodesRegistered } from './nodes';
import { buildGraphFromWizard, WIZARD_DEFAULTS } from './abilityWizard';
import { validateAbilityGraph } from './abilityValidate';
import { describeAbilityGraph } from './abilityDescribe';

describe('buildGraphFromWizard', () => {
  beforeEach(() => { _resetRegistry(); ensureNodesRegistered(); });

  it('monta um ataque simples valido a partir dos defaults', () => {
    const graph = buildGraphFromWizard(WIZARD_DEFAULTS);
    expect(graph.nodes.find(n => n.type === 'teste')?.props).toMatchObject({ dice: '1d20' });
    expect(graph.nodes.some(n => n.type === 'dano')).toBe(true);
    expect(validateAbilityGraph(graph).filter(i => i.severity === 'erro')).toEqual([]);
    expect(describeAbilityGraph(graph)).toContain('1d20');
  });

  it('reacao com custo e efeito de condicao gera grafo conectado e valido', () => {
    const graph = buildGraphFromWizard({
      ...WIZARD_DEFAULTS,
      timing: 'reacao',
      targetScope: 'atacante_original',
      hasCost: true, auraCost: 2,
      effectKinds: ['dano', 'condicao'],
      conditionKind: 'Sangrando', conditionRounds: 3,
    });
    expect(graph.nodes.find(n => n.family === 'gatilho')!.type).toBe('ao_ser_alvejado');
    expect(graph.nodes.some(n => n.type === 'custo' && n.props.amount === 2)).toBe(true);
    expect(graph.nodes.some(n => n.type === 'alvo' && n.props.scope === 'atacante_original')).toBe(true);
    expect(graph.nodes.some(n => n.type === 'aplicar_condicao' && n.props.conditionName === 'Sangrando')).toBe(true);
    expect(validateAbilityGraph(graph).filter(i => i.severity === 'erro')).toEqual([]);
  });

  it('buff com duracao habilitada usa as rodadas informadas', () => {
    const graph = buildGraphFromWizard({
      ...WIZARD_DEFAULTS, effectKinds: ['buff'], hasDuration: true, durationRounds: 5, buffStat: 'defesa', buffValue: 3,
    });
    expect(graph.nodes.some(n => n.type === 'buff' && n.props.rounds === 5 && n.props.stat === 'defesa')).toBe(true);
  });

  it('sem gatilho de preparacao quando timing e instantanea', () => {
    const graph = buildGraphFromWizard(WIZARD_DEFAULTS);
    expect(graph.nodes.some(n => n.type === 'preparacao')).toBe(false);
  });

  it('combo habilitado adiciona raiz secundaria em_combo', () => {
    const graph = buildGraphFromWizard({ ...WIZARD_DEFAULTS, comboEnabled: true });
    expect(graph.nodes.some(n => n.type === 'em_combo')).toBe(true);
  });
});
