import type { Card, Character, Condition, Item, Seal, Weapon } from '../types';
import type { ArsenalCard, ArsenalHolding, TargetConfig } from '../utils/arsenal';
import type { AbilityGraph } from '../utils/abilityGraph';
import type { AppSnapshot } from '../utils/database';
import type { ActiveFieldEffect, CenaLogEntry, PausedDisplayState, PreparationState } from '../utils/cena';

export interface PublicParticipant {
  id: string;
  name: string;
  icon: string;
  iconPosition?: string;
  conditions: Condition[];
  position?: { x: number; y: number };
}

export interface PublicAlly extends PublicParticipant {
  currentHp: number;
  maxHp: number;
  currentAura: number;
  maxAura: number;
  currentAmmo: number;
  maxAmmo: number;
}

export interface PlayerCampaignView {
  revision: number;
  updatedAt: string;
  character: Omit<Character, 'code'>;
  position: { x: number; y: number };
  actions: PlayerActionView[];
  arsenalData: {
    cards: Card[];
    seals: Seal[];
    weapons: Weapon[];
    items: Item[];
    arsenalCards: ArsenalCard[];
    abilityGraphs: AbilityGraph[];
    holdings: ArsenalHolding[];
    preparations: PreparationState[];
  };
  allies: PublicAlly[];
  enemies: PublicParticipant[];
  scene: {
    locationName: string;
    subtitle: string;
    image: string;
    imagePosition?: string;
    isNight: boolean;
    pausedImage?: string;
    pausedImagePosition?: string;
    pausedDisplay?: PausedDisplayState | null;
  };
  encounter: {
    isActive: boolean;
    isPaused: boolean;
    round: number;
    currentTurnId: string | null;
    order: Array<{ refId: string; side: 'party' | 'npc'; initiative: number }>;
    log: CenaLogEntry[];
    fieldEffects: ActiveFieldEffect[];
  };
  permissions: { isOwnTurn: boolean; canMove: boolean; canAct: boolean; canReact: boolean };
}

export interface PlayerActionView {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
  target: TargetConfig;
  requiresAim?: boolean;
  requiresSecondaryTarget?: boolean;
  requiresDestination?: boolean;
}

function publicParticipant(character: Character, position?: { x: number; y: number }): PublicParticipant {
  return { id: character.id, name: character.name || 'Sem nome', icon: character.icon || '', iconPosition: character.iconPosition, conditions: Array.isArray(character.conditions) ? character.conditions : [], position };
}

const safeTags = (tags: unknown): string[] => Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : typeof tags === 'string' ? tags.split(/[,;]+/).map(tag => tag.trim()).filter(Boolean) : [];

function publicAlly(character: Character, position?: { x: number; y: number }): PublicAlly {
  return { ...publicParticipant(character, position), currentHp: character.currentHp, maxHp: character.maxHp, currentAura: character.currentAura, maxAura: character.maxAura, currentAmmo: character.currentAmmo, maxAmmo: character.maxAmmo };
}

