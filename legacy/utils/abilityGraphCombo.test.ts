import { describe, it, expect } from 'vitest';
import { createAbilityGraph, type AbilityGraph } from './abilityGraph';
import { graphComboStackCandidates, resolveGraphComboSelection } from './abilityGraphCombo';

function comboGraph(id: string, stackKey: string, maxStacks: number): AbilityGraph {
  const base = createAbilityGraph({ id, name: id });
  return { ...base, nodes: [...base.nodes, { id: `combo-${id}`, type: 'em_combo', family: 'gatilho', props: { stackKey, maxStacks } }] };
}

describe('graphComboStackCandidates', () => {
  it('lista outras habilidades do mesmo stackKey, excluindo a própria', () => {
    const base = comboGraph('base', 'fogo', 3);
    const catalog = [base, comboGraph('b', 'fogo', 3), comboGraph('c', 'agua', 2)];
    const candidates = graphComboStackCandidates(base, catalog);
    expect(candidates.map(g => g.id)).toEqual(['b']);
  });

  it('respeita availableIds quando informado', () => {
    const base = comboGraph('base', 'fogo', 3);
    const catalog = [base, comboGraph('b', 'fogo', 3), comboGraph('c', 'fogo', 3)];
    const candidates = graphComboStackCandidates(base, catalog, ['c']);
    expect(candidates.map(g => g.id)).toEqual(['c']);
  });

  it('grafo sem combo não tem candidatos', () => {
    const base = createAbilityGraph({ id: 'no-combo', name: 'X' });
    expect(graphComboStackCandidates(base, [comboGraph('b', 'fogo', 3)])).toEqual([]);
  });
});

describe('resolveGraphComboSelection', () => {
  it('retorna as habilidades selecionadas até o limite de maxStacks-1 companheiras', () => {
    const base = comboGraph('base', 'fogo', 3);
    const catalog = [base, comboGraph('b', 'fogo', 3), comboGraph('c', 'fogo', 3), comboGraph('d', 'fogo', 3)];
    const selected = resolveGraphComboSelection(base, ['b', 'c', 'd'], catalog);
    expect(selected).toEqual([]); // 3 selecionadas > maxCompanions (2)
  });

  it('aceita seleção dentro do limite', () => {
    const base = comboGraph('base', 'fogo', 3);
    const catalog = [base, comboGraph('b', 'fogo', 3), comboGraph('c', 'fogo', 3)];
    const selected = resolveGraphComboSelection(base, ['b', 'c'], catalog);
    expect(selected.map(g => g.id)).toEqual(['b', 'c']);
  });

  it('ignora ids fora do stackKey', () => {
    const base = comboGraph('base', 'fogo', 3);
    const catalog = [base, comboGraph('b', 'agua', 3)];
    expect(resolveGraphComboSelection(base, ['b'], catalog)).toEqual([]);
  });
});
