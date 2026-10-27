import { Card, Character, Item, OwnedItem, Seal, Weapon } from '../types';

/** Item do catálogo com a quantidade possuída anexada. */
export interface ResolvedItem extends Item {
  quantity: number;
  durability?: number;
  maxDurability?: number;
}

/** Reconstrói os itens completos que um personagem possui, a partir do catálogo.
 *  Referências órfãs (modelo deletado) são ignoradas. */
export function resolveOwnedItems(char: Character, catalog: Item[]): ResolvedItem[] {
  const owned = char.ownedItems ?? [];
  const out: ResolvedItem[] = [];
  for (const o of owned) {
    const tpl = catalog.find(i => i.id === o.itemId);
    if (!tpl) continue;
    out.push({ ...tpl, quantity: o.quantity, durability: o.durability ?? tpl.durability, maxDurability: o.maxDurability ?? tpl.maxDurability });
  }
  return out;
}

/** Retorna um novo array ownedItems com +qty do item (cria a entrada se faltar). */
export function giveOwned(char: Character, itemId: string, qty: number): OwnedItem[] {
  const owned = [...(char.ownedItems ?? [])];
  const idx = owned.findIndex(o => o.itemId === itemId);
  if (idx >= 0) owned[idx] = { ...owned[idx], quantity: owned[idx].quantity + qty };
  else owned.push({ itemId, quantity: qty });
  return owned;
}

/** Retorna um novo array ownedItems com -qty (remove a entrada se chegar a 0). */
export function consumeOwned(char: Character, itemId: string, qty: number): OwnedItem[] {
  const owned = [...(char.ownedItems ?? [])];
  const idx = owned.findIndex(o => o.itemId === itemId);
  if (idx < 0) return owned;
  const newQty = owned[idx].quantity - qty;
  if (newQty <= 0) owned.splice(idx, 1);
  else owned[idx] = { ...owned[idx], quantity: newQty };
  return owned;
}

/** Define a quantidade exata (remove se <= 0). */
export function setOwnedQuantity(char: Character, itemId: string, qty: number): OwnedItem[] {
  if (qty <= 0) return (char.ownedItems ?? []).filter(o => o.itemId !== itemId);
  const owned = [...(char.ownedItems ?? [])];
  const idx = owned.findIndex(o => o.itemId === itemId);
  if (idx >= 0) owned[idx] = { ...owned[idx], quantity: qty };
  else owned.push({ itemId, quantity: qty });
  return owned;
}

/** Remove totalmente a posse de um item. */
export function removeOwned(char: Character, itemId: string): OwnedItem[] {
  return (char.ownedItems ?? []).filter(o => o.itemId !== itemId);
}

/** Aplica o gasto de uso de combate: pode consumir quantidade, durabilidade, ou ambos. */
export function consumeItemActivation(char: Character, item: ResolvedItem): OwnedItem[] {
  const owned = [...(char.ownedItems ?? [])];
  const idx = owned.findIndex(o => o.itemId === item.id);
  if (idx < 0) return owned;
  const current = owned[idx];
  const quantityCost = item.consumeOnUse ? Math.max(1, item.usesPerActivation ?? 1) : 0;
  const wear = Math.max(0, item.wearPerUse ?? 0);
  let nextQuantity = current.quantity - quantityCost;
  let nextDurability = current.durability ?? item.durability ?? item.maxDurability;
  const maxDurability = current.maxDurability ?? item.maxDurability;

  if (wear > 0 && nextDurability !== undefined) {
    nextDurability -= wear;
    if (nextDurability <= 0) {
      nextQuantity -= 1;
      nextDurability = maxDurability;
    }
  }

  if (nextQuantity <= 0) owned.splice(idx, 1);
  else owned[idx] = {
    ...current,
    quantity: nextQuantity,
    ...(nextDurability !== undefined ? { durability: nextDurability } : {}),
    ...(maxDurability !== undefined ? { maxDurability } : {}),
  };
  return owned;
}

/** Reconstrói as armas que um personagem possui, a partir do catálogo. */
export function resolveWeapons(char: Character, catalogue: Weapon[]): Weapon[] {
  return (char.weaponIds ?? [])
    .map(id => catalogue.find(w => w.id === id))
    .filter(Boolean) as Weapon[];
}

/** Reconstrói as cartas que um personagem possui, a partir do catálogo (ignora órfãs, preserva ordem). */
export function resolveCards(char: Character, catalogue: Card[]): Card[] {
  return (char.cardIds ?? [])
    .map(id => catalogue.find(c => c.id === id))
    .filter(Boolean) as Card[];
}

/** Reconstrói os selos que um personagem possui, a partir do catálogo (ignora órfãos, preserva ordem). */
export function resolveSeals(char: Character, catalogue: Seal[]): Seal[] {
  return (char.sealIds ?? [])
    .map(id => catalogue.find(s => s.id === id))
    .filter(Boolean) as Seal[];
}
