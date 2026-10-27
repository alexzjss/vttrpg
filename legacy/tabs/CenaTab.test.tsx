import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import CenaTab from './CenaTab';
import { addNpcFromCharacter, createDefaultCena, createDefaultEncounter } from '../utils/cena';
import { startEncounter } from '../utils/encounter';
import type { Character, Seal } from '../types';
import { createArsenalCard } from '../utils/arsenal';
import { createHolding } from '../utils/arsenalState';
import { getPredefinedEffect } from '../utils/arsenalEffects';
import { applyActiveEffect } from '../utils/arsenalPipeline';

afterEach(() => cleanup());

function cast(id: string, name: string, over: Partial<Character> = {}): Character {
  return { id, name, icon: '', maxHp: 20, currentHp: 20, maxAura: 10, currentAura: 10,
    maxAmmo: 0, currentAmmo: 0, baseInitiative: 0, cardIds: [], conditions: [], items: [], role: 'cast', ...over };
}
const props = (cena: any, characters: Character[], over: any = {}) => ({
  cena, characters, cards: [], seals: [], items: [], weapons: [], updateCena: () => {}, updateCharacterStats: () => {},
  onSaveCharacter: () => {}, onDeleteCharacter: () => {}, onExportCharacter: () => {}, ...over,
});

/** Seleciona um alvo em combate: a UI exige dois cliques no card do roster (o mesmo id 'pendura' o
 *  alvo na primeira seleção e só resolve na segunda) — ver onParticipantClick em CenaTab.tsx. O título
 *  do card é só o nome (sem sufixo), e o MapBoard também renderiza um token com o mesmo título, então
 *  filtramos pelo card do roster (.cena-combatant) para evitar ambiguidade. */
function selectTarget(name: string) {
  const card = screen.getAllByTitle(name).find(el => el.className.includes('cena-combatant'))!;
  fireEvent.click(card);
  fireEvent.click(card);
}

describe('CenaTab — arsenal unificado', () => {
  const reactionScenario = (over: Record<string, unknown> = {}) => {
    const attack=createArsenalCard({id:'atk',name:'Golpe Solar',category:'habilidade',testDice:'1d20',damage:{flat:4}});
    const protection=createArsenalCard({id:'prot',name:'Barreira',category:'habilidade',abilityType:'protecao',testDice:'1d8',conditions:[{type:'reacao'}]});
    const cena={...createDefaultCena(),encounter:{...createDefaultEncounter(),isActive:true,round:1,turnIndex:0,order:[{refId:'p1',side:'party' as const,initiative:20},{refId:'p2',side:'party' as const,initiative:10}]}};
    const p1=cast('p1','Shinkai',{arsenal:[createHolding(attack)]});
    const p2=cast('p2','Mikhail',{defense:10,arsenal:[createHolding(protection)]});
    render(<CenaTab {...props(cena,[p1,p2],{arsenal:[attack,protection],...over})}/>);
    fireEvent.click(screen.getByText('ATAQUES'));
    fireEvent.click(screen.getByRole('button',{name:/golpe solar/i}));
    fireEvent.click(screen.getByRole('button',{name:'USAR CARTA'}));
    selectTarget('Mikhail');
  };

  it('abre janela de proteção quando o alvo possui reação disponível', () => {
    reactionScenario();
    expect(screen.getByText('Escolha uma proteção')).toBeTruthy();
    expect(screen.getByRole('button',{name:/barreira/i})).toBeTruthy();
  });

  it('fecha a janela e resolve normalmente ao recusar a reação', () => {
    const onDiceRoll=vi.fn();
    reactionScenario({onDiceRoll});
    fireEvent.click(screen.getByRole('button',{name:/não reagir/i}));
    expect(screen.queryByText('Escolha uma proteção')).toBeNull();
    expect(onDiceRoll).toHaveBeenCalledTimes(1);
    expect(onDiceRoll.mock.calls[0][1]).toMatchObject({defenderResult:10});
    expect(onDiceRoll.mock.calls[0][1].defenderRoll).toBeUndefined();
  });

  it('fecha a janela e envia ataque e reação + defesa na mesma comparação', () => {
    const onDiceRoll=vi.fn();
    reactionScenario({onDiceRoll});
    fireEvent.click(screen.getByRole('button',{name:/barreira/i}));
    expect(screen.queryByText('Escolha uma proteção')).toBeNull();
    expect(onDiceRoll).toHaveBeenCalledTimes(1);
    const [attackRoll,options]=onDiceRoll.mock.calls[0];
    expect(options.defenderRoll).toBeDefined();
    expect(options.defenderBase).toBe(10);
    expect(options.defenderResult).toBe(10+options.defenderRoll.total);
    expect(options.isSuccess).toBe(attackRoll.total>=options.defenderResult);
  });

  it('contabiliza dano e persiste efeitos ao acertar um personagem da party', () => {
    const burn = getPredefinedEffect('Queimadura')!;
    const attack = createArsenalCard({ id:'burn-hit', name:'Lâmina Ígnea', category:'habilidade', target:{type:'um_alvo'}, damage:{flat:6}, effects:[burn] });
    const cena={...createDefaultCena(),encounter:{...createDefaultEncounter(),isActive:true,round:1,turnIndex:0,order:[{refId:'p1',side:'party' as const,initiative:20},{refId:'p2',side:'party' as const,initiative:10}]}};
    const p1=cast('p1','Shinkai',{arsenal:[createHolding(attack)]});
    const p2=cast('p2','Mikhail',{currentHp:20});
    const updateCharacterStats=vi.fn();
    render(<CenaTab {...props(cena,[p1,p2],{arsenal:[attack],updateCharacterStats})}/>);
    fireEvent.click(screen.getByText('ATAQUES'));
    fireEvent.click(screen.getByRole('button',{name:/lâmina ígnea/i}));
    fireEvent.click(screen.getByRole('button',{name:'USAR CARTA'}));
    selectTarget('Mikhail');
    expect(updateCharacterStats).toHaveBeenCalledWith('p2',expect.objectContaining({currentHp:16,defenseCurrent:14}));
    const targetUpdate=updateCharacterStats.mock.calls.find(call=>call[0]==='p2')?.[1];
    expect(targetUpdate.activeEffects[0].effect.name).toBe('Queimadura');
  });

  it('permite usar uma carta de alvo único no próprio usuário', () => {
    const heal = createArsenalCard({ id:'self-target', name:'Pulso Vital', category:'habilidade', target:{type:'um_alvo'}, healing:{flat:5} });
    const cena={...createDefaultCena(),encounter:{...createDefaultEncounter(),isActive:true,round:1,turnIndex:0,order:[{refId:'p1',side:'party' as const,initiative:20},{refId:'p2',side:'party' as const,initiative:10}]}};
    const p1=cast('p1','Shinkai',{currentHp:10,arsenal:[createHolding(heal)]});
    const p2=cast('p2','Mikhail');
    const updateCharacterStats=vi.fn();
    render(<CenaTab {...props(cena,[p1,p2],{arsenal:[heal],updateCharacterStats})}/>);
    fireEvent.click(screen.getByText('HABILIDADES'));
    fireEvent.click(screen.getByRole('button',{name:/pulso vital/i}));
    fireEvent.click(screen.getByRole('button',{name:'USAR CARTA'}));
    selectTarget('Shinkai');
    expect(updateCharacterStats).toHaveBeenCalledWith('p1',expect.objectContaining({currentHp:15}));
  });

  it('contabiliza dano e persiste efeitos ao acertar um NPC', () => {
    const burn = getPredefinedEffect('Queimadura')!;
    const attack = createArsenalCard({ id:'npc-hit', name:'Flecha Ígnea', category:'habilidade', target:{type:'um_alvo'}, damage:{flat:5}, effects:[burn] });
    let cena=addNpcFromCharacter(createDefaultCena(),cast('n1','Bandido',{role:'npc',currentHp:18}));
    cena={...cena,encounter:{...createDefaultEncounter(),isActive:true,round:1,turnIndex:0,order:[{refId:'p1',side:'party' as const,initiative:20},{refId:'n1',side:'npc' as const,initiative:10}]}};
    const p1=cast('p1','Shinkai',{arsenal:[createHolding(attack)]});
    const updateCena=vi.fn();
    render(<CenaTab {...props(cena,[p1],{arsenal:[attack],updateCena})}/>);
    fireEvent.click(screen.getByText('ATAQUES'));
    fireEvent.click(screen.getByRole('button',{name:/flecha ígnea/i}));
    fireEvent.click(screen.getByRole('button',{name:'USAR CARTA'}));
    selectTarget('Bandido');
    const saved=updateCena.mock.calls.at(-1)?.[0].npcRoster.find((npc:Character)=>npc.id==='n1');
    expect(saved.currentHp).toBe(14);
    expect(saved.defenseCurrent).toBe(15);
    expect(saved.activeEffects[0].effect.name).toBe('Queimadura');
  });
});

