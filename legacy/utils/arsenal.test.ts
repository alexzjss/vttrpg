import { describe, expect, it } from 'vitest';
import type { Card, Item, Seal, Weapon } from '../types';
import { arsenalCardAtLevel, createArsenalCard, type ArsenalEffect } from './arsenal';
import { getPredefinedEffect, PREDEFINED_ARSENAL_EFFECTS } from './arsenalEffects';
import { cardToArsenal, itemToArsenal, migrateCharacterArsenalHoldings, migrateLegacyArsenal, sealToArsenal } from './arsenalMigration';
import { ACTION_PIPELINE_STEPS, activeOrderAdjustment, applyActiveEffect, cleanseByTag, consumePrincipalBlock, getActiveEffects, hasCondition, removeActiveEffect, resolveArsenalAction, sortReactions, tickActiveEffects, type ArsenalActorState } from './arsenalPipeline';
import { activateForm, assignCardToHoldings, availableCardIds, comboStackCandidates, createHolding, equipWeapon, resolveComboCards } from './arsenalState';

const actor = (overrides: Partial<ArsenalActorState> = {}): ArsenalActorState => ({
  id: 'actor', teamId: 'a', name: 'Ator', currentHp: 20, maxHp: 20,
  currentAura: 10, maxAura: 10, currentAmmo: 0, maxAmmo: 0, defense: 10, speed: 3, tags: ['mágico'],
  equippedWeaponIds: [], activeFormIds: [], effects: [], holdings: [],
  isCurrentTurn: true, inCombat: true, ...overrides,
});

describe('modelo do arsenal', () => {
  it('cria uma carta completa com defaults seguros', () => {
    const card = createArsenalCard({ id: 'x', name: 'X', category: 'habilidade' });
    expect(card.schemaVersion).toBe(1);
    expect(card.preparation.timing.type).toBe('instantaneo');
    expect(card.cooldown.type).toBe('sem_cooldown');
    expect(card.effects).toEqual([]);
    expect(card.weaponLinks).toEqual([]);
  });

  it('oferece as quinze condições base e os presets de poderes avançados', () => {
    expect(PREDEFINED_ARSENAL_EFFECTS).toHaveLength(30);
    expect(PREDEFINED_ARSENAL_EFFECTS.slice(0, 15).map(effect => effect.name)).toEqual([
      'Vulnerável','Exposto','Marcado','Sangrando','Queimando','Congelado','Eletrizado','Molhado',
      'Enraizado','Frágil','Silenciado','Atordoado','Derrubado','Cego','Amedrontado',
    ]);
    expect(PREDEFINED_ARSENAL_EFFECTS.slice(15).map(effect => effect.name)).toEqual([
      'Provocado','Camuflado','Arremesso',
      'Escudo Menor','Escudo Maior','Purificação',
      'Ímpeto','Fluxo Ampliado','Recarga Tática','Bênção Econômica',
      'Elo Espectral','Metamorfose','Fio da Vida','Corrente Ressonante','Sorte Selvagem',
    ]);
  });
});

