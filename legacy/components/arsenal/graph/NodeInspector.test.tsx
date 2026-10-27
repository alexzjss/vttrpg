import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { _resetRegistry } from '../../../utils/nodeRegistry';
import { ensureNodesRegistered } from '../../../utils/nodes';
import NodeInspector from './NodeInspector';
import type { GraphNode } from '../../../utils/abilityGraph';

describe('NodeInspector', () => {
  beforeEach(() => { _resetRegistry(); ensureNodesRegistered(); });

  it('renderiza um campo por FieldSchema do tipo do nó', () => {
    const node: GraphNode = { id: 'd1', type: 'dano', family: 'efeito', props: { dice: '1d6', flat: 2, element: 'fogo' } };
    render(<NodeInspector node={node} edges={[]} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByLabelText('Dado')).toBeTruthy();
    expect((screen.getByLabelText('Fixo') as HTMLInputElement).value).toBe('2');
  });

  it('editar um campo numérico chama onChange com o valor convertido', () => {
    const onChange = vi.fn();
    const node: GraphNode = { id: 'd1', type: 'dano', family: 'efeito', props: { dice: '1d6', flat: 2, element: 'fogo' } };
    render(<NodeInspector node={node} edges={[]} onChange={onChange} onRemove={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Fixo'), { target: { value: '9' } });
    expect(onChange).toHaveBeenCalledWith('d1', { flat: 9 });
  });

  it('botão remover pede confirmação e chama onRemove quando confirmado', () => {
    const onRemove = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const node: GraphNode = { id: 'd1', type: 'dano', family: 'efeito', props: { dice: '1d6', flat: 2, element: 'fogo' } };
    render(<NodeInspector node={node} edges={[]} onChange={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover nó' }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalledWith('d1');
    confirmSpy.mockRestore();
  });

  it('botão remover não chama onRemove quando a confirmação é cancelada', () => {
    const onRemove = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const node: GraphNode = { id: 'd1', type: 'dano', family: 'efeito', props: { dice: '1d6', flat: 2, element: 'fogo' } };
    render(<NodeInspector node={node} edges={[]} onChange={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover nó' }));
    expect(onRemove).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('nó de família gatilho sem pais (raiz estrutural) não mostra o botão remover', () => {
    const node: GraphNode = { id: 'g1', type: 'ao_ativar', family: 'gatilho', props: {} };
    render(<NodeInspector node={node} edges={[]} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Remover nó' })).toBeFalsy();
  });

  it('nó de família gatilho conectado como filho (tem pai) mostra o botão remover', () => {
    const node: GraphNode = { id: 'g2', type: 'enquanto_ativa', family: 'gatilho', props: {} };
    render(<NodeInspector node={node} edges={[{ from: 'g1', to: 'g2' }]} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Remover nó' })).toBeTruthy();
  });

  it('sem nó selecionado mostra uma dica', () => {
    render(<NodeInspector node={null} edges={[]} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/Selecione um nó/)).toBeTruthy();
  });

  it('nó "aplicar_condicao" mostra a descrição da condição selecionada e permite editar duração/chance', () => {
    const onChange = vi.fn();
    const node: GraphNode = { id: 'c1', type: 'aplicar_condicao', family: 'efeito', props: { conditionName: 'Queimando', rounds: 2, chance: 100 } };
    render(<NodeInspector node={node} edges={[]} onChange={onChange} onRemove={vi.fn()} />);
    expect(screen.getByText(/dano de fogo por rodada/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Duração (rodadas)'), { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith('c1', { rounds: 4 });
    fireEvent.change(screen.getByLabelText('Chance de aplicar (%)'), { target: { value: '50' } });
    expect(onChange).toHaveBeenCalledWith('c1', { chance: 50 });
  });

  it('mostra e permite editar os campos específicos da condição selecionada', () => {
    const onChange = vi.fn();
    const node: GraphNode = { id: 'c1', type: 'aplicar_condicao', family: 'efeito', props: { conditionName: 'Vulnerável', intensity: 'normal', rounds: 2, chance: 100, element: 'fogo', extraDamagePercent: 25 } };
    render(<NodeInspector node={node} edges={[]} onChange={onChange} onRemove={vi.fn()} />);
    expect(screen.getByLabelText('Elemento')).toBeTruthy();
    expect(screen.getByLabelText('Dano extra (%)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Dano extra (%)'), { target: { value: '60' } });
    expect(onChange).toHaveBeenCalledWith('c1', { extraDamagePercent: 60 });
    expect(screen.getByText(/\+25% de dano de fogo/)).toBeTruthy();
  });

  it('trocar a condição reinicia os campos específicos para o padrão da nova seleção', () => {
    const onChange = vi.fn();
    const node: GraphNode = { id: 'c1', type: 'aplicar_condicao', family: 'efeito', props: { conditionName: 'Vulnerável', intensity: 'normal', rounds: 2, chance: 100, element: 'fogo', extraDamagePercent: 90 } };
    render(<NodeInspector node={node} edges={[]} onChange={onChange} onRemove={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Condição'), { target: { value: 'Sangrando' } });
    expect(onChange).toHaveBeenCalledWith('c1', expect.objectContaining({ conditionName: 'Sangrando', damagePerRound: 2, ignoresDefense: false }));
  });

  it('trocar a intensidade recalcula os valores padrão dos campos específicos', () => {
    const onChange = vi.fn();
    const node: GraphNode = { id: 'c1', type: 'aplicar_condicao', family: 'efeito', props: { conditionName: 'Queimando', intensity: 'normal', rounds: 2, chance: 100, damagePerRound: 2 } };
    render(<NodeInspector node={node} edges={[]} onChange={onChange} onRemove={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Intensidade'), { target: { value: 'forte' } });
    expect(onChange).toHaveBeenCalledWith('c1', expect.objectContaining({ intensity: 'forte', damagePerRound: 3 }));
  });

  it('nó "modificar_valor" mostra só os campos relevantes pra operação/alvo escolhidos', () => {
    const node: GraphNode = { id: 'm1', type: 'modificar_valor', family: 'efeito', props: { name: '', target: 'dano', operation: 'somar', value: 2, rounds: 2, chance: 100, stackRule: 'renovar' } };
    render(<NodeInspector node={node} edges={[]} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByLabelText('Valor')).toBeTruthy();
    expect(screen.queryByLabelText('Dado')).toBeFalsy(); // 'somar' não usa dado
    expect(screen.getByLabelText('Filtro: elemento')).toBeTruthy(); // 'dano' aceita filtro de elemento
    expect(screen.queryByLabelText('Filtro: tipo de teste')).toBeFalsy(); // só relevante pra target 'teste'
    expect(screen.getByLabelText('Filtro: direção')).toBeTruthy(); // 'dano' aceita causado/recebido
  });

  it('nó "modificar_valor" troca os campos ao mudar para "adicionar dado" em "teste"', () => {
    const node: GraphNode = { id: 'm1', type: 'modificar_valor', family: 'efeito', props: { name: '', target: 'teste', operation: 'adicionar_dado', dice: '1d6', rounds: 2, chance: 100, stackRule: 'renovar' } };
    render(<NodeInspector node={node} edges={[]} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByLabelText('Dado')).toBeTruthy();
    expect(screen.queryByLabelText('Valor')).toBeFalsy(); // 'adicionar_dado' usa dado, não valor
    expect(screen.getByLabelText('Filtro: tipo de teste')).toBeTruthy(); // target 'teste'
    expect(screen.queryByLabelText('Filtro: direção')).toBeFalsy(); // só relevante pra dano/cura
  });

  it('nó "modificar_valor" gera a descrição automática a partir dos campos', () => {
    const node: GraphNode = { id: 'm1', type: 'modificar_valor', family: 'efeito', props: { name: '', target: 'teste', operation: 'somar', value: 2, rounds: 2, chance: 100, stackRule: 'renovar', filterTestKind: 'reacao' } };
    render(<NodeInspector node={node} edges={[]} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/Somar 2 em Teste/)).toBeTruthy();
    expect(screen.getByText(/teste de reacao/)).toBeTruthy();
  });
});
