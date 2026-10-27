import React from 'react';
import { ScrollText } from 'lucide-react';
import type { Card, Character, Item, Seal, Weapon } from '../types';
import type { CenaState, SceneState, OngoingEffectState } from '../utils/cena';
import { setScene, setEncounterPaused, removeNpc, toggleNpcHidden, toggleNpcPresent, setToken, updateNpcStats, appendLog, logEntry } from '../utils/cena';
import { actorActions, normalizeArsenalCard, normalizeAbilityGraph, resolveAction, applyStatDelta, type ResolvedAction, type StatSnapshot } from '../utils/actions';
import type { AbilityGraph } from '../utils/abilityGraph';
import { mergeLevel } from '../utils/abilityGraph';
import { resolveAbilityGraphAction, activatableGraphForms, graphFormaVisual, runOngoingEffect, graphComboConfig, advanceAbilityGraphCooldowns, unlockedAbilityGraphIds } from '../utils/abilityGraphAction';
import type { MovementIntent, OngoingEffectIntent } from '../utils/abilityInterpreter';
import { resolveMovementIntents } from '../utils/movementResolver';
import { graphAreaConfig, resolveAreaTargets, type AreaShapeConfig } from '../utils/abilityArea';
import { effectiveTokens } from '../utils/mapPositions';

const AREA_SELF_CENTERED: ReadonlySet<AreaShapeConfig['shape']> = new Set(['raio', 'quadrado']);
import { buildAbilityGraphCombatLog } from '../utils/combatLogGraph';
import { graphComboStackCandidates, resolveGraphComboSelection } from '../utils/abilityGraphCombo';
import { startEncounter, advanceTurn, reorderEncounter, moveInOrder, tickFieldEffects, addParticipantToOrder, removeParticipantFromOrder } from '../utils/encounter';
import { consumeItemActivation, resolveCards, resolveSeals, resolveOwnedItems, resolveWeapons } from '../utils/items';
import LogPanel from './cena/LogPanel';
import MapBoard, { type TargetEffect, type TargetEffectKind } from './cena/MapBoard';
import RosterPanel, { type ActiveRef, type TargetImpactPreview, type TokenFormaState } from './cena/RosterPanel';
import ActionMenu from './cena/ActionMenu';
import type { RollResult } from '../utils/dice';
import { rollDice } from '../utils/dice';
import SceneBackdrop from './cena/SceneBackdrop';
import PauseCurtain from './cena/PauseCurtain';
import CombatantEditor from './cena/CombatantEditor';
import CombatCinematics from './cena/CombatCinematics';
import FieldEffectsBar from './cena/FieldEffectsBar';
import { arsenalCardAtLevel, type ArsenalCard } from '../utils/arsenal';
import { getPredefinedEffect } from '../utils/arsenalEffects';
import { activatableForms, activateForm, advanceArsenalState, availableCardIds, comboStackCandidates, equipWeapon, isReactionCard, resolveComboCards, unlockedCardIds, type FormAvailability } from '../utils/arsenalState';
import { activeOrderAdjustment, advanceTurnEndEffects, applyActiveEffect, consumePrincipalBlock, resolveArsenalAction, resolveComboAction, tickActiveEffects, type ArsenalActorState } from '../utils/arsenalPipeline';
import { buildArsenalCombatLog } from '../utils/combatLog';
import { migrateCharacterDefense, processDefenseRound, processStaggeredTurn, resolveDefenseHit } from '../utils/defense';
import { removeActiveEffects } from '../utils/abilityPrimitives';

export interface CenaTabProps {
  cena: CenaState;
  characters: Character[];
  cards: Card[];
  seals: Seal[];
  items: Item[];
  weapons: Weapon[];
  arsenal?: ArsenalCard[];
  abilityGraphs?: AbilityGraph[];
  updateCena: (next: CenaState) => void;
  updateCharacterStats: (charId: string, updates: Partial<Character>) => void;
  onDiceRoll?: (roll: RollResult, options?: {
    isSuccess?: boolean;
    customLabel?: string;
    finalTotal?: number;
    adjustments?: Array<{ label: string; value: number }>;
    defenderResult?: number;
    defenderRoll?: RollResult;
    defenderBase?: number;
    actorLabel?: string;
    defenderLabel?: string;
    dramatic?: boolean;
    onReveal?: () => void;
    onComplete?: () => void;
  }) => void;
}

