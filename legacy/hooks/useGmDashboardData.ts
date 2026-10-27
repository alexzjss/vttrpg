import { useCallback, useEffect, useState } from 'react';
import { DatabaseService } from '../utils/database';
import type { Card, Character, Item, Seal, Weapon } from '../types';
import {
  addNpcFromCharacter, appendLog, benchCastMember, clearLog, createDefaultCena, removeNpc,
  setEncounterPaused, setPausedDisplay, setScene, setStreamingMode, unbenchCastMember, updateNpcStats, type CenaState, type PausedDisplayState, type SceneState, type SceneLibraryTemplate,
} from '../utils/cena';
import { resetVitals } from '../utils/actions';
import { rerollInitiativeOrder, startEncounter, moveInOrder, type InitiativeParticipant } from '../utils/encounter';
import { applyActiveEffect, type ActiveEffectState } from '../utils/arsenalPipeline';
import type { ArsenalEffect } from '../utils/arsenal';
import {
  applySceneTemplate,
  captureSceneTemplate,
  removeSceneTemplate,
  saveSceneTemplate,
} from '../utils/sceneLibrary';

/**
 * Estado + ações do Dashboard do Mestre (janela separada): lê/escreve
 * personagens e cena diretamente no mesmo IndexedDB da janela principal.
 * Reaproveita as mesmas funções puras que o CenaTab usa — nenhuma lógica de
 * combate é duplicada, só a leitura/escrita fica independente por janela.
 */
