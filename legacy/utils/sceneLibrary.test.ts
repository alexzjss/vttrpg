import { describe, expect, it } from 'vitest';
import type { Character } from '../types';
import { addNpcFromCharacter, createDefaultCena } from './cena';
import {
  applySceneTemplate,
  captureSceneTemplate,
  listSceneTemplates,
  removeSceneTemplate,
  saveSceneTemplate,
} from './sceneLibrary';

function ch(id: string, name = id): Character {
  return {
    id, name, icon: '', maxHp: 20, currentHp: 20, maxAura: 8, currentAura: 8,
    maxAmmo: 0, currentAmmo: 0, baseInitiative: 0, cardIds: [], conditions: [], items: [], role: 'cast',
  };
}

describe('sceneLibrary', () => {
  it('lista modelos prontos junto dos pacotes salvos', () => {
    const cena = saveSceneTemplate(createDefaultCena(), {
      id: 'custom', name: 'Minha cena', description: '', scene: createDefaultCena().scene, npcIds: [], tokens: {},
    });
    expect(listSceneTemplates(cena).map(template => template.id)).toContain('builtin-tactical-arena');
    expect(listSceneTemplates(cena).map(template => template.id)).toContain('custom');
  });

  it('captura cena atual com NPCs presentes e tokens dos participantes', () => {
    let cena = addNpcFromCharacter(createDefaultCena(), ch('n1', 'Guarda'));
    cena = {
      ...cena,
      scene: { ...cena.scene, locationName: 'Ponte', notes: 'vento forte' },
      tokens: { p1: { x: 20, y: 30 }, n1: { x: 70, y: 40 }, fora: { x: 1, y: 1 } },
    };
    const template = captureSceneTemplate(cena, [ch('p1'), cena.npcRoster[0]], { name: 'Emboscada' });
    expect(template.name).toBe('Emboscada');
    expect(template.scene.locationName).toBe('Ponte');
    expect(template.npcIds).toEqual(['n1']);
    expect(template.tokens).toEqual({ p1: { x: 20, y: 30 }, n1: { x: 70, y: 40 } });
  });

  it('aplica pacote, reinicia encounter/log e ajusta presenca de NPCs salvos', () => {
    let cena = addNpcFromCharacter(createDefaultCena(), ch('n1', 'Guarda'));
    cena = addNpcFromCharacter(cena, ch('n2', 'Mago'));
    cena = {
      ...cena,
      encounter: { ...cena.encounter, isActive: true, round: 3 },
      log: [{ id: 'old', kind: 'system', text: 'x', timestamp: 1 }],
    };
    const template = {
      id: 't', name: 'Sala', description: '',
      scene: { ...cena.scene, locationName: 'Sala final' },
      npcIds: ['n2'],
      tokens: { n2: { x: 80, y: 50 } },
    };
    const next = applySceneTemplate(cena, template);
    expect(next.scene.locationName).toBe('Sala final');
    expect(next.encounter.isActive).toBe(false);
    expect(next.log).toEqual([]);
    expect(next.npcRoster.find(npc => npc.id === 'n1')!.present).toBe(false);
    expect(next.npcRoster.find(npc => npc.id === 'n2')!.present).toBe(true);
    expect(next.tokens.n2).toEqual({ x: 80, y: 50 });
  });

  it('salva e remove pacote sem mutar os demais', () => {
    const scene = createDefaultCena().scene;
    const a = { id: 'a', name: 'A', description: '', scene, npcIds: [], tokens: {} };
    const b = { id: 'b', name: 'B', description: '', scene, npcIds: [], tokens: {} };
    const saved = saveSceneTemplate(saveSceneTemplate(createDefaultCena(), a), b);
    expect(saved.sceneLibrary.map(template => template.id)).toEqual(['b', 'a']);
    expect(removeSceneTemplate(saved, 'b').sceneLibrary.map(template => template.id)).toEqual(['a']);
  });
});