describe('efeitos ativos por turno', () => {
  it('reconhece nomes alternativos de condições periódicas', () => {
    expect(getPredefinedEffect('queimadura')?.name).toBe('Queimando');
    expect(getPredefinedEffect('sangramento')?.name).toBe('Sangrando');
  });
  it('aplica dano periódico, respeita stacks e expira na duração correta', () => {
    const burn = PREDEFINED_ARSENAL_EFFECTS.find(effect => effect.name === 'Queimando')!;
    const first = tickActiveEffects([{ effect: burn, stacks: 2, remaining: 2 }], { currentHp: 10, maxHp: 20, currentAura: 5, maxAura: 10 });
    expect(first.currentHp).toBe(6);
    expect(first.hpDelta).toBe(-4);
    expect(first.effects[0].remaining).toBe(1);
    const second = tickActiveEffects(first.effects, { currentHp: first.currentHp, maxHp: 20, currentAura: 5, maxAura: 10 });
    expect(second.currentHp).toBe(2);
    expect(second.effects).toEqual([]);
    expect(second.expiredNames).toEqual(['Queimando']);
  });

  it('aplica cura periódica sem ultrapassar o máximo', () => {
    const custom = { ...PREDEFINED_ARSENAL_EFFECTS[0], id:'custom-heal', name:'Regeneração customizada', periodicDamage:null, periodicHealing:{flat:5} };
    const tick = tickActiveEffects([{ effect: custom, stacks: 1, remaining: 1 }], { currentHp: 18, maxHp: 20, currentAura: 5, maxAura: 10 });
    expect(tick.currentHp).toBe(20);
    expect(tick.hpDelta).toBe(2);
    expect(tick.events[0]).toMatchObject({ kind:'heal', amount:2 });
  });

  it('calcula dano periódico percentual via dado configurado', () => {
    const bleeding={...getPredefinedEffect('Sangrando')!,periodicDamage:{flat:10,dice:null}};
    const tick=tickActiveEffects([{effect:bleeding,stacks:1,remaining:2}],{currentHp:80,maxHp:100,currentAura:0,maxAura:0});
    expect(tick.currentHp).toBe(70);
  });

  it('resistência elemental reduz o dano periódico próprio', () => {
    const resistant={...getPredefinedEffect('Queimando')!,elementalAffinities:[{element:'fogo' as const,kind:'resistencia' as const,percent:50}]};
    const tick=tickActiveEffects([{effect:resistant,stacks:1,remaining:2}],{currentHp:20,maxHp:20,currentAura:0,maxAura:0});
    expect(tick.currentHp).toBe(19);
  });

  it('um buff de dano (valueModifiers) aumenta o dano periódico próprio', () => {
    const burn = { ...getPredefinedEffect('Queimando')!, periodicDamage: { flat: 2, dice: null } };
    const vulnerable = { ...burn, id: 'debuff-vulneravel', name: 'Vulnerável a fogo', periodicDamage: null,
      valueModifiers: [{ operation: 'somar' as const, target: 'dano' as const, value: 3, filter: { elements: ['fogo' as const] } }] };
    const tick = tickActiveEffects([{ effect: burn, stacks: 1, remaining: 2 }, { effect: vulnerable, stacks: 1, remaining: 2 }], { currentHp: 20, maxHp: 20, currentAura: 0, maxAura: 0 });
    // 2 (base) + 3 (Vulnerável a fogo) = 5
    expect(tick.currentHp).toBe(15);
  });

  it('um buff de cura (valueModifiers) aumenta a cura periódica recebida', () => {
    const regen = { ...getPredefinedEffect('Queimando')!, id: 'regen', name: 'Regeneração', periodicDamage: null, periodicHealing: { flat: 3, dice: null } };
    const blessed = { ...regen, id: 'buff-cura', name: 'Bênção', periodicHealing: null,
      valueModifiers: [{ operation: 'multiplicar' as const, target: 'cura' as const, value: 2, filter: { resource: 'vida' as const } }] };
    const tick = tickActiveEffects([{ effect: regen, stacks: 1, remaining: 2 }, { effect: blessed, stacks: 1, remaining: 2 }], { currentHp: 10, maxHp: 20, currentAura: 0, maxAura: 0 });
    expect(tick.currentHp).toBe(16); // (3) * 2 = 6
  });

  it('um buff de recuperação de aura (valueModifiers) aumenta o regen de aura periódico', () => {
    const auraRegen = { ...getPredefinedEffect('Queimando')!, id: 'aura-regen', name: 'Fluxo', periodicDamage: null, auraRestored: { flat: 2, dice: null } };
    const focused = { ...auraRegen, id: 'buff-aura', name: 'Foco', auraRestored: null,
      valueModifiers: [{ operation: 'somar' as const, target: 'recuperacao_aura' as const, value: 4 }] };
    const tick = tickActiveEffects([{ effect: auraRegen, stacks: 1, remaining: 2 }, { effect: focused, stacks: 1, remaining: 2 }], { currentHp: 20, maxHp: 20, currentAura: 0, maxAura: 20 });
    expect(tick.currentAura).toBe(6); // 2 + 4
  });

  it('Eletrizado soma dano extra ao próximo ataque de raio e se consome', () => {
    const shocked={...getPredefinedEffect('Eletrizado')!};
    const target=actor({id:'t',teamId:'b',currentHp:20,effects:applyActiveEffect([],shocked)});
    const lightning=createArsenalCard({id:'zap',name:'Raio',category:'habilidade',element:'raio',damage:{flat:10}});
    // roller fixo evita o proc elemental aleatório (raio -> Eletrizado, ~15% de chance) mascarar a asserção de consumo.
    const result=resolveArsenalAction({card:lightning,actor:actor(),targets:[target],roller:dice=>dice==='1d100'?100:0});
    expect(result.targets[0].currentHp).toBe(9);
    expect(result.targets[0].effects.some(active=>active.effect.name==='Eletrizado')).toBe(false);
  });

  it('Atordoado bloqueia a ação principal', () => {
    const stunned=applyActiveEffect([],getPredefinedEffect('Atordoado')!);
    const block=consumePrincipalBlock(stunned);
    expect(block.blocked).toBe(true);
  });

  it('Congelado e Derrubado reduzem a velocidade de iniciativa', () => {
    const slow={...getPredefinedEffect('Congelado')!};
    expect(activeOrderAdjustment([{effect:slow,stacks:1}]).speed).toBe(-50);
  });
});

