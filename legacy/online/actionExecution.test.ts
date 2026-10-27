import { describe, expect, it } from 'vitest';
import { createArsenalCard } from '../utils/arsenal';
import { createDefaultCena } from '../utils/cena';
import { executeOnlineAction } from './actionExecution';
import { createAbilityGraph } from '../utils/abilityGraph';
import { graphCosts } from '../utils/abilityGraphAction';

function character(id: string, name: string, hp = 20): any {
  return { id, name, icon: '', maxHp: hp, currentHp: hp, maxAura: 10, currentAura: 10, maxAmmo: 0, currentAmmo: 0, baseInitiative: 5, defense: 10, cardIds: [], conditions: [], items: [], arsenal: [] };
}

describe('executeOnlineAction', () => {
  it('executa cartas legadas que aparecem no mesmo menu do mestre', () => {
    const hero = character('hero', 'Heroína'); hero.cardIds = ['legado'];
    const enemy = { ...character('enemy', 'Inimigo'), isNpc: true, present: true, hidden: false };
    const cena = createDefaultCena(); cena.npcRoster = [enemy]; cena.encounter.isActive = true; cena.encounter.order = [{ refId: 'hero', side: 'party', initiative: 10 }];
    const snapshot: any = { version: 8, savedAt: '', characters: [hero], cards: [{ id: 'legado', name: 'Golpe antigo', image: '', auraCost: 0, type: 'ataque', damage: 3, description: '', diceRoll: '1d20+99' }], items: [], seals: [], weapons: [], grimoire: [], abilityGraphs: [], combat: {}, journey: {}, cena };
    const result = executeOnlineAction(snapshot, { actorId: 'hero', actionId: 'legado', targetIds: ['enemy'] });
    expect(result.summary).toContain('Golpe antigo');
    expect(result.snapshot.cena.npcRoster[0].currentHp).toBeLessThan(20);
    expect(result.snapshot.cena.encounter.turn.majorUsed).toBe(true);
  });

  it('aplica custo e dano sem alterar o snapshot original', () => {
    const hero = character('hero', 'Heroína');
    hero.arsenal = [{ cardId: 'golpe', quantity: 1, equipped: true, active: true }];
    const enemy = { ...character('enemy', 'Inimigo'), isNpc: true, present: true, hidden: false };
    const card = createArsenalCard({ id: 'golpe', name: 'Golpe', category: 'habilidade', target: { type: 'um_alvo' }, damage: { flat: 4 }, auraConsumed: { flat: 2 } });
    const cena = createDefaultCena(); cena.npcRoster = [enemy]; cena.encounter.isActive = true; cena.encounter.order = [{ refId: 'hero', side: 'party', initiative: 10 }];
    const snapshot: any = { version: 8, savedAt: '', characters: [hero], cards: [], items: [], seals: [], weapons: [], grimoire: [card], abilityGraphs: [], combat: {}, journey: {}, cena };
    const result = executeOnlineAction(snapshot, { actorId: 'hero', actionId: 'golpe', targetIds: ['enemy'] });
    expect(snapshot.characters[0].currentAura).toBe(10);
    expect(result.snapshot.characters[0].currentAura).toBe(8);
    expect(result.snapshot.cena.npcRoster[0].currentHp).toBe(17);
    expect(result.snapshot.cena.encounter.turn.majorUsed).toBe(true);
    expect(result.snapshot.cena.log.length).toBeGreaterThan(0);
  });

  it('recusa uma ação que o motor bloquear', () => {
    const hero = character('hero', 'Heroína'); hero.currentAura = 0; hero.arsenal = [{ cardId: 'magia', quantity: 1, equipped: true, active: true }];
    const card = createArsenalCard({ id: 'magia', name: 'Magia', category: 'habilidade', target: { type: 'proprio_usuario' }, auraConsumed: { flat: 3 } });
    const cena = createDefaultCena();
    const snapshot: any = { version: 8, savedAt: '', characters: [hero], cards: [], items: [], seals: [], weapons: [], grimoire: [card], abilityGraphs: [], combat: {}, journey: {}, cena };
    expect(() => executeOnlineAction(snapshot, { actorId: 'hero', actionId: 'magia', targetIds: ['hero'] })).toThrow();
  });

  it('materializa movimento produzido por uma habilidade em grafo', () => {
    const hero = character('hero', 'Heroína'); hero.arsenal = [{ cardId: 'empurrao', quantity: 1, equipped: true, active: true, maxLevel: 1 }];
    const enemy = { ...character('enemy', 'Inimigo'), isNpc: true, present: true, hidden: false };
    const graph = createAbilityGraph({ id: 'empurrao', name: 'Empurrão', target: { type: 'um_alvo' } });
    graph.nodes.push({ id: 'move', type: 'mover', family: 'efeito', props: { kind: 'empurrar', distance: 2 } } as any);
    graph.edges.push({ id: 'edge', from: graph.nodes[0].id, to: 'move' });
    const cena = createDefaultCena(); cena.npcRoster = [enemy]; cena.tokens = { hero: { x: 40, y: 50 }, enemy: { x: 60, y: 50 } };
    const snapshot: any = { version: 8, savedAt: '', characters: [hero], cards: [], items: [], seals: [], weapons: [], grimoire: [], abilityGraphs: [graph], combat: {}, journey: {}, cena };
    const result = executeOnlineAction(snapshot, { actorId: 'hero', actionId: 'empurrao', targetIds: ['enemy'] });
    expect(result.snapshot.cena.tokens.enemy).toEqual({ x: 76, y: 50 });
  });

  it('registra efeitos contínuos produzidos pelo grafo', () => {
    const hero = character('hero', 'Heroína'); hero.arsenal = [{ cardId: 'aura', quantity: 1, equipped: true, active: true, maxLevel: 1 }];
    const graph = createAbilityGraph({ id: 'aura', name: 'Aura persistente', target: { type: 'proprio_usuario' } });
    graph.nodes.push({ id: 'ongoing', type: 'aplicar_como_efeito', family: 'efeito', props: { alvo: 'proprio', rounds: 3 } } as any);
    graph.edges.push({ id: 'edge', from: graph.nodes[0].id, to: 'ongoing' });
    const snapshot: any = { version: 8, savedAt: '', characters: [hero], cards: [], items: [], seals: [], weapons: [], grimoire: [], abilityGraphs: [graph], combat: {}, journey: {}, cena: createDefaultCena() };
    const result = executeOnlineAction(snapshot, { actorId: 'hero', actionId: 'aura', targetIds: ['hero'] });
    expect(result.snapshot.cena.encounter.activeOngoingEffects).toMatchObject([{ ownerId: 'hero', casterId: 'hero', graphId: 'aura', roundsRemaining: 3 }]);
  });

  it('calcula alvos de área pelas posições dos tokens', () => {
    const hero = character('hero', 'Heroína'); hero.arsenal = [{ cardId: 'explosao', quantity: 1, equipped: true, active: true, maxLevel: 1 }];
    const near = { ...character('near', 'Próximo'), isNpc: true, present: true, hidden: false };
    const far = { ...character('far', 'Distante'), isNpc: true, present: true, hidden: false };
    const graph = createAbilityGraph({ id: 'explosao', name: 'Explosão', target: { type: 'todos_em_area' } });
    graph.nodes.push({ id: 'area', type: 'alvo', family: 'alvo', props: { scope: 'raio', radius: 2 } } as any, { id: 'damage', type: 'dano', family: 'efeito', props: { flat: 5, element: 'fisico' } } as any);
    graph.edges.push({ id: 'to-area', from: graph.nodes[0].id, to: 'area' }, { id: 'to-damage', from: 'area', to: 'damage' });
    const cena = createDefaultCena(); cena.npcRoster = [near, far]; cena.tokens = { hero: { x: 50, y: 50 }, near: { x: 58, y: 50 }, far: { x: 90, y: 50 } };
    const snapshot: any = { version: 8, savedAt: '', characters: [hero], cards: [], items: [], seals: [], weapons: [], grimoire: [], abilityGraphs: [graph], combat: {}, journey: {}, cena };
    const result = executeOnlineAction(snapshot, { actorId: 'hero', actionId: 'explosao', targetIds: [] });
    expect(result.snapshot.cena.npcRoster.find((item: any) => item.id === 'near').currentHp).toBeLessThan(20);
    expect(result.snapshot.cena.npcRoster.find((item: any) => item.id === 'far').currentHp).toBe(20);
  });

  it('retoma escolha intermediária sem cobrar o custo novamente', () => {
    const hero = character('hero', 'Heroína'); hero.arsenal = [{ cardId: 'escolha', quantity: 1, equipped: true, active: true, maxLevel: 1 }];
    const enemy = { ...character('enemy', 'Inimigo'), isNpc: true, present: true, hidden: false };
    const graph = createAbilityGraph({ id: 'escolha', name: 'Escolha arcana', target: { type: 'proprio_usuario' } });
    graph.nodes.push(
      { id: 'cost', type: 'custo', family: 'efeito', props: { recurso: 'aura', amount: 2 } } as any,
      { id: 'choice', type: 'alvo', family: 'alvo', props: { scope: 'escolha' } } as any,
      { id: 'damage', type: 'dano', family: 'efeito', props: { flat: 5, element: 'fisico' } } as any,
    );
    graph.edges.push({ id: 'e1', from: graph.nodes[0].id, to: 'cost' }, { id: 'e2', from: 'cost', to: 'choice' }, { id: 'e3', from: 'choice', to: 'damage' });
    expect(graphCosts(graph, 1).aura).toBe(2);
    const cena = createDefaultCena(); cena.npcRoster = [enemy];
    const snapshot: any = { version: 8, savedAt: '', characters: [hero], cards: [], items: [], seals: [], weapons: [], grimoire: [], abilityGraphs: [graph], combat: {}, journey: {}, cena };
    const result = executeOnlineAction(snapshot, { actorId: 'hero', actionId: 'escolha', targetIds: ['hero'], choiceTargetId: 'enemy' });
    expect(result.snapshot.characters[0].currentAura).toBe(8);
    expect(result.snapshot.cena.npcRoster[0].currentHp).toBeLessThan(20);
  });

  it('materializa teleporte na posição aprovada', () => {
    const hero = character('hero', 'Heroína'); hero.arsenal = [{ cardId: 'teleporte', quantity: 1, equipped: true, active: true, maxLevel: 1 }];
    const graph = createAbilityGraph({ id: 'teleporte', name: 'Teleporte', target: { type: 'proprio_usuario' } });
    graph.nodes.push({ id: 'move', type: 'mover', family: 'efeito', props: { kind: 'teleportar', distance: 0 } } as any);
    graph.edges.push({ id: 'edge', from: graph.nodes[0].id, to: 'move' });
    const cena = createDefaultCena(); cena.tokens = { hero: { x: 10, y: 20 } };
    const snapshot: any = { version: 8, savedAt: '', characters: [hero], cards: [], items: [], seals: [], weapons: [], grimoire: [], abilityGraphs: [graph], combat: {}, journey: {}, cena };
    const result = executeOnlineAction(snapshot, { actorId: 'hero', actionId: 'teleporte', targetIds: ['hero'], destination: { x: 73, y: 41 } });
    expect(result.snapshot.cena.tokens.hero).toEqual({ x: 73, y: 41 });
  });

  it('cria uma invocação aliada e a adiciona à iniciativa', () => {
    const hero = character('hero', 'Heroína'); hero.arsenal = [{ cardId: 'invocar', quantity: 1, equipped: true, active: true, maxLevel: 1 }];
    const graph = createAbilityGraph({ id: 'invocar', name: 'Chamar guardião', target: { type: 'proprio_usuario' } });
    graph.nodes.push({ id: 'summon', type: 'invocar', family: 'efeito', props: { entityName: 'Guardião', teamId: 'party', rounds: 3, maxHp: 12, maxAura: 2, speed: 7 } } as any);
    graph.edges.push({ id: 'edge', from: graph.nodes[0].id, to: 'summon' });
    const cena = createDefaultCena(); cena.encounter.isActive = true; cena.encounter.order = [{ refId: 'hero', side: 'party', initiative: 10 }];
    const snapshot: any = { version: 8, savedAt: '', characters: [hero], cards: [], items: [], seals: [], weapons: [], grimoire: [], abilityGraphs: [graph], combat: {}, journey: {}, cena };
    const result = executeOnlineAction(snapshot, { actorId: 'hero', actionId: 'invocar', targetIds: ['hero'] });
    expect(result.snapshot.cena.npcRoster).toMatchObject([{ name: 'Guardião', teamOverride: 'party', currentHp: 12, summonedRoundsRemaining: 3 }]);
    expect(result.snapshot.cena.encounter.order[1]).toMatchObject({ side: 'party', initiative: 7 });
  });

  it('transforma o alvo e aplica bônus da forma sem empilhar forma anterior', () => {
    const hero = character('hero', 'Heroína'); hero.arsenal = [{ cardId: 'transformar', quantity: 1, equipped: true, active: true }, { cardId: 'forma-lobo', quantity: 1, equipped: false, active: false }];
    const spell = createAbilityGraph({ id: 'transformar', name: 'Metamorfose', target: { type: 'proprio_usuario' } });
    spell.nodes.push({ id: 'transform', type: 'transformar', family: 'efeito', props: { intoFormId: 'forma-lobo' } } as any); spell.edges.push({ id: 'edge', from: spell.nodes[0].id, to: 'transform' });
    const form = createArsenalCard({ id: 'forma-lobo', name: 'Forma de Lobo', category: 'habilidade', abilityType: 'forma', form: { grantedAbilityIds: [], removedAbilityIds: [], hpBonus: 5, auraBonus: 2, durationRounds: 3 } });
    const snapshot: any = { version: 8, savedAt: '', characters: [hero], cards: [], items: [], seals: [], weapons: [], grimoire: [form], abilityGraphs: [spell], combat: {}, journey: {}, cena: createDefaultCena() };
    const result = executeOnlineAction(snapshot, { actorId: 'hero', actionId: 'transformar', targetIds: ['hero'] });
    expect(result.snapshot.characters[0]).toMatchObject({ maxHp: 25, currentHp: 25, maxAura: 12, currentAura: 12 });
    expect(result.snapshot.cena.encounter.activeFormas).toMatchObject([{ ownerId: 'hero', entryId: 'forma-lobo', hpBonusApplied: 5, auraBonusApplied: 2 }]);
  });
});
