import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  getConditionFx, dedupeConditions, CONDITION_FX, DEFAULT_FX,
  ConditionEffectOverlay, ConditionBadgeRow,
} from './ConditionEffects';

afterEach(() => cleanup());

describe('getConditionFx', () => {
  it('retorna a definição mapeada para uma condição conhecida', () => {
    expect(getConditionFx('Queimando')).toEqual(CONDITION_FX['Queimando']);
  });

  it('retorna DEFAULT_FX para uma condição desconhecida sem lançar erro', () => {
    expect(() => getConditionFx('Condição Inventada XYZ')).not.toThrow();
    expect(getConditionFx('Condição Inventada XYZ')).toEqual(DEFAULT_FX);
  });
});

describe('dedupeConditions', () => {
  it('mantém uma única entrada por nome, com a maior duração', () => {
    const result = dedupeConditions([
      { name: 'Queimando', duration: 1 },
      { name: 'Queimando', duration: 3 },
      { name: 'Molhado', duration: 2 },
    ]);
    expect(result).toHaveLength(2);
    const burning = result.find(c => c.name === 'Queimando');
    expect(burning?.duration).toBe(3);
  });

  it('lista vazia retorna lista vazia', () => {
    expect(dedupeConditions([])).toEqual([]);
  });
});

describe('ConditionEffectOverlay', () => {
  it('não renderiza nada quando não há condições', () => {
    const { container } = render(<ConditionEffectOverlay conditions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza uma camada por condição única, respeitando dedupe', () => {
    render(<ConditionEffectOverlay conditions={[
      { name: 'Queimando', duration: 1 },
      { name: 'Queimando', duration: 2 },
      { name: 'Molhado', duration: 3 },
    ]} />);
    expect(screen.getByTestId('condition-fx-Queimando')).toBeTruthy();
    expect(screen.getByTestId('condition-fx-Molhado')).toBeTruthy();
  });

  it('limita a maxLayers camadas simultâneas mesmo com mais condições ativas', () => {
    render(<ConditionEffectOverlay maxLayers={2} conditions={[
      { name: 'Queimando', duration: 1 },
      { name: 'Molhado', duration: 1 },
      { name: 'Confuso', duration: 1 },
    ]} />);
    const overlay = screen.getByTestId('condition-overlay');
    expect(overlay.querySelectorAll('.mp-cond-fx')).toHaveLength(2);
  });
});

describe('ConditionBadgeRow', () => {
  it('não renderiza nada quando não há condições', () => {
    const { container } = render(<ConditionBadgeRow conditions={[]} maxVisible={5} />);
    expect(container.firstChild).toBeNull();
  });

  it('mostra um selo por condição única até maxVisible', () => {
    render(<ConditionBadgeRow maxVisible={5} conditions={[
      { name: 'Queimando', duration: 2 },
      { name: 'Molhado', duration: 2 },
    ]} />);
    const row = screen.getByTestId('condition-badges');
    expect(row.querySelectorAll('.mp-cond-badge')).toHaveLength(2);
  });

  it('agrupa o excedente além de maxVisible num selo +N', () => {
    render(<ConditionBadgeRow maxVisible={2} conditions={[
      { name: 'Queimando', duration: 1 },
      { name: 'Molhado', duration: 1 },
      { name: 'Confuso', duration: 1 },
      { name: 'Cego', duration: 1 },
    ]} />);
    const row = screen.getByTestId('condition-badges');
    expect(row.querySelectorAll('.mp-cond-badge--overflow')).toHaveLength(1);
    expect(screen.getByText('+2')).toBeTruthy();
  });
});