describe('migração do legado', () => {
  it('converte habilidade e preserva forma, custo, efeito e área', () => {
    const legacy: Card = {
      id: 'forma', name: 'Forma Solar', image: 'sol.png', description: 'Brilha',
      auraCost: 3, type: 'forma', damage: 4, damageType: 'fogo', diceRoll: '1d20',
      conditionEffect: 'Queimadura', conditionDuration: 2, isAreaEffect: true,
      formaCardIds: ['raio'], formaHpBonus: 5,
    };
    const card = cardToArsenal(legacy);
    expect(card.abilityType).toBe('forma');
    expect(card.form?.grantedAbilityIds).toEqual(['raio']);
    expect(card.auraConsumed?.flat).toBe(3);
    expect(card.effects[0].name).toBe('Queimando');
    expect(card.area?.shape).toBe('circulo');
  });

  it('unifica os quatro catálogos e cria vínculo bilateral de arma', () => {
    const skill = {
      id: 'golpe', name: 'Golpe', image: '', description: '', auraCost: 0, type: 'ataque', weaponIds: ['espada'],
    } as Card & { weaponIds: string[] };
    const weapon: Weapon = { id: 'espada', name: 'Espada', image: '', description: '' };
    const item: Item = { id: 'pocao', name: 'Poção', image: '', description: '', consumeOnUse: true, quantity: 2 };
    const result = migrateLegacyArsenal({ cards: [skill], weapons: [weapon], items: [item], seals: [] });
    expect(result).toHaveLength(3);
    expect(result.find(card => card.id === 'espada')?.weapon?.grantedAbilityIds).toContain('golpe');
    expect(result.find(card => card.id === 'pocao')?.item).toMatchObject({ consumable: true, quantity: 2 });
  });

  it('preserva efeitos, cooldown, cargas e area de itens e selos', () => {
    const effect: ArsenalEffect = {
      id: 'burn-extra', name: 'Chama persistente', description: '', tags: [],
      duration: { type: 'rodadas', amount: 2 }, stackBehavior: 'renova_duracao', maxStacks: 1,
      triggers: [], modifiers: [], periodicDamage: { flat: 3 }, periodicHealing: null,
      auraConsumed: null, auraRestored: null, attackModifier: 0, defenseModifier: 0,
      speedModifier: 0, customEffect: null,
    };
    const item: Item = {
      id: 'bomba', name: 'Bomba', image: '', description: '', quantity: 2, usableInCombat: true,
      combatTargeting: 'area', combatAreaShape: 'cone', combatAreaSize: 4, combatAuraCost: 1,
      cooldown: { type: 'rodadas', amount: 2 },
      charges: { maximum: 3, current: 3, recharge: { type: 'por_rodada', amount: 1 } },
      effects: [effect],
    };
    const seal: Seal = {
      id: 'sigilo', name: 'Sigilo', image: '', description: '', code: 'SIG',
      combatTargeting: 'area', directionMode: 'line', areaSize: 5,
      connectors: ['top', 'bottomRight'], ritualKey: 'sigilo-chave', ritualRole: 'amplificador',
      rotationAllowed: false, maxPerRitual: 1, connectionTags: ['fogo'], forbiddenConnectionTags: ['agua'],
      cooldown: { type: 'turnos', amount: 1 },
      charges: { maximum: 2, current: 2, recharge: { type: 'nao_recarrega' } },
      effects: [effect],
    };
    const itemCard = itemToArsenal(item);
    const sealCard = sealToArsenal(seal);
    expect(itemCard.effects[0].name).toBe('Chama persistente');
    expect(itemCard.cooldown).toEqual({ type: 'rodadas', amount: 2 });
    expect(itemCard.charges?.maximum).toBe(3);
    expect(itemCard.auraConsumed?.flat).toBe(1);
    expect(itemCard.area).toMatchObject({ shape: 'cone', size: 4 });
    expect(sealCard.effects[0].name).toBe('Chama persistente');
    expect(sealCard.cooldown).toEqual({ type: 'turnos', amount: 1 });
    expect(sealCard.charges?.maximum).toBe(2);
    expect(sealCard.area).toMatchObject({ shape: 'linha', size: 5 });
    expect(sealCard.seal?.ritual).toMatchObject({
      key: 'sigilo-chave',
      role: 'amplificador',
      connectors: ['top', 'bottomRight'],
      rotationAllowed: false,
      connectionTags: ['fogo'],
      forbiddenConnectionTags: ['agua'],
      maxPerRitual: 1,
    });
  });

  it('adapta posses antigas sem duplicar entradas', () => {
    const holdings = migrateCharacterArsenalHoldings({
      cardIds: ['golpe'], weaponIds: ['espada'], sealIds: [],
      ownedItems: [{ itemId: 'pocao', quantity: 3 }],
      grimoire: [{ entryId: 'golpe', quantity: 1 }],
    });
    expect(holdings).toHaveLength(3);
    expect(holdings.find(holding => holding.cardId === 'pocao')?.quantity).toBe(3);
  });
});

describe('equipamento, formas e combos', () => {
  const skillA = createArsenalCard({ id: 'a', name: 'A', category: 'habilidade' });
  const skillB = createArsenalCard({ id: 'b', name: 'B', category: 'habilidade' });
  const weapon = createArsenalCard({
    id: 'w', name: 'W', category: 'arma', weapon: { freelyEquippable: true, grantedAbilityIds: ['a'] },
  });
  const form = createArsenalCard({
    id: 'f', name: 'F', category: 'habilidade', abilityType: 'forma',
    form: { grantedAbilityIds: ['b'], removedAbilityIds: ['a'], hpBonus: 0, auraBonus: 0 },
  });
  const catalog = [skillA, skillB, weapon, form];

  it('arma concede habilidade e forma pode conceder/remover', () => {
    let loadout = { holdings: [createHolding(weapon), createHolding(form)], equippedWeaponIds: [], activeFormIds: [] };
    loadout = equipWeapon(loadout, 'w');
    expect(availableCardIds(loadout, catalog)).toContain('a');
    loadout = activateForm(loadout, 'f');
    expect(availableCardIds(loadout, catalog)).toEqual(expect.arrayContaining(['w', 'f', 'b']));
    expect(availableCardIds(loadout, catalog)).not.toContain('a');
    expect(equipWeapon(loadout, null).equippedWeaponIds).toEqual([]);
  });

  it('habilidade vinculada fica indisponível sem o equipamento correspondente', () => {
    const linked={...skillA,weaponLinks:['w']};
    let loadout={holdings:[createHolding(linked),createHolding(weapon)],equippedWeaponIds:[],activeFormIds:[]};
    expect(availableCardIds(loadout,[linked,weapon])).not.toContain('a');
    loadout=equipWeapon(loadout,'w');
    expect(availableCardIds(loadout,[linked,weapon])).toContain('a');
  });

  it('combo oferece apenas o mesmo grupo e respeita o máximo de stacks', () => {
    const stackA=createArsenalCard({id:'stack-a',name:'Stack A',category:'habilidade',abilityType:'combo',combo:{stackKey:'solar',maxStacks:2,resolution:'simultanea'}});
    const stackC=createArsenalCard({id:'stack-c',name:'Stack C',category:'habilidade',abilityType:'combo',combo:{stackKey:'solar',maxStacks:2,resolution:'simultanea'}});
    const stackB=createArsenalCard({id:'stack-b',name:'Stack B',category:'habilidade',abilityType:'combo',combo:{stackKey:'lunar',maxStacks:2,resolution:'simultanea'}});
    const combo = createArsenalCard({
      id: 'c', name: 'Combo', category: 'habilidade', abilityType: 'combo',
      combo: { stackKey:'solar', maxStacks:2, resolution: 'simultanea' },
    });
    const comboCatalog=[...catalog,combo,stackA,stackC,stackB];
    expect(comboStackCandidates(combo,comboCatalog).map(card=>card.id)).toEqual(['stack-a','stack-c']);
    expect(resolveComboCards(combo,['stack-a'],comboCatalog).map(card=>card.id)).toEqual(['stack-a']);
    expect(resolveComboCards(combo,['stack-a','stack-c'],comboCatalog)).toEqual([]);
  });

  it('atribuição soma quantidades de itens sem duplicar holdings', () => {
    const item=createArsenalCard({id:'p',name:'Poção',category:'item',item:{consumable:true,quantity:1,disappearsOnUse:true}});
    const first=assignCardToHoldings([],item,3);
    const second=assignCardToHoldings(first,item,2);
    expect(second).toHaveLength(1);
    expect(second[0].quantity).toBe(5);
    expect(assignCardToHoldings([createHolding(skillA)],skillA,4)).toHaveLength(1);
  });
});

