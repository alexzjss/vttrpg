import type { Character } from '../types';
import type { ArsenalCard } from './arsenal';
import type { AbilityGraph } from './abilityGraph';

export function buildCharacterExport(character: Character, catalog: ArsenalCard[], graphCatalog: AbilityGraph[] = []) {
  const ids = new Set((character.arsenal ?? []).map(holding => holding.cardId));
  const cards = catalog.filter(card => ids.has(card.id));
  const abilityGraphs = graphCatalog.filter(graph => ids.has(graph.id));
  const found = new Set([...cards.map(card => card.id), ...abilityGraphs.map(graph => graph.id)]);
  return { format: 'rpg-codex-character', version: 1, exportedAt: new Date().toISOString(), character, cards, abilityGraphs, missingCardIds: [...ids].filter(id => !found.has(id)) };
}

export function buildArsenalExport(catalog: ArsenalCard[], graphCatalog: AbilityGraph[] = []) {
  return { format: 'rpg-codex-arsenal', version: 1, exportedAt: new Date().toISOString(), cards: catalog, abilityGraphs: graphCatalog };
}

function exportJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportCharacterFile(character: Character, catalog: ArsenalCard[], graphCatalog: AbilityGraph[] = []): void {
  const safeName = character.name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'personagem';
  exportJsonFile(`${safeName}-rpg-codex.json`, buildCharacterExport(character, catalog, graphCatalog));
}

export function exportArsenalFile(catalog: ArsenalCard[], graphCatalog: AbilityGraph[] = []): void {
  exportJsonFile('arsenal-rpg-codex.json', buildArsenalExport(catalog, graphCatalog));
}
