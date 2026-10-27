import type { Cue } from './cues';
import type { Id, Scene, Token } from './model';
import type { ProjectedCharacter, ProjectedEncounter, ProjectedState } from './projection';

export type Change =
  | { kind: 'upsertCharacter'; character: ProjectedCharacter } | { kind: 'removeCharacter'; id: Id }
  | { kind: 'upsertToken'; token: Token } | { kind: 'removeToken'; id: Id }
  | { kind: 'setScene'; scene: Omit<Scene, 'tokens'> } | { kind: 'setEncounter'; encounter: ProjectedEncounter }
  | { kind: 'setName'; name: string };

export interface ProjectedUpdate { revision: number; changes: Change[]; cues: Cue[] }

/** JSON com chaves ordenadas, para comparação estrutural. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

const sceneMeta = (s: Scene): Omit<Scene, 'tokens'> => {
  const { tokens: _tokens, ...meta } = s;
  return meta;
};

function diffMap<T>(before: Record<Id, T>, after: Record<Id, T>): { removed: Id[]; upserted: T[] } {
  const removed = Object.keys(before).filter((id) => !(id in after));
  const upserted = Object.entries(after)
    .filter(([id, v]) => !(id in before) || stableStringify(before[id]) !== stableStringify(v))
    .map(([, v]) => v);
  return { removed, upserted };
}

export function diffProjection(before: ProjectedState, after: ProjectedState): Change[] {
  const chars = diffMap(before.characters, after.characters);
  const toks = diffMap(before.scene.tokens, after.scene.tokens);
  const changes: Change[] = [];
  for (const id of chars.removed) changes.push({ kind: 'removeCharacter', id });
  for (const id of toks.removed) changes.push({ kind: 'removeToken', id });
  for (const character of chars.upserted) changes.push({ kind: 'upsertCharacter', character });
  for (const token of toks.upserted) changes.push({ kind: 'upsertToken', token });
  if (stableStringify(sceneMeta(before.scene)) !== stableStringify(sceneMeta(after.scene))) {
    changes.push({ kind: 'setScene', scene: sceneMeta(after.scene) });
  }
  if (stableStringify(before.encounter) !== stableStringify(after.encounter)) {
    changes.push({ kind: 'setEncounter', encounter: after.encounter });
  }
  if (before.name !== after.name) changes.push({ kind: 'setName', name: after.name });
  return changes;
}

export function applyChanges(p: ProjectedState, changes: Change[], revision: number): ProjectedState {
  const characters = { ...p.characters };
  const tokens = { ...p.scene.tokens };
  let scene: Omit<Scene, 'tokens'> = sceneMeta(p.scene);
  let encounter = p.encounter;
  let name = p.name;
  for (const ch of changes) {
    switch (ch.kind) {
      case 'upsertCharacter': characters[ch.character.id] = ch.character; break;
      case 'removeCharacter': delete characters[ch.id]; break;
      case 'upsertToken': tokens[ch.token.id] = ch.token; break;
      case 'removeToken': delete tokens[ch.id]; break;
      case 'setScene': scene = ch.scene; break;
      case 'setEncounter': encounter = ch.encounter; break;
      case 'setName': name = ch.name; break;
    }
  }
  return { ...p, name, revision, characters, scene: { ...scene, tokens }, encounter };
}
