import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry } from './nodeRegistry';
import { ensureNodesRegistered } from './nodes';
import { createAbilityGraph } from './abilityGraph';
import { addNode, removeNode, updateNodeProps, moveNode, setLevelOverride, setRootTrigger, addSecondaryTrigger, ensureStandardCards, ensureStandardCardsOnAllTriggers } from './abilityGraphEdit';

describe('abilityGraphEdit', () => {
  beforeEach(() => { _resetRegistry(); ensureNodesRegistered(); });

  it('addNode cria um nó com defaults do registro e conecta ao pai', () => {
    const base = createAbilityGraph({ id: 'a', name: 'X' });
    const rootId = base.nodes[0].id;
    const { graph, nodeId } = addNode(base, rootId, 'dano');
    const node = graph.nodes.find(n => n.id === nodeId)!;
    expect(node.type).toBe('dano');
    expect(node.props).toEqual({ dice: '1d6', flat: 0, element: null, perfurante: false, hits: 1 });
    expect(graph.edges).toContainEqual({ id: expect.any(String), from: rootId, to: nodeId });
  });

  it('addNode com branch conecta como SE/SENÃO de um ramo', () => {
    const base = createAbilityGraph({ id: 'a', name: 'X' });
    const rootId = base.nodes[0].id;
    const { graph: g1, nodeId: ramoId } = addNode(base, rootId, 'ramo');
    const { graph: g2, nodeId: danoId } = addNode(g1, ramoId, 'dano', 'entao');
    const edge = g2.edges.find(e => e.to === danoId)!;
    expect(edge.from).toBe(ramoId);
    expect(edge.branch).toBe('entao');
  });

  it('removeNode remove o nó e sua subárvore, mas não a raiz de fato do grafo (sem pais)', () => {
    const base = createAbilityGraph({ id: 'a', name: 'X' });
    const rootId = base.nodes[0].id;
    const { graph: g1, nodeId: n1 } = addNode(base, rootId, 'dano');
    const { graph: g2, nodeId: n2 } = addNode(g1, n1, 'cura');
    const g3 = removeNode(g2, n1);
    expect(g3.nodes.some(n => n.id === n1)).toBe(false);
    expect(g3.nodes.some(n => n.id === n2)).toBe(false);
    expect(g3.edges).toEqual([]);

    const g4 = removeNode(g3, rootId);
    expect(g4.nodes.some(n => n.id === rootId)).toBe(true); // raiz de fato preservada (no-op)
  });

  it('removeNode permite remover um trigger secundário conectado como filho de outro nó', () => {
    const base = createAbilityGraph({ id: 'a', name: 'X' });
    const rootId = base.nodes[0].id;
    const { graph, nodeId: enquantoId } = addNode(base, rootId, 'enquanto_ativa');
    const next = removeNode(graph, enquantoId);
    expect(next.nodes.some(n => n.id === enquantoId)).toBe(false);
  });

  it('removeNode permite remover uma raiz secundária solta (sem pais, mas não a única raiz)', () => {
    const base = createAbilityGraph({ id: 'a', name: 'X' });
    const withSecondary = addSecondaryTrigger(base, 'em_combo');
    const secondaryId = withSecondary.nodes.find(n => n.type === 'em_combo')!.id;
    const next = removeNode(withSecondary, secondaryId);
    expect(next.nodes.some(n => n.id === secondaryId)).toBe(false);
    expect(next.nodes.some(n => n.type === 'ao_ativar')).toBe(true); // a raiz principal continua lá
  });

  it('updateNodeProps mescla o patch nas props do nó', () => {
    const base = createAbilityGraph({ id: 'a', name: 'X' });
    const rootId = base.nodes[0].id;
    const { graph, nodeId } = addNode(base, rootId, 'dano');
    const updated = updateNodeProps(graph, nodeId, { flat: 5 });
    const node = updated.nodes.find(n => n.id === nodeId)!;
    expect(node.props).toEqual({ dice: '1d6', flat: 5, element: null, perfurante: false, hits: 1 });
  });

  it('moveNode atualiza a posição do nó', () => {
    const base = createAbilityGraph({ id: 'a', name: 'X' });
    const rootId = base.nodes[0].id;
    const { graph, nodeId } = addNode(base, rootId, 'dano');
    const moved = moveNode(graph, nodeId, { x: 40, y: 120 });
    expect(moved.nodes.find(n => n.id === nodeId)!.position).toEqual({ x: 40, y: 120 });
  });

  it('setLevelOverride cria e depois atualiza a entrada do nível', () => {
    const base = createAbilityGraph({ id: 'a', name: 'X' });
    const rootId = base.nodes[0].id;
    const { graph, nodeId } = addNode(base, rootId, 'dano');
    const g1 = setLevelOverride(graph, 2, nodeId, 'flat', 3);
    expect(g1.levelProfiles).toEqual([{ level: 2, overrides: [{ nodeId, field: 'flat', value: 3 }] }]);
    const g2 = setLevelOverride(g1, 2, nodeId, 'flat', 7);
    expect(g2.levelProfiles).toEqual([{ level: 2, overrides: [{ nodeId, field: 'flat', value: 7 }] }]);
  });

  it('setRootTrigger troca o tipo do nó raiz existente sem duplicar', () => {
    const base = createAbilityGraph({ id: 'a1', name: 'X' });
    const rootId = base.nodes[0].id;
    const next = setRootTrigger(base, 'ao_ser_alvejado');
    expect(next.nodes).toHaveLength(1);
    expect(next.nodes[0].id).toBe(rootId);
    expect(next.nodes[0].type).toBe('ao_ser_alvejado');
    expect(next.nodes[0].props).toEqual({});
  });

  it('setRootTrigger preserva os filhos conectados à raiz', () => {
    const base = createAbilityGraph({ id: 'a1', name: 'X' });
    const rootId = base.nodes[0].id;
    const { graph } = addNode(base, rootId, 'dano');
    const next = setRootTrigger(graph, 'ao_ser_alvejado');
    expect(next.edges).toHaveLength(1);
    expect(next.edges[0].from).toBe(rootId);
  });

  describe('ensureStandardCards', () => {
    it('conecta um nó "alvo" (scope alvo_da_habilidade) direto no gatilho sem filhos', () => {
      const base = createAbilityGraph({ id: 'a1', name: 'X' });
      const rootId = base.nodes[0].id;
      const next = ensureStandardCards(base, rootId);
      const edge = next.edges.find(e => e.from === rootId)!;
      const alvoNode = next.nodes.find(n => n.id === edge.to)!;
      expect(alvoNode.type).toBe('alvo');
      expect(alvoNode.props).toEqual(expect.objectContaining({ scope: 'alvo_da_habilidade' }));
    });

    it('deixa um nó "teste" solto (sem aresta nenhuma) disponível pra conectar depois', () => {
      const base = createAbilityGraph({ id: 'a1', name: 'X' });
      const rootId = base.nodes[0].id;
      const next = ensureStandardCards(base, rootId);
      const testeNode = next.nodes.find(n => n.type === 'teste')!;
      expect(testeNode).toBeDefined();
      expect(next.edges.some(e => e.to === testeNode.id || e.from === testeNode.id)).toBe(false);
    });

    it('quando o gatilho já tem filhos conectados, insere o alvo ENTRE o gatilho e os filhos existentes (rewiring)', () => {
      const base = createAbilityGraph({ id: 'a1', name: 'X' });
      const rootId = base.nodes[0].id;
      const { graph, nodeId: danoId } = addNode(base, rootId, 'dano');
      const next = ensureStandardCards(graph, rootId);
      const rootEdge = next.edges.find(e => e.from === rootId)!;
      const alvoNode = next.nodes.find(n => n.id === rootEdge.to)!;
      expect(alvoNode.type).toBe('alvo');
      const alvoToDano = next.edges.find(e => e.from === alvoNode.id);
      expect(alvoToDano?.to).toBe(danoId);
    });

    it('não duplica o alvo se o gatilho já tiver um filho direto do tipo alvo', () => {
      const base = createAbilityGraph({ id: 'a1', name: 'X' });
      const rootId = base.nodes[0].id;
      const { graph } = addNode(base, rootId, 'alvo');
      const next = ensureStandardCards(graph, rootId);
      expect(next.nodes.filter(n => n.type === 'alvo')).toHaveLength(1);
    });

    it('não duplica o teste se o gatilho já tiver um teste alcançável na subárvore', () => {
      const base = createAbilityGraph({ id: 'a1', name: 'X' });
      const rootId = base.nodes[0].id;
      const { graph } = addNode(base, rootId, 'teste');
      const next = ensureStandardCards(graph, rootId);
      expect(next.nodes.filter(n => n.type === 'teste')).toHaveLength(1);
    });

    it('é idempotente: chamar duas vezes não duplica nada', () => {
      const base = createAbilityGraph({ id: 'a1', name: 'X' });
      const rootId = base.nodes[0].id;
      const once = ensureStandardCards(base, rootId);
      const twice = ensureStandardCards(once, rootId);
      expect(twice.nodes.filter(n => n.type === 'alvo')).toHaveLength(1);
      expect(twice.nodes.filter(n => n.type === 'teste')).toHaveLength(1);
      expect(twice.edges).toHaveLength(once.edges.length);
    });
  });

  describe('ensureStandardCardsOnAllTriggers (migração de grafos salvos)', () => {
    it('aplica os cartões padrão em todos os gatilhos de um grafo antigo (gatilho principal + secundário)', () => {
      const base = createAbilityGraph({ id: 'a1', name: 'X' });
      const withCombo = addSecondaryTrigger(base, 'em_combo');
      // Simula um grafo "antigo" salvo antes da mudança: remove os cartões que addSecondaryTrigger já
      // teria adicionado, pra representar fielmente o estado de um grafo pré-existente no banco.
      const legacyGraph = { ...withCombo, nodes: withCombo.nodes.filter(n => n.family === 'gatilho'), edges: [] };
      const migrated = ensureStandardCardsOnAllTriggers(legacyGraph);
      const rootId = migrated.nodes.find(n => n.type === 'ao_ativar')!.id;
      const comboId = migrated.nodes.find(n => n.type === 'em_combo')!.id;
      expect(migrated.edges.some(e => e.from === rootId && migrated.nodes.find(n => n.id === e.to)?.type === 'alvo')).toBe(true);
      expect(migrated.edges.some(e => e.from === comboId && migrated.nodes.find(n => n.id === e.to)?.type === 'alvo')).toBe(true);
      expect(migrated.nodes.some(n => n.id === `teste-standard-${rootId}`)).toBe(true);
      expect(migrated.nodes.some(n => n.id === `teste-standard-${comboId}`)).toBe(true);
    });

    it('é idempotente sobre uma coleção de grafos e não duplica em quem já tem os cartões', () => {
      const base = createAbilityGraph({ id: 'a1', name: 'X' });
      const once = ensureStandardCardsOnAllTriggers(base);
      const twice = ensureStandardCardsOnAllTriggers(once);
      expect(twice.nodes.filter(n => n.type === 'alvo')).toHaveLength(1);
      expect(twice.nodes.filter(n => n.type === 'teste')).toHaveLength(1);
    });
  });
});
