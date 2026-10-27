import type {
  Actor, CampaignState, Character, Id, InitiativeEntry, Pool, Resources, Scene,
} from './model';

export type Audience = { kind: 'gm' } | { kind: 'player'; characterId: Id };
export type HpBand = 'ileso' | 'ferido' | 'grave' | 'beira';

export interface ProjectedCharacter extends Omit<Character, 'resources'> {
  resources: Resources | null;
  hpBand: HpBand | null;
}
export interface ProjectedEncounter {
  active: boolean; round: number; order: InitiativeEntry[]; currentTokenId: Id | null;
}
export interface ProjectedState {
  audience: Audience; campaignId: Id; name: string; revision: number;
  characters: Record<Id, ProjectedCharacter>; scene: Scene; encounter: ProjectedEncounter;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function hpBand(hp: Pool): HpBand {
  const ratio = hp.max > 0 ? hp.current / hp.max : 0;
  if (ratio >= 1) return 'ileso';
  if (ratio > 0.5) return 'ferido';
  if (ratio > 0.25) return 'grave';
  return 'beira';
}

export function audienceKey(a: Audience): string {
  return a.kind === 'gm' ? 'gm' : `player:${a.characterId}`;
}

export function actorAudience(actor: Actor): Audience {
  return actor.role === 'gm' ? { kind: 'gm' } : { kind: 'player', characterId: actor.characterId };
}

function projectCharacterFor(c: Character, gm: boolean): ProjectedCharacter {
  if (gm || c.kind === 'pc' || c.hpVisibility === 'exact') {
    return { ...c, resources: clone(c.resources), hpBand: null };
  }
  if (c.hpVisibility === 'band') return { ...c, resources: null, hpBand: hpBand(c.resources.hp) };
  return { ...c, resources: null, hpBand: null };
}

export function project(state: CampaignState, audience: Audience): ProjectedState {
  const gm = audience.kind === 'gm';
  const tokens = Object.fromEntries(
    Object.entries(state.scene.tokens)
      .filter(([, t]) => gm || !t.hidden)
      .map(([id, t]) => [id, clone(t)]),
  );
  const visibleCharacterIds = new Set(Object.values(tokens).map((t) => t.characterId));

  const characters: Record<Id, ProjectedCharacter> = {};
  for (const c of Object.values(state.characters)) {
    if (gm || c.kind === 'pc' || visibleCharacterIds.has(c.id)) {
      characters[c.id] = projectCharacterFor(c, gm);
    }
  }

  const enc = state.encounter;
  const current = enc.order[enc.turnIndex]?.tokenId ?? null;
  const order = gm ? enc.order : enc.order.filter((e) => tokens[e.tokenId] !== undefined);
  const currentTokenId = current !== null && (gm || tokens[current] !== undefined) ? current : null;

  return {
    audience: clone(audience),
    campaignId: state.campaignId,
    name: state.name,
    revision: state.revision,
    characters,
    scene: { ...clone({ ...state.scene, tokens: {} }), tokens },
    encounter: { active: enc.active, round: enc.round, order: clone(order), currentTokenId },
  };
}
