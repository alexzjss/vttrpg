import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ActionMenu from './ActionMenu';
import { createArsenalCard } from '../../utils/arsenal';
import type { ResolvedAction, ActionCategory } from '../../utils/actions';
import { GUARD_ACTION } from '../../utils/actions';

afterEach(() => cleanup());

const ra = (over: Partial<ResolvedAction>): ResolvedAction => ({
  source: 'card', id: 'a', name: 'Golpe', category: 'atacar', diceRoll: '1d20', targeting: 'other', ...over,
});
const groups = (over: Partial<Record<ActionCategory, ResolvedAction[]>> = {}): Record<ActionCategory, ResolvedAction[]> => ({
  atacar: [], habilidade: [GUARD_ACTION], item: [], ...over,
});

describe('ActionMenu', () => {
  it('mostra as categorias', () => {
    render(<ActionMenu actions={groups()} />);
    for (const label of ['ATAQUES', 'HABILIDADES', 'ITENS']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByText('FORMA')).toBeNull();
    expect(screen.queryByText('GUARDA')).toBeNull();
    fireEvent.click(screen.getByText('HABILIDADES'));
    expect(screen.getByText('Guarda')).toBeTruthy();
  });
  it('abre a categoria e seleciona uma ação real', () => {
    const onSelectAction = vi.fn();
    render(<ActionMenu actions={groups({ atacar: [ra({ name: 'Bola de Fogo' })] })} onSelectAction={onSelectAction} />);
    fireEvent.click(screen.getByText('ATAQUES'));
    fireEvent.click(screen.getByText('Bola de Fogo'));
    expect(onSelectAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'USAR CARTA' }));
    expect(onSelectAction).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bola de Fogo' }));
  });

  it('mostra a arte da carta selecionada quando existe imagem', () => {
    render(<ActionMenu actions={groups({ atacar: [ra({ name: 'Bola de Fogo', image: 'https://x/fogo.png' })] })} />);
    fireEvent.click(screen.getByText('ATAQUES'));
    fireEvent.click(screen.getByText('Bola de Fogo'));
    const preview=screen.getByTestId('arsenal-card-preview');
    expect(preview.getAttribute('data-has-art')).toBe('true');
  });

  it('sem imagem, cai no cabeçalho neutro', () => {
    render(<ActionMenu actions={groups({ atacar: [ra({ name: 'Golpe Simples' })] })} />);
    fireEvent.click(screen.getByText('ATAQUES'));
    fireEvent.click(screen.getByText('Golpe Simples'));
    expect(screen.getByTestId('arsenal-card-preview')).toBeTruthy();
    expect(screen.getByRole('heading',{name:'Golpe Simples'})).toBeTruthy();
  });
});

describe('ActionMenu — equipamento', () => {
  it('permite equipar e ficar sem arma', () => {
    const onEquipWeapon=vi.fn();
    const weapon=createArsenalCard({id:'w',name:'Espada Solar',category:'arma',weapon:{freelyEquippable:true,grantedAbilityIds:[]}});
    render(<ActionMenu arsenalWeapons={[weapon]} equippedWeaponId={null} onEquipWeapon={onEquipWeapon}/>);
    fireEvent.change(screen.getByLabelText('Arma equipada'),{target:{value:'w'}});
    expect(onEquipWeapon).toHaveBeenCalledWith('w');
    fireEvent.change(screen.getByLabelText('Arma equipada'),{target:{value:''}});
    expect(onEquipWeapon).toHaveBeenCalledWith(null);
  });

  it('seleciona o nível da arma equipada', () => {
    const onSelectLevel=vi.fn();
    const weapon=createArsenalCard({id:'w',name:'Espada Solar',category:'arma',levels:[{level:2,damage:{flat:7}}],weapon:{freelyEquippable:true,grantedAbilityIds:[]}});
    render(<ActionMenu arsenalWeapons={[weapon]} equippedWeaponId="w" selectedLevels={{w:1}} onSelectLevel={onSelectLevel}/>);
    fireEvent.change(screen.getByLabelText('Nível de Espada Solar'),{target:{value:'2'}});
    expect(onSelectLevel).toHaveBeenCalledWith('w',2);
  });
});
