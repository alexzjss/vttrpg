import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createArsenalCard } from '../../utils/arsenal';
import ArsenalCardPreview from './ArsenalCardPreview';

afterEach(()=>cleanup());

describe('ArsenalCardPreview',()=>{
  it('explica combate, ritmo, efeitos e requisitos da carta',()=>{
    const card=createArsenalCard({
      id:'solar',name:'Lâmina Solar',category:'habilidade',abilityType:'protecao',element:'fogo',description:'Protege e contra-ataca.',
      testDice:'1d20+2',damage:{flat:4,dice:'1d6'},auraConsumed:{flat:2},target:{type:'um_alvo'},area:{shape:'cone',size:3,unit:'metros'},
      cooldown:{type:'rodadas',amount:2},preparation:{timing:{type:'turnos',amount:1},cancellable:true,interruptedByDamage:true,persistsAfterDamage:false,visibility:'visivel'},
      conditions:[{type:'arma_equipada'}],effects:[{id:'burn',name:'Queimadura',description:'Dano ao longo do tempo.',tags:[],duration:{type:'rodadas',amount:2},stackBehavior:'renova_duracao',maxStacks:1,triggers:[],modifiers:[],periodicDamage:{flat:2},periodicHealing:null,auraConsumed:null,auraRestored:null,attackModifier:0,defenseModifier:0,speedModifier:0,customEffect:null}],
    });
    render(<ArsenalCardPreview card={card}/>);
    expect(screen.getByText('Lâmina Solar')).toBeTruthy();
    expect(screen.getByText('RITMO E USO')).toBeTruthy();
    expect(screen.getByText('Queimadura')).toBeTruthy();
    expect(screen.getByText('REQUISITOS')).toBeTruthy();
    expect(screen.getByText('cone · 3 metros')).toBeTruthy();
  });
});