export function useGmDashboardData() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [cena, setCena] = useState<CenaState>(createDefaultCena());
  const [cards, setCards] = useState<Card[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [seals, setSeals] = useState<Seal[]>([]);
  const [weapons, setWeapons] = useState<Weapon[]>([]);

  useEffect(() => DatabaseService.syncCharacters(setCharacters), []);
  useEffect(() => DatabaseService.syncCenaState(setCena), []);
  useEffect(() => DatabaseService.syncCards(setCards), []);
  useEffect(() => {
    const syncItems = (DatabaseService as { syncItems?: (cb: (d: Item[]) => void) => () => void }).syncItems;
    return syncItems ? syncItems(setItems) : undefined;
  }, []);
  useEffect(() => DatabaseService.syncSeals(setSeals), []);
  useEffect(() => DatabaseService.syncWeapons(setWeapons), []);

  const updateCena = useCallback((next: CenaState) => { setCena(next); DatabaseService.updateCena(next); }, []);
  const saveCharacter = useCallback((char: Character) => { DatabaseService.saveCharacter(char); }, []);
  const deleteCharacter = useCallback((id: string) => {
    if (!window.confirm('Excluir este personagem permanentemente?')) return;
    DatabaseService.deleteCharacter(id);
  }, []);
  const updateCharacterStats = useCallback((id: string, updates: Partial<Character>) => {
    const character = characters.find(c => c.id === id);
    if (character) DatabaseService.saveCharacter({ ...character, ...updates });
  }, [characters]);

  const initiativeParticipants = (): InitiativeParticipant[] => {
    const party = characters.filter(c => !cena.benchedCastIds.includes(c.id));
    const presentNpcs = cena.npcRoster.filter(n => n.present && !n.hidden && !characters.some(c => c.id === n.id));
    return [...party, ...presentNpcs].map(p => ({
      id: p.id, side: (party.some(c => c.id === p.id) ? 'party' : 'npc') as 'party' | 'npc',
      name: p.name, baseInitiative: p.speed ?? p.baseInitiative ?? 0,
    }));
  };

  const onToggleBench = useCallback((id: string) =>
    updateCena(cena.benchedCastIds.includes(id) ? unbenchCastMember(cena, id) : benchCastMember(cena, id)),
  [cena, updateCena]);

  const onSpawnNpc = useCallback((char: Character) => updateCena(addNpcFromCharacter(cena, char)), [cena, updateCena]);
  const onEditNpc = useCallback((npcId: string, updates: Partial<Character>) => updateCena(updateNpcStats(cena, npcId, updates)), [cena, updateCena]);
  const onRemoveNpc = useCallback((id: string) => updateCena(removeNpc(cena, id)), [cena, updateCena]);

  const onTogglePause = useCallback(() => updateCena(setEncounterPaused(cena, !cena.encounter.isPaused)), [cena, updateCena]);
  const onResetAllStatus = useCallback(() => {
    if (!window.confirm('Reiniciar o status de todos os combatentes (cura total e remove condições)?')) return;
    characters.forEach(character => updateCharacterStats(character.id, resetVitals(character)));
    updateCena({ ...cena, npcRoster: cena.npcRoster.map(npc => ({ ...npc, ...resetVitals(npc) })) });
  }, [characters, cena, updateCena, updateCharacterStats]);
  const onClearLog = useCallback(() => {
    if (!window.confirm('Limpar todo o log de combate?')) return;
    updateCena(clearLog(cena));
  }, [cena, updateCena]);
  const onRerollInitiative = useCallback(() => {
    if (!window.confirm('Rerolar a iniciativa de todos os presentes?')) return;
    const { encounter, log } = rerollInitiativeOrder(cena.encounter, initiativeParticipants());
    updateCena(appendLog({ ...cena, encounter }, log));
  }, [cena, updateCena]);
  const onEndCombat = useCallback(() => {
    if (!window.confirm('Reiniciar o combate do zero? Isso limpa o log e sorteia uma nova iniciativa.')) return;
    updateCena(startEncounter({ ...cena, log: [] }, initiativeParticipants()));
  }, [cena, updateCena]);
  const onSceneChange = useCallback((partial: Partial<SceneState>) => updateCena(setScene(cena, partial)), [cena, updateCena]);
  const onToggleStreamingMode = useCallback(() => updateCena(setStreamingMode(cena, !cena.streamingMode)), [cena, updateCena]);
  const onSetPausedDisplay = useCallback((display: PausedDisplayState | null) => updateCena(setPausedDisplay(cena, display)), [cena, updateCena]);

  const onReorderTurn = useCallback((fromIndex: number, toIndex: number) =>
    updateCena({ ...cena, encounter: moveInOrder(cena.encounter, fromIndex, toIndex) }),
  [cena, updateCena]);

  /** Aplica um efeito de arsenal a todo o grupo (pjs, npcs ou todos) de uma vez — atalho de mestre. */
  const onApplyEffectToGroup = useCallback((effect: ArsenalEffect, target: 'todos' | 'pjs' | 'npcs') => {
    if (target !== 'npcs') {
      characters.filter(c => !cena.benchedCastIds.includes(c.id)).forEach(character => {
        const next: ActiveEffectState[] = applyActiveEffect((character.activeEffects ?? []) as ActiveEffectState[], effect);
        updateCharacterStats(character.id, { activeEffects: next });
      });
    }
    if (target !== 'pjs') {
      const npcRoster = cena.npcRoster.map(npc => ({
        ...npc,
        activeEffects: applyActiveEffect((npc.activeEffects ?? []) as ActiveEffectState[], effect),
      }));
      updateCena({ ...cena, npcRoster });
    }
  }, [characters, cena, updateCena, updateCharacterStats]);

  const sceneParticipants = useCallback((): Character[] => {
    const party = characters.filter(c => !cena.benchedCastIds.includes(c.id));
    const presentNpcs = cena.npcRoster.filter(n => n.present && !n.hidden && !characters.some(c => c.id === n.id));
    return [...party, ...presentNpcs];
  }, [characters, cena]);

  const onSaveSceneTemplate = useCallback((name: string, description: string) => {
    const template = captureSceneTemplate(cena, sceneParticipants(), { name, description });
    updateCena(saveSceneTemplate(cena, template));
  }, [cena, sceneParticipants, updateCena]);

  const onApplySceneTemplate = useCallback((template: SceneLibraryTemplate) => {
    if (!window.confirm(`Aplicar "${template.name}" e reiniciar a cena de combate atual?`)) return;
    updateCena(applySceneTemplate(cena, template));
  }, [cena, updateCena]);

  const onRemoveSceneTemplate = useCallback((templateId: string) => {
    if (!window.confirm('Excluir este pacote de cena salvo?')) return;
    updateCena(removeSceneTemplate(cena, templateId));
  }, [cena, updateCena]);

  return {
    characters, cena, cards, items, seals, weapons,
    saveCharacter, deleteCharacter, updateCharacterStats,
    onToggleBench, onSpawnNpc, onEditNpc, onRemoveNpc,
    onTogglePause, onResetAllStatus, onClearLog, onRerollInitiative, onEndCombat,
    onSceneChange, onToggleStreamingMode, onSetPausedDisplay, onReorderTurn, onApplyEffectToGroup,
    sceneParticipants: sceneParticipants(),
    onSaveSceneTemplate, onApplySceneTemplate, onRemoveSceneTemplate,
  };
}
