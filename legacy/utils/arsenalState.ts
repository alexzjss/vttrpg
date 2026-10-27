import type { ArsenalCard, ArsenalHolding, TriggerEvent } from './arsenal';
import { resolveArsenalAction, type ArsenalActorState } from './arsenalPipeline';

export type ArsenalStateEvent = TriggerEvent | 'descanso';

export interface ArsenalLoadout {
  holdings: ArsenalHolding[];
  equippedWeaponIds: string[];
  activeFormIds: string[];
}

export function createHolding(card: ArsenalCard, quantity = 1, maxLevel?: number): ArsenalHolding {
  return {
    cardId: card.id,
    quantity: Math.max(0, quantity),
    equipped: false,
    active: false,
    ...(maxLevel ? { maxLevel: Math.max(1, Math.floor(maxLevel)) } : {}),
    ...(card.charges ? { currentCharges: card.charges.current } : {}),
  };
}

export function assignCardToHoldings(holdings: readonly ArsenalHolding[], card: ArsenalCard, quantity = 1, maxLevel?: number): ArsenalHolding[] {
  const safeQuantity=Math.max(1,Math.floor(quantity));
  const existing=holdings.find(holding=>holding.cardId===card.id);
  if(!existing)return [...holdings.map(holding=>({...holding})),createHolding(card,card.category==='item'?safeQuantity:1,maxLevel)];
  if(card.category!=='item')return holdings.map(holding=>({...holding}));
  return holdings.map(holding=>holding.cardId===card.id?{...holding,quantity:holding.quantity+safeQuantity}:{...holding});
}

/** Atribui uma entrada por id (habilidade-grafo, sem semântica de quantidade de item) — não duplica se já atribuída. */
export function assignEntryToHoldings(holdings: readonly ArsenalHolding[], entryId: string, maxLevel?: number): ArsenalHolding[] {
  if (holdings.some(holding => holding.cardId === entryId)) return holdings.map(holding => ({ ...holding }));
  return [...holdings.map(holding => ({ ...holding })), { cardId: entryId, quantity: 1, equipped: false, active: false, ...(maxLevel ? { maxLevel: Math.max(1, Math.floor(maxLevel)) } : {}) }];
}

export function equipWeapon(loadout: ArsenalLoadout, weaponId: string | null): ArsenalLoadout {
  const equippedWeaponIds = weaponId ? [weaponId] : [];
  return {
    ...loadout,
    equippedWeaponIds,
    holdings: loadout.holdings.map(holding => ({ ...holding, equipped: holding.cardId === weaponId })),
  };
}

export function activateForm(loadout: ArsenalLoadout, formId: string | null): ArsenalLoadout {
  const activeFormIds = formId ? [formId] : [];
  return {
    ...loadout,
    activeFormIds,
    holdings: loadout.holdings.map(holding => ({ ...holding, active: holding.cardId === formId })),
  };
}

/** IDs disponíveis após concessões de armas/formas e remoções da forma ativa. */
export function availableCardIds(loadout: ArsenalLoadout, catalog: readonly ArsenalCard[]): string[] {
  const owned = new Set(loadout.holdings.filter(holding => holding.quantity > 0).map(holding => holding.cardId));
  const removed = new Set<string>();
  for (const ability of catalog) {
    if (ability.category !== 'habilidade' || !owned.has(ability.id)) continue;
    const hasEquipmentLink = ability.weaponLinks.length > 0 || ability.formLinks.length > 0;
    const unlocked = ability.weaponLinks.some(id => loadout.equippedWeaponIds.includes(id))
      || ability.formLinks.some(id => loadout.activeFormIds.includes(id));
    if (hasEquipmentLink && !unlocked) owned.delete(ability.id);
  }
  for (const weaponId of loadout.equippedWeaponIds) {
    const weapon = catalog.find(card => card.id === weaponId && card.category === 'arma');
    for (const id of weapon?.weapon?.grantedAbilityIds ?? []) owned.add(id);
    for (const ability of catalog) if (ability.category === 'habilidade' && ability.weaponLinks.includes(weaponId)) owned.add(ability.id);
  }
  for (const formId of loadout.activeFormIds) {
    const form = catalog.find(card => card.id === formId && card.abilityType === 'forma');
    for (const id of form?.form?.grantedAbilityIds ?? []) owned.add(id);
    for (const ability of catalog) if (ability.category === 'habilidade' && ability.formLinks.includes(formId)) owned.add(ability.id);
    for (const id of form?.form?.removedAbilityIds ?? []) removed.add(id);
  }
  for (const id of removed) owned.delete(id);
  return [...owned];
}

export interface UnlockCriteria { cardIds: string[]; tags: string[]; element: string | null; cardType: string | null }

/** Ids liberados por nós 'liberar_cartas' de efeitos contínuos ativos (ex.: uma forma que libera cartas não
 *  atribuídas ao personagem) — casa por id explícito, por tag, por elemento ou por tipo de carta. */