describe('CenaTab — iniciar/encerrar + resolução (3A/3B intactos)', () => {
  it('Iniciar Combate monta a ordem', () => {
    const updateCena = vi.fn();
    const onDiceRoll = vi.fn();
    render(<CenaTab {...props(createDefaultCena(), [cast('p1', 'Shinkai')], { updateCena, onDiceRoll })} />);
    fireEvent.click(screen.getByRole('button', { name: /iniciar combate/i }));
    expect(screen.getByRole('dialog', { name: /preparar novo combate/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /manter status atual/i }));
    expect(updateCena.mock.calls[0][0].encounter.order).toHaveLength(1);
    expect(onDiceRoll).toHaveBeenCalledTimes(1);
    expect(onDiceRoll.mock.calls[0][1]).toMatchObject({ customLabel: 'INICIATIVA', actorLabel: 'Shinkai' });
  });

  it('oferece restaurar recursos e condições antes de um novo combate', () => {
    const updateCena = vi.fn();
    const updateCharacterStats = vi.fn();
    const wounded = cast('p1', 'Shinkai', { currentHp: 3, currentAura: 1, currentAmmo: 0, maxAmmo: 4, conditions: [{ name: 'Queimando', duration: 2 }] });
    render(<CenaTab {...props(createDefaultCena(), [wounded], { updateCena, updateCharacterStats })} />);
    fireEvent.click(screen.getByRole('button', { name: /iniciar combate/i }));
    fireEvent.click(screen.getByRole('button', { name: /restaurar e iniciar/i }));
    expect(updateCharacterStats).toHaveBeenCalledWith('p1', expect.objectContaining({ currentHp: 20, currentAura: 10, currentAmmo: 4, conditions: [] }));
    expect(updateCena.mock.calls[0][0].encounter.isActive).toBe(true);
  });

  it('ao encerrar combate limpa totalmente o log', () => {
    const updateCena = vi.fn();
    const started = { ...startEncounter(createDefaultCena(), [{ id: 'p1', side: 'party' as const, name: 'Shinkai', baseInitiative: 0 }]), log: [{ id: 'old', kind: 'system' as const, text: 'registro', timestamp: 1 }] };
    render(<CenaTab {...props(started, [cast('p1', 'Shinkai')], { updateCena })} />);
    fireEvent.click(screen.getByRole('button', { name: /encerrar/i }));
    expect(updateCena.mock.calls[0][0].log).toEqual([]);
    expect(updateCena.mock.calls[0][0].encounter.isActive).toBe(false);
  });

  it('cura self resolve imediatamente (party)', () => {
    const heal: Seal = { id: 'sh', name: 'Cura', code: '', image: '', description: '', healHp: 5 };
    let cena = createDefaultCena();
    cena = startEncounter(cena, [{ id: 'p1', side: 'party', name: 'Shinkai', baseInitiative: 0 }]);
    const updateCharacterStats = vi.fn();
    render(<CenaTab {...props(cena, [cast('p1', 'Shinkai', { currentHp: 10, sealIds: ['sh'] })], { seals: [heal], updateCharacterStats })} />);
    fireEvent.click(screen.getByText('HABILIDADES'));
    fireEvent.click(screen.getByRole('button', { name: /cura/i }));
    fireEvent.click(screen.getByRole('button', { name: 'USAR CARTA' }));
    expect(updateCharacterStats).toHaveBeenCalled();
    expect(updateCharacterStats.mock.calls[0][1].currentHp).toBe(15);
  });

  it('só mostra o efeito no alvo depois que o modal de rolagem termina', () => {
    const heal: Seal = { id: 'sh', name: 'Cura', code: '', image: '', description: '', healHp: 5 };
    let cena = createDefaultCena();
    cena = startEncounter(cena, [{ id: 'p1', side: 'party', name: 'Shinkai', baseInitiative: 0 }]);
    const onDiceRoll = vi.fn();
    render(<CenaTab {...props(cena, [cast('p1', 'Shinkai', { currentHp: 10, sealIds: ['sh'] })], { seals: [heal], onDiceRoll })} />);
    fireEvent.click(screen.getByText('HABILIDADES'));
    fireEvent.click(screen.getByRole('button', { name: /cura/i }));
    fireEvent.click(screen.getByRole('button', { name: 'USAR CARTA' }));
    expect(screen.queryByLabelText('Efeito em Shinkai')).toBeNull();
    expect(onDiceRoll.mock.calls[0][1].onComplete).toBeTypeOf('function');
    act(() => onDiceRoll.mock.calls[0][1].onComplete());
    expect(screen.getByLabelText('Efeito em Shinkai').querySelector('.is-heal')).toBeTruthy();
    expect(screen.getByLabelText('Sucesso da ação em Shinkai')).toBeTruthy();
  });
});

