import type { CampaignState, InitiativeEntry } from './model';

export function sortInitiative(entries: InitiativeEntry[], state: CampaignState): InitiativeEntry[] {
  const info = (tokenId: string) => {
    const token = state.scene.tokens[tokenId];
    const c = token ? state.characters[token.characterId] : undefined;
    return { speed: c?.speed ?? 0, name: c?.name ?? '' };
  };
  return [...entries].sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    const ia = info(a.tokenId);
    const ib = info(b.tokenId);
    if (ib.speed !== ia.speed) return ib.speed - ia.speed;
    return ia.name.localeCompare(ib.name, 'pt-BR');
  });
}
