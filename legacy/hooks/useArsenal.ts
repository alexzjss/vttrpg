import { useCallback, useEffect, useMemo, useState } from 'react';
import { DatabaseService } from '../utils/database';
import type { ArsenalCard, ArsenalCategory } from '../utils/arsenal';

export interface ArsenalStoreHook {
  cards: ArsenalCard[];
  loading: boolean;
  error: string | null;
  byCategory: Record<ArsenalCategory, ArsenalCard[]>;
  save: (card: ArsenalCard) => Promise<void>;
  remove: (id: string) => Promise<void>;
  find: (id: string) => ArsenalCard | undefined;
}

/** Ponto de conexão da futura UI unificada; não depende de modal. */
export function useArsenal(): ArsenalStoreHook {
  const [cards, setCards] = useState<ArsenalCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => DatabaseService.syncArsenalCards(next => {
    setCards(next);
    setLoading(false);
  }), []);

  const byCategory = useMemo<Record<ArsenalCategory, ArsenalCard[]>>(() => ({
    habilidade: cards.filter(card => card.category === 'habilidade'),
    selo: cards.filter(card => card.category === 'selo'),
    item: cards.filter(card => card.category === 'item'),
    arma: cards.filter(card => card.category === 'arma'),
  }), [cards]);

  const save = useCallback(async (card: ArsenalCard) => {
    setError(null);
    try { await DatabaseService.saveArsenalCard(card); }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Não foi possível salvar a carta';
      setError(message);
      throw reason;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setError(null);
    try { await DatabaseService.deleteArsenalCard(id); }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Não foi possível remover a carta';
      setError(message);
      throw reason;
    }
  }, []);

  const find = useCallback((id: string) => cards.find(card => card.id === id), [cards]);
  return { cards, loading, error, byCategory, save, remove, find };
}

