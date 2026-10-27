import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardNav } from './useKeyboardNav';

function setup(activeTab = 'cena') {
  const onSelect = vi.fn();
  const view = renderHook(
    ({ tab }) => useKeyboardNav({ activeTab: tab as any, onSelect }),
    { initialProps: { tab: activeTab } },
  );
  return { onSelect, ...view };
}

describe('useKeyboardNav', () => {
  it('"1" vai direto para cena', () => {
    const { result, onSelect } = setup('cena');
    act(() => result.current.handleKey({ key: '1', preventDefault() {} } as any));
    expect(onSelect).toHaveBeenCalledWith('cena');
  });

  it('"2" não corresponde a nenhum destino (não chama onSelect)', () => {
    const { result, onSelect } = setup('cena');
    act(() => result.current.handleKey({ key: '2', preventDefault() {} } as any));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ArrowRight com um único destino permanece em cena', () => {
    const { result, onSelect } = setup('cena');
    act(() => result.current.handleKey({ key: 'ArrowRight', preventDefault() {} } as any));
    expect(onSelect).toHaveBeenCalledWith('cena');
  });

  it('ArrowLeft com um único destino permanece em cena', () => {
    const { result, onSelect } = setup('cena');
    act(() => result.current.handleKey({ key: 'ArrowLeft', preventDefault() {} } as any));
    expect(onSelect).toHaveBeenCalledWith('cena');
  });
});
