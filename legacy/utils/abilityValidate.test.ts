import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry } from './nodeRegistry';
import { ensureNodesRegistered } from './nodes';
import { listAbilityTemplates } from './abilityTemplates';
import { validateAbilityGraph } from './abilityValidate';

describe('validateAbilityGraph', () => {
  beforeEach(() => { _resetRegistry(); ensureNodesRegistered(); });

  it('templates prontos nao geram erros criticos', () => {
    for (const template of listAbilityTemplates()) {
      const graph = template.build();
      const issues = validateAbilityGraph(graph);
      const errors = issues.filter(i => i.severity === 'erro');
      expect(errors, `template ${template.id}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('acusa no desconectado', () => {
    const graph = listAbilityTemplates().find(t => t.id === 'cura')!.build();
    const solto = { ...graph, nodes: [...graph.nodes, { id: 'solto', type: 'dano', family: 'efeito' as const, props: {} }] };
    const issues = validateAbilityGraph(solto);
    expect(issues.some(i => i.severity === 'erro' && i.nodeId === 'solto')).toBe(true);
  });

  it('acusa habilidade sem nenhum efeito', () => {
    const graph = listAbilityTemplates().find(t => t.id === 'cura')!.build();
    const semEfeito = { ...graph, nodes: graph.nodes.filter(n => n.family !== 'efeito'), edges: [] };
    const issues = validateAbilityGraph(semEfeito);
    expect(issues.some(i => i.severity === 'erro' && i.message.includes('não produz nenhum efeito'))).toBe(true);
  });

  it('acusa custo de aura muito alto', () => {
    const graph = listAbilityTemplates().find(t => t.id === 'cura_aura')!.build({ auraCost: 20 });
    const issues = validateAbilityGraph(graph);
    expect(issues.some(i => i.severity === 'aviso' && i.message.includes('Custo de aura'))).toBe(true);
  });

  it('acusa buff sem duracao', () => {
    const graph = listAbilityTemplates().find(t => t.id === 'buff')!.build();
    const buffNode = graph.nodes.find(n => n.type === 'buff')!;
    buffNode.props.rounds = 0;
    const issues = validateAbilityGraph(graph);
    expect(issues.some(i => i.severity === 'erro' && i.nodeId === buffNode.id)).toBe(true);
  });

  it('acusa reacao com retaliacao sem identificar o atacante original', () => {
    const graph = listAbilityTemplates().find(t => t.id === 'reacao_aura_dano')!.build({ damageDice: '1d6' });
    const semAlvo = { ...graph, nodes: graph.nodes.filter(n => n.type !== 'alvo') };
    const issues = validateAbilityGraph(semAlvo);
    expect(issues.some(i => i.message.includes('não identifica o causador'))).toBe(true);
  });

  it('acusa chance impossivel', () => {
    const graph = listAbilityTemplates().find(t => t.id === 'estado_alvo')!.build();
    const ramo = graph.nodes.find(n => n.type === 'se_vida_alvo')!;
    ramo.props.percent = 0;
    const issues = validateAbilityGraph(graph);
    expect(issues.some(i => i.nodeId === ramo.id && i.severity === 'aviso')).toBe(true);
  });

  it('acusa ciclo no fluxo (nó que aponta de volta para um ancestral)', () => {
    const graph = listAbilityTemplates().find(t => t.id === 'cura')!.build();
    const curaNode = graph.nodes.find(n => n.type === 'cura')!;
    const gatilho = graph.nodes.find(n => n.family === 'gatilho')!;
    const ciclico = { ...graph, edges: [...graph.edges, { id: 'e-ciclo', from: curaNode.id, to: gatilho.id }] };
    const issues = validateAbilityGraph(ciclico);
    expect(issues.some(i => i.severity === 'erro' && i.message.includes('ciclo') && i.nodeId === curaNode.id)).toBe(true);
  });

  it('grafo sem ciclo não acusa nada relacionado a ciclo', () => {
    const graph = listAbilityTemplates().find(t => t.id === 'cura')!.build();
    const issues = validateAbilityGraph(graph);
    expect(issues.some(i => i.message.includes('ciclo'))).toBe(false);
  });
});