const conditionColor = (name: string): string => {
  let hash = 0;
  for (const char of name) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 78% 66%)`;
};

const diceBonusOf = (notation: string): number => {
  const match = notation.match(/[+-]\d+(?!.*[+-]\d)/);
  return match ? Number(match[0]) : 0;
};

const accuracyTone = (bonus: number, defense: number): { label: string; gap: number } => {
  const expected = 10.5 + bonus;
  const gap = Math.round(expected - defense);
  if (gap >= 6) return { label: 'FAVORÁVEL', gap };
  if (gap >= 0) return { label: 'EQUILIBRADO', gap };
  if (gap >= -5) return { label: 'ARRISCADO', gap };
  return { label: 'DIFÍCIL', gap };
};

const CenaTab: React.FC<CenaTabProps> = ({ cena, characters, cards, seals, items, weapons, arsenal = [], abilityGraphs = [], updateCena, updateCharacterStats, onDiceRoll }) => {
  const [active, setActive] = React.useState<ActiveRef | null>(null);
  const [armed, setArmed] = React.useState<ResolvedAction | null>(null);
  const [previewAction, setPreviewAction] = React.useState<ResolvedAction | null>(null);
  const [pendingLogIds, setPendingLogIds] = React.useState<string[]>([]);
  const [pendingProtection, setPendingProtection] = React.useState<{ targetId:string; action:ResolvedAction; cards:ArsenalCard[]; graphs?:AbilityGraph[] }|null>(null);
  const [pendingTargetId, setPendingTargetId] = React.useState<string | null>(null);
  const [comboDraft, setComboDraft] = React.useState<ArsenalCard|null>(null);
  const [comboGraphDraft, setComboGraphDraft] = React.useState<AbilityGraph|null>(null);
  const [comboSelection, setComboSelection] = React.useState<string[]>([]);
  const [logOpen, setLogOpen] = React.useState(true);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [gmDashboardOpen, setGmDashboardOpen] = React.useState(false);
  const [arsenalLevels,setArsenalLevels] = React.useState<Record<string,number>>({});
  const [targetEffect, setTargetEffect] = React.useState<TargetEffect | null>(null);
  const hideLogUntilDiceComplete = React.useCallback((ids: string[], after?: () => void) => {
    if (!ids.length || !onDiceRoll) return after;
    setPendingLogIds(current => [...current, ...ids]);
    return () => {
      setPendingLogIds(current => current.filter(id => !ids.includes(id)));
      after?.();
    };
  }, [onDiceRoll]);
  React.useEffect(() => {
    if (!armed) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      event.preventDefault();
      setArmed(null);
      setPendingTargetId(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [armed]);
  React.useEffect(() => { setPendingTargetId(null); }, [armed?.id]);
  const [formaActivation, setFormaActivation] = React.useState<{ key:number; characterName:string; formName:string; color?:string; image?:string } | null>(null);
  const [rareEvent, setRareEvent] = React.useState<{ key:number; kind:'break'|'defeat'|'stagger'|'critical'|'fumble'|'reaction'|'massive-heal'|'forma-expire'; label:string; detail?:string; image?:string } | null>(null);
  const [consequence, setConsequence] = React.useState<{ key:number; tone:'damage'|'heal'|'condition'|'evade'; label:string; detail:string } | null>(null);
  const targetEffectTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const encounterInitialized = React.useRef(false);
  const gmDashboardWindow = React.useRef<Window | null>(null);
  const combat = true;

  const toggleGmDashboard = React.useCallback(() => {
    const win = gmDashboardWindow.current;
    if (win && !win.closed) { win.close(); gmDashboardWindow.current = null; setGmDashboardOpen(false); return; }
    const opened = window.open('?view=gm-dashboard', 'vat-gm-dashboard', 'popup,width=1200,height=860');
    gmDashboardWindow.current = opened;
    setGmDashboardOpen(!!opened);
  }, []);
  const toggleEncounterPause = React.useCallback(() => {
    updateCena(setEncounterPaused(cena, !cena.encounter.isPaused));
  }, [cena, updateCena]);
  React.useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
    };
    const handler = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || isTyping(event.target)) return;
      if (event.key !== 'Escape' && event.key.toLocaleLowerCase() !== 'm') return;
      event.preventDefault();
      if (event.key === 'Escape') toggleGmDashboard();
      else toggleEncounterPause();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleEncounterPause, toggleGmDashboard]);
  React.useEffect(() => {
    if (!gmDashboardOpen) return;
    const timer = window.setInterval(() => {
      if (gmDashboardWindow.current?.closed) {
        gmDashboardWindow.current = null;
        setGmDashboardOpen(false);
      }
    }, 700);
    return () => window.clearInterval(timer);
  }, [gmDashboardOpen]);
  React.useEffect(() => () => { gmDashboardWindow.current?.close(); }, []);

  const playTargetEffect = React.useCallback((effect: Omit<TargetEffect, 'id'>) => {
    if (targetEffectTimer.current) clearTimeout(targetEffectTimer.current);
    setTargetEffect({ ...effect, id: `target-fx-${Date.now()}-${Math.random().toString(36).slice(2)}` });
    const hp = effect.hpDelta ?? 0;
    const tone = effect.kinds.includes('heal') ? 'heal' : effect.kinds.includes('evade') ? 'evade' : effect.kinds.includes('condition') ? 'condition' : 'damage';
    const label = tone === 'heal' ? 'RECUPERACAO' : tone === 'evade' ? 'EVITOU' : tone === 'condition' ? 'CONDICAO' : 'IMPACTO';
    const detail = effect.conditionName ?? (hp ? `${hp > 0 ? '+' : '-'}${Math.abs(hp)} HP` : effect.kinds.join(' / ').toUpperCase());
    setConsequence({ key: Date.now(), tone, label, detail });
    targetEffectTimer.current = setTimeout(() => setTargetEffect(null), 1300);
  }, []);
  const playRareEvent = React.useCallback((before: Character, after: Character) => {
    const beforeDefense = migrateCharacterDefense(before);
    const afterDefense = migrateCharacterDefense(after);
    const key = Date.now();
    if (before.currentHp > 0 && after.currentHp <= 0) {
      setRareEvent({ key, kind: 'defeat', label: after.name, detail: 'DERROTADO', image: after.icon });
    } else if (!beforeDefense.isStaggered && afterDefense.isStaggered) {
      setRareEvent({ key, kind: 'stagger', label: after.name, detail: 'DESNORTEADO', image: after.icon });
    } else if (!beforeDefense.isDefenseBroken && afterDefense.isDefenseBroken) {
      setRareEvent({ key, kind: 'break', label: after.name, detail: 'BREAK DE DEFESA', image: after.icon });
    }
  }, []);
  const playRollRareEvent = React.useCallback((roll: RollResult, actorName: string, image?: string) => {
    const key = Date.now();
    if (roll.total === 20) setRareEvent({ key, kind: 'critical', label: actorName, detail: 'CRITICO', image });
    else if (roll.total === 1) setRareEvent({ key, kind: 'fumble', label: actorName, detail: 'FALHA CRITICA', image });
  }, []);
  React.useEffect(() => () => {
    if (targetEffectTimer.current) clearTimeout(targetEffectTimer.current);
  }, []);

  const fullCast = characters;
  const party = fullCast.filter(c => !cena.benchedCastIds.includes(c.id));
  // Entradas antigas do roster só continuam ativas quando não existe mais a
  // ficha correspondente. Isso evita duplicar personagens em campanhas salvas.
  const presentNpcs = cena.npcRoster.filter(n => n.present && !n.hidden && !characters.some(c => c.id === n.id));
  const participants: Character[] = [...party, ...presentNpcs];

  const byId = (id: string): Character | null =>
    party.find(c => c.id === id) ?? cena.npcRoster.find(n => n.id === id) ?? null;
  const initiativeParticipants = participants.map(p => ({
    id: p.id, side: (party.some(c => c.id === p.id) ? 'party' : 'npc') as 'party' | 'npc',
    name: p.name, baseInitiative: p.speed ?? p.baseInitiative ?? 0,
  }));
  React.useEffect(() => {
    if (cena.encounter.isActive || encounterInitialized.current) return;
    encounterInitialized.current = true;
    updateCena(startEncounter(cena, initiativeParticipants, ({ participant, roll, logEntryId }) => {
      if (onDiceRoll) setPendingLogIds(ids => [...ids, logEntryId]);
      onDiceRoll?.(roll, {
        customLabel: 'INICIATIVA', actorLabel: participant.name,
        onReveal: () => setPendingLogIds(ids => ids.filter(id => id !== logEntryId)),
      });
    }));
  }, [cena.encounter.isActive]);

  // Mantém a ordem de turnos sincronizada com quem está de fato na cena: quem entra
  // (personagem desbanido, NPC invocado, ficha recém-criada) ganha uma rolagem de
  // iniciativa individual e é inserido na ordem; quem sai (banido, NPC removido,
  // ficha excluída) é retirado dela. Não mexe na iniciativa de quem já estava.
  const participantIdsKey = initiativeParticipants.map(p => p.id).sort().join(',');
  React.useEffect(() => {
    if (!cena.encounter.isActive) return;
    const currentIds = new Set(cena.encounter.order.map(entry => entry.refId));
    const wantedIds = new Set(initiativeParticipants.map(p => p.id));
    const toRemove = cena.encounter.order.map(entry => entry.refId).filter(id => !wantedIds.has(id));
    const toAdd = initiativeParticipants.filter(p => !currentIds.has(p.id));
    if (toRemove.length === 0 && toAdd.length === 0) return;
    let encounter = cena.encounter;
    for (const id of toRemove) encounter = removeParticipantFromOrder(encounter, id);
    let logs: ReturnType<typeof addParticipantToOrder>['log'] = [];
    for (const participant of toAdd) {
      const result = addParticipantToOrder(encounter, participant);
      encounter = result.encounter;
      logs = [...logs, ...result.log];
    }
    updateCena(logs.length ? appendLog({ ...cena, encounter }, logs) : { ...cena, encounter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cena.encounter.isActive, participantIdsKey]);

  const turnEntry = combat ? cena.encounter.order[cena.encounter.turnIndex] : undefined;
  const turnActor = turnEntry ? byId(turnEntry.refId) : null;
  const isDefeatedEntry = (e: { refId: string }) => { const c = byId(e.refId); return !!c && c.currentHp <= 0; };

  const selectedChar: Character | null = !active
    ? null
    : active.side === 'party'
      ? party.find(c => c.id === active.id) ?? null
      : cena.npcRoster.find(n => n.id === active.id) ?? null;
  const activeChar: Character | null = combat ? turnActor : selectedChar;

  const targetableIds = React.useMemo(() => {
    if (!armed || !turnActor) return [];
    if (armed.targeting === 'self') return [turnActor.id];
    return participants.filter(p => p.currentHp > 0).map(p => p.id);
  }, [armed, turnActor?.id, participants]);

  /** Config de área (linha/raio/cone/quadrado) da habilidade armada, lida do nó 'alvo' do grafo sem
   *  rodar o interpretador — usada só pra pré-visualizar a área no grid antes de resolver de fato. */
  const armedAreaConfig = React.useMemo<AreaShapeConfig | null>(() => {
    if (!armed?.abilityGraph) return null;
    return graphAreaConfig(armed.abilityGraph, armed.abilityGraphLevel ?? 1);
  }, [armed]);

  /** Ids destacados no grid como "dentro da área" da habilidade armada — raio/quadrado calculam assim que
   *  armada (centrados no próprio ator); linha/cone só depois que um alvo pendente define a mira. */
  const areaPreviewIds = React.useMemo(() => {
    if (!armedAreaConfig || !turnActor) return [];
    const aimAtId = AREA_SELF_CENTERED.has(armedAreaConfig.shape) ? null : pendingTargetId;
    if (!AREA_SELF_CENTERED.has(armedAreaConfig.shape) && !aimAtId) return [];
    const candidateIds = participants.map(p => p.id);
    // effectiveTokens preenche com a mesma posição visual de fallback do MapBoard pra quem ainda não
    // foi arrastado no mapa — sem isso, a área nunca acertava ninguém que não tivesse cena.tokens[id].
    const tokensForArea = effectiveTokens(cena.tokens, participants.map(p => p.id));
    return resolveAreaTargets(armedAreaConfig, turnActor.id, aimAtId, tokensForArea, candidateIds);
  }, [armedAreaConfig, turnActor?.id, pendingTargetId, participants, cena.tokens]);

  const targetImpacts = React.useMemo<Record<string, TargetImpactPreview>>(() => {
    if (!armed || !turnActor) return {};
    const ids = armed.targeting === 'self' ? [turnActor.id] : targetableIds;
    return ids.reduce<Record<string, TargetImpactPreview>>((acc, id) => {
      const target = byId(id);
      if (!target) return acc;
      const intent: TargetImpactPreview['intent'] = armed.healHp ? 'heal' : armed.damage || armed.damageValue || armed.impactValue ? 'attack' : armed.conditionName ? 'debuff' : 'buff';
      const defenseValue = target.defense ?? 10;
      const bonus = diceBonusOf(armed.diceRoll || '1d20');
      const tone = accuracyTone(bonus, defenseValue);
      const impact: TargetImpactPreview = {
        intent,
        accuracyLabel: tone.label,
        comparison: `${armed.diceRoll || '1d20'} vs DEF ${defenseValue}`,
      };
      const heal = Math.max(0, armed.healHp ?? 0);
      const damage = Math.max(0, armed.damageValue ?? armed.damage ?? 0);
      if (heal > 0) impact.hpDelta = Math.min(heal, Math.max(0, target.maxHp - target.currentHp));
      if (damage > 0) {
        const defense = resolveDefenseHit(migrateCharacterDefense(target), damage);
        if (defense.defenseDamage > 0) impact.defenseDelta = -defense.defenseDamage;
        if (defense.staggerDamage > 0) impact.staggerDelta = defense.staggerDamage;
        if (defense.healthDamage > 0) impact.hpDelta = -(defense.healthDamage);
        if (defense.defenseBroken) impact.note = 'BREAK';
        if (defense.enteredStaggered) impact.note = 'STAGGER';
      }
      if (armed.conditionName) impact.note = impact.note ?? armed.conditionName;
      acc[id] = impact;
      return acc;
    }, {});
  }, [armed, targetableIds, turnActor?.id, party, cena.npcRoster]);

  const activeCards = activeChar ? resolveCards(activeChar, cards) : [];
  const activeSeals = activeChar ? resolveSeals(activeChar, seals) : [];
  const activeItems = activeChar ? resolveOwnedItems(activeChar, items) : [];
  const activeWeapons = activeChar ? resolveWeapons(activeChar, weapons) : [];
  const loadoutOf = (character:Character) => ({
    holdings:character.arsenal??[],
    equippedWeaponIds:(character.arsenal??[]).filter(h=>h.equipped).map(h=>h.cardId),
    activeFormIds:(character.arsenal??[]).filter(h=>h.active).map(h=>h.cardId),
  });
  const activeLoadout = activeChar ? loadoutOf(activeChar) : { holdings:[], equippedWeaponIds:[], activeFormIds:[] };
  const holdingLevelCap = (entryId:string) => activeLoadout.holdings.find(holding=>holding.cardId===entryId)?.maxLevel;
  const cappedLevel = (entryId:string) => Math.max(1, Math.min(arsenalLevels[entryId]??holdingLevelCap(entryId)??1, holdingLevelCap(entryId)??Infinity));
  const leveledArsenal = arsenal.map(card=>arsenalCardAtLevel(card,cappedLevel(card.id)));
  /** Critérios de 'liberar_cartas' de efeitos contínuos ativos do personagem selecionado (ex.: forma que
   *  libera cartas não atribuídas a ele enquanto durar). */
  const activeUnlockCriteria = activeChar
    ? cena.encounter.activeOngoingEffects.filter(entry => entry.ownerId === activeChar.id).flatMap(entry => entry.unlockCardIntents ?? [])
    : [];
  const activeUnlockedArsenalIds = unlockedCardIds(activeUnlockCriteria, leveledArsenal);
  const activeArsenalIds = activeChar ? [...new Set([...availableCardIds(activeLoadout, leveledArsenal), ...activeUnlockedArsenalIds])] : [];
  const activeArsenalCards = leveledArsenal.filter(card => activeArsenalIds.includes(card.id));
  const leveledAbilityGraphs = abilityGraphs.map(graph => mergeLevel(graph,cappedLevel(graph.id)));
  const activeUnlockedGraphIds = unlockedAbilityGraphIds(activeUnlockCriteria, abilityGraphs);
  const activeAbilityGraphIds = activeChar ? [...new Set([...(activeChar.arsenal??[]).map(h=>h.cardId), ...activeUnlockedGraphIds])] : [];
  const activeAbilityGraphs = activeChar
    ? abilityGraphs
        .filter(graph => (activeChar.arsenal??[]).some(h=>h.cardId===graph.id) || activeUnlockedGraphIds.includes(graph.id))
        .map(graph => ({ graph, level: cappedLevel(graph.id) }))
    : [];
  const activeArsenalWeapons = activeArsenalCards.filter(card => card.category==='arma');

  const snapOf = (c: Character): StatSnapshot => {
    const defense = migrateCharacterDefense(c);
    return {
      currentHp: c.currentHp, maxHp: c.maxHp, currentAura: c.currentAura, maxAura: c.maxAura,
      currentAmmo: c.currentAmmo, maxAmmo: c.maxAmmo, defense: c.defense,
      defenseMax: defense.defenseMax, defenseCurrent: defense.defenseCurrent, defenseReduction: defense.defenseReduction,
      defenseRegeneration: defense.defenseRegeneration, defenseActivationThreshold: defense.defenseActivationThreshold,
      staggerMax: defense.staggerMax, staggerCurrent: defense.staggerCurrent, staggerRecovery: defense.staggerRecovery,
      staggerDamageMultiplier: defense.staggerDamageMultiplier, staggerDuration: defense.staggerDuration,
      isDefenseBroken: defense.isDefenseBroken, isStaggered: defense.isStaggered,
      staggerTurnsRemaining: defense.staggerTurnsRemaining,
      conditions: [],
    };
  };

  const applyDeltaTo = (cur: CenaState, id: string, delta: { hp?: number; aura?: number; ammo?: number }, defenseDelta?: Partial<Character>): CenaState => {
    const c = byId(id); if (!c) return cur;
    const stats = applyStatDelta(c, delta);
    const updates = { ...stats, ...(defenseDelta ?? {}) };
    if (party.some(p => p.id === id)) { updateCharacterStats(id, updates); return cur; }
    return updateNpcStats(cur, id, updates);
  };

  const fieldEffectStates = ():ArsenalActorState['effects'] =>
    cena.encounter.fieldEffects.map(fe => ({ effect: fe.effect, stacks: 1, remaining: fe.roundsRemaining ?? undefined }));

  const actorState = (character:Character):ArsenalActorState => {
    const defense = migrateCharacterDefense(character);
    return {
      id:character.id, teamId:character.teamOverride??(party.some(p=>p.id===character.id)?'party':'npc'), name:character.name,
      currentHp:character.currentHp,maxHp:character.maxHp,currentAura:character.currentAura,maxAura:character.maxAura,
      currentAmmo:character.currentAmmo,maxAmmo:character.maxAmmo,
      defense:character.defense??10,
      defenseCurrent:defense.defenseCurrent,defenseMax:defense.defenseMax,defenseReduction:defense.defenseReduction,
      defenseRegeneration:defense.defenseRegeneration,defenseActivationThreshold:defense.defenseActivationThreshold,
      staggerCurrent:defense.staggerCurrent,staggerMax:defense.staggerMax,staggerRecovery:defense.staggerRecovery,
      staggerDamageMultiplier:defense.staggerDamageMultiplier,staggerDuration:defense.staggerDuration,
      isDefenseBroken:defense.isDefenseBroken,isStaggered:defense.isStaggered,staggerTurnsRemaining:defense.staggerTurnsRemaining,
      speed:character.speed??character.baseInitiative??0,tags:[],
      equippedWeaponIds:(character.arsenal??[]).filter(h=>h.equipped).map(h=>h.cardId),
      activeFormIds:(character.arsenal??[]).filter(h=>h.active).map(h=>h.cardId),effects:[...(character.activeEffects??[]),...fieldEffectStates()],
      holdings:(character.arsenal??[]).map(h=>({...h})),isCurrentTurn:turnActor?.id===character.id,inCombat:combat,
    };
  };

  const byIdIn = (cur: CenaState, id: string): Character | null =>
    party.find(c => c.id === id) ?? cur.npcRoster.find(n => n.id === id) ?? null;

  const actorStateIn = (cur: CenaState, character: Character): ArsenalActorState => ({
    ...actorState(character),
    effects: [...(character.activeEffects ?? []), ...cur.encounter.fieldEffects.map(fe => ({ effect: fe.effect, stacks: 1, remaining: fe.roundsRemaining ?? undefined }))],
  });

  const turnFormAvailability: FormAvailability[] = turnActor
    ? activatableForms(actorState(turnActor), leveledArsenal, loadoutOf(turnActor))
    : [];
  const turnGraphFormAvailability = turnActor
    ? activatableGraphForms(actorState(turnActor), leveledAbilityGraphs, loadoutOf(turnActor))
    : [];

  const formaStates: Record<string, TokenFormaState> = {};
  for (const p of participants) {
    const activeForma = cena.encounter.activeFormas.find(f => f.ownerId === p.id);
    if (activeForma) {
      const card = leveledArsenal.find(c => c.id === activeForma.entryId);
      const graph = card ? undefined : leveledAbilityGraphs.find(g => g.id === activeForma.entryId);
      const graphVisual = graph ? graphFormaVisual(graph, arsenalLevels[graph.id] ?? 1) : undefined;
      formaStates[p.id] = { ring: 'active', color: card?.form?.color ?? graphVisual?.color, iconOverride: card?.form?.iconOverride ?? graphVisual?.iconOverride };
    } else {
      const readyCard = p.id === turnActor?.id ? turnFormAvailability.find(f => f.ok) : undefined;
      const readyGraph = !readyCard && p.id === turnActor?.id ? turnGraphFormAvailability.find(f => f.ok) : undefined;
      if (readyCard) formaStates[p.id] = { ring: 'available', color: readyCard.card.form?.color };
      else if (readyGraph) formaStates[p.id] = { ring: 'available', color: graphFormaVisual(readyGraph.graph, arsenalLevels[readyGraph.graph.id] ?? 1).color };
    }
  }
  const formaIconOverrides = Object.fromEntries(Object.entries(formaStates).map(([id, state]) => [id, state.ring === 'active' ? state.iconOverride : undefined]));
  const formaAuraColors = Object.fromEntries(Object.entries(formaStates).map(([id, state]) => [id, state.ring === 'active' ? state.color : undefined]));
  const formaAvailableColors = Object.fromEntries(Object.entries(formaStates).map(([id, state]) => [id, state.ring === 'available' ? (state.color ?? '#f59e0b') : undefined]));
  const turnForma = turnActor ? formaStates[turnActor.id] : undefined;
  const turnVisual = turnForma?.ring === 'active' && turnForma.iconOverride
    ? turnForma.iconOverride
    : turnActor?.bannerImage || turnActor?.icon;

  const applyArsenalActor = (cur:CenaState, original:Character, state:ArsenalActorState):CenaState => {
    const fieldEffectIds=new Set(cena.encounter.fieldEffects.map(field=>field.effect.id));
    const updates:Partial<Character>={
      currentHp:state.currentHp,
      currentAura:state.currentAura,
      currentAmmo:state.currentAmmo,
      defenseMax:state.defenseMax,
      defenseCurrent:state.defenseCurrent,
      defenseReduction:state.defenseReduction,
      defenseRegeneration:state.defenseRegeneration,
      defenseActivationThreshold:state.defenseActivationThreshold,
      staggerMax:state.staggerMax,
      staggerCurrent:state.staggerCurrent,
      staggerRecovery:state.staggerRecovery,
      staggerDamageMultiplier:state.staggerDamageMultiplier,
      staggerDuration:state.staggerDuration,
      isDefenseBroken:state.isDefenseBroken,
      isStaggered:state.isStaggered,
      staggerTurnsRemaining:state.staggerTurnsRemaining,
      arsenal:state.holdings,
      activeEffects:state.effects.filter(activeEffect=>!fieldEffectIds.has(activeEffect.effect.id)),
    };
    if(party.some(p=>p.id===original.id)){updateCharacterStats(original.id,updates);return cur;}
    return updateNpcStats(cur,original.id,updates);
  };

  const persistCharacter = (cur: CenaState, id: string, updates: Partial<Character>): CenaState => {
    if (party.some(p => p.id === id)) { updateCharacterStats(id, updates); return cur; }
    return updateNpcStats(cur, id, updates);
  };

  /** Registra as intenções de 'aplicar_como_efeito' de um resultado de habilidade-grafo como activeOngoingEffects. */
  const registerOngoingEffects = (
    cur: CenaState, graphId: string, intents: OngoingEffectIntent[],
  ): CenaState => {
    if (!intents.length) return cur;
    const entries: OngoingEffectState[] = intents.map(intent => ({
      id: `ongoing-${crypto.randomUUID()}`, ownerId: intent.targetId, casterId: intent.casterId, graphId, roundsRemaining: intent.rounds,
      ...(intent.pendingReactions?.length ? { pendingReactions: intent.pendingReactions } : {}),
      ...(intent.unlockCardIntents?.length ? { unlockCardIntents: intent.unlockCardIntents } : {}),
    }));
    return { ...cur, encounter: { ...cur.encounter, activeOngoingEffects: [...cur.encounter.activeOngoingEffects, ...entries] } };
  };

  const revertForma = (cur: CenaState, character: Character): CenaState => {
    const state = cur.encounter.activeFormas.find(f => f.ownerId === character.id);
    const loadout = loadoutOf(character);
    const activeId = loadout.activeFormIds[0];
    const next = activateForm(loadout, null);
    const nextMaxHp = Math.max(1, character.maxHp - (state?.hpBonusApplied ?? 0));
    const nextMaxAura = Math.max(0, character.maxAura - (state?.auraBonusApplied ?? 0));
    const activeEffects = (character.activeEffects ?? []).filter(active => active.effect.duration.type !== 'enquanto_forma_ativa');
    let result: CenaState = persistCharacter(cur, character.id, {
      arsenal: next.holdings,
      maxHp: nextMaxHp,
      currentHp: Math.min(character.currentHp, nextMaxHp),
      maxAura: nextMaxAura,
      currentAura: Math.min(character.currentAura, nextMaxAura),
      activeEffects,
    });
    result = { ...result, encounter: { ...result.encounter, activeFormas: result.encounter.activeFormas.filter(f => f.ownerId !== character.id) } };
    const formaName = leveledArsenal.find(c => c.id === activeId)?.name ?? leveledAbilityGraphs.find(g => g.id === activeId)?.header.name;
    if (formaName) result = appendLog(result, [logEntry('system', `${character.name} deixa a forma ${formaName}.`)]);
    return result;
  };

  const activateFormaFor = (character: Character, formId: string) => {
    // Se já há forma ativa, reverte antes (troca paga o custo da nova).
    let cur = cena;
    const already = loadoutOf(character).activeFormIds[0];
    if (already && already !== formId) cur = revertForma(cur, character);
    else if (already === formId) { updateCena(revertForma(cur, character)); return; }
    const fresh = byIdIn(cur, character.id) ?? character;
    const formaCard = leveledArsenal.find(c => c.id === formId);
    if (!formaCard) return;
    const result = resolveArsenalAction({ card: formaCard, actor: actorStateIn(cur, fresh), targets: [actorStateIn(cur, fresh)] });
    if (result.status === 'bloqueada') { updateCena(appendLog(cur, [logEntry('system', `${fresh.name}: ${result.reason}.`)])); return; }
    const loadout = activateForm(loadoutOf(fresh), formId);
    const hpBonus = formaCard.form?.hpBonus ?? 0;
    const auraBonus = formaCard.form?.auraBonus ?? 0;
    // result.actor já pagou a aura do custo; somamos o bônus por cima.
    const newMaxHp = fresh.maxHp + hpBonus;
    const newMaxAura = fresh.maxAura + auraBonus;
    const grantedEffects = formaCard.form?.effects ?? [];
    const activeEffects = grantedEffects.reduce(
      (acc, effect) => applyActiveEffect(acc, { ...effect, duration: { type: 'enquanto_forma_ativa' } }),
      fresh.activeEffects ?? [],
    );
    let next = persistCharacter(cur, fresh.id, {
      arsenal: loadout.holdings,
      maxHp: newMaxHp,
      currentHp: Math.min(newMaxHp, result.actor.currentHp + hpBonus),
      maxAura: newMaxAura,
      currentAura: Math.min(newMaxAura, result.actor.currentAura + auraBonus),
      activeEffects,
    });
    const rounds = formaCard.form?.durationRounds ?? 0;
    next = { ...next, encounter: { ...next.encounter, activeFormas: [
      ...next.encounter.activeFormas.filter(f => f.ownerId !== fresh.id),
      { ownerId: fresh.id, entryId: formId, roundsRemaining: rounds && rounds > 0 ? rounds : 0, hpBonusApplied: hpBonus, auraBonusApplied: auraBonus },
    ] } };
    next = appendLog(next, [logEntry('system', `${fresh.name} assume a forma ${formaCard.name}.`)]);
    setFormaActivation({
      key: Date.now(),
      characterName: fresh.name,
      formName: formaCard.name,
      color: formaCard.form?.color,
      image: formaCard.form?.iconOverride || fresh.bannerImage || fresh.icon,
    });
    updateCena(next);
  };

  /** Equivalente de activateFormaFor para habilidades-grafo detectadas como forma (cor_token/icone_token) —?
   *  mesmo estado cena.encounter.activeFormas (genérico por id), mesma revertForma no toggle/expiração. */
  const activateAbilityGraphFormaFor = (character: Character, formId: string) => {
    let cur = cena;
    const already = loadoutOf(character).activeFormIds[0];
    if (already && already !== formId) cur = revertForma(cur, character);
    else if (already === formId) { updateCena(revertForma(cur, character)); return; }
    const fresh = byIdIn(cur, character.id) ?? character;
    const graph = leveledAbilityGraphs.find(g => g.id === formId);
    if (!graph) return;
    const result = resolveAbilityGraphAction({ graph, level: 1, actor: actorStateIn(cur, fresh), targets: [actorStateIn(cur, fresh)], roller: notation => rollDice(notation).total });
    if (result.status === 'bloqueada') { updateCena(appendLog(cur, [logEntry('system', `${fresh.name}: ${result.reason}.`)])); return; }
    const loadout = activateForm(loadoutOf(fresh), formId);
    const visual = graphFormaVisual(graph, arsenalLevels[graph.id] ?? 1);
    const newMaxHp = fresh.maxHp + visual.hpBonus;
    const newMaxAura = fresh.maxAura + visual.auraBonus;
    let next = persistCharacter(cur, fresh.id, {
      arsenal: loadout.holdings,
      maxHp: newMaxHp,
      currentHp: Math.min(newMaxHp, result.actor.currentHp + visual.hpBonus),
      maxAura: newMaxAura,
      currentAura: Math.min(newMaxAura, result.actor.currentAura + visual.auraBonus),
      activeEffects: result.actor.effects,
    });
    next = { ...next, encounter: { ...next.encounter, activeFormas: [
      ...next.encounter.activeFormas.filter(f => f.ownerId !== fresh.id),
      { ownerId: fresh.id, entryId: formId, roundsRemaining: 0, hpBonusApplied: visual.hpBonus, auraBonusApplied: visual.auraBonus },
    ] } };
    next = appendLog(next, [logEntry('system', `${fresh.name} assume a forma ${graph.header.name}.`)]);
    setFormaActivation({
      key: Date.now(), characterName: fresh.name, formName: graph.header.name,
      color: visual.color, image: visual.iconOverride || fresh.bannerImage || fresh.icon,
    });
    updateCena(next);
  };

  /** Qualquer carta usável como reação (abilityType 'protecao', legado, ou marcada com a condição de uso
   *  {type:'reacao'}) que o alvo possui e pode disparar agora. Não se restringe mais a bônus de defesa:
   *  a carta resolve normalmente via resolveArsenalAction (isReaction:true), então pode causar dano,
   *  curar ou aplicar condições — o bônus de defesa contra o ataque reagido vem da rolagem de teste dela. */
  const protectionCardsFor = (target:Character):ArsenalCard[] => {
    const ids=availableCardIds(loadoutOf(target),leveledArsenal);
    return leveledArsenal.filter(card=>{
      const holding=(target.arsenal??[]).find(item=>item.cardId===card.id);
      return ids.includes(card.id)&&card.category==='habilidade'&&isReactionCard(card)&&!(holding?.cooldownRemaining)&&(!card.charges||(holding?.currentCharges??card.charges.current)>0);
    });
  };

  /** Habilidades-grafo cuja raiz é "Quando alvejado" (ao_ser_alvejado), que o alvo possui e pode usar agora. */
  const ongoingGraphProtectionsFor = (target: Character): { graph: AbilityGraph; nodeIds: string[] }[] =>
    cena.encounter.activeOngoingEffects
      .filter(entry => entry.ownerId === target.id)
      .flatMap(entry => {
        const graph = leveledAbilityGraphs.find(candidate => candidate.id === entry.graphId);
        if (!graph) return [];
        return (entry.pendingReactions ?? [])
          .filter(reaction => reaction.eventType === 'ao_ser_alvejado')
          .map(reaction => ({ graph, nodeIds: reaction.nodeIds }));
      });

  const protectionAbilityGraphsFor = (target:Character):AbilityGraph[] => {
    const ownedReactions = leveledAbilityGraphs.filter(graph=>{
      const root = graph.nodes.find(n=>n.family==='gatilho');
      if(root?.type!=='ao_ser_alvejado')return false;
      const holding=(target.arsenal??[]).find(item=>item.cardId===graph.id);
      if(!holding||holding.quantity<=0)return false;
      if(holding.cooldownRemaining)return false;
      if(graph.header.charges&&(holding.currentCharges??graph.header.charges.current)<=0)return false;
      return true;
    });
    const byId = new Map<string, AbilityGraph>();
    for (const graph of ownedReactions) byId.set(graph.id, graph);
    return [...byId.values()];
  };

  /** Resolve uma habilidade-grafo de proteção como reação: rola 1d20 e aplica os efeitos do grafo no
   *  próprio defensor; o resultado vira defenseBonus do ataque.
   *  O 1d20 é o padrão (mesma raiz de sempre, para qualquer nó 'teste' interno do próprio grafo), mas se
   *  o grafo tiver um nó 'esquiva', o valor fixo/dado configurado nele substitui o 1d20 como defenseBonus
   *  externo (ver `defenseRollOverride` em abilityInterpreter.ts) — grafos sem o nó novo continuam
   *  exatamente como antes. */
  const resolveGraphProtection = (
    target: Character,
    attacker: Character,
    graph: AbilityGraph,
    options: { targetState?: ArsenalActorState; attackerState?: ArsenalActorState; entryNodeIds?: string[] } = {},
  ) => {
    const level = arsenalLevels[graph.id] ?? 1;
    const protectionRoll = rollDice('1d20');
    const state = options.targetState ?? actorState(target);
    const attackerState = options.attackerState ?? actorState(attacker);
    const ongoing = cena.encounter.activeOngoingEffects.find(entry =>
      entry.ownerId === target.id
      && entry.graphId === graph.id
      && entry.pendingReactions?.some(reaction => reaction.eventType === 'ao_ser_alvejado')
    );
    const entryNodeIds = options.entryNodeIds ?? ongoing?.pendingReactions?.find(reaction => reaction.eventType === 'ao_ser_alvejado')?.nodeIds;
    const result = resolveAbilityGraphAction({
      graph, level, actor: state, targets: [state], additionalTargets: [attackerState],
      roller: notation => notation === '1d20' ? protectionRoll.total : rollDice(notation).total,
      entryNodeIds,
    });
    return { result, protectionRoll };
  };

  const resolveOngoingGraphProtections = (
    target: Character,
    attacker: Character,
    targetState: ArsenalActorState,
    attackerState: ArsenalActorState,
  ) => {
    let currentTargetState = targetState;
    let currentAttackerState = attackerState;
    let bonus = 0;
    const logs: ReturnType<typeof logEntry>[] = [];
    for (const protection of ongoingGraphProtectionsFor(target)) {
      const beforeTarget = currentTargetState;
      const beforeAttacker = currentAttackerState;
      const { result, protectionRoll } = resolveGraphProtection(target, attacker, protection.graph, {
        targetState: currentTargetState,
        attackerState: currentAttackerState,
        entryNodeIds: protection.nodeIds,
      });
      if (result.status !== 'concluida') continue;
      bonus += result.defenseRollOverride ?? protectionRoll.total;
      const reactionTarget = result.targets.find(t => t.id === target.id);
      currentTargetState = reactionTarget
        ? { ...result.actor, currentHp: reactionTarget.currentHp, currentAura: reactionTarget.currentAura, effects: reactionTarget.effects }
        : result.actor;
      currentAttackerState = result.additionalTargets.find(t => t.id === attacker.id) ?? currentAttackerState;
      logs.push(...buildAbilityGraphCombatLog({ graph: protection.graph, beforeActor: beforeTarget, beforeTargets: [beforeTarget, beforeAttacker], result }));
    }
    return { bonus, targetState: currentTargetState, attackerState: currentAttackerState, logs, resolved: bonus !== 0 || logs.length > 0 };
  };

  /** Habilidades-grafo contínuas do próprio `owner` cujo `eventType` (ex.: 'ao_atacar'/'ao_esquivar') está pendente. */
  const ownOngoingReactionsFor = (owner: Character, eventType: string): { graph: AbilityGraph; nodeIds: string[] }[] =>
    cena.encounter.activeOngoingEffects
      .filter(entry => entry.ownerId === owner.id)
      .flatMap(entry => {
        const graph = leveledAbilityGraphs.find(candidate => candidate.id === entry.graphId);
        if (!graph) return [];
        return (entry.pendingReactions ?? [])
          .filter(reaction => reaction.eventType === eventType)
          .map(reaction => ({ graph, nodeIds: reaction.nodeIds }));
      });

  /** Dispara as reações contínuas 'ao_atacar'/'ao_esquivar' do próprio dono (ex.: forma ativa com "quando
   *  atacar, causa dano extra"). O outro personagem envolvido (alvo do ataque, ou atacante no caso da
   *  esquiva) é o alvo padrão da reação — inclusive quando ela usa um nó 'alvo' com escopo 'escolha': sem
   *  um prompt interativo de UI ainda plugado neste ponto, a escolha recai sobre esse alvo natural. */
  const resolveOwnOngoingReactions = (
    owner: Character, eventType: string, other: Character,
    ownerState: ArsenalActorState, otherState: ArsenalActorState,
  ) => {
    let currentOwnerState = ownerState;
    let currentOtherState = otherState;
    const logs: ReturnType<typeof logEntry>[] = [];
    let resolved = false;
    for (const reaction of ownOngoingReactionsFor(owner, eventType)) {
      const level = arsenalLevels[reaction.graph.id] ?? 1;
      const beforeOwner = currentOwnerState;
      const beforeOther = currentOtherState;
      let result = resolveAbilityGraphAction({
        graph: reaction.graph, level, actor: currentOwnerState, targets: [currentOtherState],
        roller: notation => rollDice(notation).total, entryNodeIds: reaction.nodeIds,
      });
      if (result.status !== 'concluida') continue;
      while (result.pendingTargetChoice) {
        result = resolveAbilityGraphAction({
          graph: reaction.graph, level, actor: result.actor, targets: [currentOtherState],
          roller: notation => rollDice(notation).total, entryNodeIds: result.pendingTargetChoice.nodeIds,
        });
        if (result.status !== 'concluida') break;
      }
      if (result.status !== 'concluida') continue;
      resolved = true;
      currentOwnerState = result.actor;
      currentOtherState = result.targets.find(t => t.id === other.id) ?? currentOtherState;
      logs.push(...buildAbilityGraphCombatLog({ graph: reaction.graph, beforeActor: beforeOwner, beforeTargets: [beforeOther], result }));
    }
    return { ownerState: currentOwnerState, otherState: currentOtherState, logs, resolved };
  };

  /** Resolve um stack de combo clássico (2+ cartas): rola resolveComboAction e funde os resultados
   *  num único log/estado final. Sem a coreografia de dados por carta do caminho de golpe único — cada
   *  resultado gera sua própria linha de log, mas a animação de dado só acompanha a primeira carta. */
  const resolveComboOn = (targetId:string, action:ResolvedAction, comboCards:ArsenalCard[], protection?:ArsenalCard) => {
    if(!turnActor)return;
    const target=byId(targetId);if(!target)return;
    setPendingProtection(null);
    let next=cena;
    let protectionBonus=0;
    let protectionRoll:RollResult|undefined;
    let protectionResolved=false;
    let resolvedTargetState=actorState(target);
    const ongoingProtection=resolveOngoingGraphProtections(target,turnActor,resolvedTargetState,actorState(turnActor));
    protectionBonus+=ongoingProtection.bonus;
    resolvedTargetState=ongoingProtection.targetState;
    const protectionLogs=ongoingProtection.logs;
    if(ongoingProtection.resolved)protectionResolved=true;
    if(protection){
      protectionRoll=rollDice(protection.testDice??'1d20');
      const protectionResult=resolveArsenalAction({card:protection,actor:resolvedTargetState,targets:[resolvedTargetState],isReaction:true,roller:notation=>notation===(protection.testDice??'1d20')?protectionRoll!.total:rollDice(notation).total});
      if(protectionResult.status==='concluida'){
        protectionResolved=true;
        protectionBonus+=protectionRoll.total;
        const reactionTarget=protectionResult.targets[0];
        resolvedTargetState={
          ...protectionResult.actor,
          currentHp:reactionTarget.currentHp,
          currentAura:Math.max(0,Math.min(protectionResult.actor.maxAura,protectionResult.actor.currentAura+(reactionTarget.currentAura-target.currentAura))),
          effects:reactionTarget.effects,
        };
      }
    }
    const captured:RollResult[]=[];
    const results=resolveComboAction({
      cards:comboCards,actor:actorState(turnActor),targets:[resolvedTargetState],
      reactions:protectionResolved?[{id:`protection-${protection?.id ?? 'ongoing'}`,ownerId:target.id,ownerKind:'alvo',defenseModifier:protectionBonus}]:[],
      roller:notation=>{const roll=rollDice(notation);captured.push(roll);return roll.total;},
    });
    const blockedIndex=results.findIndex(result=>result.status==='bloqueada');
    if(blockedIndex>=0){
      next=appendLog(next,[...protectionLogs,...buildArsenalCombatLog({card:comboCards[blockedIndex],beforeActor:actorState(turnActor),beforeTargets:[resolvedTargetState],result:results[blockedIndex],rolls:captured})]);
      updateCena(next);setArmed(null);return;
    }
    const final=results[results.length-1];
    const targetResult=final.targets.find(entry=>entry.id===target.id)??final.targets[0];
    const hitAny=results.some(result=>result.hitTargetIds.includes(target.id));
    const effectKinds:TargetEffectKind[]=[];
    if(protectionResolved&&!hitAny)effectKinds.push('evade');
    if(hitAny&&targetResult.currentHp<target.currentHp)effectKinds.push('damage');
    if(hitAny&&targetResult.currentHp>target.currentHp)effectKinds.push('heal');
    if(hitAny&&action.conditionName)effectKinds.push('condition');
    const hpDelta=targetResult.currentHp-target.currentHp;
    const effect=effectKinds.length?{
      targetId:target.id,kinds:effectKinds,conditionName:action.conditionName,
      hpDelta:hpDelta||undefined,
      conditionColor:action.conditionName?conditionColor(action.conditionName):undefined,
      damageType:effectKinds.includes('damage')?action.damageType:undefined,
    }:null;
    const combatLogs=[
      ...protectionLogs,
      ...comboCards.flatMap((card,index)=>buildArsenalCombatLog({
        card,
        beforeActor:index===0?actorState(turnActor):results[index-1].actor,
        beforeTargets:[index===0?resolvedTargetState:(results[index-1].targets.find(entry=>entry.id===target.id)??results[index-1].targets[0])],
        result:results[index],
        rolls:index===0?captured:[],
      })),
    ];
    if(effect)playTargetEffect(effect);
    if(turnActor.id===target.id){
      const merged={
        ...final.actor,
        currentHp:targetResult.currentHp,
        currentAura:Math.max(0,Math.min(final.actor.maxAura,final.actor.currentAura+(targetResult.currentAura-target.currentAura))),
        effects:targetResult.effects,
        defenseCurrent:targetResult.defenseCurrent,defenseMax:targetResult.defenseMax,
        staggerCurrent:targetResult.staggerCurrent,staggerMax:targetResult.staggerMax,
        isDefenseBroken:targetResult.isDefenseBroken,isStaggered:targetResult.isStaggered,
        staggerTurnsRemaining:targetResult.staggerTurnsRemaining,
      };
      next=applyArsenalActor(next,turnActor,merged);
    }else{
      next=applyArsenalActor(next,turnActor,final.actor);
      next=applyArsenalActor(next,target,targetResult);
    }
    playRareEvent(target, targetResult as Character);
    next=appendLog(next,combatLogs);
    if(turnActor.id!==target.id){
      if(hitAny){
        const reaction=resolveOwnOngoingReactions(turnActor,'ao_atacar',target,actorStateIn(next,turnActor),actorStateIn(next,target));
        if(reaction.resolved){
          next=applyArsenalActor(next,turnActor,reaction.ownerState);
          next=applyArsenalActor(next,target,reaction.otherState);
          next=appendLog(next,reaction.logs);
        }
      }else if(protectionResolved){
        const reaction=resolveOwnOngoingReactions(target,'ao_esquivar',turnActor,actorStateIn(next,target),actorStateIn(next,turnActor));
        if(reaction.resolved){
          next=applyArsenalActor(next,target,reaction.ownerState);
          next=applyArsenalActor(next,turnActor,reaction.otherState);
          next=appendLog(next,reaction.logs);
        }
      }
    }
    updateCena(next);setArmed(null);setPendingProtection(null);
  };

  const resolveCanonicalOn = (targetId:string, action:ResolvedAction, protection?:ArsenalCard) => {
    if(!turnActor||!action.arsenalCard)return;
    if(action.comboArsenalCards&&action.comboArsenalCards.length>1){resolveComboOn(targetId,action,action.comboArsenalCards,protection);return;}
    const target=byId(targetId);if(!target)return;
    // A escolha terminou. Fecha a janela antes de resolver/animar, inclusive se
    // algum custo ou requisito bloquear uma das cartas mais adiante.
    setPendingProtection(null);
    let next=cena;
    let protectionBonus=0;
    let protectionRoll:RollResult|undefined;
    let protectionResolved=false;
    let resolvedTargetState=actorState(target);
    const ongoingProtection = resolveOngoingGraphProtections(target, turnActor, resolvedTargetState, actorState(turnActor));
    protectionBonus += ongoingProtection.bonus;
    resolvedTargetState = ongoingProtection.targetState;
    const protectionLogs = ongoingProtection.logs;
    if (ongoingProtection.resolved) protectionResolved = true;
    if(protection){
      protectionRoll=rollDice(protection.testDice??'1d20');
      const protectionResult=resolveArsenalAction({card:protection,actor:resolvedTargetState,targets:[resolvedTargetState],isReaction:true,roller:notation=>notation===(protection.testDice??'1d20')?protectionRoll.total:rollDice(notation).total});
      if(protectionResult.status==='concluida'){
        protectionResolved=true;
        protectionBonus+=protectionRoll.total;
        const reactionTarget=protectionResult.targets[0];
        resolvedTargetState={
          ...protectionResult.actor,
          currentHp:reactionTarget.currentHp,
          currentAura:Math.max(0,Math.min(protectionResult.actor.maxAura,protectionResult.actor.currentAura+(reactionTarget.currentAura-target.currentAura))),
          effects:reactionTarget.effects,
        };
      }
    }
    const captured:RollResult[]=[];
    const result=resolveArsenalAction({
      card:action.arsenalCard,actor:actorState(turnActor),targets:[resolvedTargetState],
      resumePreparation:action.resumePreparation,
      reactions:protectionResolved?[{id:`protection-${protection?.id ?? 'ongoing'}`,ownerId:target.id,ownerKind:'alvo',defenseModifier:protectionBonus}]:[],
      roller:notation=>{const roll=rollDice(notation);captured.push(roll);return roll.total;},
    });
    if(result.status==='bloqueada'){
      next=appendLog(next,buildArsenalCombatLog({card:action.arsenalCard,beforeActor:actorState(turnActor),beforeTargets:[resolvedTargetState],result,rolls:captured}));
      updateCena(next);setArmed(null);return;
    }
    if(result.status==='preparando'){
      next=applyArsenalActor(next,turnActor,result.actor);
      const timing=result.preparation?.timing;
      const rounds=timing?.type==='rodadas'||timing?.type==='turnos'?timing.amount:1;
      next={...next,encounter:{...next.encounter,preparations:[...next.encounter.preparations.filter(preparation=>!(preparation.ownerId===turnActor.id&&preparation.entryId===action.id)),{ownerId:turnActor.id,entryId:action.id,roundsRemaining:rounds,participantIds:[],targetIds:[target.id]}]}};
      next=appendLog(next,[{id:`arsenal-${Date.now()}`,kind:'system',text:`${turnActor.name} inicia a preparação de ${action.name}.`,timestamp:Date.now()}]);
      updateCena(next);setArmed(null);setPendingProtection(null);return;
    }
    next={...next,encounter:{...next.encounter,preparations:next.encounter.preparations.filter(preparation=>!(preparation.ownerId===turnActor.id&&preparation.entryId===action.id))}};
    const hit=result.hitTargetIds.includes(target.id);
    const targetResult=result.targets[0];
    const effectKinds:TargetEffectKind[]=[];
    if(protectionResolved&&!hit)effectKinds.push('evade');
    if(hit&&targetResult.currentHp<target.currentHp)effectKinds.push('damage');
    if(hit&&targetResult.currentHp>target.currentHp)effectKinds.push('heal');
    if(hit&&action.conditionName)effectKinds.push('condition');
    const hpDelta=targetResult.currentHp-target.currentHp;
    const hasTest=!!action.arsenalCard.testDice;
    const effect=effectKinds.length||hasTest?{
      targetId:target.id,kinds:effectKinds,conditionName:action.conditionName,
      hpDelta:hpDelta||undefined,result:hasTest?(hit?'success' as const:'failure' as const):undefined,
      conditionColor:action.conditionName?conditionColor(action.conditionName):undefined,
      damageType:effectKinds.includes('damage')?action.damageType:undefined,
    }:null;
    const combatLogs=[
      ...protectionLogs,
      ...buildArsenalCombatLog({
      card:action.arsenalCard,
      beforeActor:actorState(turnActor),
      beforeTargets:[resolvedTargetState],
      result,
      rolls:captured,
      }),
    ];
    const revealCombatLogs=hideLogUntilDiceComplete(captured.length?combatLogs.map(entry=>entry.id):[],effect?()=>playTargetEffect(effect):undefined);
    captured.forEach((roll,index)=>onDiceRoll?.(roll,{
      customLabel:index===0?action.name:`${action.name} · efeito`,
      actorLabel:turnActor.name,
      defenderLabel:index===0&&protectionResolved?`${target.name} · ${protection?.name}`:target.name,
      defenderResult:index===0?(target.defense??10)+protectionBonus:undefined,
      defenderRoll:index===0&&protectionResolved?protectionRoll:undefined,
      defenderBase:index===0&&protectionResolved?(target.defense??10):undefined,
      finalTotal:index===0&&result.rolls.test!==undefined?result.rolls.test:undefined,
      adjustments:index===0&&result.rolls.test!==undefined&&result.rolls.test!==roll.total?[{label:'Efeitos no dado',value:result.rolls.test-roll.total}]:undefined,
      isSuccess:result.hitTargetIds.includes(target.id),
      dramatic:index===0,
      onComplete:index===captured.length-1?revealCombatLogs:undefined,
    }));
    if(captured[0]) playRollRareEvent(captured[0], turnActor.name, turnVisual);
    if(effect&&(!onDiceRoll||captured.length===0))playTargetEffect(effect);
    if(turnActor.id===target.id){
      const merged={
        ...result.actor,
        currentHp:result.targets[0].currentHp,
        currentAura:Math.max(0,Math.min(result.actor.maxAura,result.actor.currentAura+(result.targets[0].currentAura-target.currentAura))),
        effects:result.targets[0].effects,
        defenseCurrent:result.targets[0].defenseCurrent,defenseMax:result.targets[0].defenseMax,
        staggerCurrent:result.targets[0].staggerCurrent,staggerMax:result.targets[0].staggerMax,
        isDefenseBroken:result.targets[0].isDefenseBroken,isStaggered:result.targets[0].isStaggered,
        staggerTurnsRemaining:result.targets[0].staggerTurnsRemaining,
      };
      next=applyArsenalActor(next,turnActor,merged);
    }else{
      next=applyArsenalActor(next,turnActor,result.actor);
      next=applyArsenalActor(next,target,result.targets[0]);
    }
    playRareEvent(target, result.targets[0] as Character);
    next=appendLog(next,combatLogs);
    if(turnActor.id!==target.id){
      if(hit){
        const reaction=resolveOwnOngoingReactions(turnActor,'ao_atacar',target,actorStateIn(next,turnActor),actorStateIn(next,target));
        if(reaction.resolved){
          next=applyArsenalActor(next,turnActor,reaction.ownerState);
          next=applyArsenalActor(next,target,reaction.otherState);
          next=appendLog(next,reaction.logs);
        }
      }else if(protectionResolved){
        const reaction=resolveOwnOngoingReactions(target,'ao_esquivar',turnActor,actorStateIn(next,target),actorStateIn(next,turnActor));
        if(reaction.resolved){
          next=applyArsenalActor(next,target,reaction.ownerState);
          next=applyArsenalActor(next,turnActor,reaction.otherState);
          next=appendLog(next,reaction.logs);
        }
      }
    }
    updateCena(next);setArmed(null);setPendingProtection(null);
  };

  /** Equivalente de resolveCanonicalOn para habilidades do novo sistema de grafo. Suporta reação: se o
   *  alvo tiver uma habilidade-grafo ou carta clássica com raiz "Quando alvejado"/condição 'reacao'
   *  disponível, ela resolve primeiro (podendo até causar dano de volta no atacante via alvo
   *  "atacante_original") e só então a ação principal é resolvida contra o estado já atualizado. */
  const resolveAbilityGraphOn = (targetId: string, action: ResolvedAction, protection?: ArsenalCard | AbilityGraph) => {
    if (!turnActor || !action.abilityGraph) return;
    const target = byId(targetId); if (!target) return;
    setPendingProtection(null);
    const level = action.abilityGraphLevel ?? 1;
    const originalBeforeActor = actorState(turnActor);
    let beforeActor = originalBeforeActor;
    const protectionLogs: ReturnType<typeof logEntry>[] = [];
    let defenseBonus = 0;
    let resolvedTargetState = actorState(target);
    let protectionResolved = false;
    const ongoingProtection = resolveOngoingGraphProtections(target, turnActor, resolvedTargetState, beforeActor);
    defenseBonus += ongoingProtection.bonus;
    resolvedTargetState = ongoingProtection.targetState;
    beforeActor = ongoingProtection.attackerState;
    protectionLogs.push(...ongoingProtection.logs);
    if (ongoingProtection.resolved) protectionResolved = true;
    if (protection) {
      if ('kind' in protection && protection.kind === 'graph') {
        const { result: protResult, protectionRoll } = resolveGraphProtection(target, turnActor, protection, {
          targetState: resolvedTargetState,
          attackerState: beforeActor,
        });
        if (protResult.status === 'concluida') {
          protectionResolved = true; defenseBonus += protResult.defenseRollOverride ?? protectionRoll.total;
          const reactionTarget = protResult.targets.find(t => t.id === target.id);
          resolvedTargetState = reactionTarget
            ? { ...protResult.actor, currentHp: reactionTarget.currentHp, currentAura: reactionTarget.currentAura, effects: reactionTarget.effects }
            : protResult.actor;
          beforeActor = protResult.additionalTargets.find(t => t.id === turnActor.id) ?? beforeActor;
          protectionLogs.push(...buildAbilityGraphCombatLog({ graph: protection, beforeActor: actorState(target), beforeTargets: [actorState(target), originalBeforeActor], result: protResult }));
        }
      } else {
        const card = protection as ArsenalCard;
        const protectionRoll = rollDice(card.testDice ?? '1d20');
        const protResult = resolveArsenalAction({
          card, actor: resolvedTargetState, targets: [resolvedTargetState], isReaction: true,
          roller: notation => notation === (card.testDice ?? '1d20') ? protectionRoll.total : rollDice(notation).total,
        });
        if (protResult.status === 'concluida') {
          protectionResolved = true; defenseBonus += protectionRoll.total;
          const reactionTarget = protResult.targets[0];
          resolvedTargetState = { ...protResult.actor, currentHp: reactionTarget.currentHp, currentAura: reactionTarget.currentAura, effects: reactionTarget.effects };
        }
      }
    }
    const beforeTarget = resolvedTargetState;
    const areaConfig = graphAreaConfig(action.abilityGraph, level);
    const beforeAreaTargets = areaConfig
      ? resolveAreaTargets(
          areaConfig, turnActor.id, target.id !== turnActor.id ? target.id : null,
          effectiveTokens(cena.tokens, participants.map(p => p.id)),
          participants.filter(p => p.id !== target.id).map(p => p.id),
        ).map(id => byId(id)).filter((c): c is Character => !!c).map(actorState)
      : [];
    const captured: { roll: RollResult; label?: string }[] = [];
    const result = resolveAbilityGraphAction({
      graph: action.abilityGraph, level, actor: beforeActor, targets: [beforeTarget],
      resumePreparation: action.resumePreparation, combos: action.comboAbilityGraphs, defenseBonus,
      areaTargets: beforeAreaTargets,
      roller: (notation, label) => {
        const roll = rollDice(notation);
        captured.push({ roll, label });
        return roll.total;
      },
    });
    if (result.status === 'bloqueada') {
      updateCena(appendLog(cena, [logEntry('system', `${turnActor.name}: ${result.reason}.`)]));
      setArmed(null);
      return;
    }
    if (result.status === 'preparando') {
      let next = applyArsenalActor(cena, turnActor, result.actor);
      const timing = result.preparation?.timing;
      const rounds = timing?.type === 'rodadas' || timing?.type === 'turnos' ? timing.amount : 1;
      next = { ...next, encounter: { ...next.encounter, preparations: [
        ...next.encounter.preparations.filter(p => !(p.ownerId === turnActor.id && p.entryId === action.id)),
        { ownerId: turnActor.id, entryId: action.id, roundsRemaining: rounds, participantIds: [], targetIds: [target.id] },
      ] } };
      next = appendLog(next, [logEntry('system', `${turnActor.name} inicia a preparação de ${action.name}.`)]);
      updateCena(next); setArmed(null);
      return;
    }
    let next = { ...cena, encounter: { ...cena.encounter, preparations: cena.encounter.preparations.filter(p => !(p.ownerId === turnActor.id && p.entryId === action.id)) } };
    const hit = result.hitTargetIds.includes(target.id);
    const targetResult = result.targets.find(t => t.id === target.id)!;
    const effectKinds: TargetEffectKind[] = [];
    if (protectionResolved && !hit) effectKinds.push('evade');
    if (hit && targetResult.currentHp < target.currentHp) effectKinds.push('damage');
    if (hit && targetResult.currentHp > target.currentHp) effectKinds.push('heal');
    const beforeEffectIds = new Set(beforeTarget.effects.map(active => active.effect.id));
    const newCondition = targetResult.effects.find(active => !beforeEffectIds.has(active.effect.id))?.effect.name;
    if (hit && newCondition) effectKinds.push('condition');
    const hpDelta = targetResult.currentHp - target.currentHp;
    const hasTest = mergeLevel(action.abilityGraph, level).nodes.some(node => node.type === 'teste');
    const effect = effectKinds.length || hasTest ? {
      targetId: target.id, kinds: effectKinds, conditionName: newCondition, hpDelta: hpDelta || undefined,
      result: hasTest ? (hit ? 'success' as const : 'failure' as const) : undefined,
      conditionColor: newCondition ? conditionColor(newCondition) : undefined,
      damageType: effectKinds.includes('damage') ? action.damageType : undefined,
    } : null;
    const graphLogs = [
      ...protectionLogs,
      ...buildAbilityGraphCombatLog({ graph: action.abilityGraph, beforeActor, beforeTargets: [beforeTarget], result }),
    ];
    const revealGraphLogs = hideLogUntilDiceComplete(captured.length ? graphLogs.map(entry => entry.id) : [], effect ? () => playTargetEffect(effect) : undefined);
    captured.forEach(({ roll, label }, index) => {
      const isTestRoll = hasTest && index === 0;
      onDiceRoll?.(roll, {
        customLabel: isTestRoll ? action.name : (label ?? `${action.name} · efeito`),
        actorLabel: turnActor.name,
        defenderLabel: isTestRoll ? (protectionResolved ? `${target.name} · proteção` : target.name) : undefined,
        defenderResult: isTestRoll ? (target.defense ?? 10) + defenseBonus : undefined,
        defenderBase: isTestRoll && protectionResolved ? (target.defense ?? 10) : undefined,
        isSuccess: isTestRoll ? hit : true,
        dramatic: isTestRoll,
        onComplete: index === captured.length - 1 ? revealGraphLogs : undefined,
      });
    });
    if (captured[0]) playRollRareEvent(captured[0].roll, turnActor.name, turnVisual);
    if (effect && (!onDiceRoll || captured.length === 0)) playTargetEffect(effect);
    if (turnActor.id === target.id) {
      const merged = { ...result.actor, currentHp: targetResult.currentHp,
        currentAura: Math.max(0, Math.min(result.actor.maxAura, result.actor.currentAura + (targetResult.currentAura - target.currentAura))),
        effects: targetResult.effects };
      next = applyArsenalActor(next, turnActor, merged);
    } else {
      next = applyArsenalActor(next, turnActor, result.actor);
      next = applyArsenalActor(next, target, targetResult);
    }
    for (const areaState of result.areaTargets) {
      const areaChar = byId(areaState.id);
      if (areaChar) next = applyArsenalActor(next, areaChar, areaState);
    }
    playRareEvent(target, targetResult as Character);
    next = appendLog(next, graphLogs);
    next = registerOngoingEffects(next, action.abilityGraph.id, result.ongoingEffectIntents);
    const nextTokens = resolveMovementIntents(result.movementIntents, effectiveTokens(next.tokens, participants.map(p => p.id)), turnActor.id);
    if (Object.keys(nextTokens).length > 0) next = { ...next, tokens: { ...next.tokens, ...nextTokens } };
    if (turnActor.id !== target.id) {
      if (hit) {
        const reaction = resolveOwnOngoingReactions(turnActor, 'ao_atacar', target, actorStateIn(next, turnActor), actorStateIn(next, target));
        if (reaction.resolved) {
          next = applyArsenalActor(next, turnActor, reaction.ownerState);
          next = applyArsenalActor(next, target, reaction.otherState);
          next = appendLog(next, reaction.logs);
        }
      } else if (protectionResolved) {
        const reaction = resolveOwnOngoingReactions(target, 'ao_esquivar', turnActor, actorStateIn(next, target), actorStateIn(next, turnActor));
        if (reaction.resolved) {
          next = applyArsenalActor(next, target, reaction.ownerState);
          next = applyArsenalActor(next, turnActor, reaction.otherState);
          next = appendLog(next, reaction.logs);
        }
      }
    }
    updateCena(next); setArmed(null);
  };

  const resolveOn = (targetId: string, action: ResolvedAction) => {
    if (!turnActor) return;
    const target = byId(targetId); if (!target) return;
    const res = resolveAction(turnActor.name, snapOf(turnActor), target.name, snapOf(target), action);
    const projectedTarget = applyStatDelta(target, res.targetDelta);
    const projectedTargetWithDefense = { ...projectedTarget, ...(res.defenseDelta ?? {}) };
    const effectKinds:TargetEffectKind[] = [];
    if(res.success&&projectedTarget.currentHp<target.currentHp)effectKinds.push('damage');
    if(res.success&&projectedTarget.currentHp>target.currentHp)effectKinds.push('heal');
    if(res.success&&res.conditionApplied)effectKinds.push('condition');
    const hpDelta=projectedTarget.currentHp-target.currentHp;
    const effect=effectKinds.length||res.roll?{
      targetId:target.id,kinds:effectKinds,conditionName:res.conditionApplied?.name,
      hpDelta:hpDelta||undefined,result:res.roll?(res.success?'success' as const:'failure' as const):undefined,
      conditionColor:res.conditionApplied?conditionColor(res.conditionApplied.name):undefined,
      damageType:effectKinds.includes('damage')?action.damageType:undefined,
    }:null;
    if (res.roll) {
      const comparison = res.log.find(entry => entry.roll)?.roll;
      // Mantém todo o encadeamento (rolagem, dano e condições) fora do log
      // até o instante da revelação, evitando spoilers laterais.
      const concealedIds = res.log.map(entry => entry.id);
      const revealLogs = hideLogUntilDiceComplete(concealedIds, effect ? () => playTargetEffect(effect) : undefined);
      onDiceRoll?.(res.roll, {
        isSuccess: res.success,
        customLabel: action.name,
        defenderResult: comparison?.targetValue,
        actorLabel: turnActor.name,
        defenderLabel: comparison?.targetLabel,
        dramatic: comparison?.targetValue !== undefined,
        onComplete: revealLogs,
      });
      playRollRareEvent(res.roll, turnActor.name, turnVisual);
    }
    if(effect&&(!res.roll||!onDiceRoll))playTargetEffect(effect);
    let next = appendLog(cena, res.log);
    if (turnActor.id === targetId) {
      const merged = {
        hp: ((res.actorDelta.hp ?? 0) + (res.targetDelta.hp ?? 0)) || undefined,
        aura: ((res.actorDelta.aura ?? 0) + (res.targetDelta.aura ?? 0)) || undefined,
        ammo: ((res.actorDelta.ammo ?? 0) + (res.targetDelta.ammo ?? 0)) || undefined,
      };
      next = applyDeltaTo(next, turnActor.id, merged, res.defenseDelta);
    } else {
      next = applyDeltaTo(next, turnActor.id, res.actorDelta);
      next = applyDeltaTo(next, targetId, res.targetDelta, res.defenseDelta);
    }
    if (action.source === 'item' && action.item) {
      const ownedItems = consumeItemActivation(turnActor, action.item);
      if (party.some(character => character.id === turnActor.id)) updateCharacterStats(turnActor.id, { ownedItems });
      else next = updateNpcStats(next, turnActor.id, { ownedItems });
      next = appendLog(next, [logEntry('system', `${turnActor.name} gasta ${action.name}.`)]);
    }
    if (res.success && res.conditionApplied) {
      const preset = getPredefinedEffect(res.conditionApplied.name);
      const conditionUpdates: Partial<Character> = preset
        ? { activeEffects: applyActiveEffect(target.activeEffects ?? [], {
            ...preset,
            duration: res.conditionApplied.duration > 0 ? { type: 'rodadas', amount: res.conditionApplied.duration } : { type:'permanente' },
          }) }
        : { conditions: [
            ...target.conditions.filter(condition => condition.name !== res.conditionApplied!.name),
            res.conditionApplied,
          ] };
      if (party.some(character => character.id === target.id)) updateCharacterStats(target.id, conditionUpdates);
      else next = updateNpcStats(next, target.id, conditionUpdates);
    }
    if (res.success && action.advancedEffects?.length) {
      let baseEffects = target.activeEffects ?? [];
      if (res.conditionApplied) {
        const preset = getPredefinedEffect(res.conditionApplied.name);
        if (preset) {
          baseEffects = applyActiveEffect(baseEffects, {
            ...preset,
            duration: res.conditionApplied.duration > 0 ? { type: 'rodadas', amount: res.conditionApplied.duration } : { type:'permanente' },
          });
        }
      }
      const movementIntents: MovementIntent[] = [];
      const persistentEffects = action.advancedEffects.filter(effect => {
        if (effect.dispel) {
          const cleaned = removeActiveEffects(
            { ...actorStateIn(next, target), effects: baseEffects },
            effect.dispel.category,
            effect.dispel.count,
          );
          baseEffects = cleaned.target.effects;
          if (cleaned.removedNames.length) {
            next = appendLog(next, [logEntry('condition', `${target.name} perde ${cleaned.removedNames.join(', ')}.`)]);
          }
          return false;
        }
        if (effect.movement) {
          movementIntents.push({ targetId: target.id, kind: effect.movement.kind, distance: effect.movement.distance });
          return false;
        }
        return true;
      });
      if (movementIntents.length) {
        const nextTokens = resolveMovementIntents(movementIntents, effectiveTokens(next.tokens, participants.map(p => p.id)), turnActor.id);
        if (Object.keys(nextTokens).length > 0) {
          next = { ...next, tokens: { ...next.tokens, ...nextTokens } };
          next = appendLog(next, [logEntry('system', `${action.name} move ${target.name}.`)]);
        }
      }
      const activeEffects = persistentEffects.reduce(
        (acc, effect) => applyActiveEffect(acc, effect, turnActor.id),
        baseEffects,
      );
      const effectUpdates: Partial<Character> = { activeEffects };
      if (party.some(character => character.id === target.id)) updateCharacterStats(target.id, effectUpdates);
      else next = updateNpcStats(next, target.id, effectUpdates);
      next = appendLog(next, persistentEffects.map(effect =>
        logEntry('condition', `${target.name} recebe ${effect.name} por ${effect.duration.amount ?? 1} rodada(s).`),
      ));
    }
    playRareEvent(target, projectedTargetWithDefense as Character);
    updateCena(next);
    setArmed(null);
  };

  /** Conjura uma habilidade/selo de alvo 'campo_de_batalha': sem seleção de alvo,
   *  os efeitos viram ActiveFieldEffect no encounter (não pertencem a ninguém). */
  /** Conjura uma habilidade-grafo mirando o campo de batalha: sem efeitos de campo instaláveis nesta
   *  fase (ver plano da Fase 4) —? roda o grafo, aplica custos/cooldown e loga a execução. */
  const resolveAbilityGraphFieldCast = (action: ResolvedAction) => {
    if (!turnActor || !action.abilityGraph) return;
    const level = action.abilityGraphLevel ?? 1;
    const beforeActor = actorState(turnActor);
    const result = resolveAbilityGraphAction({
      graph: action.abilityGraph, level, actor: beforeActor, targets: [],
      resumePreparation: action.resumePreparation, combos: action.comboAbilityGraphs,
      roller: notation => rollDice(notation).total,
    });
    if (result.status === 'bloqueada') {
      updateCena(appendLog(cena, [logEntry('system', `${turnActor.name}: ${result.reason}.`)]));
      return;
    }
    let next = applyArsenalActor(cena, turnActor, result.actor);
    if (result.status === 'preparando') {
      const timing = result.preparation?.timing;
      const rounds = timing?.type === 'rodadas' || timing?.type === 'turnos' ? timing.amount : 1;
      next = { ...next, encounter: { ...next.encounter, preparations: [
        ...next.encounter.preparations.filter(p => !(p.ownerId === turnActor.id && p.entryId === action.id)),
        { ownerId: turnActor.id, entryId: action.id, roundsRemaining: rounds, participantIds: [], targetIds: [] },
      ] } };
      next = appendLog(next, [logEntry('system', `${turnActor.name} inicia a preparação de ${action.name}.`)]);
      updateCena(next);
      return;
    }
    next = { ...next, encounter: { ...next.encounter, preparations: next.encounter.preparations.filter(p => !(p.ownerId === turnActor.id && p.entryId === action.id)) } };
    next = appendLog(next, [logEntry('system', `${turnActor.name} conjura ${action.name}.`)]);
    next = registerOngoingEffects(next, action.abilityGraph.id, result.ongoingEffectIntents);
    const nextTokens = resolveMovementIntents(result.movementIntents, effectiveTokens(next.tokens, participants.map(p => p.id)), turnActor.id);
    if (Object.keys(nextTokens).length > 0) next = { ...next, tokens: { ...next.tokens, ...nextTokens } };
    updateCena(next);
  };

  const resolveFieldCast = (action: ResolvedAction) => {
    if (!turnActor || !action.arsenalCard) return;
    const result = resolveArsenalAction({
      card: action.arsenalCard, actor: actorState(turnActor), targets: [],
      resumePreparation: action.resumePreparation,
      roller: notation => rollDice(notation).total,
    });
    if (result.status === 'bloqueada') {
      updateCena(appendLog(cena, [{ id: `arsenal-${Date.now()}`, kind: 'system', text: `${turnActor.name}: ${result.reason}.`, timestamp: Date.now() }]));
      return;
    }
    let next = applyArsenalActor(cena, turnActor, result.actor);
    if (result.status === 'preparando') {
      const timing = result.preparation?.timing;
      const rounds = timing?.type === 'rodadas' || timing?.type === 'turnos' ? timing.amount : 1;
      next = { ...next, encounter: { ...next.encounter, preparations: [
        ...next.encounter.preparations.filter(p => !(p.ownerId === turnActor.id && p.entryId === action.id)),
        { ownerId: turnActor.id, entryId: action.id, roundsRemaining: rounds, participantIds: [], targetIds: [] },
      ] } };
      next = appendLog(next, [{ id: `arsenal-${Date.now()}`, kind: 'system', text: `${turnActor.name} inicia a preparação de ${action.name}.`, timestamp: Date.now() }]);
      updateCena(next);
      return;
    }
    next = { ...next, encounter: { ...next.encounter, preparations: next.encounter.preparations.filter(p => !(p.ownerId === turnActor.id && p.entryId === action.id)) } };
    const installed = result.fieldEffects.map(effect => ({
      id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sourceId: turnActor.id, sourceName: turnActor.name, entryId: action.id, effect,
      roundsRemaining: effect.duration.type === 'rodadas' ? (effect.duration.amount ?? 1) : null,
    }));
    if (installed.length) next = { ...next, encounter: { ...next.encounter, fieldEffects: [...next.encounter.fieldEffects, ...installed] } };
    next = appendLog(next, [{ id: `arsenal-${Date.now()}`, kind: 'system', text: `${turnActor.name} conjura ${action.name}: o campo de batalha é afetado.`, timestamp: Date.now() }]);
    updateCena(next);
  };

  const dispelFieldEffect = (id: string) =>
    updateCena({ ...cena, encounter: { ...cena.encounter, fieldEffects: cena.encounter.fieldEffects.filter(fe => fe.id !== id) } });

  const onSceneChange = (partial: Partial<SceneState>) => updateCena(setScene(cena, partial));
  const selectById = (id: string) => {
    if (party.some(c => c.id === id)) setActive({ id, side: 'party' });
    else if (cena.npcRoster.some(n => n.id === id)) setActive({ id, side: 'npc' });
  };
  const removeNpcFromCombat = (id: string) => { updateCena(removeNpc(cena, id)); setActive(prev => (prev?.side === 'npc' && prev.id === id ? null : prev)); };

  const onSelectAction = (action: ResolvedAction) => {
    if(turnActor&&action.category!=='item'){
      const control=consumePrincipalBlock(turnActor.activeEffects??[]);
      if(control.blocked){
        let next=appendLog(cena,[logEntry('condition',`${turnActor.name} perde a ação principal por ${control.source??'Desnorteado'}.`)]);
        if(party.some(character=>character.id===turnActor.id))updateCharacterStats(turnActor.id,{activeEffects:control.effects});
        else next=updateNpcStats(next,turnActor.id,{activeEffects:control.effects});
        updateCena(next);return;
      }
    }
    if(action.arsenalCard?.abilityType==='forma'&&turnActor){
      activateFormaFor(turnActor, action.id);
      return;
    }
    if(action.abilityGraph&&graphFormaVisual(action.abilityGraph,action.abilityGraphLevel??1).isForma&&turnActor){
      activateAbilityGraphFormaFor(turnActor, action.id);
      return;
    }
    if(action.arsenalCard?.abilityType==='combo'){setComboDraft(action.arsenalCard);setComboSelection([]);return;}
    if(action.abilityGraph&&graphComboConfig(action.abilityGraph,action.abilityGraphLevel??1)){setComboGraphDraft(action.abilityGraph);setComboSelection([]);return;}
    if(action.arsenalCard){
      const preparation=cena.encounter.preparations.find(item=>item.ownerId===turnActor?.id&&item.entryId===action.id);
      if(preparation){
        if(preparation.roundsRemaining>0){updateCena(appendLog(cena,[{id:`preparation-${Date.now()}`,kind:'system',text:`${action.name} ainda precisa de ${preparation.roundsRemaining} rodada(s) de preparação.`,timestamp:Date.now()}]));return;}
        if(action.arsenalCard.target.type==='campo_de_batalha'){resolveFieldCast({...action,resumePreparation:true});return;}
        const preparedTarget=preparation.targetIds?.[0];
        if(preparedTarget){resolveCanonicalOn(preparedTarget,{...action,resumePreparation:true});return;}
      }
    }
    if(action.abilityGraph){
      const preparation=cena.encounter.preparations.find(item=>item.ownerId===turnActor?.id&&item.entryId===action.id);
      if(preparation){
        if(preparation.roundsRemaining>0){updateCena(appendLog(cena,[logEntry('system',`${action.name} ainda precisa de ${preparation.roundsRemaining} rodada(s) de preparação.`)]));return;}
        if(mergeLevel(action.abilityGraph,action.abilityGraphLevel??1).header.target.type==='campo_de_batalha'){resolveAbilityGraphFieldCast({...action,resumePreparation:true});return;}
        const preparedTarget=preparation.targetIds?.[0];
        if(preparedTarget){resolveAbilityGraphOn(preparedTarget,{...action,resumePreparation:true});return;}
      }
    }
    if(action.arsenalCard?.target.type==='campo_de_batalha'&&turnActor){resolveFieldCast(action);return;}
    if(action.abilityGraph&&mergeLevel(action.abilityGraph,action.abilityGraphLevel??1).header.target.type==='campo_de_batalha'&&turnActor){resolveAbilityGraphFieldCast(action);return;}
    if (action.targeting === 'self' && turnActor) action.arsenalCard ? resolveCanonicalOn(turnActor.id,action) : action.abilityGraph ? resolveAbilityGraphOn(turnActor.id,action) : resolveOn(turnActor.id, action);
    else setArmed(action);
  };

  const resolveArmedTarget = (id: string) => {
    if(combat&&armed?.arsenalCard){const target=byId(id);const protections=target&&turnActor&&target.id!==turnActor.id?protectionCardsFor(target):[];if(protections.length){setPendingProtection({targetId:id,action:armed,cards:protections});return;}resolveCanonicalOn(id,armed);}
    else if(combat&&armed?.abilityGraph){
      const target=byId(id);
      const cardProtections=target&&turnActor&&target.id!==turnActor.id?protectionCardsFor(target):[];
      const graphProtections=target&&turnActor&&target.id!==turnActor.id?protectionAbilityGraphsFor(target):[];
      if(cardProtections.length||graphProtections.length){setPendingProtection({targetId:id,action:armed,cards:cardProtections,graphs:graphProtections});return;}
      resolveAbilityGraphOn(id,armed);
    }
    else if (combat && armed) resolveOn(id, armed);
  };

  const onParticipantClick = (id: string) => {
    if (combat && armed) {
      if (!targetableIds.includes(id)) return;
      if (pendingTargetId !== id) { setPendingTargetId(id); return; }
      resolveArmedTarget(id);
      return;
    }
    else selectById(id);
  };

  const equipActiveWeapon = (weaponId:string|null) => {
    if(!activeChar)return;
    const next=equipWeapon(loadoutOf(activeChar),weaponId);
    const stripped=(activeChar.activeEffects??[]).filter(active=>active.effect.duration.type!=='enquanto_equipado');
    const weaponCard=weaponId?leveledArsenal.find(c=>c.id===weaponId):undefined;
    const activeEffects=(weaponCard?.weapon?.effects??[]).reduce(
      (acc,effect)=>applyActiveEffect(acc,{...effect,duration:{type:'enquanto_equipado'}}),
      stripped,
    );
    if(party.some(p=>p.id===activeChar.id))updateCharacterStats(activeChar.id,{arsenal:next.holdings,activeEffects});
    else updateCena(updateNpcStats(cena,activeChar.id,{arsenal:next.holdings,activeEffects}));
  };

  const goNextTurn = () => {
    const effectOverrides=new Map<string,Character['activeEffects']>();
    const outgoingId=cena.encounter.order[cena.encounter.turnIndex]?.refId;
    const outgoing=outgoingId?byId(outgoingId):null;
    const turnEnd=outgoing?advanceTurnEndEffects(outgoing.activeEffects??[]):null;
    if(outgoingId&&turnEnd&&outgoing?.activeEffects?.length)effectOverrides.set(outgoingId,turnEnd.effects);
    const effectsOf=(id:string)=>effectOverrides.get(id)??byId(id)?.activeEffects??[];
    const adjustments=Object.fromEntries(cena.encounter.order.map(entry=>[entry.refId,activeOrderAdjustment(effectsOf(entry.refId))]));
    const hasOrderAdjustment=Object.values(adjustments).some(adjustment=>adjustment.speed!==0||adjustment.positions!==0);
    const reordered=hasOrderAdjustment?reorderEncounter(cena.encounter,adjustments):cena.encounter;
    const staggerSkipped=new Set<string>();
    const encNext = advanceTurn(reordered, entry => {
      if(isDefeatedEntry(entry))return true;
      const staggerCandidate = byId(entry.refId);
      if (staggerCandidate?.isStaggered && (staggerCandidate.staggerTurnsRemaining ?? 0) > 0) {
        staggerSkipped.add(entry.refId);
        return true;
      }
      return false;
    });
    let next: CenaState = { ...cena, encounter: encNext };
    const updates = new Map<string, Partial<Character>>();
    const currentCharacter = (id: string) => {
      const base = byId(id);
      return base ? { ...base, ...(updates.get(id) ?? {}) } : null;
    };
    if(outgoingId&&turnEnd&&outgoing?.activeEffects?.length){
      updates.set(outgoingId,{activeEffects:turnEnd.effects});
      if(outgoing)next=appendLog(next,turnEnd.expiredNames.map(name=>logEntry('condition',`${name} expirou em ${outgoing.name}.`)));
    }
    for(const id of staggerSkipped){
      const character=byId(id);if(!character)continue;
      const staggerTurn=processStaggeredTurn(migrateCharacterDefense(character));
      updates.set(id,{...(updates.get(id)??{}),defenseCurrent:staggerTurn.currentDefense,staggerCurrent:staggerTurn.currentStagger,isDefenseBroken:staggerTurn.target.isDefenseBroken,isStaggered:staggerTurn.target.isStaggered,staggerTurnsRemaining:staggerTurn.target.staggerTurnsRemaining});
      next=appendLog(next,[logEntry('condition',`${character.name} perde o turno por Desnorteado.`),...(staggerTurn.exitedStaggered?[logEntry('condition',`${character.name} deixou de estar Desnorteado.`)]:[])]);
    }

    if (encNext.round !== cena.encounter.round && encNext.fieldEffects.length) {
      const fieldTick = tickFieldEffects(encNext, participants.map(p => ({ id: p.id, name: p.name })));
      next = { ...next, encounter: { ...encNext, fieldEffects: fieldTick.fieldEffects } };
      for (const [id, delta] of Object.entries(fieldTick.deltas)) {
        const character = currentCharacter(id);
        if (character) updates.set(id, applyStatDelta(character, delta));
      }
      next = appendLog(next, fieldTick.log);
    }

    const nextTurnId = encNext.order[encNext.turnIndex]?.refId;
    const owner = nextTurnId ? currentCharacter(nextTurnId) : null;
    if (encNext.round !== cena.encounter.round) {
      next = appendLog(next, [logEntry('round', `Rodada ${encNext.round}`)]);
      for (const participant of participants) {
        const character = currentCharacter(participant.id);
        if (!character) continue;
        const defenseRound = processDefenseRound(migrateCharacterDefense(character));
        if (defenseRound.currentDefense !== defenseRound.previousDefense || defenseRound.currentStagger !== defenseRound.previousStagger || defenseRound.defenseRestored) {
          updates.set(character.id, {
            ...(updates.get(character.id) ?? {}),
            defenseCurrent: defenseRound.currentDefense,
            staggerCurrent: defenseRound.currentStagger,
            isDefenseBroken: defenseRound.target.isDefenseBroken,
            isStaggered: defenseRound.target.isStaggered,
            staggerTurnsRemaining: defenseRound.target.staggerTurnsRemaining,
          });
          const roundLogs = [];
          if (defenseRound.currentDefense > defenseRound.previousDefense) roundLogs.push(logEntry('condition', `${character.name} recuperou ${defenseRound.currentDefense - defenseRound.previousDefense} de Defesa.`));
          if (defenseRound.previousStagger > defenseRound.currentStagger) roundLogs.push(logEntry('condition', `${character.name} recuperou ${defenseRound.previousStagger - defenseRound.currentStagger} de Stagger.`));
          if (defenseRound.defenseRestored) roundLogs.push(logEntry('condition', `${character.name} recompôs sua Defesa.`));
          next = appendLog(next, roundLogs);
        }
        updates.set(character.id, {
          ...(updates.get(character.id) ?? {}),
          arsenal: advanceAbilityGraphCooldowns(advanceArsenalState(character.arsenal ?? [], leveledArsenal, 'inicio_rodada'), leveledAbilityGraphs, 'inicio_rodada'),
        });
      }
    }
    if (owner) {
      const current = currentCharacter(owner.id) ?? owner;
      updates.set(owner.id, {
        ...(updates.get(owner.id) ?? {}),
        arsenal: advanceAbilityGraphCooldowns(advanceArsenalState(current.arsenal ?? [], leveledArsenal, 'inicio_turno'), leveledAbilityGraphs, 'inicio_turno'),
      });
    }
    if (owner) {
      let effects = owner.activeEffects ?? [];
      const remainingConditions = [] as Character['conditions'];
      for (const condition of owner.conditions) {
        const preset = getPredefinedEffect(condition.name);
        if (preset) effects = applyActiveEffect(effects, { ...preset, duration: condition.duration > 0 ? { type:'rodadas', amount:condition.duration } : { type:'permanente' } });
        else remainingConditions.push(condition);
      }
      const tick = tickActiveEffects(effects, owner);
      const hadProcessableEffects = effects.length > 0;
      if (hadProcessableEffects || remainingConditions.length !== owner.conditions.length) {
      updates.set(owner.id, {
        ...(updates.get(owner.id) ?? {}),
        currentHp: tick.currentHp,
        currentAura: tick.currentAura,
        activeEffects: tick.effects,
        conditions: remainingConditions,
      });
      const tickLogs = [
        ...tick.events.map(event => logEntry('damage', event.kind === 'damage'
          ? `${owner.name} sofre ${event.amount} de dano de ${event.effectName}.`
          : event.kind === 'heal'
            ? `${owner.name} recupera ${event.amount} de HP de ${event.effectName}.`
            : event.kind === 'aura-drain'
              ? `${owner.name} perde ${event.amount} de Aura por ${event.effectName}.`
              : `${owner.name} recupera ${event.amount} de Aura por ${event.effectName}.`)),
        ...tick.expiredNames.map(name => logEntry('condition', `${name} expirou em ${owner.name}.`)),
      ];
      next = appendLog(next, tickLogs);
      if (tick.hpDelta) playTargetEffect({
        targetId: owner.id,
        kinds: [tick.hpDelta < 0 ? 'damage' : 'heal'],
        hpDelta: tick.hpDelta,
      });
      }
    }
    if (owner) {
      const ownerOngoing = next.encounter.activeOngoingEffects.filter(entry => entry.ownerId === owner.id);
      if (ownerOngoing.length) {
        let character = currentCharacter(owner.id) ?? owner;
        const survivors: OngoingEffectState[] = [];
        const expiredLogs: ReturnType<typeof logEntry>[] = [];
        for (const entry of ownerOngoing) {
          const graph = leveledAbilityGraphs.find(g => g.id === entry.graphId);
          let pendingReactions = entry.pendingReactions;
          let unlockCardIntents = entry.unlockCardIntents;
          if (graph) {
            const result = runOngoingEffect(graph, arsenalLevels[graph.id] ?? 1, actorStateIn(next, character), notation => rollDice(notation).total);
            character = { ...character, currentHp: result.actor.currentHp, currentAura: result.actor.currentAura, activeEffects: result.actor.effects };
            updates.set(owner.id, { ...(updates.get(owner.id) ?? {}), currentHp: character.currentHp, currentAura: character.currentAura, activeEffects: character.activeEffects });
            if (result.pendingReactions?.length) pendingReactions = result.pendingReactions;
            if (result.unlockCardIntents?.length) unlockCardIntents = result.unlockCardIntents;
          }
          const remaining = entry.roundsRemaining - 1;
          if (remaining > 0) survivors.push({ ...entry, roundsRemaining: remaining, pendingReactions, unlockCardIntents });
          else expiredLogs.push(logEntry('system', `${character.name} deixou de estar sob efeito de ${graph?.header.name ?? 'uma habilidade'}.`));
        }
        next = { ...next, encounter: { ...next.encounter, activeOngoingEffects: [
          ...next.encounter.activeOngoingEffects.filter(entry => entry.ownerId !== owner.id), ...survivors,
        ] } };
        next = appendLog(next, expiredLogs);
      }
    }

    for (const [id, characterUpdates] of updates) {
      if (party.some(character => character.id === id)) updateCharacterStats(id, characterUpdates);
      else next = updateNpcStats(next, id, characterUpdates);
    }

    if (encNext.round !== cena.encounter.round) {
      const expiredSummons = next.npcRoster.filter(npc => (npc.summonedRoundsRemaining ?? 0) === 1);
      const expiredIds = new Set(expiredSummons.map(npc => npc.id));
      const npcRoster = next.npcRoster
        .filter(npc => !expiredIds.has(npc.id))
        .map(npc => (npc.summonedRoundsRemaining ?? 0) > 1 ? { ...npc, summonedRoundsRemaining: npc.summonedRoundsRemaining! - 1 } : npc);
      if (expiredIds.size) {
        const tokens = { ...next.tokens }; expiredIds.forEach(id => delete tokens[id]);
        next = { ...next, npcRoster, tokens, encounter: { ...next.encounter, order: next.encounter.order.filter(entry => !expiredIds.has(entry.refId)) } };
        next = appendLog(next, expiredSummons.map(npc => logEntry('system', `${npc.name} desaparece ao fim da invocação.`)));
      } else next = { ...next, npcRoster };
    }

    if (encNext.round !== cena.encounter.round && next.encounter.activeFormas.length) {
      const expiring: string[] = [];
      const survivors = next.encounter.activeFormas.map(f => {
        if (f.roundsRemaining <= 0) return f;
        const remaining = f.roundsRemaining - 1;
        if (remaining <= 0) { expiring.push(f.ownerId); return f; }
        return { ...f, roundsRemaining: remaining };
      });
      next = { ...next, encounter: { ...next.encounter, activeFormas: survivors } };
      for (const ownerId of expiring) {
        const owner = currentCharacter(ownerId);
        if (owner) next = revertForma(next, owner);
      }
    }

    updateCena(next);
  };

  return (
    <div className={`cena-shell ${logOpen ? 'is-journal-open' : ''} ${(targetEffect || rareEvent || pendingProtection) ? 'is-resolution-focus' : ''} is-combat`}>
      <SceneBackdrop image={cena.scene.image} imagePosition={cena.scene.imagePosition} combat={combat} />
      <PauseCurtain isPaused={cena.encounter.isPaused} image={cena.scene.pausedImage} imagePosition={cena.scene.pausedImagePosition} participants={participants} display={cena.pausedDisplay} onChangeDisplay={display => updateCena({ ...cena, pausedDisplay: display })} />
      <CombatCinematics combat={combat} round={cena.encounter.round} activeName={turnActor?.name} activeImage={turnVisual} formaActivation={formaActivation} rareEvent={rareEvent} />
      {cena.streamingMode && <div className="cena-streaming-tag" role="status" aria-label="Modo streaming ativo —? HP de NPCs e notas ocultos">
        <i /><span>STREAMING</span>
      </div>}

      <button className={`cena-journal-tab ${logOpen ? 'is-open' : ''}`} onClick={() => setLogOpen(v => !v)} aria-expanded={logOpen} aria-label={logOpen ? 'Fechar diário de combate' : 'Abrir diário de combate'}>
        <ScrollText size={18} /><span>DIÁRIO</span>
      </button>
      <div className={`cena-journal-drawer ${logOpen ? 'is-open' : ''}`} aria-hidden={!logOpen}>
        <LogPanel log={cena.log} hiddenEntryIds={pendingLogIds} notes={cena.scene.notes} onNotesChange={notes => onSceneChange({ notes })} streamingMode={cena.streamingMode} />
      </div>

      <main className="cena-arena-column">
        {combat && armed && (
          <div className="cena-target-callout">
            <div className="cena-turn-phase" aria-label="Fase do turno">
              {['ACAO','ALVO','REACAO','ROLAGEM','RESULTADO'].map(step => <i key={step} className={step === (pendingProtection ? 'REACAO' : 'ALVO') ? 'is-active' : ''}>{step}</i>)}
            </div>
            <span>{pendingTargetId ? `ALVO: ${byId(pendingTargetId)?.name ?? 'selecionado'}`
              : armedAreaConfig && AREA_SELF_CENTERED.has(armedAreaConfig.shape) ? `ÁREA DE ${armed.name.toUpperCase()} (${areaPreviewIds.length} alvo(s))`
              : `ESCOLHA O ALVO DE ${armed.name.toUpperCase()}`}</span>
            {pendingTargetId && <button onClick={() => resolveArmedTarget(pendingTargetId)}>confirmar</button>}
            {!pendingTargetId && turnActor && armedAreaConfig && AREA_SELF_CENTERED.has(armedAreaConfig.shape) && (
              <button onClick={() => resolveArmedTarget(turnActor.id)}>confirmar</button>
            )}
            <button onClick={() => { setArmed(null); setPendingTargetId(null); }}>cancelar (Esc)</button>
          </div>
        )}
        {consequence && !rareEvent && <div key={consequence.key} className={`cena-consequence-panel is-${consequence.tone}`}><strong>{consequence.label}</strong><span>{consequence.detail}</span></div>}
        {combat && <FieldEffectsBar effects={cena.encounter.fieldEffects} onDispel={dispelFieldEffect} />}
        <div className="cena-arena-stage">
          <MapBoard image={cena.scene.image} imagePosition={cena.scene.imagePosition} participants={participants} tokens={cena.tokens}
            activeId={combat ? (turnEntry?.refId ?? null) : (active?.id ?? null)}
            onMoveToken={(id, pos) => updateCena(setToken(cena, id, pos))}
            onSelect={onParticipantClick}
            combat={combat} enemyIds={presentNpcs.map(n => n.id)} targetEffect={rareEvent ? null : targetEffect}
            targetableIds={armed ? targetableIds : []} targetImpacts={armed ? targetImpacts : {}}
            selectedTargetId={pendingTargetId} areaPreviewIds={armed ? areaPreviewIds : []}
            iconOverrides={formaIconOverrides} auraColors={formaAuraColors} formaAvailableColors={formaAvailableColors} />
        </div>
      </main>
      <aside className="cena-command-deck">
        <section className="cena-deck-roster">
          <RosterPanel
            party={party} npcRoster={cena.npcRoster} active={active}
            currentTurnId={turnEntry?.refId ?? null}
            targetFeedback={targetEffect}
            round={combat ? cena.encounter.round : undefined}
            orderIds={combat ? cena.encounter.order.map(entry => entry.refId) : []}
            onNextTurn={combat ? goNextTurn : undefined}
            onSelectTurn={combat ? (turnIndex) => updateCena({ ...cena, encounter: { ...cena.encounter, turnIndex, turn: { majorUsed: false, minorUsed: false } } }) : undefined}
            onEditCharacter={setEditingId}
            onSelectActive={ref => (combat && armed) ? onParticipantClick(ref.id) : setActive(ref)}
            onToggleHidden={id => updateCena(toggleNpcHidden(cena, id))}
            onTogglePresent={id => updateCena(toggleNpcPresent(cena, id))}
            onRemoveNpc={removeNpcFromCombat}
            onReorderTurn={(fromIndex, toIndex) => {
              updateCena({ ...cena, encounter: moveInOrder(cena.encounter, fromIndex, toIndex) });
            }}
            turnControlsDisabled={cena.encounter.isPaused}
            streamingMode={cena.streamingMode}
            formaStates={formaStates}
            auraPreview={activeChar && previewAction?.auraCost ? { charId: activeChar.id, cost: previewAction.auraCost } : null}
            targetPreview={armed ? { diceRoll: armed.diceRoll, damage: armed.damage, damageType: armed.damageType, healHp: armed.healHp, conditionName: armed.conditionName, targeting: armed.targeting } : null}
            targetImpacts={armed ? targetImpacts : {}}
          />
        </section>
        {combat && <section className="cena-deck-actions">
          <ActionMenu actions={actorActions({ cards: activeCards, seals: activeSeals, weapons: activeWeapons, items: activeItems, arsenalCards:activeArsenalCards, abilityGraphs:activeAbilityGraphs })} onSelectAction={onSelectAction} arsenalWeapons={activeArsenalWeapons} equippedWeaponId={activeLoadout.equippedWeaponIds[0]??null} onEquipWeapon={equipActiveWeapon} selectedLevels={arsenalLevels} onSelectLevel={(id,level)=>setArsenalLevels(current=>({...current,[id]:level}))} holdings={activeLoadout.holdings} preparations={cena.encounter.preparations.filter(item=>item.ownerId===activeChar?.id)} onPreviewAction={setPreviewAction} />
        </section>}
      </aside>
      {editingId && byId(editingId) && <CombatantEditor character={byId(editingId)!} onClose={() => setEditingId(null)} onSave={updates => {
        if (party.some(character => character.id === editingId)) updateCharacterStats(editingId, updates);
        else updateCena(updateNpcStats(cena, editingId, updates));
        setEditingId(null);
      }} />}
      {pendingProtection&&<div role="dialog" aria-modal="true" style={modalOverlay}><div className="cena-reaction-modal" style={modalCard}><div style={{fontSize:10,color:'#7de6ff',fontWeight:900,letterSpacing:'2px'}}>JANELA DE REAÇÃO</div><h3 style={{fontSize:20,color:'#fff',margin:'6px 0'}}>Escolha uma proteção</h3><p style={{fontSize:12,color:'#8b9aab',marginBottom:14}}>O alvo pode somar a rolagem da proteção à defesa natural.</p>{pendingProtection.cards.map(card=><button key={card.id} onClick={()=>resolveCanonicalOn(pendingProtection.targetId,pendingProtection.action,card)} style={modalChoice}><span style={{flex:1,textAlign:'left'}}>{card.name}</span><span>{card.testDice??'1d20'}</span></button>)}{(pendingProtection.graphs??[]).map(graph=><button key={graph.id} onClick={()=>resolveAbilityGraphOn(pendingProtection.targetId,pendingProtection.action,graph)} style={modalChoice}><span style={{flex:1,textAlign:'left'}}>{graph.header.name}</span><span>{(graph.nodes.find(node=>node.type==='teste')?.props as {dice?:string}|undefined)?.dice??'1d20'}</span></button>)}<button onClick={()=>(pendingProtection.action.abilityGraph?resolveAbilityGraphOn(pendingProtection.targetId,pendingProtection.action):resolveCanonicalOn(pendingProtection.targetId,pendingProtection.action))} style={{...modalChoice,color:'#8993a0'}}>Não reagir</button></div></div>}
      {comboDraft&&<div role="dialog" aria-modal="true" style={modalOverlay}><div className="cena-combo-modal" style={modalCard}><div style={{fontSize:10,color:'#c4b5fd',fontWeight:900,letterSpacing:'2px'}}>STACK DE COMBO</div><h3 style={{fontSize:20,color:'#fff',margin:'6px 0'}}>{comboDraft.name}</h3><p style={{fontSize:12,color:'#8b9aab',marginBottom:14}}>A carta inicial já ocupa 1 de {comboDraft.combo?.maxStacks??1} stacks. Acrescente apenas cartas disponíveis do mesmo grupo ou faça a jogada agora.</p>{comboStackCandidates(comboDraft,leveledArsenal,activeArsenalIds).map(card=>{const checked=comboSelection.includes(card.id);const full=comboSelection.length>=Math.max(0,(comboDraft.combo?.maxStacks??1)-1);return <label key={card.id} className={checked?'is-linked':''} style={{...modalChoice,opacity:!checked&&full?.45:1}}><input type="checkbox" checked={checked} disabled={!checked&&full} onChange={e=>setComboSelection(current=>e.target.checked?[...current,card.id]:current.filter(id=>id!==card.id))}/><span style={{flex:1}}>{card.name}</span><span style={{color:'#9b8bbd'}}>stack {comboSelection.indexOf(card.id)+2}</span></label>})}{comboStackCandidates(comboDraft,leveledArsenal,activeArsenalIds).length===0&&<p style={{padding:12,border:'1px dashed rgba(167,139,250,.25)',color:'#777f8d',fontSize:11}}>Nenhuma outra carta deste stack está disponível. A jogada ainda pode ser feita com a carta inicial.</p>}<div style={{display:'flex',gap:8,marginTop:14}}><button style={{...modalChoice,flex:1}} onClick={()=>setComboDraft(null)}>Cancelar</button><button style={{...modalChoice,flex:1,background:'rgba(124,58,237,.3)'}} onClick={()=>{const selected=resolveComboCards(comboDraft,comboSelection,leveledArsenal,activeArsenalIds);setArmed({...normalizeArsenalCard(comboDraft),name:selected.length?`${comboDraft.name} + ${selected.map(card=>card.name).join(' + ')}`:comboDraft.name,comboArsenalCards:selected.length?[comboDraft,...selected]:undefined});setComboDraft(null)}}><span key={comboSelection.length} className="cena-combo-counter">Fazer a jogada ({comboSelection.length+1}/{comboDraft.combo?.maxStacks??1})</span></button></div></div></div>}
      {comboGraphDraft&&(()=>{const maxStacks=graphComboConfig(comboGraphDraft,arsenalLevels[comboGraphDraft.id]??1)?.maxStacks??1;return <div role="dialog" aria-modal="true" style={modalOverlay}><div className="cena-combo-modal" style={modalCard}><div style={{fontSize:10,color:'#c4b5fd',fontWeight:900,letterSpacing:'2px'}}>STACK DE COMBO</div><h3 style={{fontSize:20,color:'#fff',margin:'6px 0'}}>{comboGraphDraft.header.name}</h3><p style={{fontSize:12,color:'#8b9aab',marginBottom:14}}>A habilidade inicial já ocupa 1 de {maxStacks} stacks. Acrescente apenas habilidades disponíveis do mesmo grupo ou faça a jogada agora.</p>{graphComboStackCandidates(comboGraphDraft,leveledAbilityGraphs,activeAbilityGraphIds).map(graph=>{const checked=comboSelection.includes(graph.id);const full=comboSelection.length>=Math.max(0,maxStacks-1);return <label key={graph.id} className={checked?'is-linked':''} style={{...modalChoice,opacity:!checked&&full?.45:1}}><input type="checkbox" checked={checked} disabled={!checked&&full} onChange={e=>setComboSelection(current=>e.target.checked?[...current,graph.id]:current.filter(id=>id!==graph.id))}/><span style={{flex:1}}>{graph.header.name}</span><span style={{color:'#9b8bbd'}}>stack {comboSelection.indexOf(graph.id)+2}</span></label>})}{graphComboStackCandidates(comboGraphDraft,leveledAbilityGraphs,activeAbilityGraphIds).length===0&&<p style={{padding:12,border:'1px dashed rgba(167,139,250,.25)',color:'#777f8d',fontSize:11}}>Nenhuma outra habilidade deste stack está disponível. A jogada ainda pode ser feita com a habilidade inicial.</p>}<div style={{display:'flex',gap:8,marginTop:14}}><button style={{...modalChoice,flex:1}} onClick={()=>setComboGraphDraft(null)}>Cancelar</button><button style={{...modalChoice,flex:1,background:'rgba(124,58,237,.3)'}} onClick={()=>{const selected=resolveGraphComboSelection(comboGraphDraft,comboSelection,leveledAbilityGraphs,activeAbilityGraphIds);const base=normalizeAbilityGraph(comboGraphDraft,arsenalLevels[comboGraphDraft.id]??1);setArmed({...base,name:selected.length?`${comboGraphDraft.header.name} + ${selected.map(graph=>graph.header.name).join(' + ')}`:comboGraphDraft.header.name,comboAbilityGraphs:selected.map(graph=>({graph,level:arsenalLevels[graph.id]??1}))});setComboGraphDraft(null)}}><span key={comboSelection.length} className="cena-combo-counter">Fazer a jogada ({comboSelection.length+1}/{maxStacks})</span></button></div></div></div>;})()}
    </div>
  );
};

const modalOverlay:React.CSSProperties={position:'fixed',inset:0,zIndex:99999,display:'grid',placeItems:'center',background:'rgba(3,7,15,.82)',backdropFilter:'blur(12px)'};
const modalCard:React.CSSProperties={width:420,maxHeight:'70vh',overflow:'auto',padding:22,background:'#101522',border:'1px solid rgba(125,230,255,.3)',boxShadow:'0 24px 80px rgba(0,0,0,.7)'};
const modalChoice:React.CSSProperties={width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 12px',marginBottom:6,background:'rgba(35,56,86,.65)',border:'1px solid rgba(125,210,240,.2)',color:'#e6f7ff',cursor:'pointer',fontSize:12};

export default CenaTab;