describe('pipeline de resolução', () => {
  it('acumula os valores dos níveis e limita a seleção ao maior nível', () => {
    const card=createArsenalCard({id:'level',name:'Golpe',category:'arma',damage:{flat:3},testDice:'1d20',levels:[
      {level:2,damage:{flat:5},testDice:'1d20+1'},
      {level:3,damage:{flat:8}},
    ]});
    expect(arsenalCardAtLevel(card,2)).toMatchObject({damage:{flat:5},testDice:'1d20+1'});
    expect(arsenalCardAtLevel(card,99)).toMatchObject({damage:{flat:8},testDice:'1d20+1'});
    expect(card.damage?.flat).toBe(3);
  });

  it('ordena reações por alvo, aliados, inimigos e automáticas', () => {
    expect(sortReactions([
      { id: 'auto', ownerId: 'x', ownerKind: 'automatico' },
      { id: 'enemy', ownerId: 'x', ownerKind: 'inimigo' },
      { id: 'target', ownerId: 'x', ownerKind: 'alvo' },
      { id: 'ally', ownerId: 'x', ownerKind: 'aliado_alvo' },
    ]).map(reaction => reaction.id)).toEqual(['target', 'ally', 'enemy', 'auto']);
  });

  it('executa as 16 etapas, custos, dano, efeitos, cooldown e cargas', () => {
    const burn = PREDEFINED_ARSENAL_EFFECTS.find(effect => effect.name === 'Queimando')!;
    const card = createArsenalCard({
      id: 'fire', name: 'Fogo', category: 'habilidade', tags: ['fogo'], testDice: '1d20',
      damage: { flat: 5 }, extraDamageDice: '1d4', auraConsumed: { flat: 2 },
      effects: [burn], cooldown: { type: 'turnos', amount: 2 },
      charges: { maximum: 3, current: 3, recharge: { type: 'por_turno', amount: 1 } },
    });
    const user = actor({ holdings: [createHolding(card)] });
    const target = actor({ id: 'target', teamId: 'b', currentHp: 20, defense: 10, isCurrentTurn: false });
    const rolls: Record<string, number> = { '1d20': 15, '1d4': 3 };
    const result = resolveArsenalAction({ card, actor: user, targets: [target], roller: dice => rolls[dice] });
    expect(result.status).toBe('concluida');
    expect(result.trace.map(entry => entry.step)).toEqual(ACTION_PIPELINE_STEPS);
    expect(result.actor.currentAura).toBe(8);
    expect(result.targets[0].currentHp).toBe(14);
    expect(result.targets[0].defenseCurrent).toBe(12);
    expect(result.targets[0].effects[0].effect.name).toBe('Queimando');
    expect(result.actor.holdings[0]).toMatchObject({ cooldownRemaining: 2, currentCharges: 2 });
  });

  it('pausa em preparação e não abre janela de reação antes da retomada', () => {
    const card = createArsenalCard({
      id: 'ritual', name: 'Ritual', category: 'selo', auraConsumed: { flat: 1 },
      preparation: { timing: { type: 'rodadas', amount: 2 }, cancellable: true, interruptedByDamage: true, persistsAfterDamage: false, visibility: 'oculta' },
    });
    const result = resolveArsenalAction({ card, actor: actor(), targets: [actor({ id: 't', teamId: 'b' })] });
    expect(result.status).toBe('preparando');
    expect(result.preparation).toMatchObject({ visibility: 'oculta', targetIds: ['t'] });
    expect(result.trace.at(-1)?.step).toBe('iniciar_preparacao');
    const resumed = resolveArsenalAction({ card, actor: result.actor, targets: result.targets, resumePreparation: true });
    expect(resumed.status).toBe('concluida');
    expect(resumed.actor.currentAura).toBe(9);
  });

  it('bloqueia condição antes de consumir recursos', () => {
    const card = createArsenalCard({
      id: 'armed', name: 'Armada', category: 'habilidade', auraConsumed: { flat: 3 }, conditions: [{ type: 'arma_equipada' }],
    });
    const result = resolveArsenalAction({ card, actor: actor(), targets: [actor({ id: 't', teamId: 'b' })] });
    expect(result.status).toBe('bloqueada');
    expect(result.actor.currentAura).toBe(10);
  });

  it('ritual exige e consome os itens ao iniciar a preparação', () => {
    const card=createArsenalCard({
      id:'ritual',name:'Ritual',category:'selo',
      seal:{kind:'ritual',type:'buff',persistent:true,consumable:false,requiredItems:[{itemId:'cristal',quantity:2}],durationRounds:3},
      preparation:{timing:{type:'rodadas',amount:2},cancellable:true,interruptedByDamage:true,persistsAfterDamage:false,visibility:'visivel'},
    });
    const prepared=resolveArsenalAction({card,actor:actor({holdings:[{cardId:'cristal',quantity:3,equipped:false,active:false}]}),targets:[actor()]});
    expect(prepared.status).toBe('preparando');
    expect(prepared.actor.holdings[0].quantity).toBe(1);
    const blocked=resolveArsenalAction({card,actor:actor({holdings:[{cardId:'cristal',quantity:1,equipped:false,active:false}]}),targets:[actor()]});
    expect(blocked).toMatchObject({status:'bloqueada',reason:'Itens insuficientes para o ritual'});
  });

  it('soma a rolagem de proteção à defesa contra a carta lançada', () => {
    const burn = PREDEFINED_ARSENAL_EFFECTS.find(effect => effect.name === 'Queimando')!;
    const attack=createArsenalCard({id:'atk',name:'Ataque',category:'habilidade',testDice:'1d20',damage:{flat:4},effects:[burn]});
    const target=actor({id:'target',teamId:'b',defense:10,currentHp:20});
    const result=resolveArsenalAction({card:attack,actor:actor(),targets:[target],reactions:[{id:'escudo',ownerId:'target',ownerKind:'alvo',defenseModifier:3}],roller:()=>12});
    expect(result.hitTargetIds).toEqual([]);
    expect(result.targets[0].currentHp).toBe(20);
    expect(result.targets[0].effects).toEqual([]);
  });

  it('Molhado aumenta o dano elétrico recebido e permanece ativo', () => {
    const wet=getPredefinedEffect('Molhado')!;
    const lightning=createArsenalCard({id:'zap',name:'Raio',category:'habilidade',element:'raio',damage:{flat:4}});
    const target=actor({id:'target',teamId:'b',currentHp:20,effects:applyActiveEffect([],wet)});
    const result=resolveArsenalAction({card:lightning,actor:actor(),targets:[target]});
    expect(result.targets[0].currentHp).toBe(16);
    expect(result.targets[0].effects.some(active=>active.effect.name==='Molhado')).toBe(true);
  });

  it('Frágil reduz apenas a defesa do alvo', () => {
    const fragile=getPredefinedEffect('Frágil')!;
    const attack=createArsenalCard({id:'weak-hit',name:'Golpe',category:'habilidade',testDice:'1d20',damage:{flat:4}});
    const result=resolveArsenalAction({card:attack,actor:actor(),targets:[actor({id:'t',teamId:'b',defense:10,effects:applyActiveEffect([],fragile)})],roller:()=>9});
    expect(result.hitTargetIds).toEqual(['t']);
  });

  it('Atordoado bloqueia a ação declarada', () => {
    const stunned = getPredefinedEffect('Atordoado')!;
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', damage: { flat: 5 } });
    const blocked = resolveArsenalAction({ card, actor: actor({ effects: applyActiveEffect([], stunned) }), targets: [actor({ id: 't', teamId: 'b' })] });
    expect(blocked.status).toBe('bloqueada');
    expect(blocked.reason).toBe('Incapacitado: perde a ação');
  });

  it('actsRequireTest bloqueia a ação quando o teste falha', () => {
    const frozen = { ...getPredefinedEffect('Congelado')!, actsRequireTest: { dice: '1d20', minimum: 10 } };
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', damage: { flat: 5 } });
    const failed = resolveArsenalAction({ card, actor: actor({ effects: applyActiveEffect([], frozen) }), targets: [actor({ id: 't', teamId: 'b' })], roller: () => 3 });
    expect(failed.status).toBe('bloqueada');
    expect(failed.reason).toBe('Congelado: falhou no teste (3 < 10)');
    const passed = resolveArsenalAction({ card, actor: actor({ effects: applyActiveEffect([], frozen) }), targets: [actor({ id: 't', teamId: 'b' })], roller: () => 15 });
    expect(passed.status).toBe('concluida');
  });

  it('Congelado bloqueia reações', () => {
    const frozen = getPredefinedEffect('Congelado')!;
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', damage: { flat: 5 } });
    const blocked = resolveArsenalAction({ card, actor: actor({ effects: applyActiveEffect([], frozen) }), targets: [actor({ id: 't', teamId: 'b' })], isReaction: true });
    expect(blocked.status).toBe('bloqueada');
    expect(blocked.reason).toBe('Reação bloqueada');
  });

  it('carta de fogo tem chance de aplicar Queimando após o dano', () => {
    const card = createArsenalCard({ id: 'fire', name: 'Fogo', category: 'habilidade', element: 'fogo', damage: { flat: 5 }, elementalConditionChance: 1 });
    const result = resolveArsenalAction({ card, actor: actor(), targets: [actor({ id: 't', teamId: 'b', currentHp: 20 })], roller: dice => dice === '1d100' ? 1 : 0 });
    expect(result.targets[0].effects.some(active => active.effect.name === 'Queimando')).toBe(true);
  });

  it('applyElementalCondition:false nunca aplica a condição', () => {
    const card = createArsenalCard({ id: 'fire', name: 'Fogo', category: 'habilidade', element: 'fogo', damage: { flat: 5 }, applyElementalCondition: false, elementalConditionChance: 1 });
    const result = resolveArsenalAction({ card, actor: actor(), targets: [actor({ id: 't', teamId: 'b', currentHp: 20 })], roller: dice => dice === '1d100' ? 1 : 0 });
    expect(result.targets[0].effects).toEqual([]);
  });
});