/** Cria o único formato de campanha que pode atravessar a fronteira do jogador. */
export function buildPlayerCampaignView(snapshot: AppSnapshot, characterId: string, revision: number, updatedAt: string): PlayerCampaignView {
  const owner = snapshot.characters.find(character => character.id === characterId);
  if (!owner) throw new Error('character_not_found');

  const visibleNpcs = snapshot.cena.npcRoster.filter(npc => npc.present && !npc.hidden && !npc.isHidden);
  const alliedSummons = visibleNpcs.filter(npc => npc.teamOverride === 'party');
  const hostileNpcs = visibleNpcs.filter(npc => npc.teamOverride !== 'party');
  const visibleIds = new Set([...snapshot.characters.filter(character => !character.isHidden).map(character => character.id), ...visibleNpcs.map(npc => npc.id)]);
  const order = snapshot.cena.encounter.order.filter(entry => visibleIds.has(entry.refId));
  const currentTurnId = snapshot.cena.encounter.order[snapshot.cena.encounter.turnIndex]?.refId ?? null;
  const isOwnTurn = snapshot.cena.encounter.isActive && currentTurnId === characterId;
  const ownedActionIds = new Set<string>([
    ...(owner.cardIds ?? []), ...(owner.weaponIds ?? []), ...(owner.sealIds ?? []),
    ...(owner.grimoire ?? []).map(item => item.entryId), ...(owner.arsenal ?? []).filter(item => item.active).map(item => item.cardId),
  ]);
  const actions: PlayerActionView[] = [
    ...(snapshot.grimoire ?? []).filter(action => ownedActionIds.has(action.id)).map(action => ({ id: action.id, name: action.name || 'Ação', description: action.description || '', icon: action.icon || '', category: action.category || 'habilidade', tags: safeTags(action.tags), target: action.target ?? { type: 'um_alvo' as const } })),
    ...(snapshot.abilityGraphs ?? []).filter(action => ownedActionIds.has(action.id)).map(action => { const validGraph = Array.isArray(action.nodes) && Array.isArray(action.edges); const areaScope = validGraph ? action.nodes.find(node => node.type === 'alvo' && ['linha', 'cone'].includes(String((node.props as any)?.scope))) : null; return { id: action.id, name: action.header?.name || 'Habilidade', description: action.header?.description || '', icon: action.header?.icon || '', category: 'habilidade', tags: safeTags(action.header?.tags), target: action.header?.target ?? { type: 'um_alvo' as const }, requiresAim: !!areaScope, requiresSecondaryTarget: validGraph && action.nodes.some(node => node.type === 'alvo' && (node.props as any)?.scope === 'escolha'), requiresDestination: validGraph && action.nodes.some(node => node.type === 'mover' && (node.props as any)?.kind === 'teleportar') }; }),
  ];
  const { code: _secretCode, ...safeOwner } = owner;
  const ownedItemIds = new Set((owner.ownedItems ?? []).map(item => item.itemId));
  const canonicalIds = new Set([...(owner.arsenal ?? []).map(item => item.cardId), ...(owner.grimoire ?? []).map(item => item.entryId)]);
  const publicLog: CenaLogEntry[] = (snapshot.cena.log ?? []).map(entry => ({
    ...entry,
    text: entry.text.replace(/\s+vs\s+(?:defesa|DEF)\s+\d+(?:\.\d+)?/gi, ''),
    roll: entry.roll ? { ...entry.roll, targetValue: undefined } : undefined,
    details: entry.details ? { ...entry.details, notes: undefined } : undefined,
  }));

  return {
    revision, updatedAt, character: safeOwner, position: snapshot.cena.tokens[characterId] ?? { x: 50, y: 50 }, actions,
    arsenalData: {
      cards: (snapshot.cards ?? []).filter(card => (owner.cardIds ?? []).includes(card.id)),
      seals: (snapshot.seals ?? []).filter(seal => (owner.sealIds ?? []).includes(seal.id)),
      weapons: (snapshot.weapons ?? []).filter(weapon => (owner.weaponIds ?? []).includes(weapon.id)),
      items: (snapshot.items ?? []).filter(item => ownedItemIds.has(item.id)),
      arsenalCards: (snapshot.grimoire ?? []).filter(card => canonicalIds.has(card.id)),
      abilityGraphs: (snapshot.abilityGraphs ?? []).filter(graph => canonicalIds.has(graph.id)),
      holdings: owner.arsenal ?? [],
      preparations: (snapshot.cena.encounter.preparations ?? []).filter(item => item.ownerId === characterId),
    },
    allies: [...snapshot.characters.filter(character => character.id !== characterId && !character.isHidden), ...alliedSummons].map(character => publicAlly(character, snapshot.cena.tokens[character.id])),
    enemies: hostileNpcs.map(npc => publicParticipant(npc, snapshot.cena.tokens[npc.id])),
    scene: {
      locationName: snapshot.cena.scene.locationName,
      subtitle: snapshot.cena.scene.subtitle,
      image: snapshot.cena.scene.image,
      imagePosition: snapshot.cena.scene.imagePosition,
      isNight: snapshot.cena.scene.isNight,
      pausedImage: snapshot.cena.scene.pausedImage,
      pausedImagePosition: snapshot.cena.scene.pausedImagePosition,
      pausedDisplay: snapshot.cena.pausedDisplay,
    },
    encounter: { isActive: snapshot.cena.encounter.isActive, isPaused: snapshot.cena.encounter.isPaused, round: snapshot.cena.encounter.round, currentTurnId, order, log: publicLog, fieldEffects: snapshot.cena.encounter.fieldEffects ?? [] },
    permissions: { isOwnTurn, canMove: !snapshot.cena.encounter.isActive || (isOwnTurn && !snapshot.cena.encounter.isPaused), canAct: (!snapshot.cena.encounter.isActive || isOwnTurn) && !snapshot.cena.encounter.isPaused, canReact: snapshot.cena.encounter.isActive && !snapshot.cena.encounter.isPaused && !snapshot.cena.encounter.reactionsUsed[characterId] },
  };
}
