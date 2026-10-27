import type { Element } from '../types';
import type {
  TargetConfig, AreaConfig, ChargeConfig,
  ArsenalVisibility, ArsenalTag,
} from './arsenal';
import { getNodeType, type FieldSchema } from './nodeRegistry';

export type NodeFamily = 'gatilho' | 'ramo' | 'alvo' | 'efeito';

export interface GraphNode {
  id: string;
  type: string;                 // chave no nodeRegistry
  family: NodeFamily;
  props: Record<string, unknown>;
  position?: { x: number; y: number };
  /** Nó só entra no grafo mesclado a partir deste nível (progressão). Ausente = nível 1. */
  enabledFromLevel?: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  /** Só em arestas que saem de um nó 'ramo'. Ausente = fluxo simples. */
  branch?: 'entao' | 'senao';
}

export interface AbilityHeader {
  name: string;
  description: string;
  icon: string;
  iconPosition?: string;
  artLayout?: 'horizontal' | 'full';
  element: Element | null;
  tags: ArsenalTag[];
  visibility: ArsenalVisibility;
  target: TargetConfig;
  area: AreaConfig | null;
  charges: ChargeConfig | null;
  /** Só fica disponível enquanto uma das armas/formas listadas estiver equipada/ativa (mesma semântica de
   *  ArsenalCard.weaponLinks/formLinks). Ausente/vazio = sempre disponível, independente de equipamento. */
  weaponLinks?: string[];
  formLinks?: string[];
}

export interface NodeFieldOverride { nodeId: string; field: string; value: unknown }
export interface LevelProfile { level: number; overrides: NodeFieldOverride[]; }

export interface AbilityGraph {
  kind: 'graph';
  schemaVersion: 2;
  id: string;
  header: AbilityHeader;
  nodes: GraphNode[];
  edges: GraphEdge[];
  levelProfiles: LevelProfile[];
  metadata?: Record<string, unknown>;
}

export function createAbilityGraph(
  input: { id: string; name: string } & Partial<AbilityHeader>,
): AbilityGraph {
  const { id, name, ...header } = input;
  return {
    kind: 'graph',
    schemaVersion: 2,
    id,
    header: {
      name,
      description: '',
      icon: '',
      element: null,
      tags: [],
      visibility: 'publica',
      target: { type: 'um_alvo' },
      area: null,
      charges: null,
      ...header,
    },
    nodes: [{ id: `gatilho-${id}`, type: 'ao_ativar', family: 'gatilho', props: {} }],
    edges: [],
    levelProfiles: [],
  };
}

/** Um override de nível é aplicado quando: o nó existe no grafo mesclado, e — se o tipo do nó declara
 *  esse campo no seu FieldSchema — o valor bate com o tipo esperado pelo `kind` do campo. Campos que não
 *  aparecem em `fields` (ex.: os específicos de cada condição em 'aplicar_condicao', dinâmicos por
 *  seleção) passam sem checagem de tipo, só a existência do nó é exigida. */
function overrideMatchesSchema(schema: FieldSchema | undefined, value: unknown): boolean {
  if (!schema) return true;
  switch (schema.kind) {
    case 'numero': return typeof value === 'number';
    case 'toggle': return typeof value === 'boolean';
    case 'texto': case 'select': case 'elemento': case 'dado': return value === null || typeof value === 'string';
    default: return true;
  }
}

/** Grafo efetivo no nível pedido: filtra nós por enabledFromLevel e aplica overrides acumulados até o
 *  nível — ignorando (sem quebrar) overrides que referenciam um nó inexistente ou um valor cujo tipo não
 *  bate com o campo declarado, em vez de gravar um prop inválido que só quebraria depois, na interpretação. */
export function mergeLevel(graph: AbilityGraph, level: number): AbilityGraph {
  const nodes = graph.nodes
    .filter(node => (node.enabledFromLevel ?? 1) <= level)
    .map(node => ({ ...node, props: { ...node.props } }));
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (const profile of [...graph.levelProfiles].sort((a, b) => a.level - b.level)) {
    if (profile.level > level) break;
    for (const override of profile.overrides) {
      const node = byId.get(override.nodeId);
      if (!node) continue;
      const schema = getNodeType(node.type)?.fields.find(field => field.key === override.field);
      if (!overrideMatchesSchema(schema, override.value)) continue;
      node.props[override.field] = override.value;
    }
  }
  return { ...graph, nodes };
}