describe('CenaTab — ciclo de condições e efeitos', () => {
  it('Congelado reduz a velocidade de iniciativa do afetado', () => {
    const frozen=applyActiveEffect([],getPredefinedEffect('Congelado')!);
    const cena={...createDefaultCena(),encounter:{...createDefaultEncounter(),isActive:true,round:1,turnIndex:0,order:[
      {refId:'p1',side:'party' as const,initiative:30},{refId:'p2',side:'party' as const,initiative:20},{refId:'p3',side:'party' as const,initiative:10},
    ]}};
    const updateCena=vi.fn();
    render(<CenaTab {...props(cena,[cast('p1','A'),cast('p2','B',{activeEffects:frozen}),cast('p3','C')],{updateCena})}/>);
    fireEvent.click(screen.getByRole('button',{name:/próximo turno/i}));
    expect(updateCena.mock.calls[0][0].encounter.order.map((entry:any)=>entry.refId)).toEqual(['p1','p3','p2']);
  });

  it('aplica e avança um efeito periódico no início do turno do portador', () => {
    const burn = getPredefinedEffect('Queimadura')!;
    const cena = { ...createDefaultCena(), encounter: { ...createDefaultEncounter(), isActive: true, round: 1, turnIndex: 0, order: [
      { refId: 'p1', side: 'party' as const, initiative: 20 },
      { refId: 'p2', side: 'party' as const, initiative: 10 },
    ] } };
    const updateCharacterStats = vi.fn();
    const updateCena = vi.fn();
    const p1 = cast('p1', 'Shinkai');
    const p2 = cast('p2', 'Mikhail', { currentHp: 20, activeEffects: [{ effect: burn, stacks: 1, remaining: 2 }] });
    render(<CenaTab {...props(cena, [p1, p2], { updateCharacterStats, updateCena })} />);
    fireEvent.click(screen.getByRole('button', { name: /próximo turno/i }));
    expect(updateCharacterStats).toHaveBeenCalledWith('p2', expect.objectContaining({ currentHp: 18 }));
    expect(updateCharacterStats.mock.calls[0][1].activeEffects[0].remaining).toBe(1);
    expect(updateCena.mock.calls[0][0].log.some((entry:any) => /sofre 2 de dano de Queimadura/i.test(entry.text))).toBe(true);
    expect(screen.getByText('−2')).toBeTruthy();
  });

  it('migra e processa uma condição periódica legada ao iniciar o turno', () => {
    const cena = { ...createDefaultCena(), encounter: { ...createDefaultEncounter(), isActive: true, round: 1, turnIndex: 0, order: [
      { refId: 'p1', side: 'party' as const, initiative: 20 },
      { refId: 'p2', side: 'party' as const, initiative: 10 },
    ] } };
    const updateCharacterStats = vi.fn();
    const updateCena = vi.fn();
    const p1 = cast('p1', 'Shinkai');
    const p2 = cast('p2', 'Mikhail', { currentHp: 20, conditions: [{ name: 'Queimando', duration: 2 }] });
    render(<CenaTab {...props(cena, [p1, p2], { updateCharacterStats, updateCena })} />);
    fireEvent.click(screen.getByRole('button', { name: /próximo turno/i }));
    expect(updateCharacterStats).toHaveBeenCalledWith('p2', expect.objectContaining({ currentHp: 18, conditions: [] }));
    expect(updateCharacterStats.mock.calls[0][1].activeEffects[0].effect.name).toBe('Queimadura');
    expect(updateCharacterStats.mock.calls[0][1].activeEffects[0].remaining).toBe(1);
    expect(updateCena.mock.calls[0][0].encounter.turnIndex).toBe(1);
  });
});