describe('capacidades expandidas de efeitos', () => {
  const template = getPredefinedEffect('Queimadura')!;
  const effect = (overrides: Partial<ArsenalEffect> = {}): ArsenalEffect => ({
    ...template, periodicDamage: null, periodicDamageElement: null, ...overrides,
  });

  it('modificador de dano só se aplica quando o elemento da carta bate', () => {
    const buff = effect({ modifiers: [{ stat: 'dano', operation: 'somar', value: 5, filter: { damageType: ['fogo'] } }] });
    const fireCard = createArsenalCard({ id: 'fire', name: 'Fogo', category: 'habilidade', element: 'fogo', damage: { flat: 4 } });
    const waterCard = createArsenalCard({ id: 'water', name: 'Água', category: 'habilidade', element: 'água', damage: { flat: 4 } });
    const user = actor({ effects: applyActiveEffect([], buff) });
    const withFire = resolveArsenalAction({ card: fireCard, actor: user, targets: [actor({ id: 't', teamId: 'b', currentHp: 20 })] });
    const withWater = resolveArsenalAction({ card: waterCard, actor: user, targets: [actor({ id: 't', teamId: 'b', currentHp: 20 })] });
    expect(withFire.targets[0].currentHp).toBe(13);
    expect(withWater.targets[0].currentHp).toBe(17);
  });

  it('modificador multiplicativo dobra o dano', () => {
    const buff = effect({ modifiers: [{ stat: 'dano', operation: 'multiplicar', value: 100 }] });
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', damage: { flat: 6 } });
    const result = resolveArsenalAction({ card, actor: actor({ effects: applyActiveEffect([], buff) }), targets: [actor({ id: 't', teamId: 'b', currentHp: 30 })] });
    expect(result.targets[0].currentHp).toBe(20);
  });

  it('modificador de definir sobrepõe a defesa calculada do alvo', () => {
    const debuff = effect({ modifiers: [{ stat: 'defesa', operation: 'definir', value: 1 }] });
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', testDice: '1d20', damage: { flat: 3 } });
    const target = actor({ id: 't', teamId: 'b', defense: 99, currentHp: 20, effects: applyActiveEffect([], debuff) });
    const result = resolveArsenalAction({ card, actor: actor(), targets: [target], roller: () => 2 });
    expect(result.hitTargetIds).toEqual(['t']);
  });

  it('bônus de dado flat e vantagem se somam à rolagem de dano', () => {
    const buff = effect({ diceBonuses: [{ target: 'dano', bonusFlat: 3, bonusDice: '1d4' }] });
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', damage: { flat: 5 } });
    const rolls: Record<string, number> = { '1d4': 2 };
    const result = resolveArsenalAction({ card, actor: actor({ effects: applyActiveEffect([], buff) }), targets: [actor({ id: 't', teamId: 'b', currentHp: 30 })], roller: dice => rolls[dice] });
    expect(result.targets[0].currentHp).toBe(20);
  });

  it('vantagem no teste rola duas vezes e fica com o maior resultado', () => {
    const buff = effect({ diceBonuses: [{ target: 'teste', advantage: true }] });
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', testDice: '1d20', damage: { flat: 1 } });
    const rolls = [8, 17];
    const result = resolveArsenalAction({ card, actor: actor({ effects: applyActiveEffect([], buff) }), targets: [actor({ id: 't', teamId: 'b', defense: 15, currentHp: 20 })], roller: () => rolls.shift()! });
    expect(result.rolls.test).toBe(17);
    expect(result.hitTargetIds).toEqual(['t']);
  });

  it('resistência elemental reduz o dano e vulnerabilidade aumenta', () => {
    const resist = effect({ elementalAffinities: [{ element: 'fogo', kind: 'resistencia', percent: 50 }] });
    const vulnerable = effect({ elementalAffinities: [{ element: 'fogo', kind: 'vulnerabilidade', percent: 50 }] });
    const card = createArsenalCard({ id: 'fire', name: 'Fogo', category: 'habilidade', element: 'fogo', damage: { flat: 10 } });
    const resistant = resolveArsenalAction({ card, actor: actor(), targets: [actor({ id: 't', teamId: 'b', currentHp: 30, maxHp: 40, effects: applyActiveEffect([], resist) })] });
    const vulnerableResult = resolveArsenalAction({ card, actor: actor(), targets: [actor({ id: 't', teamId: 'b', currentHp: 30, maxHp: 40, effects: applyActiveEffect([], vulnerable) })] });
    expect(resistant.targets[0].currentHp).toBe(26);
    expect(vulnerableResult.targets[0].currentHp).toBe(18);
  });

  it('imunidade elemental zera o dano e absorção converte em cura', () => {
    const immune = effect({ elementalAffinities: [{ element: 'fogo', kind: 'imunidade', percent: 0 }] });
    const absorb = effect({ elementalAffinities: [{ element: 'fogo', kind: 'absorcao', percent: 100 }] });
    const card = createArsenalCard({ id: 'fire', name: 'Fogo', category: 'habilidade', element: 'fogo', damage: { flat: 10 } });
    const immuneResult = resolveArsenalAction({ card, actor: actor(), targets: [actor({ id: 't', teamId: 'b', currentHp: 30, maxHp: 30, effects: applyActiveEffect([], immune) })] });
    const absorbResult = resolveArsenalAction({ card, actor: actor(), targets: [actor({ id: 't', teamId: 'b', currentHp: 20, maxHp: 30, effects: applyActiveEffect([], absorb) })] });
    expect(immuneResult.targets[0].currentHp).toBe(30);
    expect(absorbResult.targets[0].currentHp).toBe(30);
  });

  it('roubo de vida cura o atacante com base no dano causado', () => {
    const drain = effect({ lifeSteal: 50 });
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', damage: { flat: 10 } });
    const result = resolveArsenalAction({ card, actor: actor({ currentHp: 10, maxHp: 20, effects: applyActiveEffect([], drain) }), targets: [actor({ id: 't', teamId: 'b', currentHp: 30, maxHp: 40 })] });
    expect(result.actor.currentHp).toBe(14);
    expect(result.targets[0].currentHp).toBe(22);
  });

  it('espinhos refletem dano ao atacante quando o alvo é atingido', () => {
    const thorny = effect({ thorns: { flat: 4 } });
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', damage: { flat: 6 } });
    const result = resolveArsenalAction({ card, actor: actor({ currentHp: 20 }), targets: [actor({ id: 't', teamId: 'b', currentHp: 30, maxHp: 40, effects: applyActiveEffect([], thorny) })] });
    expect(result.actor.currentHp).toBe(16);
    expect(result.targets[0].currentHp).toBe(26);
  });

  it('Frágil reduz defesa e permite dano extra passar', () => {
    const fragile = { ...getPredefinedEffect('Frágil')!, elementalAffinities: [{ element: 'fisico' as const, kind: 'vulnerabilidade' as const, percent: 25 }] };
    const card = createArsenalCard({ id: 'punch', name: 'Soco', category: 'habilidade', element: 'fisico', testDice: '1d20', damage: { flat: 8 } });
    const target = actor({ id: 't', teamId: 'b', defense: 12, currentHp: 30, maxHp: 30, effects: applyActiveEffect([], fragile) });
    const result = resolveArsenalAction({ card, actor: actor(), targets: [target], roller: () => 11 });
    expect(result.hitTargetIds).toEqual(['t']);
    expect(result.targets[0].currentHp).toBe(22);
  });

  it('Amaldiçoado reduz cura e recuperação de aura recebidas', () => {
    const cursed = effect({
      modifiers: [
        { stat: 'cura_recebida', operation: 'multiplicar', value: -50 },
        { stat: 'aura_recebida', operation: 'multiplicar', value: -50 },
      ],
    });
    const card = createArsenalCard({ id: 'heal', name: 'Cura', category: 'habilidade', healing: { flat: 10 }, auraRestored: { flat: 4 } });
    const target = actor({ id: 't', teamId: 'b', currentHp: 10, maxHp: 30, currentAura: 0, maxAura: 10, effects: applyActiveEffect([], cursed) });
    const result = resolveArsenalAction({ card, actor: actor(), targets: [target] });
    expect(result.targets[0].currentHp).toBe(15);
    expect(result.targets[0].currentAura).toBe(2);
  });

  it('imunidade a uma condição impede sua aplicação no alvo', () => {
    const burn = PREDEFINED_ARSENAL_EFFECTS.find(entry => entry.name === 'Queimando')!;
    const fireproof = effect({ id: 'fireproof', name: 'À Prova de Fogo', immunities: [burn.id] });
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', damage: { flat: 2 }, effects: [burn] });
    const result = resolveArsenalAction({ card, actor: actor(), targets: [actor({ id: 't', teamId: 'b', currentHp: 30, effects: applyActiveEffect([], fireproof) })] });
    expect(result.targets[0].effects.some(active => active.effect.name === 'Queimando')).toBe(false);
  });

  it('usesPerActivation consome múltiplas unidades por uso e bloqueia sem estoque suficiente', () => {
    const potion = createArsenalCard({ id: 'potion', name: 'Poção Tripla', category: 'item', item: { consumable: true, quantity: 5, disappearsOnUse: false, usesPerActivation: 3 } });
    const holding = createHolding(potion, 5);
    const enough = resolveArsenalAction({ card: potion, actor: actor({ holdings: [holding] }), targets: [actor()] });
    expect(enough.status).toBe('concluida');
    expect(enough.actor.holdings[0].quantity).toBe(2);
    const short = resolveArsenalAction({ card: potion, actor: actor({ holdings: [{ ...holding, quantity: 2 }] }), targets: [actor()] });
    expect(short).toMatchObject({ status: 'bloqueada', reason: 'Item indisponível' });
  });

  it('aplica bônus somente à carta, categoria e tipo de habilidade selecionados', () => {
    const scoped = effect({ diceBonuses: [{
      target: 'teste', bonusFlat: 5, filter: { cardIds: ['guard'], categories: ['habilidade'], abilityTypes: ['protecao'] },
    }] });
    const guard = createArsenalCard({ id:'guard', name:'Guarda Arcana', category:'habilidade', abilityType:'protecao', testDice:'1d20' });
    const other = createArsenalCard({ id:'other', name:'Golpe', category:'habilidade', abilityType:'comum', testDice:'1d20' });
    const user = actor({ effects:applyActiveEffect([],scoped) });
    expect(resolveArsenalAction({card:guard,actor:user,targets:[actor({id:'t',teamId:'b'})],roller:()=>10}).rolls.test).toBe(15);
    expect(resolveArsenalAction({card:other,actor:user,targets:[actor({id:'t',teamId:'b'})],roller:()=>10}).rolls.test).toBe(10);
  });

  it('combina rerrolagem, resultado mínimo e desvantagem; vantagem anula desvantagem', () => {
    const control = effect({ diceBonuses:[{ target:'teste', rerollBelow:5, minimumResult:8, disadvantage:true }] });
    const card = createArsenalCard({id:'test',name:'Teste',category:'habilidade',testDice:'1d20'});
    const rolls=[3,12,9];
    const result=resolveArsenalAction({card,actor:actor({effects:applyActiveEffect([],control)}),targets:[actor({id:'t',teamId:'b'})],roller:()=>rolls.shift()!});
    expect(result.rolls.test).toBe(9);
    const neutral=effect({diceBonuses:[{target:'teste',advantage:true,disadvantage:true}]});
    let calls=0;
    resolveArsenalAction({card,actor:actor({effects:applyActiveEffect([],neutral)}),targets:[actor({id:'t',teamId:'b'})],roller:()=>{calls+=1;return 10;}});
    expect(calls).toBe(1);
  });

  it('multiplica bônus flat pela quantidade de stacks ativos', () => {
    const stacking=effect({id:'stacking',stackBehavior:'acumula_intensidade',maxStacks:3,diceBonuses:[{target:'dano',bonusFlat:2}]});
    const effects=applyActiveEffect(applyActiveEffect([],stacking),stacking);
    const card=createArsenalCard({id:'hit',name:'Golpe',category:'arma',damage:{flat:1}});
    const result=resolveArsenalAction({card,actor:actor({effects}),targets:[actor({id:'t',teamId:'b',currentHp:20})]});
    expect(result.targets[0].currentHp).toBe(16);
  });

  it('remove efeito ativo por id e por tag', () => {
    const burn = getPredefinedEffect('Queimando')!;
    const fragile = getPredefinedEffect('Frágil')!;
    const effects = applyActiveEffect(applyActiveEffect([], burn), fragile);
    expect(hasCondition({ effects }, burn.id)).toBe(true);
    expect(removeActiveEffect(effects, burn.id).some(active => active.effect.id === burn.id)).toBe(false);
    expect(cleanseByTag(effects, 'debuff').some(active => active.effect.name === 'Frágil')).toBe(false);
    expect(getActiveEffects({ effects })).toBe(effects);
  });
});

