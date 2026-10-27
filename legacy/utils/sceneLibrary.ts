import type { Character } from '../types';
import {
  createDefaultEncounter,
  type CenaState,
  type SceneLibraryTemplate,
  type SceneState,
} from './cena';

export const BUILTIN_SCENE_TEMPLATES: SceneLibraryTemplate[] = [
  {
    id: 'builtin-tactical-arena',
    name: 'Arena tática',
    description: 'Mapa limpo para combate direto, com lados bem separados.',
    scene: {
      locationName: 'Arena em ruínas',
      subtitle: 'Linhas claras, cobertura improvisada e espaço para AoE.',
      image: '',
      isNight: false,
      notes: 'Use as posições salvas como abertura: PJs à esquerda, oposição à direita. Bom para encontro de teste ou luta rápida.',
    },
    npcIds: [],
    tokens: {
      p1: { x: 24, y: 52 },
      p2: { x: 20, y: 64 },
      n1: { x: 76, y: 48 },
      n2: { x: 82, y: 62 },
    },
  },
  {
    id: 'builtin-boss-stage',
    name: 'Chefe em fases',
    description: 'Cena de chefe com palco central e notas para virada de fase.',
    scene: {
      locationName: 'Câmara do coração vermelho',
      subtitle: 'Um chefe no centro, lacaios nas bordas e fase 2 no meio da luta.',
      image: '',
      isNight: true,
      notes: 'Quando o chefe cair abaixo de 50% de vida, ative uma Forma/Fase e adicione um efeito de campo. Deixe a arena avisar a mudança antes do próximo turno.',
    },
    npcIds: [],
    tokens: {
      boss: { x: 72, y: 50 },
      n1: { x: 64, y: 34 },
      n2: { x: 64, y: 66 },
      p1: { x: 26, y: 45 },
      p2: { x: 22, y: 59 },
    },
  },
  {
    id: 'builtin-exploration-hub',
    name: 'Exploração com tensão',
    description: 'Cena de investigação ou travessia antes do combate.',
    scene: {
      locationName: 'Distrito silencioso',
      subtitle: 'Pistas, portas fechadas e inimigos fora de vista.',
      image: '',
      isNight: true,
      notes: 'Comece com NPCs ocultos. Revele presença aos poucos e use o diário para registrar pistas, alarmes e relógios narrativos.',
    },
    npcIds: [],
    tokens: {
      p1: { x: 34, y: 56 },
      p2: { x: 42, y: 61 },
      clue: { x: 62, y: 44 },
    },
  },
];

function cloneScene(scene: SceneState): SceneState {
  return { ...scene };
}

function cloneTokens(tokens: Record<string, { x: number; y: number }>): Record<string, { x: number; y: number }> {
  return Object.fromEntries(Object.entries(tokens).map(([id, pos]) => [id, { ...pos }]));
}

export function listSceneTemplates(cena: CenaState): SceneLibraryTemplate[] {
  return [...BUILTIN_SCENE_TEMPLATES, ...cena.sceneLibrary];
}

export function captureSceneTemplate(
  cena: CenaState,
  participants: readonly Character[],
  input: { name: string; description?: string },
): SceneLibraryTemplate {
  const participantIds = new Set(participants.map(p => p.id));
  return {
    id: `scene-${crypto.randomUUID()}`,
    name: input.name.trim() || cena.scene.locationName || 'Cena salva',
    description: input.description?.trim() ?? '',
    scene: cloneScene(cena.scene),
    npcIds: cena.npcRoster.filter(npc => npc.present && !npc.hidden).map(npc => npc.id),
    tokens: cloneTokens(Object.fromEntries(Object.entries(cena.tokens).filter(([id]) => participantIds.has(id)))),
  };
}

export function saveSceneTemplate(cena: CenaState, template: SceneLibraryTemplate): CenaState {
  return {
    ...cena,
    sceneLibrary: [
      template,
      ...cena.sceneLibrary.filter(existing => existing.id !== template.id),
    ],
  };
}

export function removeSceneTemplate(cena: CenaState, templateId: string): CenaState {
  return { ...cena, sceneLibrary: cena.sceneLibrary.filter(template => template.id !== templateId) };
}

export function applySceneTemplate(cena: CenaState, template: SceneLibraryTemplate): CenaState {
  const npcIds = new Set(template.npcIds);
  return {
    ...cena,
    scene: cloneScene(template.scene),
    npcRoster: cena.npcRoster.map(npc => ({ ...npc, present: npcIds.size ? npcIds.has(npc.id) : npc.present })),
    tokens: { ...cena.tokens, ...cloneTokens(template.tokens) },
    encounter: createDefaultEncounter(),
    log: [],
  };
}