export function unlockedCardIds(criteria: readonly UnlockCriteria[], catalog: readonly ArsenalCard[]): string[] {
  const ids = new Set<string>();
  for (const c of criteria) {
    for (const id of c.cardIds) ids.add(id);
    if (!c.tags.length && !c.element && !c.cardType) continue;
    for (const card of catalog) {
      const matchesTag = c.tags.length > 0 && c.tags.some(tag => (card.tags as string[]).includes(tag));
      const matchesElement = !!c.element && card.element === c.element;
      const matchesType = !!c.cardType && card.category === c.cardType;
      if (matchesTag || matchesElement || matchesType) ids.add(card.id);
    }
  }
  return [...ids];
}

/** Uma carta é usável como reação (oferecida quando o portador é alvejado) se for do tipo legado
 *  'protecao' ou tiver a condição de uso {type:'reacao'} — não depende mais de um `abilityType`
 *  específico, então qualquer carta (dano, cura, condição) pode ser desenhada como reação. */
export function isReactionCard(card: ArsenalCard): boolean {
  return card.abilityType === 'protecao' || card.conditions.some(condition => condition.type === 'reacao');
}

export function comboStackCandidates(combo: ArsenalCard, catalog: readonly ArsenalCard[], availableIds?: readonly string[]): ArsenalCard[] {
  if (combo.abilityType !== 'combo' || !combo.combo) return [];
  const available = availableIds ? new Set(availableIds) : null;
  const legacyAllowed = combo.combo.abilityIds?.length ? new Set(combo.combo.abilityIds) : null;
  return catalog.filter(card => card.id !== combo.id
    && card.category === 'habilidade'
    && card.abilityType === 'combo'
    && (!available || available.has(card.id))
    && (card.combo?.stackKey === combo.combo?.stackKey || legacyAllowed?.has(card.id)));
}

export function resolveComboCards(combo: ArsenalCard, selectedIds: readonly string[], catalog: readonly ArsenalCard[], availableIds?: readonly string[]): ArsenalCard[] {
  if (combo.abilityType !== 'combo' || !combo.combo) return [];
  const candidates = new Set(comboStackCandidates(combo, catalog, availableIds).map(card => card.id));
  const maxCompanions = Math.max(0, combo.combo.maxStacks - 1);
  const selected = [...new Set(selectedIds)]
    .filter(id => candidates.has(id))
    .map(id => catalog.find(card => card.id === id && card.category === 'habilidade'))
    .filter((card): card is ArsenalCard => !!card);
  return selected.length <= maxCompanions ? selected : [];
}

export function advanceArsenalState(
  holdings: readonly ArsenalHolding[],
  catalog: readonly ArsenalCard[],
  event: ArsenalStateEvent,
): ArsenalHolding[] {
  return holdings.map(holding => {
    const card = catalog.find(entry => entry.id === holding.cardId);
    if (!card) return { ...holding };
    const next = { ...holding };
    if (next.cooldownRemaining) {
      const decrement = (event === 'inicio_turno' && card.cooldown.type === 'turnos')
        || (event === 'inicio_rodada' && card.cooldown.type === 'rodadas')
        || (event === 'uso_manual' && card.cooldown.type === 'usos');
      const reset = (card.cooldown.type === 'gatilho' && card.cooldown.trigger === event)
        || (card.cooldown.type === 'fim_combate' && event === 'sair_combate')
        || (card.cooldown.type === 'descanso' && event === 'descanso');
      if (decrement) next.cooldownRemaining = Math.max(0, next.cooldownRemaining - 1);
      if (reset) next.cooldownRemaining = 0;
    }

    if (card.charges) {
      const recharge = card.charges.recharge;
      const shouldRecharge = (recharge.type === 'automatica' && event === 'uso_manual')
        || (recharge.type === 'por_turno' && event === 'inicio_turno')
        || (recharge.type === 'por_rodada' && event === 'inicio_rodada')
        || (recharge.type === 'por_evento' && recharge.event === event);
      const rechargeAmount = recharge.type === 'nao_recarrega' ? 0 : recharge.amount;
      if (shouldRecharge) {
        next.currentCharges = Math.min(card.charges.maximum, (next.currentCharges ?? card.charges.current) + rechargeAmount);
      }
    }
    return next;
  });
}

export interface FormAvailability {
  card: ArsenalCard;
  ok: boolean;
  reason: string | null;
  isActive: boolean;
}

/** Decide quais formas do catálogo o ator pode ativar agora, reusando a validação
 *  canônica do pipeline. A forma já ativa aparece com isActive=true e ok=false. */
export function activatableForms(
  actor: ArsenalActorState,
  catalog: readonly ArsenalCard[],
  loadout: ArsenalLoadout,
): FormAvailability[] {
  const owned = new Set(loadout.holdings.filter(h => h.quantity > 0).map(h => h.cardId));
  const forms = catalog.filter(card => card.abilityType === 'forma' && owned.has(card.id));
  return forms.map(card => {
    const isActive = loadout.activeFormIds.includes(card.id);
    if (isActive) return { card, ok: false, reason: null, isActive };
    const dryRun = resolveArsenalAction({ card, actor, targets: [actor] });
    const ok = dryRun.status !== 'bloqueada';
    return { card, ok, reason: ok ? null : dryRun.reason ?? 'Indisponível', isActive };
  });
}
