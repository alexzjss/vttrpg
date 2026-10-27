import type { NodeFamily } from './abilityGraph';
import type { InterpretCtx } from './abilityInterpreter';

/** Descreve um campo do painel de propriedades — o inspector (Fase 3) se gera a partir daqui. */
export interface FieldSchema {
  key: string;
  kind: 'dado' | 'numero' | 'texto' | 'elemento' | 'select' | 'toggle' | 'condicao' | 'duracao';
  label: string;
  options?: { value: string; label: string }[];
  hint?: string;
}

export interface NodeTypeDef<P = Record<string, unknown>> {
  type: string;
  family: NodeFamily;
  label: string;
  /** Subgrupo cosmético dentro da família, usado só para organizar a paleta (não afeta a interpretação). */
  category?: string;
  fields: FieldSchema[];
  defaults: () => P;
  /** efeito/alvo: muta o ctx (aplica dano, troca alvo, etc.). */
  interpret?: (props: P, ctx: InterpretCtx) => void;
  /** ramo: decide 'entao' vs 'senao'. */
  evaluate?: (props: P, ctx: InterpretCtx) => boolean;
  /** texto curto para preview/summary. */
  summarize: (props: P) => string;
}

const registry = new Map<string, NodeTypeDef>();

export function registerNodeType<P>(def: NodeTypeDef<P>): void {
  registry.set(def.type, def as NodeTypeDef);
}
export function getNodeType(type: string): NodeTypeDef | undefined {
  return registry.get(type);
}
export function listNodeTypes(family?: NodeFamily): NodeTypeDef[] {
  const all = [...registry.values()];
  return family ? all.filter(def => def.family === family) : all;
}
/** Apenas para testes: limpa o registro global. */
export function _resetRegistry(): void {
  registry.clear();
}
