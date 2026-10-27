import { describe, it, expect } from 'vitest';
import { createDefaultCena, DEFAULT_SCENE, DEFAULT_ENCOUNTER, setScene, addNpcFromCharacter, mergeNpcLiveUpdates, removeNpc, syncNpcFromCharacter, toggleNpcHidden, toggleNpcPresent, setToken, setEncounterActive, setEncounterPaused, benchCastMember, unbenchCastMember, clearLog, logEntry, appendLog, updateNpcStats } from './cena';
import type { Character } from '../types';

function fakeChar(id: string, over: Partial<Character> = {}): Character {
  return {
    id, name: `Char ${id}`, icon: '', maxHp: 10, currentHp: 10, maxAura: 5, currentAura: 5,
    maxAmmo: 0, currentAmmo: 0, baseInitiative: 0, cardIds: [], conditions: [], items: [],
    role: 'npc', ...over,
  };
}

describe('createDefaultCena', () => {
  it('cria um estado de cena vazio e coerente', () => {
    const cena = createDefaultCena();
    expect(cena.scene).toEqual(DEFAULT_SCENE);
    expect(cena.npcRoster).toEqual([]);
    expect(cena.encounter).toEqual(DEFAULT_ENCOUNTER);
    expect(cena.log).toEqual([]);
    expect(cena.benchedCastIds).toEqual([]);
  });

  it('retorna cópias independentes (não compartilha referência de scene/encounter)', () => {
    const a = createDefaultCena();
    const b = createDefaultCena();
    a.scene.locationName = 'Mudou';
    a.encounter.round = 99;
    expect(b.scene.locationName).toBe(DEFAULT_SCENE.locationName);
    expect(b.encounter.round).toBe(1);
  });

  it('encounter começa inativo no round 1, turno 0, sem ordem', () => {
    const { encounter } = createDefaultCena();
    expect(encounter.isActive).toBe(false);
    expect(encounter.round).toBe(1);
    expect(encounter.turnIndex).toBe(0);
    expect(encounter.order).toEqual([]);
  });
});

describe('setScene', () => {
  it('faz merge parcial em scene sem mutar o original', () => {
    const cena = createDefaultCena();
    const next = setScene(cena, { locationName: 'Mina', subtitle: 'Galeria profunda' });
    expect(next.scene.locationName).toBe('Mina');
    expect(next.scene.subtitle).toBe('Galeria profunda');
    expect(next.scene.notes).toBe(cena.scene.notes);
    expect(cena.scene.locationName).toBe('Local Desconhecido');
    expect(next).not.toBe(cena);
  });
});

describe('addNpcFromCharacter', () => {
  it('cria um NpcEntry presente e revelado a partir de um Character', () => {
    const cena = createDefaultCena();
    const next = addNpcFromCharacter(cena, fakeChar('a'));
    expect(next.npcRoster).toHaveLength(1);
    expect(next.npcRoster[0]).toMatchObject({ id: 'a', isNpc: true, hidden: false, present: true });
  });
  it('não duplica NPC com o mesmo id (no-op)', () => {
    const cena = addNpcFromCharacter(createDefaultCena(), fakeChar('a'));
    const again = addNpcFromCharacter(cena, fakeChar('a'));
    expect(again.npcRoster).toHaveLength(1);
    expect(again).toBe(cena);
  });
});

describe('removeNpc / toggleNpcHidden / toggleNpcPresent', () => {
  it('removeNpc tira pelo id', () => {
    const cena = addNpcFromCharacter(createDefaultCena(), fakeChar('a'));
    expect(removeNpc(cena, 'a').npcRoster).toHaveLength(0);
  });
  it('toggleNpcHidden inverte hidden só do alvo', () => {
    let cena = addNpcFromCharacter(createDefaultCena(), fakeChar('a'));
    cena = addNpcFromCharacter(cena, fakeChar('b'));
    const next = toggleNpcHidden(cena, 'a');
    expect(next.npcRoster.find(n => n.id === 'a')!.hidden).toBe(true);
    expect(next.npcRoster.find(n => n.id === 'b')!.hidden).toBe(false);
  });
  it('toggleNpcPresent inverte present do alvo', () => {
    const cena = addNpcFromCharacter(createDefaultCena(), fakeChar('a'));
    expect(toggleNpcPresent(cena, 'a').npcRoster[0].present).toBe(false);
  });
});

describe('tokens', () => {
  it('createDefaultCena começa com tokens vazio', () => {
    expect(createDefaultCena().tokens).toEqual({});
  });
  it('setToken define a posição de um id sem mutar o original', () => {
    const cena = createDefaultCena();
    const next = setToken(cena, 'p1', { x: 40, y: 55 });
    expect(next.tokens.p1).toEqual({ x: 40, y: 55 });
    expect(cena.tokens.p1).toBeUndefined();
    expect(next).not.toBe(cena);
  });
  it('setToken atualiza posição existente', () => {
    let cena = setToken(createDefaultCena(), 'p1', { x: 10, y: 10 });
    cena = setToken(cena, 'p1', { x: 90, y: 20 });
    expect(cena.tokens.p1).toEqual({ x: 90, y: 20 });
  });
});

describe('setEncounterActive', () => {
  it('liga e desliga o encounter sem mutar o original', () => {
    const cena = createDefaultCena();
    const on = setEncounterActive(cena, true);
    expect(on.encounter.isActive).toBe(true);
    expect(cena.encounter.isActive).toBe(false);
    expect(setEncounterActive(on, false).encounter.isActive).toBe(false);
  });
});

