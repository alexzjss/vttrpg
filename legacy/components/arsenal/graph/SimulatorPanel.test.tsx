import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { _resetRegistry } from '../../../utils/nodeRegistry';
import { ensureNodesRegistered } from '../../../utils/nodes';
import { createAbilityGraph, type AbilityGraph } from '../../../utils/abilityGraph';
import SimulatorPanel from './SimulatorPanel';

function graphDano(): AbilityGraph {
  return {
    ...createAbilityGraph({ id: 'g', name: 'Bola de Fogo', element: 'fogo' }),
    nodes: [
      { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
      { id: 'd', type: 'dano', family: 'efeito', props: { dice: '2d6', flat: 0, element: 'fogo' } },
    ],
    edges: [{ id: 'e1', from: 'g', to: 'd' }],
  };
}

describe('SimulatorPanel', () => {
  beforeEach(() => { _resetRegistry(); ensureNodesRegistered(); });

  it('mostra o botão Simular antes de rodar', () => {
    render(<SimulatorPanel graph={graphDano()} level={1} />);
    expect(screen.getByRole('button', { name: 'Simular' })).toBeTruthy();
  });

  it('ao clicar em Simular, mostra o trace e o resumo de HP', () => {
    render(<SimulatorPanel graph={graphDano()} level={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Simular' }));
    expect(screen.getByText(/de dano em/)).toBeTruthy();
    expect(screen.getByText(/HP:/)).toBeTruthy();
  });
});
