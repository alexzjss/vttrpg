import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import LogPanel from './LogPanel';
import type { CenaLogEntry } from '../../utils/cena';

afterEach(() => cleanup());

const log: CenaLogEntry[] = [{ id: '1', kind: 'system', text: 'A aventura começa', timestamp: 1 }];

describe('LogPanel', () => {
  it('mostra as entradas do log', () => {
    render(<LogPanel log={log} notes="" onNotesChange={() => {}} />);
    expect(screen.getByText('A aventura começa')).toBeTruthy();
  });
  it('mostra vazio quando não há log', () => {
    render(<LogPanel log={[]} notes="" onNotesChange={() => {}} />);
    expect(screen.getByText(/nada aconteceu ainda/i)).toBeTruthy();
  });
  it('troca para Notas e edita', () => {
    const onNotesChange = vi.fn();
    render(<LogPanel log={log} notes="velho" onNotesChange={onNotesChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /notas/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'novo' } });
    expect(onNotesChange).toHaveBeenCalledWith('novo');
  });

  it('mostra a comparação estruturada de uma rolagem', () => {
    const compared: CenaLogEntry = {
      id: 'roll-1', kind: 'roll', text: 'Lina ataca Ogro.', timestamp: 2,
      roll: { notation: '1d20+2', total: 15, individualRolls: [13], numSides: 20, bonus: 2, actorLabel: 'Lina', targetLabel: 'Ogro', targetValue: 12, success: true },
    };
    render(<LogPanel log={[compared]} notes="" onNotesChange={() => {}} />);
    expect(screen.getByText('Lina × Ogro')).toBeTruthy();
    expect(screen.getByText('VS')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('oculta uma rolagem pendente até sua revelação', () => {
    render(<LogPanel log={[{ id: 'segredo', kind: 'roll', text: 'Resultado oculto', timestamp: 3 }]} hiddenEntryIds={['segredo']} notes="" onNotesChange={() => {}} />);
    expect(screen.queryByText('Resultado oculto')).toBeNull();
  });

  it('mostra duração e valor estruturados dos efeitos', () => {
    render(<LogPanel log={[{
      id: 'effect', kind: 'condition', text: 'Ogro recebe Queimadura.', timestamp: 4,
      details: { targetLabel: 'Ogro', sourceLabel: 'Queimadura', amount: 3, resource: 'HP', durationLabel: '2 rodadas' },
    }]} notes="" onNotesChange={() => {}} />);
    expect(screen.getByText('3 HP')).toBeTruthy();
    expect(screen.getByText('duração: 2 rodadas')).toBeTruthy();
  });
});
