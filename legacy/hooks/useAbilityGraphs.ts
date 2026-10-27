import { useCallback, useEffect, useState } from 'react';
import { DatabaseService } from '../utils/database';
import type { AbilityGraph } from '../utils/abilityGraph';

export interface AbilityGraphStoreHook {
  graphs: AbilityGraph[];
  loading: boolean;
  error: string | null;
  save: (graph: AbilityGraph) => Promise<void>;
  remove: (id: string) => Promise<void>;
  find: (id: string) => AbilityGraph | undefined;
}

/** Espelha useArsenal.ts, mas para as habilidades/formas do novo sistema de grafo. */
export function useAbilityGraphs(): AbilityGraphStoreHook {
  const [graphs, setGraphs] = useState<AbilityGraph[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => DatabaseService.syncAbilityGraphs(next => {
    setGraphs(next);
    setLoading(false);
  }), []);

  const save = useCallback(async (graph: AbilityGraph) => {
    setError(null);
    try { await DatabaseService.saveAbilityGraph(graph); }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Não foi possível salvar a habilidade';
      setError(message);
      throw reason;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setError(null);
    try { await DatabaseService.deleteAbilityGraph(id); }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Não foi possível remover a habilidade';
      setError(message);
      throw reason;
    }
  }, []);

  const find = useCallback((id: string) => graphs.find(graph => graph.id === id), [graphs]);
  return { graphs, loading, error, save, remove, find };
}
