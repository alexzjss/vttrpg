import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { _resetRegistry } from '../../../utils/nodeRegistry';
import { ensureNodesRegistered } from '../../../utils/nodes';
import { createAbilityGraph, type AbilityGraph } from '../../../utils/abilityGraph';
import GraphEditor from './GraphEditor';

function graphAtaque(): AbilityGraph {
  return {
    ...createAbilityGraph({ id: 'g', name: 'Golpe' }),
    nodes: [
      { id: 'gatilho', type: 'ao_ativar', family: 'gatilho', props: {} },
      { id: 'dano', type: 'dano', family: 'efeito', props: { dice: '1d6', flat: 0, element: 'fisico' } },
    ],
    edges: [{ id: 'e1', from: 'gatilho', to: 'dano' }],
  };
}

describe('GraphEditor', () => {
  beforeEach(() => { _resetRegistry(); ensureNodesRegistered(); });

  it('renderiza o nome no cabeçalho e o grafo no canvas', () => {
    render(<GraphEditor initial={graphAtaque()} onSave={vi.fn()} onClose={vi.fn()} />);
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Golpe');
    expect(screen.getByTestId('graph-node-dano')).toBeTruthy();
  });

  it('editar o nome e salvar chama onSave com o header atualizado', () => {
    const onSave = vi.fn();
    render(<GraphEditor initial={graphAtaque()} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Golpe Solar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSave.mock.calls[0][0].header.name).toBe('Golpe Solar');
  });

  it('selecionar um nó mostra suas propriedades no inspector', () => {
    render(<GraphEditor initial={graphAtaque()} onSave={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('graph-node-dano'));
    expect((screen.getByLabelText('Fixo') as HTMLInputElement).value).toBe('0');
  });

  it('editar uma propriedade no inspector e salvar reflete no grafo salvo', () => {
    const onSave = vi.fn();
    render(<GraphEditor initial={graphAtaque()} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('graph-node-dano'));
    fireEvent.change(screen.getByLabelText('Fixo'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const saved = onSave.mock.calls[0][0] as AbilityGraph;
    expect(saved.nodes.find(n => n.id === 'dano')!.props.flat).toBe(4);
  });

  it('adicionar um nó pelo "+" e pela paleta conecta o novo nó', () => {
    const onSave = vi.fn();
    render(<GraphEditor initial={graphAtaque()} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('graph-node-dano-connect'));
    fireEvent.click(screen.getByRole('button', { name: 'Roubo de vida' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const saved = onSave.mock.calls[0][0] as AbilityGraph;
    const newNode = saved.nodes.find(n => n.type === 'roubo_vida')!;
    expect(saved.edges.some(e => e.from === 'dano' && e.to === newNode.id)).toBe(true);
  });

  it('editar em nível 2 cria um override em vez de mudar o nível 1', () => {
    const onSave = vi.fn();
    render(<GraphEditor initial={graphAtaque()} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar nivel' }));
    fireEvent.click(screen.getByTestId('graph-node-dano'));
    fireEvent.change(screen.getByLabelText('Fixo'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const saved = onSave.mock.calls[0][0] as AbilityGraph;
    expect(saved.nodes.find(n => n.id === 'dano')!.props.flat).toBe(0); // nível 1 intocado
    expect(saved.levelProfiles).toContainEqual({ level: 2, overrides: [{ nodeId: 'dano', field: 'flat', value: 9 }] });
  });

  it('aba Simulador roda a simulação', () => {
    render(<GraphEditor initial={graphAtaque()} onSave={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Simulador' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simular' }));
    expect(screen.getByText(/de dano em/)).toBeTruthy();
  });

  it('carregar um template preserva o id original da habilidade (não adota o id fixo do template)', () => {
    const onSave = vi.fn();
    render(<GraphEditor initial={createAbilityGraph({ id: 'minha-habilidade-unica', name: 'Golpe' })} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Criar habilidade/ }));
    fireEvent.click(screen.getByText('Ataque').closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: 'Criar no grafo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const saved = onSave.mock.calls[0][0] as AbilityGraph;
    expect(saved.id).toBe('minha-habilidade-unica');
  });

  it('carregar um template com grafo já editado pede confirmação antes de substituir', () => {
    const onSave = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<GraphEditor initial={graphAtaque()} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Criar habilidade/ }));
    fireEvent.click(screen.getByText('Ataque').closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: 'Criar no grafo' }));
    expect(confirmSpy).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // cancelado: grafo original (com o nó "dano" já existente) continua intacto
    expect(onSave.mock.calls[0][0].nodes.some((n: { id: string }) => n.id === 'dano')).toBe(true);
    confirmSpy.mockRestore();
  });

  it('Fechar chama onClose', () => {
    const onClose = vi.fn();
    render(<GraphEditor initial={graphAtaque()} onSave={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalled();
  });

  describe('propriedades avançadas do cabeçalho', () => {
    it('não mostra mais os campos removidos (Ativação/Economia/Forma/Proteção/Custo/Combo/Preparação)', () => {
      render(<GraphEditor initial={graphAtaque()} onSave={vi.fn()} onClose={vi.fn()} />);
      expect(screen.queryByLabelText('Ativação')).toBeFalsy();
      expect(screen.queryByLabelText('Economia de ação')).toBeFalsy();
      expect(screen.queryByLabelText('É uma Forma')).toBeFalsy();
      expect(screen.queryByLabelText('Oferece como proteção reativa')).toBeFalsy();
      expect(screen.queryByLabelText('Custo de aura')).toBeFalsy();
      expect(screen.queryByLabelText('Custo de munição')).toBeFalsy();
      expect(screen.queryByLabelText('Combinável em combo')).toBeFalsy();
      expect(screen.queryByLabelText('Tipo de preparação')).toBeFalsy();
    });

    it('adicionar um nó "Cooldown" conectado ao gatilho', () => {
      const onSave = vi.fn();
      render(<GraphEditor initial={graphAtaque()} onSave={onSave} onClose={vi.fn()} />);
      fireEvent.click(screen.getByTestId('graph-node-gatilho'));
      fireEvent.click(screen.getByRole('button', { name: 'Cooldown' }));
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      const saved = onSave.mock.calls[0][0] as AbilityGraph;
      expect(saved.nodes.some(n => n.type === 'cooldown')).toBe(true);
    });

    it('adicionar um nó "Preparação" conectado ao gatilho', () => {
      const onSave = vi.fn();
      render(<GraphEditor initial={graphAtaque()} onSave={onSave} onClose={vi.fn()} />);
      fireEvent.click(screen.getByTestId('graph-node-gatilho'));
      fireEvent.click(screen.getByRole('button', { name: 'Preparação' }));
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      const saved = onSave.mock.calls[0][0] as AbilityGraph;
      expect(saved.nodes.some(n => n.type === 'preparacao')).toBe(true);
    });

    it('clicar em um gatilho da paleta troca a raiz do grafo', () => {
      const onSave = vi.fn();
      render(<GraphEditor initial={graphAtaque()} onSave={onSave} onClose={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Quando alvejado' }));
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      const saved = onSave.mock.calls[0][0] as AbilityGraph;
      expect(saved.nodes.find(n => n.family === 'gatilho')!.type).toBe('ao_ser_alvejado');
    });

    it('clicar em "Em combo" na paleta anexa a raiz secundária sem substituir a primária', () => {
      const onSave = vi.fn();
      render(<GraphEditor initial={graphAtaque()} onSave={onSave} onClose={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Em combo' }));
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      const saved = onSave.mock.calls[0][0] as AbilityGraph;
      const roots = saved.nodes.filter(n => n.family === 'gatilho');
      expect(roots.map(n => n.type).sort()).toEqual(['ao_ativar', 'em_combo']);
    });

    it('adicionar um nó "Custo de recurso" conectado ao gatilho', () => {
      const onSave = vi.fn();
      render(<GraphEditor initial={graphAtaque()} onSave={onSave} onClose={vi.fn()} />);
      fireEvent.click(screen.getByTestId('graph-node-gatilho-connect'));
      fireEvent.click(screen.getByRole('button', { name: 'Custo de recurso' }));
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      const saved = onSave.mock.calls[0][0] as AbilityGraph;
      expect(saved.nodes.some(n => n.type === 'custo')).toBe(true);
    });
  });
});
