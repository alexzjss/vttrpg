import { useCallback } from 'react';
import type { TabId } from '../../utils/atmosphere';
import { NAV_ORDER } from './navModel';

export interface UseKeyboardNav {
  handleKey: (e: KeyboardEvent) => void;
}

/**
 * Navegação só por teclado (sem UI visível):
 * - teclas 1..4 vão direto às abas (na ordem de NAV_ORDER);
 * - ArrowRight/ArrowLeft ciclam por todas as abas.
 */
export function useKeyboardNav({ activeTab, onSelect }: {
  activeTab: TabId;
  onSelect: (id: TabId) => void;
}): UseKeyboardNav {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key >= '1' && e.key <= '4') {
      const id = NAV_ORDER[Number(e.key) - 1];
      if (id) { e.preventDefault(); onSelect(id); }
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const cur = NAV_ORDER.indexOf(activeTab);
      const base = cur === -1 ? 0 : cur;
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      onSelect(NAV_ORDER[(base + delta + NAV_ORDER.length) % NAV_ORDER.length]);
    }
  }, [activeTab, onSelect]);

  return { handleKey };
}