describe('setEncounterPaused', () => {
  it('liga e desliga a pausa sem mutar o original', () => {
    const cena = createDefaultCena();
    const paused = setEncounterPaused(cena, true);
    expect(paused.encounter.isPaused).toBe(true);
    expect(cena.encounter.isPaused).toBe(false);
    expect(setEncounterPaused(paused, false).encounter.isPaused).toBe(false);
  });
});

describe('benchCastMember / unbenchCastMember', () => {
  it('adiciona e remove um id sem duplicar, sem mutar o original', () => {
    const cena = createDefaultCena();
    const benched = benchCastMember(cena, 'p1');
    expect(benched.benchedCastIds).toEqual(['p1']);
    expect(cena.benchedCastIds).toEqual([]);
    expect(benchCastMember(benched, 'p1').benchedCastIds).toEqual(['p1']);
    expect(unbenchCastMember(benched, 'p1').benchedCastIds).toEqual([]);
  });
});

describe('clearLog', () => {
  it('esvazia o log sem mutar o original', () => {
    const cena = appendLog(createDefaultCena(), [logEntry('system', 'x')]);
    const cleared = clearLog(cena);
    expect(cleared.log).toEqual([]);
    expect(cena.log).toHaveLength(1);
  });
});

describe('log helpers', () => {
  it('logEntry cria entrada com kind/text e id único', () => {
    const a = logEntry('system', 'Olá');
    const b = logEntry('roll', 'Rolagem');
    expect(a.kind).toBe('system');
    expect(a.text).toBe('Olá');
    expect(typeof a.timestamp).toBe('number');
    expect(a.id).not.toBe(b.id);
  });
  it('appendLog anexa sem mutar o original', () => {
    const cena = createDefaultCena();
    const next = appendLog(cena, [logEntry('system', 'x')]);
    expect(next.log).toHaveLength(1);
    expect(cena.log).toHaveLength(0);
    expect(next).not.toBe(cena);
  });
});

describe('updateNpcStats', () => {
  it('mescla updates no NPC alvo sem mutar o original', () => {
    const cena = addNpcFromCharacter(createDefaultCena(), fakeChar('a'));
    const next = updateNpcStats(cena, 'a', { currentHp: 3, conditions: [{ name: 'Queimando', duration: 2 }] });
    expect(next.npcRoster[0].currentHp).toBe(3);
    expect(next.npcRoster[0].conditions).toEqual([{ name: 'Queimando', duration: 2 }]);
    expect(cena.npcRoster[0].currentHp).toBe(10);
    expect(next).not.toBe(cena);
  });
  it('no-op para id inexistente', () => {
    const cena = createDefaultCena();
    expect(updateNpcStats(cena, 'x', { currentHp: 1 }).npcRoster).toEqual([]);
  });
});

describe('sincronização viva do NPC',()=>{
  it('recebe mudanças da ficha preservando recursos e cooldowns do combate',()=>{
    const npc=addNpcFromCharacter(createDefaultCena(),fakeChar('n',{name:'Antes',currentHp:10,arsenal:[{cardId:'a',quantity:1,equipped:false,active:false,currentCharges:1,cooldownRemaining:2}]})).npcRoster[0];
    const source=fakeChar('n',{name:'Depois',maxHp:20,currentHp:20,defense:14,arsenal:[{cardId:'a',quantity:1,equipped:false,active:false,currentCharges:3},{cardId:'b',quantity:1,equipped:false,active:false}]});
    const synced=syncNpcFromCharacter({...npc,currentHp:4},source);
    expect(synced).toMatchObject({name:'Depois',maxHp:20,currentHp:4,defense:14});
    expect(synced.arsenal?.map(holding=>holding.cardId)).toEqual(['a','b']);
    expect(synced.arsenal?.[0]).toMatchObject({currentCharges:1,cooldownRemaining:2});
  });

  it('incorpora nova carta atribuída sem perder o estado das anteriores',()=>{
    const source=fakeChar('n',{arsenal:[{cardId:'a',quantity:3,equipped:false,active:false}]});
    const npc=addNpcFromCharacter(createDefaultCena(),source).npcRoster[0];
    const runtime={...npc,arsenal:[{cardId:'a',quantity:1,equipped:true,active:true,cooldownRemaining:2}]};
    const merged=mergeNpcLiveUpdates(runtime,{arsenal:[{cardId:'a',quantity:5,equipped:false,active:false},{cardId:'b',quantity:1,equipped:false,active:false}]},source);
    expect(merged.arsenal?.map(holding=>holding.cardId)).toEqual(['a','b']);
    expect(merged.arsenal?.[0]).toMatchObject({quantity:3,equipped:true,active:true,cooldownRemaining:2});
  });
});

describe('EncounterState v2 defaults', () => {
  it('createDefaultCena traz os campos novos do encounter', () => {
    const c = createDefaultCena();
    expect(c.encounter.turn).toEqual({ majorUsed: false, minorUsed: false });
    expect(c.encounter.reactionsUsed).toEqual({});
    expect(c.encounter.activeBuffs).toEqual([]);
    expect(c.encounter.activeFormas).toEqual([]);
    expect(c.encounter.preparations).toEqual([]);
  });

  it('instâncias default são independentes (sem referência compartilhada)', () => {
    const a = createDefaultCena();
    a.encounter.activeBuffs.push({ targetId: 'x', stat: 'defesa', value: 1, roundsRemaining: 1, source: 't' });
    a.encounter.reactionsUsed['x'] = true;
    expect(DEFAULT_ENCOUNTER.activeBuffs).toEqual([]);
    expect(DEFAULT_ENCOUNTER.reactionsUsed).toEqual({});
    expect(createDefaultCena().encounter.activeBuffs).toEqual([]);
  });
});