describe('motor clássico honra os modificadores de valor v2 (buff/debuff novo)', () => {
  const buff = (overrides: ArsenalEffect['valueModifiers']): ArsenalEffect => ({
    id: 'v2-buff', name: 'Buff v2', description: '', tags: [], duration: { type: 'rodadas', amount: 2 },
    stackBehavior: 'renova_duracao', maxStacks: 1, triggers: [], modifiers: [],
    periodicDamage: null, periodicHealing: null, auraConsumed: null, auraRestored: null,
    attackModifier: 0, defenseModifier: 0, speedModifier: 0, customEffect: null, valueModifiers: overrides,
  });

  it('teste (ataque) soma o modificador novo ao total', () => {
    const user = actor({ effects: applyActiveEffect([], buff([{ operation: 'somar', target: 'teste', value: 5, filter: { testKinds: ['ataque'] } }])) });
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', testDice: '1d20', damage: { flat: 1 } });
    const result = resolveArsenalAction({ card, actor: user, targets: [actor({ id: 't', teamId: 'b', defense: 14 })], roller: () => 9 });
    expect(result.hitTargetIds).toEqual(['t']); // 9 + 5 = 14 >= 14
  });

  it('dano causado soma o modificador novo (sem contar duas vezes com o antigo)', () => {
    const user = actor({ effects: applyActiveEffect([], buff([{ operation: 'somar', target: 'dano', value: 5 }])) });
    const card = createArsenalCard({ id: 'hit', name: 'Golpe', category: 'habilidade', damage: { flat: 3 } });
    // maxHp precisa acompanhar currentHp aqui — senão o clamp final (Math.min(maxHp,...)) mascara a diferença de dano.
    const result = resolveArsenalAction({ card, actor: user, targets: [actor({ id: 't', teamId: 'b', currentHp: 30, maxHp: 30 })], roller: () => 0 });
    expect(result.targets[0].currentHp).toBe(24); // 30 - floor((3+5)*0.8 de redução de defesa) = 30 - 6 = 24, sem duplicar
  });

  it('dano recebido (Vulnerável a fogo) multiplica o dano no lado do alvo', () => {
    const target = actor({ id: 't', teamId: 'b', currentHp: 30, maxHp: 30, effects: applyActiveEffect([], buff([{ operation: 'multiplicar', target: 'dano', value: 2, filter: { elements: ['fogo'], direction: 'recebido' } }])) });
    const card = createArsenalCard({ id: 'hit', name: 'Bola de Fogo', category: 'habilidade', element: 'fogo', damage: { flat: 4 } });
    const result = resolveArsenalAction({ card, actor: actor(), targets: [target], roller: () => 0 });
    expect(result.targets[0].currentHp).toBe(24); // 30 - floor((4*2)*0.8) = 30 - 6 = 24
  });

  it('cura causada soma dado extra do modificador novo', () => {
    const user = actor({ currentHp: 10, effects: applyActiveEffect([], buff([{ operation: 'adicionar_dado', target: 'cura', dice: '1d6' }])) });
    const card = createArsenalCard({ id: 'heal', name: 'Cura', category: 'habilidade', healing: { flat: 5 } });
    const rolls: Record<string, number> = { '1d6': 3 };
    const result = resolveArsenalAction({ card, actor: user, targets: [actor({ id: 't', teamId: 'b', currentHp: 10, maxHp: 30 })], roller: dice => rolls[dice] ?? 0 });
    expect(result.targets[0].currentHp).toBe(18); // 10 + (5+3) = 18
  });

  it('custo de aura e cooldown respeitam reduções do modificador novo', () => {
    const card = createArsenalCard({ id: 'spell', name: 'Feitiço', category: 'habilidade', auraConsumed: { flat: 3 }, cooldown: { type: 'rodadas', amount: 2 } });
    const user = actor({ currentAura: 10, holdings: [{ cardId: 'spell', quantity: 1, equipped: false, active: false }], effects: applyActiveEffect([], buff([
      { operation: 'subtrair', target: 'custo_aura', value: 2 },
      { operation: 'subtrair', target: 'cooldown', value: 1 },
    ])) });
    const result = resolveArsenalAction({ card, actor: user, targets: [actor({ id: 't', teamId: 'b' })], roller: () => 0 });
    expect(result.actor.currentAura).toBe(9); // 10 - (3-2) = 9
    expect(result.actor.holdings[0].cooldownRemaining).toBe(1); // 2 - 1 = 1
  });
});