describe('CenaTab — painel do mestre', () => {
  afterEach(() => vi.restoreAllMocks());

  const combatCena = (over: Partial<ReturnType<typeof createDefaultCena>> = {}) => ({
    ...createDefaultCena(),
    encounter: { ...createDefaultEncounter(), isActive: true, round: 2, turnIndex: 0, order: [
      { refId: 'p1', side: 'party' as const, initiative: 20 },
      { refId: 'p2', side: 'party' as const, initiative: 10 },
    ] },
    ...over,
  });

  it('pausado desabilita os botões de turno no roster', () => {
    render(<CenaTab {...props(combatCena({ encounter: { ...combatCena().encounter, isPaused: true } }), [cast('p1', 'Shinkai'), cast('p2', 'Mikhail')])} />);
    expect((screen.getByRole('button', { name: /próximo turno/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /turno anterior/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('o botão do dashboard do mestre abre uma janela externa e fecha ao clicar de novo', () => {
    const fakeWindow = { closed: false, close: vi.fn() } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWindow);
    render(<CenaTab {...props(combatCena(), [cast('p1', 'Shinkai'), cast('p2', 'Mikhail')])} />);
    fireEvent.click(screen.getByRole('button', { name: /abrir dashboard do mestre/i }));
    expect(openSpy).toHaveBeenCalledWith('?view=gm-dashboard', 'vat-gm-dashboard', expect.stringContaining('popup'));
    fireEvent.click(screen.getByRole('button', { name: /fechar dashboard do mestre/i }));
    expect(fakeWindow.close).toHaveBeenCalled();
  });
});

describe('CenaTab — formas ativáveis', () => {
  const ignea = createArsenalCard({
    id: 'ignea', name: 'Forma Ígnea', category: 'habilidade', abilityType: 'forma',
    auraConsumed: { flat: 4, dice: null },
    form: { grantedAbilityIds: [], removedAbilityIds: [], hpBonus: 5, auraBonus: 2, color: '#a855f7', iconOverride: 'lua.png', durationRounds: 3 },
  });
  const combatCena = () => ({
    ...createDefaultCena(),
    encounter: { ...createDefaultEncounter(), isActive: true, round: 1, turnIndex: 0, order: [
      { refId: 'p1', side: 'party' as const, initiative: 20 },
      { refId: 'p2', side: 'party' as const, initiative: 10 },
    ] },
  });

  it('acende o anel de chamas só no turno do ator com forma disponível', () => {
    const p1 = cast('p1', 'Shinkai', { arsenal: [createHolding(ignea)] });
    const p2 = cast('p2', 'Mikhail');
    const { container } = render(<CenaTab {...props(combatCena(), [p1, p2], { arsenal: [ignea] })} />);
    const rings = container.querySelectorAll('.cena-combatant__forma-ring.is-available');
    expect(rings).toHaveLength(1);
  });

  it('abre o popover, ativa a forma pelo pipeline e aplica bônus de PV/Aura', () => {
    const p1 = cast('p1', 'Shinkai', { arsenal: [createHolding(ignea)] });
    const p2 = cast('p2', 'Mikhail');
    const updateCharacterStats = vi.fn();
    const updateCena = vi.fn();
    const { container } = render(<CenaTab {...props(combatCena(), [p1, p2], { arsenal: [ignea], updateCharacterStats, updateCena })} />);
    fireEvent.click(container.querySelector('.cena-combatant__forma-ring.is-available')!);
    expect(screen.getByText('Forma Ígnea')).toBeTruthy();
    fireEvent.click(screen.getByText('Forma Ígnea'));
    expect(updateCharacterStats).toHaveBeenCalledWith('p1', expect.objectContaining({
      maxHp: 25, currentHp: 25, maxAura: 12, currentAura: 8,
    }));
    const holdings = updateCharacterStats.mock.calls[0][1].arsenal;
    expect(holdings.find((h: any) => h.cardId === 'ignea').active).toBe(true);
    const savedForma = updateCena.mock.calls[0][0].encounter.activeFormas[0];
    expect(savedForma).toMatchObject({ ownerId: 'p1', entryId: 'ignea', roundsRemaining: 3, hpBonusApplied: 5, auraBonusApplied: 2 });
    expect(updateCena.mock.calls[0][0].log.some((entry: any) => /assume a forma Forma Ígnea/i.test(entry.text))).toBe(true);
  });

  it('bloqueia a ativação quando falta Aura e não altera o personagem', () => {
    const caro = createArsenalCard({
      id: 'caro', name: 'Forma Cara', category: 'habilidade', abilityType: 'forma',
      auraConsumed: { flat: 99, dice: null },
      form: { grantedAbilityIds: [], removedAbilityIds: [], hpBonus: 0, auraBonus: 0 },
    });
    const p1 = cast('p1', 'Shinkai', { arsenal: [createHolding(caro)] });
    const p2 = cast('p2', 'Mikhail');
    const { container } = render(<CenaTab {...props(combatCena(), [p1, p2], { arsenal: [caro] })} />);
    expect(container.querySelectorAll('.cena-combatant__forma-ring.is-available')).toHaveLength(0);
  });

  it('mostra o anel ativo com a cor da forma e permite reverter', () => {
    const cena = { ...combatCena(), encounter: { ...combatCena().encounter, activeFormas: [
      { ownerId: 'p1', entryId: 'ignea', roundsRemaining: 2, hpBonusApplied: 5, auraBonusApplied: 2 },
    ] } };
    const p1 = cast('p1', 'Shinkai', { maxHp: 25, currentHp: 25, maxAura: 12, currentAura: 8, arsenal: [{ ...createHolding(ignea), active: true }] });
    const p2 = cast('p2', 'Mikhail');
    const updateCharacterStats = vi.fn();
    const updateCena = vi.fn();
    const { container } = render(<CenaTab {...props(cena, [p1, p2], { arsenal: [ignea], updateCharacterStats, updateCena })} />);
    const activeRing = container.querySelector('.cena-combatant__forma-ring.is-active') as HTMLElement;
    expect(activeRing).toBeTruthy();
    expect(activeRing.style.getPropertyValue('--forma-color')).toBe('#a855f7');
    fireEvent.click(activeRing);
    fireEvent.click(screen.getByRole('button', { name: /reverter forma/i }));
    expect(updateCharacterStats).toHaveBeenCalledWith('p1', expect.objectContaining({ maxHp: 20, maxAura: 10 }));
    expect(updateCena.mock.calls[0][0].encounter.activeFormas).toHaveLength(0);
  });
});

describe('CenaTab — efeitos passivos de forma e arma', () => {
  const combatCena = () => ({
    ...createDefaultCena(),
    encounter: { ...createDefaultEncounter(), isActive: true, round: 1, turnIndex: 0, order: [
      { refId: 'p1', side: 'party' as const, initiative: 20 },
      { refId: 'p2', side: 'party' as const, initiative: 10 },
    ] },
  });

  it('ativar uma forma concede seus efeitos passivos e reverter os remove', () => {
    const fury = { ...getPredefinedEffect('Frágil')!, id: 'fury', name: 'Fúria da Forma' };
    const ignea = createArsenalCard({
      id: 'ignea', name: 'Forma Ígnea', category: 'habilidade', abilityType: 'forma',
      form: { grantedAbilityIds: [], removedAbilityIds: [], hpBonus: 0, auraBonus: 0, effects: [fury] },
    });
    const p1 = cast('p1', 'Shinkai', { arsenal: [createHolding(ignea)] });
    const p2 = cast('p2', 'Mikhail');
    const updateCharacterStats = vi.fn();
    const { container } = render(<CenaTab {...props(combatCena(), [p1, p2], { arsenal: [ignea], updateCharacterStats })} />);
    fireEvent.click(container.querySelector('.cena-combatant__forma-ring.is-available')!);
    fireEvent.click(screen.getByText('Forma Ígnea'));
    const afterActivate = updateCharacterStats.mock.calls[0][1].activeEffects;
    expect(afterActivate.find((active: any) => active.effect.id === 'fury').effect.duration.type).toBe('enquanto_forma_ativa');

    updateCharacterStats.mockClear();
    const activated = { ...p1, ...updateCharacterStats.mock.calls[0]?.[1], activeEffects: afterActivate, arsenal: [{ ...createHolding(ignea), active: true }] };
    const cenaWithForma = { ...combatCena(), encounter: { ...combatCena().encounter, activeFormas: [{ ownerId: 'p1', entryId: 'ignea', roundsRemaining: 0, hpBonusApplied: 0, auraBonusApplied: 0 }] } };
    const { container: container2 } = render(<CenaTab {...props(cenaWithForma, [activated, p2], { arsenal: [ignea], updateCharacterStats })} />);
    fireEvent.click(container2.querySelector('.cena-combatant__forma-ring.is-active')!);
    fireEvent.click(screen.getByRole('button', { name: /reverter forma/i }));
    const afterRevert = updateCharacterStats.mock.calls.at(-1)?.[1].activeEffects;
    expect(afterRevert.some((active: any) => active.effect.id === 'fury')).toBe(false);
  });

  it('equipar uma arma concede seus efeitos passivos e trocar de arma os remove', () => {
    const sharp = { ...getPredefinedEffect('Frágil')!, id: 'sharp', name: 'Fio da Lâmina' };
    const sword = createArsenalCard({ id: 'sword', name: 'Espada', category: 'arma', weapon: { freelyEquippable: true, grantedAbilityIds: [], effects: [sharp] } });
    const dagger = createArsenalCard({ id: 'dagger', name: 'Adaga', category: 'arma', weapon: { freelyEquippable: true, grantedAbilityIds: [] } });
    const p1 = cast('p1', 'Shinkai', { arsenal: [createHolding(sword), createHolding(dagger)] });
    const updateCharacterStats = vi.fn();
    render(<CenaTab {...props(combatCena(), [p1, cast('p2', 'Mikhail')], { arsenal: [sword, dagger], updateCharacterStats })} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'sword' } });
    const afterEquip = updateCharacterStats.mock.calls.at(-1)?.[1].activeEffects;
    expect(afterEquip.find((active: any) => active.effect.id === 'sharp').effect.duration.type).toBe('enquanto_equipado');

    updateCharacterStats.mockClear();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dagger' } });
    const afterSwitch = updateCharacterStats.mock.calls.at(-1)?.[1].activeEffects;
    expect(afterSwitch.some((active: any) => active.effect.id === 'sharp')).toBe(false);
  });
});

describe('CenaTab — habilidades do novo sistema de grafo', () => {
  const combatCena = () => ({
    ...createDefaultCena(),
    encounter: { ...createDefaultEncounter(), isActive: true, round: 1, turnIndex: 0, order: [
      { refId: 'p1', side: 'party' as const, initiative: 20 },
      { refId: 'p2', side: 'party' as const, initiative: 10 },
    ] },
  });

  it('reação com nó esquiva substitui o 1d20 fixo pelo valor do nó como defenseBonus', async () => {
    const { ensureNodesRegistered } = await import('../utils/nodes');
    const { createAbilityGraph } = await import('../utils/abilityGraph');
    ensureNodesRegistered();
    const attackGraph = {
      ...createAbilityGraph({ id: 'graph-atk2', name: 'Ataque Preciso' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} },
        { id: 'teste', type: 'teste', family: 'ramo' as const, props: { dice: '1d20', comparador: 'defesa_alvo', valorFixo: 0, modificador: 0 } },
        { id: 'd', type: 'dano', family: 'efeito' as const, props: { dice: undefined, flat: 6, element: 'fisico' } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'teste' }, { id: 'e2', from: 'teste', to: 'd', branch: 'entao' as const }],
    };
    // flat=25 é impossível de alcançar pelo 1d20 fixo antigo (máximo 5+20=25 exigiria rolar 20 exato;
    // 25 sozinho já bate isso, então uso um valor ainda maior pra não depender de sorte no roll real).
    const reactionGraph = {
      ...createAbilityGraph({ id: 'graph-esquiva', name: 'Esquiva Ágil' }),
      nodes: [
        { id: 'gt', type: 'ao_ser_alvejado', family: 'gatilho' as const, props: {} },
        { id: 'e', type: 'esquiva', family: 'efeito' as const, props: { dice: undefined, flat: 25 } },
      ],
      edges: [{ id: 'e1', from: 'gt', to: 'e' }],
    };
    const p1 = cast('p1', 'Shinkai', { arsenal: [{ cardId: 'graph-atk2', quantity: 1, equipped: false, active: false }] });
    const p2 = cast('p2', 'Mikhail', { defense: 5, arsenal: [{ cardId: 'graph-esquiva', quantity: 1, equipped: false, active: false }] });
    const onDiceRoll = vi.fn();
    render(<CenaTab {...props(combatCena(), [p1, p2], { abilityGraphs: [attackGraph, reactionGraph], onDiceRoll })} />);
    fireEvent.click(screen.getByText('ATAQUES'));
    fireEvent.click(screen.getByRole('button', { name: /ataque preciso/i }));
    fireEvent.click(screen.getByRole('button', { name: 'USAR CARTA' }));
    selectTarget('Mikhail');
    fireEvent.click(screen.getByRole('button', { name: /esquiva ágil/i }));
    const testRollCall = onDiceRoll.mock.calls.find(call => call[1]?.defenderResult !== undefined);
    expect(testRollCall![1].defenderResult).toBe(30); // 5 (defesa base) + 25 (esquiva), nunca alcançável pelo 1d20 antigo
  });

  it('efeito continuo aplicado por grafo reage ao alvo ser alvejado e soma esquiva', async () => {
    const { ensureNodesRegistered } = await import('../utils/nodes');
    const { createAbilityGraph } = await import('../utils/abilityGraph');
    ensureNodesRegistered();
    const buffGraph = {
      ...createAbilityGraph({ id: 'graph-evasion-buff', name: 'Passos Entre Linhas' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} },
        { id: 'apply', type: 'aplicar_como_efeito', family: 'efeito' as const, props: { alvo: 'proprio', rounds: 3 } },
        { id: 'targeted', type: 'ao_ser_alvejado', family: 'gatilho' as const, props: {} },
        { id: 'evasion', type: 'esquiva', family: 'efeito' as const, props: { dice: undefined, flat: 25 } },
      ],
      edges: [
        { id: 'e1', from: 'g', to: 'apply' },
        { id: 'e2', from: 'apply', to: 'targeted' },
        { id: 'e3', from: 'targeted', to: 'evasion' },
      ],
    };
    const attackGraph = {
      ...createAbilityGraph({ id: 'graph-atk-ongoing', name: 'Disparo Marcado' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} },
        { id: 'teste', type: 'teste', family: 'ramo' as const, props: { dice: '1d20', comparador: 'defesa_alvo', valorFixo: 0, modificador: 0 } },
        { id: 'd', type: 'dano', family: 'efeito' as const, props: { dice: undefined, flat: 6, element: 'fisico' } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'teste' }, { id: 'e2', from: 'teste', to: 'd', branch: 'entao' as const }],
    };
    const p1 = cast('p1', 'Shinkai', { arsenal: [{ cardId: 'graph-atk-ongoing', quantity: 1, equipped: false, active: false }] });
    const p2 = cast('p2', 'Mikhail', { defense: 5 });
    const baseCena = combatCena();
    const cena = {
      ...baseCena,
      encounter: {
        ...baseCena.encounter,
        activeOngoingEffects: [{
          id: 'ongoing-evasion', ownerId: 'p2', casterId: 'p2', graphId: 'graph-evasion-buff', roundsRemaining: 3,
          pendingReactions: [{ eventType: 'ao_ser_alvejado', nodeIds: ['evasion'] }],
        }],
      },
    };
    const onDiceRoll = vi.fn();
    render(<CenaTab {...props(cena, [p1, p2], { abilityGraphs: [attackGraph, buffGraph], onDiceRoll })} />);
    fireEvent.click(screen.getByText('ATAQUES'));
    fireEvent.click(screen.getByRole('button', { name: /disparo marcado/i }));
    fireEvent.click(screen.getByRole('button', { name: 'USAR CARTA' }));
    selectTarget('Mikhail');
    const testRollCall = onDiceRoll.mock.calls.find(call => call[1]?.defenderResult !== undefined);
    expect(testRollCall![1].defenderResult).toBe(30);
  });

  it('efeito continuo de esquiva acumula com esquiva usada como reacao manual', async () => {
    const { ensureNodesRegistered } = await import('../utils/nodes');
    const { createAbilityGraph } = await import('../utils/abilityGraph');
    ensureNodesRegistered();
    const passiveGraph = {
      ...createAbilityGraph({ id: 'graph-passive-evasion', name: 'Postura Fluida' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} },
        { id: 'apply', type: 'aplicar_como_efeito', family: 'efeito' as const, props: { alvo: 'proprio', rounds: 3 } },
        { id: 'targeted', type: 'ao_ser_alvejado', family: 'gatilho' as const, props: {} },
        { id: 'passive', type: 'esquiva', family: 'efeito' as const, props: { dice: undefined, flat: 2 } },
      ],
      edges: [
        { id: 'e1', from: 'g', to: 'apply' },
        { id: 'e2', from: 'apply', to: 'targeted' },
        { id: 'e3', from: 'targeted', to: 'passive' },
      ],
    };
    const manualGraph = {
      ...createAbilityGraph({ id: 'graph-manual-evasion', name: 'Esquiva Rápida' }),
      nodes: [
        { id: 'gt', type: 'ao_ser_alvejado', family: 'gatilho' as const, props: {} },
        { id: 'manual', type: 'esquiva', family: 'efeito' as const, props: { dice: undefined, flat: 4 } },
      ],
      edges: [{ id: 'e1', from: 'gt', to: 'manual' }],
    };
    const attackGraph = {
      ...createAbilityGraph({ id: 'graph-atk-stacking', name: 'Ataque de Teste' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} },
        { id: 'teste', type: 'teste', family: 'ramo' as const, props: { dice: '1d20', comparador: 'defesa_alvo', valorFixo: 0, modificador: 0 } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'teste' }],
    };
    const p1 = cast('p1', 'Shinkai', { arsenal: [{ cardId: 'graph-atk-stacking', quantity: 1, equipped: false, active: false }] });
    const p2 = cast('p2', 'Mikhail', { defense: 2, arsenal: [{ cardId: 'graph-manual-evasion', quantity: 1, equipped: false, active: false }] });
    const baseCena = combatCena();
    const cena = {
      ...baseCena,
      encounter: {
        ...baseCena.encounter,
        activeOngoingEffects: [{
          id: 'ongoing-passive-evasion', ownerId: 'p2', casterId: 'p2', graphId: 'graph-passive-evasion', roundsRemaining: 3,
          pendingReactions: [{ eventType: 'ao_ser_alvejado', nodeIds: ['passive'] }],
        }],
      },
    };
    const onDiceRoll = vi.fn();
    render(<CenaTab {...props(cena, [p1, p2], { abilityGraphs: [attackGraph, passiveGraph, manualGraph], onDiceRoll })} />);
    fireEvent.click(screen.getByText('HABILIDADES'));
    fireEvent.click(screen.getByRole('button', { name: /ataque de teste/i }));
    fireEvent.click(screen.getByRole('button', { name: 'USAR CARTA' }));
    selectTarget('Mikhail');
    fireEvent.click(screen.getByRole('button', { name: /esquiva rápida/i }));
    const testRollCall = onDiceRoll.mock.calls.find(call => call[1]?.defenderResult !== undefined);
    expect(testRollCall![1].defenderResult).toBe(8);
  });

  it('usar uma habilidade-grafo em outro alvo aplica dano, gera log e ativa o cooldown', async () => {
    const { ensureNodesRegistered } = await import('../utils/nodes');
    const { createAbilityGraph } = await import('../utils/abilityGraph');
    ensureNodesRegistered();
    const graph = {
      ...createAbilityGraph({ id: 'graph-atk', name: 'Golpe do Grafo' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} },
        { id: 'd', type: 'dano', family: 'efeito' as const, props: { dice: undefined, flat: 6, element: 'fisico' } },
        { id: 'cd', type: 'cooldown', family: 'efeito' as const, props: { tipo: 'rodadas', amount: 2 } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'd' }, { id: 'e2', from: 'g', to: 'cd' }],
    };
    const p1 = cast('p1', 'Shinkai', { arsenal: [{ cardId: 'graph-atk', quantity: 1, equipped: false, active: false }] });
    const p2 = cast('p2', 'Mikhail', { currentHp: 20 });
    const updateCharacterStats = vi.fn();
    render(<CenaTab {...props(combatCena(), [p1, p2], { abilityGraphs: [graph], updateCharacterStats })} />);
    fireEvent.click(screen.getByText('ATAQUES'));
    fireEvent.click(screen.getByRole('button', { name: /golpe do grafo/i }));
    fireEvent.click(screen.getByRole('button', { name: 'USAR CARTA' }));
    selectTarget('Mikhail');
    expect(updateCharacterStats).toHaveBeenCalledWith('p2', expect.objectContaining({ currentHp: 16, defenseCurrent: 14 }));
    const actorUpdate = updateCharacterStats.mock.calls.find(call => call[0] === 'p1')?.[1];
    expect(actorUpdate.arsenal.find((h: any) => h.cardId === 'graph-atk').cooldownRemaining).toBe(2);
  });

  it('habilidade-grafo com nó alvo "raio" atinge quem está no raio ao redor do ator, sem precisar clicar em ninguém', async () => {
    const { ensureNodesRegistered } = await import('../utils/nodes');
    const { createAbilityGraph } = await import('../utils/abilityGraph');
    ensureNodesRegistered();
    const graph = {
      ...createAbilityGraph({ id: 'graph-raio', name: 'Explosão' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} },
        { id: 'a', type: 'alvo', family: 'alvo' as const, props: { scope: 'raio', radius: 1 } },
        { id: 'd', type: 'dano', family: 'efeito' as const, props: { dice: undefined, flat: 5, element: 'fisico' } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'a' }, { id: 'e2', from: 'a', to: 'd' }],
    };
    const p1 = cast('p1', 'Shinkai', { arsenal: [{ cardId: 'graph-raio', quantity: 1, equipped: false, active: false }] });
    const p2 = cast('p2', 'Mikhail', { currentHp: 20 });
    const p3 = cast('p3', 'Longe', { currentHp: 20 });
    const updateCharacterStats = vi.fn();
    const cenaComTokens = { ...combatCena(), tokens: { p1: { x: 50, y: 50 }, p2: { x: 55, y: 50 }, p3: { x: 90, y: 50 } } };
    render(<CenaTab {...props(cenaComTokens, [p1, p2, p3], { abilityGraphs: [graph], updateCharacterStats })} />);
    fireEvent.click(screen.getByText('ATAQUES'));
    fireEvent.click(screen.getByRole('button', { name: /explosão/i }));
    fireEvent.click(screen.getByRole('button', { name: 'USAR CARTA' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirmar' }));
    expect(updateCharacterStats).toHaveBeenCalledWith('p2', expect.objectContaining({ currentHp: 16, defenseCurrent: 15 }));
    expect(updateCharacterStats).not.toHaveBeenCalledWith('p3', expect.anything());
    const p1Update = updateCharacterStats.mock.calls.find(call => call[0] === 'p1')?.[1];
    expect(p1Update.currentHp).toBe(20); // ator não é afetado pelo próprio raio (só quem está em areaTargets)
  });

  it('habilidade-grafo com nó alvo "raio" ainda atinge personagens sem posição gravada em cena.tokens (usa o mesmo fallback visual do MapBoard)', async () => {
    const { ensureNodesRegistered } = await import('../utils/nodes');
    const { createAbilityGraph } = await import('../utils/abilityGraph');
    ensureNodesRegistered();
    const graph = {
      ...createAbilityGraph({ id: 'graph-raio2', name: 'Onda de Choque' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} },
        { id: 'a', type: 'alvo', family: 'alvo' as const, props: { scope: 'raio', radius: 2 } },
        { id: 'd', type: 'dano', family: 'efeito' as const, props: { dice: undefined, flat: 5, element: 'fisico' } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'a' }, { id: 'e2', from: 'a', to: 'd' }],
    };
    const p1 = cast('p1', 'Shinkai', { arsenal: [{ cardId: 'graph-raio2', quantity: 1, equipped: false, active: false }] });
    const p2 = cast('p2', 'Mikhail', { currentHp: 20 });
    const p3 = cast('p3', 'Longe', { currentHp: 20 });
    const updateCharacterStats = vi.fn();
    // Nenhum personagem tem posição em cena.tokens — nunca foram arrastados no mapa.
    render(<CenaTab {...props(combatCena(), [p1, p2, p3], { abilityGraphs: [graph], updateCharacterStats })} />);
    fireEvent.click(screen.getByText('ATAQUES'));
    fireEvent.click(screen.getByRole('button', { name: /onda de choque/i }));
    fireEvent.click(screen.getByRole('button', { name: 'USAR CARTA' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirmar' }));
    expect(updateCharacterStats).toHaveBeenCalledWith('p2', expect.objectContaining({ currentHp: expect.any(Number) }));
    const p2Update = updateCharacterStats.mock.calls.find(call => call[0] === 'p2')?.[1];
    expect(p2Update.currentHp).toBeLessThan(20);
  });

  it('usar uma habilidade-grafo com nó mover (empurrar) desloca o token do alvo em cena.tokens', async () => {
    const { ensureNodesRegistered } = await import('../utils/nodes');
    const { createAbilityGraph } = await import('../utils/abilityGraph');
    ensureNodesRegistered();
    const graph = {
      ...createAbilityGraph({ id: 'graph-push', name: 'Rajada' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} },
        { id: 'm', type: 'mover', family: 'efeito' as const, props: { kind: 'empurrar', distance: 1 } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'm' }],
    };
    const p1 = cast('p1', 'Shinkai', { arsenal: [{ cardId: 'graph-push', quantity: 1, equipped: false, active: false }] });
    const p2 = cast('p2', 'Mikhail', { currentHp: 20 });
    const updateCena = vi.fn();
    const cenaComTokens = { ...combatCena(), tokens: { p1: { x: 50, y: 50 }, p2: { x: 60, y: 50 } } };
    render(<CenaTab {...props(cenaComTokens, [p1, p2], { abilityGraphs: [graph], updateCena })} />);
    fireEvent.click(screen.getByText('HABILIDADES'));
    fireEvent.click(screen.getByRole('button', { name: /rajada/i }));
    fireEvent.click(screen.getByRole('button', { name: 'USAR CARTA' }));
    selectTarget('Mikhail');
    const finalState = updateCena.mock.calls.at(-1)?.[0];
    expect(finalState.tokens.p2.x).toBeGreaterThan(60);
  });

  it('habilidade-grafo com preparação entra em espera e só resolve na segunda seleção', async () => {
    const { ensureNodesRegistered } = await import('../utils/nodes');
    const { createAbilityGraph } = await import('../utils/abilityGraph');
    ensureNodesRegistered();
    const graph = {
      ...createAbilityGraph({ id: 'graph-prep', name: 'Golpe Carregado' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} },
        { id: 'd', type: 'dano', family: 'efeito' as const, props: { dice: undefined, flat: 6, element: 'fisico' } },
        { id: 'prep', type: 'preparacao', family: 'efeito' as const, props: { tipo: 'rodadas', amount: 1 } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'd' }, { id: 'e2', from: 'g', to: 'prep' }],
    };
    const p1 = cast('p1', 'Shinkai', { arsenal: [{ cardId: 'graph-prep', quantity: 1, equipped: false, active: false }] });
    const p2 = cast('p2', 'Mikhail', { currentHp: 20 });
    const updateCena = vi.fn();
    render(<CenaTab {...props(combatCena(), [p1, p2], { abilityGraphs: [graph], updateCena })} />);
    fireEvent.click(screen.getByText('ATAQUES'));
    fireEvent.click(screen.getByRole('button', { name: /golpe carregado/i }));
    fireEvent.click(screen.getByRole('button', { name: 'USAR CARTA' }));
    selectTarget('Mikhail');
    const preparedState = updateCena.mock.calls.at(-1)?.[0];
    expect(preparedState.encounter.preparations).toContainEqual(expect.objectContaining({ ownerId: 'p1', entryId: 'graph-prep', targetIds: ['p2'] }));
  });

  it('combo de habilidades-grafo aplica o dano do grafo base e da companheira selecionada', async () => {
    const { ensureNodesRegistered } = await import('../utils/nodes');
    const { createAbilityGraph } = await import('../utils/abilityGraph');
    ensureNodesRegistered();
    const danoNode = (flat: number) => ({ id: 'd', type: 'dano', family: 'efeito' as const, props: { dice: undefined, flat, element: 'fisico' } });
    const comboNode = (id: string) => ({ id, type: 'em_combo', family: 'gatilho' as const, props: { stackKey: 'fogo', maxStacks: 2 } });
    const base = {
      ...createAbilityGraph({ id: 'combo-base', name: 'Golpe Fogo' }),
      nodes: [{ id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} }, danoNode(6), comboNode('combo-root-base')],
      edges: [{ id: 'e1', from: 'g', to: 'd' }],
    };
    const companion = {
      ...createAbilityGraph({ id: 'combo-b', name: 'Golpe Brasa' }),
      nodes: [{ id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} }, danoNode(4), comboNode('combo-root-b')],
      edges: [{ id: 'e1', from: 'g', to: 'd' }],
    };
    const p1 = cast('p1', 'Shinkai', { arsenal: [
      { cardId: 'combo-base', quantity: 1, equipped: false, active: false },
      { cardId: 'combo-b', quantity: 1, equipped: false, active: false },
    ] });
    const p2 = cast('p2', 'Mikhail', { currentHp: 20 });
    const updateCena = vi.fn();
    render(<CenaTab {...props(combatCena(), [p1, p2], { abilityGraphs: [base, companion], updateCena })} />);
    fireEvent.click(screen.getByText('ATAQUES'));
    fireEvent.click(screen.getByRole('button', { name: /golpe fogo/i }));
    fireEvent.click(screen.getByRole('button', { name: 'USAR CARTA' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText(/Fazer a jogada/));
    selectTarget('Mikhail');
    const finalState = updateCena.mock.calls.at(-1)?.[0];
    expect(finalState.log.some((entry: any) => /Mikhail sofre 7 de dano/.test(entry.text))).toBe(true);
  });

  it('acende o anel de forma disponível para habilidade-grafo com bloco de cor', async () => {
    const { ensureNodesRegistered } = await import('../utils/nodes');
    const { createAbilityGraph } = await import('../utils/abilityGraph');
    ensureNodesRegistered();
    const formaGraph = {
      ...createAbilityGraph({ id: 'graph-forma', name: 'Forma Estelar' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} },
        { id: 'cor', type: 'cor_token', family: 'efeito' as const, props: { color: '#38bdf8' } },
        { id: 'custo', type: 'custo', family: 'efeito' as const, props: { recurso: 'aura', amount: 4 } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'cor' }, { id: 'e2', from: 'g', to: 'custo' }],
    };
    const p1 = cast('p1', 'Shinkai', { arsenal: [{ cardId: 'graph-forma', quantity: 1, equipped: false, active: false }] });
    const p2 = cast('p2', 'Mikhail');
    const { container } = render(<CenaTab {...props(combatCena(), [p1, p2], { abilityGraphs: [formaGraph] })} />);
    expect(container.querySelectorAll('.cena-combatant__forma-ring.is-available')).toHaveLength(1);
  });

  it('não acende o anel quando falta aura para a forma-grafo', async () => {
    const { ensureNodesRegistered } = await import('../utils/nodes');
    const { createAbilityGraph } = await import('../utils/abilityGraph');
    ensureNodesRegistered();
    const formaGraph = {
      ...createAbilityGraph({ id: 'graph-forma-cara', name: 'Forma Cara' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} },
        { id: 'cor', type: 'cor_token', family: 'efeito' as const, props: { color: '#38bdf8' } },
        { id: 'custo', type: 'custo', family: 'efeito' as const, props: { recurso: 'aura', amount: 99 } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'cor' }, { id: 'e2', from: 'g', to: 'custo' }],
    };
    const p1 = cast('p1', 'Shinkai', { arsenal: [{ cardId: 'graph-forma-cara', quantity: 1, equipped: false, active: false }] });
    const p2 = cast('p2', 'Mikhail');
    const { container } = render(<CenaTab {...props(combatCena(), [p1, p2], { abilityGraphs: [formaGraph] })} />);
    expect(container.querySelectorAll('.cena-combatant__forma-ring.is-available')).toHaveLength(0);
  });

  it('mostra o anel ativo com a cor da forma-grafo quando já ativa', async () => {
    const { ensureNodesRegistered } = await import('../utils/nodes');
    const { createAbilityGraph } = await import('../utils/abilityGraph');
    ensureNodesRegistered();
    const formaGraph = {
      ...createAbilityGraph({ id: 'graph-forma-ativa', name: 'Forma Ativa' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} },
        { id: 'cor', type: 'cor_token', family: 'efeito' as const, props: { color: '#22c55e' } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'cor' }],
    };
    const cena = { ...combatCena(), encounter: { ...combatCena().encounter, activeFormas: [
      { ownerId: 'p1', entryId: 'graph-forma-ativa', roundsRemaining: 2, hpBonusApplied: 0, auraBonusApplied: 0 },
    ] } };
    const p1 = cast('p1', 'Shinkai', { arsenal: [{ cardId: 'graph-forma-ativa', quantity: 1, equipped: false, active: true }] });
    const p2 = cast('p2', 'Mikhail');
    const { container } = render(<CenaTab {...props(cena, [p1, p2], { abilityGraphs: [formaGraph] })} />);
    const activeRing = container.querySelector('.cena-combatant__forma-ring.is-active') as HTMLElement;
    expect(activeRing).toBeTruthy();
    expect(activeRing.style.getPropertyValue('--forma-color')).toBe('#22c55e');
  });
});
