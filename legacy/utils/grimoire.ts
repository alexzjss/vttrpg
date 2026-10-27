import type { Affinity, Element, GrimoireHolding } from '../types';

export type EntryCategory = 'arma' | 'habilidade' | 'selo' | 'item';
export type ActionType = 'principal' | 'menor' | 'reação';
export type Targeting = 'self' | 'aliado' | 'inimigo' | 'qualquer';
export type BuffStat = 'defesa' | 'acerto' | 'dano';

/** Um efeito composável — a unidade básica de tudo no grimório. */
export type Effect =
  | { kind: 'damage'; dice: string; element: Element }
  | { kind: 'heal'; stat: 'hp' | 'aura' | 'ammo'; dice: string }
  | { kind: 'condition'; name: string; duration: number; value?: number }
  | { kind: 'buff'; stat: BuffStat; value: number; duration: number };

/** Como a entrada se usa em combate (ausente = entrada narrativa). */
export interface CombatProfile {
  actionType: ActionType;
  targeting: Targeting;
  /** Ex: '1d20+2'. Ausente = sem teste de acerto (auto-acerto, ex. cura). */
  attackDice?: string;
  costs?: { aura?: number; ammo?: number; hp?: number };
  effects: Effect[];
}

export type Requirement =
  | { type: 'specificCharacter'; characterId: string }
  | { type: 'linkedEntry'; entryId: string }
  | { type: 'entryCount'; entryId: string; quantity: number }
  | { type: 'minHp'; value: number }    // % 0-100
  | { type: 'minAura'; value: number }; // % 0-100

export interface EntryLevel { level: number; name?: string; combat: CombatProfile }

export interface FormaModule {
  color: string; icon?: string;
  /** Rodadas; 0 = permanente até encerrar o combate. */
  duration: number;
  hpBonus?: number; auraBonus?: number;
  grantedEntryIds: string[];
}

export interface ComboModule {
  minUsers: number; maxUsers?: number;
  diceMode: 'sum' | 'highest';
  preparationRounds?: number;
}

/** A entidade única do grimório (substitui Card/Seal/Weapon/Item nas Fases 2-3). */
export interface GrimoireEntry {
  id: string; name: string; image: string; description: string;
  category: EntryCategory;
  isHidden?: boolean; code?: string;
  combat?: CombatProfile;
  levels?: EntryLevel[];
  forma?: FormaModule;
  combo?: ComboModule;
  requirements?: Requirement[];
  /** Decrementa 1 unidade da posse ao usar. */
  consumable?: boolean;
}

/** Entrada do catálogo com a posse anexada. */
export interface ResolvedHolding extends GrimoireEntry {
  quantity: number;
  heldLevel?: number;
}

/** Reconstrói o acervo de um personagem a partir do catálogo (ignora órfãs). */
export function resolveHoldings(
  holdings: GrimoireHolding[] | undefined,
  catalog: GrimoireEntry[],
): ResolvedHolding[] {
  const out: ResolvedHolding[] = [];
  for (const h of holdings ?? []) {
    const tpl = catalog.find(e => e.id === h.entryId);
    if (!tpl) continue;
    out.push({ ...tpl, quantity: h.quantity ?? 1, heldLevel: h.level });
  }
  return out;
}

/** Perfil de combate efetivo: o do nível escolhido, ou o base. */
export function effectiveCombat(entry: GrimoireEntry, level?: number): CombatProfile | undefined {
  if (level != null && entry.levels) {
    const l = entry.levels.find(x => x.level === level);
    if (l) return l.combat;
  }
  return entry.combat;
}

/** Ação embutida "Guarda": menor, self, +2 defesa até o próximo turno. */
export const GUARD_ENTRY: GrimoireEntry = {
  id: 'builtin-guard',
  name: 'Guarda',
  image: '',
  description: '+2 de defesa até o início do seu próximo turno.',
  category: 'habilidade',
  combat: {
    actionType: 'menor',
    targeting: 'self',
    effects: [{ kind: 'buff', stat: 'defesa', value: 2, duration: 1 }],
  },
};

export interface RequirementContext {
  characterId: string;
  holdings: GrimoireHolding[];
  currentHp: number; maxHp: number;
  currentAura: number; maxAura: number;
}

/** Retorna o motivo do bloqueio do primeiro requisito não atendido, ou null. */
export function checkRequirements(
  reqs: Requirement[] | undefined,
  ctx: RequirementContext,
): string | null {
  for (const r of reqs ?? []) {
    switch (r.type) {
      case 'specificCharacter':
        if (ctx.characterId !== r.characterId) return 'Exclusivo de outro personagem';
        break;
      case 'linkedEntry':
        if (!ctx.holdings.some(h => h.entryId === r.entryId)) return 'Requer uma entrada vinculada';
        break;
      case 'entryCount': {
        const h = ctx.holdings.find(x => x.entryId === r.entryId);
        if ((h?.quantity ?? (h ? 1 : 0)) < r.quantity) return `Requer ${r.quantity}× de uma entrada`;
        break;
      }
      case 'minHp':
        if (ctx.maxHp <= 0 || (ctx.currentHp / ctx.maxHp) * 100 < r.value) return `Requer HP ≥ ${r.value}%`;
        break;
      case 'minAura':
        if (ctx.maxAura <= 0 || (ctx.currentAura / ctx.maxAura) * 100 < r.value) return `Requer Aura ≥ ${r.value}%`;
        break;
    }
  }
  return null;
}
