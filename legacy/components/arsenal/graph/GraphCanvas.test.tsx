import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { _resetRegistry } from '../../../utils/nodeRegistry';
import { ensureNodesRegistered } from '../../../utils/nodes';
import { createAbilityGraph, type AbilityGraph } from '../../../utils/abilityGraph';
import GraphCanvas from './GraphCanvas';

function graphWithBranch(): AbilityGraph {
  return {
    ...createAbilityGraph({ id: 'g', name: 'X' }),
    nodes: [
      { id: 'gatilho', type: 'ao_ativar', family: 'gatilho', props: {} },
      { id: 'ramo', type: 'se_aura_minima', family: 'ramo', props: { amount: 3 } },
      { id: 'dano', type: 'dano', family: 'efeito', props: { dice: '1d6', flat: 0, element: null } },
    ],
    edges: [{ id: 'e1', from: 'gatilho', to: 'ramo' }, { id: 'e2', from: 'ramo', to: 'dano', branch: 'entao' }],
  };
}

describe('GraphCanvas', () => {
  beforeEach(() => { _resetRegistry(); ensureNodesRegistered(); });

  it('renderiza um nó por node e uma linha por edge', () => {
    const graph = graphWithBranch();
    const { container } = render(
      <GraphCanvas graph={graph} selectedNodeId={null} onSelect={vi.fn()} onMove={vi.fn()} onRequestConnect={vi.fn()} />,
    );
    expect(screen.getByText('Quando a habilidade é usada')).toBeTruthy();
    expect(screen.getByText(/Se aura/)).toBeTruthy();
    expect(screen.getByTestId('graph-edges').querySelectorAll('path').length).toBe(2);
  });

  it('clicar num nó chama onSelect com o id', () => {
    const onSelect = vi.fn();
    render(<GraphCanvas graph={graphWithBranch()} selectedNodeId={null} onSelect={onSelect} onMove={vi.fn()} onRequestConnect={vi.fn()} />);
    fireEvent.click(screen.getByTestId('graph-node-dano'));
    expect(onSelect).toHaveBeenCalledWith('dano');
  });

  it('clicar no corpo de um nó comum já arma a conexão, sem precisar do botão "+"', () => {
    const onRequestConnect = vi.fn();
    render(<GraphCanvas graph={graphWithBranch()} selectedNodeId={null} onSelect={vi.fn()} onMove={vi.fn()} onRequestConnect={onRequestConnect} />);
    fireEvent.click(screen.getByTestId('graph-node-dano'));
    expect(onRequestConnect).toHaveBeenCalledWith('dano', undefined);
  });

  it('clicar no corpo de um nó ramo NÃO arma conexão (exige os botões ENTÃO/SENÃO)', () => {
    const onRequestConnect = vi.fn();
    render(<GraphCanvas graph={graphWithBranch()} selectedNodeId={null} onSelect={vi.fn()} onMove={vi.fn()} onRequestConnect={onRequestConnect} />);
    fireEvent.click(screen.getByTestId('graph-node-ramo'));
    expect(onRequestConnect).not.toHaveBeenCalled();
  });

  it('nó comum tem um botão "+" que chama onRequestConnect sem branch', () => {
    const onRequestConnect = vi.fn();
    render(<GraphCanvas graph={graphWithBranch()} selectedNodeId={null} onSelect={vi.fn()} onMove={vi.fn()} onRequestConnect={onRequestConnect} />);
    fireEvent.click(screen.getByTestId('graph-node-dano-connect'));
    expect(onRequestConnect).toHaveBeenCalledWith('dano', undefined);
  });

  it('nó ramo tem dois botões "+" para SE e SENÃO', () => {
    const onRequestConnect = vi.fn();
    render(<GraphCanvas graph={graphWithBranch()} selectedNodeId={null} onSelect={vi.fn()} onMove={vi.fn()} onRequestConnect={onRequestConnect} />);
    fireEvent.click(screen.getByTestId('graph-node-ramo-connect-entao'));
    expect(onRequestConnect).toHaveBeenCalledWith('ramo', 'entao');
    fireEvent.click(screen.getByTestId('graph-node-ramo-connect-senao'));
    expect(onRequestConnect).toHaveBeenCalledWith('ramo', 'senao');
  });

  it('nó com issue de erro mostra um indicador visual; nó sem issue não mostra', () => {
    render(<GraphCanvas graph={graphWithBranch()} selectedNodeId={null}
      issues={[{ severity: 'erro', message: 'problema no dano', nodeId: 'dano' }]}
      onSelect={vi.fn()} onMove={vi.fn()} onRequestConnect={vi.fn()} />);
    expect(screen.getByTestId('graph-node-dano-issue')).toBeTruthy();
    expect(screen.queryByTestId('graph-node-ramo-issue')).toBeFalsy();
  });

  it('arrastar um nó chama onMove com a nova posição', () => {
    const onMove = vi.fn();
    render(<GraphCanvas graph={graphWithBranch()} selectedNodeId={null} onSelect={vi.fn()} onMove={onMove} onRequestConnect={vi.fn()} />);
    const nodeEl = screen.getByTestId('graph-node-dano');
    fireEvent.mouseDown(nodeEl, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 130, clientY: 140 });
    fireEvent.mouseUp(window);
    expect(onMove).toHaveBeenCalled();
    const [nodeId, position] = onMove.mock.calls[0];
    expect(nodeId).toBe('dano');
    expect(position.x).toBeGreaterThan(0);
  });

  it('arrastar o fundo move a visao do canvas sem mover nos', () => {
    const onMove = vi.fn();
    render(<GraphCanvas graph={graphWithBranch()} selectedNodeId={null} onSelect={vi.fn()} onMove={onMove} onRequestConnect={vi.fn()} />);
    const canvas = screen.getByTestId('graph-canvas');
    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.mouseMove(window, { clientX: 150, clientY: 130 });
    fireEvent.mouseUp(window);
    expect(onMove).not.toHaveBeenCalled();
    expect(canvas.innerHTML).toContain('translate(90px, 60px)');
  });
});
