import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../../types';
import { createArsenalCard } from '../../utils/arsenal';
import { createHolding } from '../../utils/arsenalState';
import ArsenalAssignmentDialog from './ArsenalAssignmentDialog';

afterEach(()=>cleanup());

const character=(id:string,name:string):Character=>({id,name,icon:'',maxHp:10,currentHp:10,maxAura:5,currentAura:5,maxAmmo:0,currentAmmo:0,baseInitiative:0,cardIds:[],conditions:[],items:[],role:'cast'});

describe('ArsenalAssignmentDialog',()=>{
  it('pesquisa personagens e atribui quantidade adicional de item',()=>{
    const card=createArsenalCard({id:'p',name:'Poção',category:'item',item:{consumable:true,quantity:1,disappearsOnUse:true}});
    const alice=character('a','Alice');
    const beto={...character('b','Beto'),arsenal:[createHolding(card,2)]};
    const onAssign=vi.fn();
    render(<ArsenalAssignmentDialog card={card} characters={[alice,beto]} onAssign={onAssign} onClose={()=>{}}/>);
    fireEvent.change(screen.getByLabelText('Pesquisar personagens'),{target:{value:'Beto'}});
    expect(screen.queryByText('Alice')).toBeNull();
    expect(screen.getByText('Possui 2')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Quantidade do item'),{target:{value:'4'}});
    fireEvent.click(screen.getByRole('button',{name:/Beto/i}));
    fireEvent.click(screen.getByRole('button',{name:'Atribuir ×4'}));
    expect(onAssign).toHaveBeenCalledWith(['b'],4);
  });

  it('permite seleção em lote e bloqueia quem já possui carta não consumível',()=>{
    const card=createArsenalCard({id:'h',name:'Golpe',category:'habilidade'});
    const alice={...character('a','Alice'),arsenal:[createHolding(card)]};
    const beto=character('b','Beto');
    const caio=character('c','Caio');
    const onAssign=vi.fn();
    render(<ArsenalAssignmentDialog card={card} characters={[alice,beto,caio]} onAssign={onAssign} onClose={()=>{}}/>);
    expect(screen.getByRole('button',{name:/Alice/i}).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Selecionar visíveis'}));
    fireEvent.click(screen.getByRole('button',{name:'Atribuir'}));
    expect(onAssign).toHaveBeenCalledWith(['b','c'],1);
  });
});
