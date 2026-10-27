import type { AbilityGraph } from './abilityGraph';
import { graphComboConfig } from './abilityGraphAction';

/** Outras habilidades-grafo do mesmo stackKey do combo (nível 1), disponíveis para empilhar. */
export function graphComboStackCandidates(base: AbilityGraph, catalog: readonly AbilityGraph[], availableIds?: readonly string[]): AbilityGraph[] {
  const baseCombo = graphComboConfig(base, 1);
  if (!baseCombo) return [];
  const available = availableIds ? new Set(availableIds) : null;
  return catalog.filter(graph => graph.id !== base.id
    && graphComboConfig(graph, 1)?.stackKey === baseCombo.stackKey
    && (!available || available.has(graph.id)));
}

/** Resolve a seleção de companheiras para o combo, vazio se exceder maxStacks-1. */
export function resolveGraphComboSelection(base: AbilityGraph, selectedIds: readonly string[], catalog: readonly AbilityGraph[], availableIds?: readonly string[]): AbilityGraph[] {
  const baseCombo = graphComboConfig(base, 1);
  if (!baseCombo) return [];
  const candidates = new Set(graphComboStackCandidates(base, catalog, availableIds).map(graph => graph.id));
  const maxCompanions = Math.max(0, baseCombo.maxStacks - 1);
  const selected = [...new Set(selectedIds)]
    .filter(id => candidates.has(id))
    .map(id => catalog.find(graph => graph.id === id))
    .filter((graph): graph is AbilityGraph => !!graph);
  return selected.length <= maxCompanions ? selected : [];
}
