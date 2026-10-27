import { describe, expect, it } from 'vitest';
import { buildPlayerCampaignView } from './playerView';

describe('buildPlayerCampaignView', () => {
  it('não expõe ficha, recursos ou habilidades dos inimigos', () => {
    const hero = { id: 'hero', name: 'Heroína', icon: '', maxHp: 10, currentHp: 8, maxAura: 5, currentAura: 4, maxAmmo: 2, currentAmmo: 2, baseInitiative: 1, cardIds: ['own-action'], conditions: [], items: [], code: 'segredo' };
    const enemy = { ...hero, id: 'enemy', name: 'Vilão', currentHp: 2, maxHp: 99, cardIds: ['secret-action'], isNpc: true, present: true, hidden: false };
    const snapshot: any = { characters: [hero], grimoire: [{ id: 'own-action' }, { id: 'secret-action' }], cena: { npcRoster: [enemy], tokens: {}, scene: { locationName: 'Arena', subtitle: '', image: '', isNight: false, notes: 'nota secreta' }, encounter: { isActive: true, isPaused: false, round: 1, turnIndex: 0, order: [{ refId: 'hero', side: 'party', initiative: 10 }], reactionsUsed: {} } } };
    const view = buildPlayerCampaignView(snapshot, 'hero', 3, 'agora');
    expect(view.character).not.toHaveProperty('code');
    expect(view.enemies[0]).not.toHaveProperty('currentHp');
    expect(view.enemies[0]).not.toHaveProperty('cardIds');
    expect(view.scene).not.toHaveProperty('notes');
    expect(view.actions.map(action => action.id)).toEqual(['own-action']);
    expect(JSON.stringify(view)).not.toContain('secret-action');
  });

  it('remove inimigos ocultos e bloqueia ação fora do turno', () => {
    const hero: any = { id: 'hero', name: 'Heroína', icon: '', maxHp: 10, currentHp: 10, maxAura: 5, currentAura: 5, maxAmmo: 0, currentAmmo: 0, baseInitiative: 1, cardIds: [], conditions: [], items: [] };
    const snapshot: any = { characters: [hero], grimoire: [], cena: { npcRoster: [{ ...hero, id: 'hidden', isNpc: true, present: true, hidden: true }], tokens: {}, scene: { locationName: '', subtitle: '', image: '', isNight: false }, encounter: { isActive: true, isPaused: false, round: 1, turnIndex: 0, order: [{ refId: 'other', side: 'party', initiative: 10 }], reactionsUsed: {} } } };
    const view = buildPlayerCampaignView(snapshot, 'hero', 1, 'agora');
    expect(view.enemies).toEqual([]);
    expect(view.permissions.canAct).toBe(false);
    expect(view.permissions.canMove).toBe(false);
  });

  it('inclui habilidades em grafo que pertencem ao personagem', () => {
    const hero: any = { id: 'hero', name: 'Heroína', icon: '', maxHp: 10, currentHp: 10, maxAura: 5, currentAura: 5, maxAmmo: 0, currentAmmo: 0, baseInitiative: 1, cardIds: [], conditions: [], items: [], arsenal: [{ cardId: 'graph-1', quantity: 1, equipped: true, active: true }] };
    const graph: any = { id: 'graph-1', header: { name: 'Rajada', description: 'Ataque em grafo', icon: '', tags: [], target: { type: 'um_alvo' } } };
    const snapshot: any = { characters: [hero], grimoire: [], abilityGraphs: [graph], cena: { npcRoster: [], tokens: {}, scene: { locationName: '', subtitle: '', image: '', isNight: false }, encounter: { isActive: false, isPaused: false, round: 1, turnIndex: 0, order: [], reactionsUsed: {} } } };
    expect(buildPlayerCampaignView(snapshot, 'hero', 1, 'agora').actions).toMatchObject([{ id: 'graph-1', name: 'Rajada', category: 'habilidade', target: { type: 'um_alvo' } }]);
  });
});
