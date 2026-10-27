import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry } from './nodeRegistry';
import { ensureNodesRegistered } from './nodes';
import { createAbilityGraph, type AbilityGraph, type GraphNode } from './abilityGraph';
import { resolveAbilityGraphAction, activatableGraphForms, availableAbilityGraphIds, graphFormaVisual, graphCosts, graphComboConfig, graphCooldown, graphPreparation, advanceAbilityGraphCooldowns } from './abilityGraphAction';
import type { ArsenalActorState } from './arsenalPipeline';

const actor = (over: Partial<ArsenalActorState> = {}): ArsenalActorState => ({
  id: 'a', teamId: 'A', name: 'Herói', currentHp: 30, maxHp: 30, currentAura: 10, maxAura: 10,
  currentAmmo: 0, maxAmmo: 0, defense: 12, speed: 8, tags: [], equippedWeaponIds: [],
  activeFormIds: [], effects: [], holdings: [], isCurrentTurn: true, inCombat: true, ...over,
});
const target = (over: Partial<ArsenalActorState> = {}): ArsenalActorState => actor({ id: 't', teamId: 'B', name: 'Alvo', isCurrentTurn: false, ...over });

/** Anexa um nó ao grafo conectado à raiz de trigger (nó estruturalmente alcançável). */
function attachToRoot(graph: AbilityGraph, node: GraphNode): AbilityGraph {
  const rootId = graph.nodes.find(n => n.family === 'gatilho')!.id;
  return { ...graph, nodes: [...graph.nodes, node], edges: [...graph.edges, { id: `edge-${node.id}`, from: rootId, to: node.id }] };
}

/** Anexa um nó ao grafo sem conectá-lo a nada — usado para testar que nós desconectados são ignorados. */
function detached(graph: AbilityGraph, node: GraphNode): AbilityGraph {
  return { ...graph, nodes: [...graph.nodes, node] };
}

/** Anexa um nó 'custo' conectado à raiz do grafo. */
function withCusto(graph: AbilityGraph, recurso: 'aura' | 'municao' | 'vida', amount: number): AbilityGraph {
  const node: GraphNode = { id: `custo-${recurso}-${graph.nodes.length}`, type: 'custo', family: 'efeito', props: { recurso, amount } };
  return attachToRoot(graph, node);
}

function withCooldown(graph: AbilityGraph, tipo: 'sem_cooldown' | 'turnos' | 'rodadas' | 'usos', amount: number): AbilityGraph {
  const node: GraphNode = { id: `cooldown-${graph.nodes.length}`, type: 'cooldown', family: 'efeito', props: { tipo, amount } };
  return attachToRoot(graph, node);
}

function withPreparacao(graph: AbilityGraph, tipo: 'instantaneo' | 'turnos' | 'rodadas', amount: number): AbilityGraph {
  const node: GraphNode = { id: `preparacao-${graph.nodes.length}`, type: 'preparacao', family: 'efeito', props: { tipo, amount } };
  return attachToRoot(graph, node);
}

function danoGraph(over: Partial<AbilityGraph['header']> = {}, auraCost = 0): AbilityGraph {
  const base: AbilityGraph = {
    ...createAbilityGraph({ id: 'golpe', name: 'Golpe', ...over }),
    nodes: [
      { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
      { id: 'd', type: 'dano', family: 'efeito', props: { dice: undefined, flat: 6, element: 'fisico' } },
    ],
    edges: [{ id: 'e1', from: 'g', to: 'd' }],
  };
  return auraCost > 0 ? withCusto(base, 'aura', auraCost) : base;
}

function danoComTesteGraph(comparador: 'defesa_alvo' | 'valor_fixo' = 'defesa_alvo', valorFixo = 0): AbilityGraph {
  return {
    ...createAbilityGraph({ id: 'golpe-teste', name: 'Golpe com teste' }),
    nodes: [
      { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
      { id: 'teste', type: 'teste', family: 'ramo', props: { dice: '1d20', comparador, valorFixo, modificador: 0 } },
      { id: 'd', type: 'dano', family: 'efeito', props: { dice: undefined, flat: 6, element: 'fisico' } },
    ],
    edges: [
      { id: 'e1', from: 'g', to: 'teste' },
      { id: 'e2', from: 'teste', to: 'd', branch: 'entao' },
    ],
  };
}

describe('resolveAbilityGraphAction', () => {
  beforeEach(() => { _resetRegistry(); ensureNodesRegistered(); });

  it('sem nó teste, sempre acerta e aplica dano', () => {
    const res = resolveAbilityGraphAction({ graph: danoGraph(), level: 1, actor: actor(), targets: [target()], roller: () => 0 });
    expect(res.status).toBe('concluida');
    expect(res.hitTargetIds).toEqual(['t']);
    expect(res.targets[0].currentHp).toBe(24);
  });

  it('com nó teste, erra quando a rolagem é menor que a defesa do alvo', () => {
    const res = resolveAbilityGraphAction({ graph: danoComTesteGraph(), level: 1, actor: actor(), targets: [target({ defense: 99 })], roller: () => 5 });
    expect(res.hitTargetIds).toEqual([]);
    expect(res.targets[0].currentHp).toBe(30); // não sofreu dano
  });

  it('com nó teste, acerta quando a rolagem é maior ou igual à defesa', () => {
    const res = resolveAbilityGraphAction({ graph: danoComTesteGraph(), level: 1, actor: actor(), targets: [target({ defense: 5 })], roller: () => 10 });
    expect(res.hitTargetIds).toEqual(['t']);
    expect(res.targets[0].currentHp).toBe(24);
  });

  it('testa cada alvo individualmente: um alvo pode acertar e outro errar na mesma ação', () => {
    const res = resolveAbilityGraphAction({
      graph: danoComTesteGraph(),
      level: 1,
      actor: actor(),
      targets: [target({ id: 't1', defense: 5 }), target({ id: 't2', defense: 15 })],
      roller: () => 10,
    });
    expect(res.hitTargetIds.sort()).toEqual(['t1']);
    expect(res.targets.find(t => t.id === 't1')!.currentHp).toBe(24); // acertou
    expect(res.targets.find(t => t.id === 't2')!.currentHp).toBe(30); // errou, sem dano
  });

  it('bloqueia por aura insuficiente', () => {
    const graph = danoGraph({}, 20);
    const res = resolveAbilityGraphAction({ graph, level: 1, actor: actor({ currentAura: 5 }), targets: [target()], roller: () => 0 });
    expect(res.status).toBe('bloqueada');
    expect(res.reason).toMatch(/aura/i);
  });

  it('bloqueia por vida insuficiente quando o custo em vida é maior ou igual ao HP atual', () => {
    const graph = withCusto(danoGraph(), 'vida', 30);
    const res = resolveAbilityGraphAction({ graph, level: 1, actor: actor({ currentHp: 30 }), targets: [target()], roller: () => 0 });
    expect(res.status).toBe('bloqueada');
    expect(res.reason).toMatch(/vida/i);
  });

  it('desconta o custo em vida do próprio ator ao concluir', () => {
    const graph = withCusto(danoGraph(), 'vida', 5);
    const res = resolveAbilityGraphAction({ graph, level: 1, actor: actor({ currentHp: 30 }), targets: [target()], roller: () => 0 });
    expect(res.status).toBe('concluida');
    expect(res.actor.currentHp).toBe(25);
  });

  it('bloqueia por cooldown ativo na holding do ator', () => {
    const graph = danoGraph();
    const res = resolveAbilityGraphAction({
      graph, level: 1, actor: actor({ holdings: [{ cardId: 'golpe', quantity: 1, equipped: false, active: false, cooldownRemaining: 2 }] }),
      targets: [target()], roller: () => 0,
    });
    expect(res.status).toBe('bloqueada');
    expect(res.reason).toMatch(/cooldown/i);
  });

  it('define cooldownRemaining na holding após uso quando o grafo tem um nó cooldown', () => {
    const graph = withCooldown(danoGraph(), 'rodadas', 3);
    const res = resolveAbilityGraphAction({
      graph, level: 1, actor: actor({ holdings: [{ cardId: 'golpe', quantity: 1, equipped: false, active: false }] }),
      targets: [target()], roller: () => 0,
    });
    const holding = res.actor.holdings.find(h => h.cardId === 'golpe')!;
    expect(holding.cooldownRemaining).toBe(3);
  });

  it('descarta munição/aura de custo mesmo quando bloqueia por outro motivo não desconta nada', () => {
    const graph = danoGraph({}, 3);
    const res = resolveAbilityGraphAction({ graph, level: 1, actor: actor({ currentAura: 10 }), targets: [target()], roller: () => 0 });
    expect(res.actor.currentAura).toBe(7);
  });

  describe('preparação com duração', () => {
    it('com preparação não-instantânea, entra em "preparando" sem rodar o grafo, mas paga o custo', () => {
      const graph = withPreparacao(danoGraph({}, 4), 'rodadas', 2);
      const res = resolveAbilityGraphAction({ graph, level: 1, actor: actor({ currentAura: 10 }), targets: [target()], roller: () => 0 });
      expect(res.status).toBe('preparando');
      expect(res.preparation?.timing).toEqual({ type: 'rodadas', amount: 2 });
      expect(res.actor.currentAura).toBe(6);
      expect(res.targets[0].currentHp).toBe(30); // grafo não rodou ainda
    });

    it('com resumePreparation:true, roda o grafo normalmente sem cobrar custo de novo', () => {
      const graph = withPreparacao(danoGraph({}, 4), 'rodadas', 2);
      const res = resolveAbilityGraphAction({ graph, level: 1, actor: actor({ currentAura: 6 }), targets: [target()], roller: () => 0, resumePreparation: true });
      expect(res.status).toBe('concluida');
      expect(res.targets[0].currentHp).toBe(24);
      expect(res.actor.currentAura).toBe(6); // não desconta de novo
    });
  });

  describe('combos', () => {
    function curaGraph(): AbilityGraph {
      const base: AbilityGraph = {
        ...createAbilityGraph({ id: 'combo-cura', name: 'Cura combo' }),
        nodes: [
          { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
          { id: 'c', type: 'cura', family: 'efeito', props: { dice: undefined, flat: 3 } },
        ],
        edges: [{ id: 'e1', from: 'g', to: 'c' }],
      };
      return withCusto(base, 'aura', 2);
    }

    it('roda o grafo base e os combos em sequência sobre o mesmo alvo', () => {
      const base = danoGraph({}, 1);
      const res = resolveAbilityGraphAction({
        graph: base, level: 1, actor: actor({ currentAura: 10 }), targets: [target({ currentHp: 20 })],
        combos: [{ graph: curaGraph(), level: 1 }], roller: () => 0,
      });
      expect(res.status).toBe('concluida');
      // dano 6 depois cura 3 → líquido -3
      expect(res.targets[0].currentHp).toBe(17);
      expect(res.trace.length).toBeGreaterThan(1);
    });

    it('soma o custo de aura do combo ao custo base', () => {
      const base = danoGraph({}, 1);
      const res = resolveAbilityGraphAction({
        graph: base, level: 1, actor: actor({ currentAura: 10 }), targets: [target()],
        combos: [{ graph: curaGraph(), level: 1 }], roller: () => 0,
      });
      expect(res.actor.currentAura).toBe(7); // 10 - (1 base + 2 combo)
    });

    it('só atualiza o cooldown/cargas da holding do grafo base', () => {
      const base = withCooldown(danoGraph(), 'rodadas', 2);
      const res = resolveAbilityGraphAction({
        graph: base, level: 1,
        actor: actor({ holdings: [
          { cardId: 'golpe', quantity: 1, equipped: false, active: false },
          { cardId: 'combo-cura', quantity: 1, equipped: false, active: false },
        ] }),
        targets: [target()], combos: [{ graph: curaGraph(), level: 1 }], roller: () => 0,
      });
      expect(res.actor.holdings.find(h => h.cardId === 'golpe')!.cooldownRemaining).toBe(2);
      expect(res.actor.holdings.find(h => h.cardId === 'combo-cura')!.cooldownRemaining).toBeUndefined();
    });

    it('roda o ramo "em_combo" do grafo base além do fluxo principal quando usada com companheiras', () => {
      const base: AbilityGraph = {
        ...danoGraph(),
        nodes: [
          ...danoGraph().nodes,
          { id: 'combo-root', type: 'em_combo', family: 'gatilho', props: { stackKey: 'x', maxStacks: 2 } },
          { id: 'combo-cura', type: 'cura', family: 'efeito', props: { dice: undefined, flat: 5 } },
        ],
        edges: [...danoGraph().edges, { id: 'e2', from: 'combo-root', to: 'combo-cura' }],
      };
      const res = resolveAbilityGraphAction({
        graph: base, level: 1, actor: actor({ currentAura: 10 }), targets: [target({ currentHp: 20 })],
        combos: [{ graph: curaGraph(), level: 1 }], roller: () => 0,
      });
      // dano 6 (fluxo principal) + cura 3 (combo companheira) + cura 5 (ramo em_combo do base) = +2 líquido
      expect(res.targets[0].currentHp).toBe(22);
    });
  });

  describe('defenseBonus (proteção/reação)', () => {
    it('soma defenseBonus à defesa do alvo no teste de acerto', () => {
      const graph = danoComTesteGraph();
      const semBonus = resolveAbilityGraphAction({ graph, level: 1, actor: actor(), targets: [target({ defense: 10 })], roller: () => 10 });
      expect(semBonus.hitTargetIds).toEqual(['t']); // 10 >= 10, acerta

      const comBonus = resolveAbilityGraphAction({ graph, level: 1, actor: actor(), targets: [target({ defense: 10 })], roller: () => 10, defenseBonus: 5 });
      expect(comBonus.hitTargetIds).toEqual([]); // 10 >= 15 falso, erra
    });
  });

  describe('alvos contextuais de reação', () => {
    it('permite que uma reação cause dano no atacante original sem ferir o defensor', () => {
      const graph: AbilityGraph = {
        ...createAbilityGraph({ id: 'contra', name: 'Contra' }),
        nodes: [
          { id: 'g', type: 'ao_ser_alvejado', family: 'gatilho', props: {} },
          { id: 'teste', type: 'teste', family: 'ramo', props: { dice: '1d20', comparador: 'valor_fixo', valorFixo: 0, modificador: 0 } },
          { id: 'alvo-atacante', type: 'alvo', family: 'alvo', props: { scope: 'atacante_original' } },
          { id: 'dano', type: 'dano', family: 'efeito', props: { dice: undefined, flat: 5, element: 'fisico' } },
        ],
        edges: [
          { id: 'e1', from: 'g', to: 'teste' },
          { id: 'e2', from: 'teste', to: 'alvo-atacante', branch: 'entao' },
          { id: 'e3', from: 'alvo-atacante', to: 'dano' },
        ],
      };
      const defender = actor({ id: 'def', name: 'Defensor', currentHp: 30 });
      const attacker = target({ id: 'atk', name: 'Atacante', currentHp: 30 });
      const res = resolveAbilityGraphAction({ graph, level: 1, actor: defender, targets: [defender], additionalTargets: [attacker], roller: () => 10 });
      expect(res.actor.currentHp).toBe(30);
      expect(res.targets.find(t => t.id === 'def')?.currentHp).toBe(30);
      expect(res.additionalTargets.find(t => t.id === 'atk')?.currentHp).toBe(25);
    });
  });

  describe('activatableGraphForms', () => {
    function formaGraph(id: string, auraCost = 0): AbilityGraph {
      const base: AbilityGraph = {
        ...createAbilityGraph({ id, name: id }),
        nodes: [
          { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
          { id: 'buff', type: 'buff', family: 'efeito', props: { stat: 'vida_maxima', operation: 'somar', value: 10, rounds: 999 } },
          { id: 'cor', type: 'cor_token', family: 'efeito', props: { color: '#f00' } },
        ],
        edges: [{ id: 'e1', from: 'g', to: 'buff' }, { id: 'e2', from: 'buff', to: 'cor' }],
      };
      return auraCost > 0 ? withCusto(base, 'aura', auraCost) : base;
    }

    it('detecta forma pela presença de cor_token/icone_token no grafo', () => {
      const forma = formaGraph('forma-1');
      const naoForma = createAbilityGraph({ id: 'x', name: 'X' });
      const result = activatableGraphForms(
        actor({ holdings: [{ cardId: 'forma-1', quantity: 1, equipped: false, active: false }] }),
        [forma, naoForma],
        { holdings: [{ cardId: 'forma-1', quantity: 1, equipped: false, active: false }], equippedWeaponIds: [], activeFormIds: [] },
      );
      expect(result).toHaveLength(1);
      expect(result[0].graph.id).toBe('forma-1');
    });

    it('marca como ativa quando já está no activeFormIds do loadout', () => {
      const forma = formaGraph('forma-1');
      const loadout = { holdings: [{ cardId: 'forma-1', quantity: 1, equipped: false, active: true }], equippedWeaponIds: [], activeFormIds: ['forma-1'] };
      const result = activatableGraphForms(actor({ holdings: loadout.holdings }), [forma], loadout);
      expect(result[0]).toMatchObject({ isActive: true, ok: false });
    });

    it('bloqueia por aura insuficiente e expõe o motivo', () => {
      const forma = formaGraph('forma-1', 50);
      const loadout = { holdings: [{ cardId: 'forma-1', quantity: 1, equipped: false, active: false }], equippedWeaponIds: [], activeFormIds: [] };
      const result = activatableGraphForms(actor({ currentAura: 1, holdings: loadout.holdings }), [forma], loadout);
      expect(result[0]).toMatchObject({ ok: false });
      expect(result[0].reason).toMatch(/aura/i);
    });
  });

  describe('availableAbilityGraphIds', () => {
    it('esconde habilidade-grafo vinculada a uma forma até a forma estar ativa', () => {
      const linked: AbilityGraph = { ...createAbilityGraph({ id: 'golpe-solar', name: 'Golpe Solar' }), header: { ...createAbilityGraph({ id: 'x', name: 'x' }).header, formLinks: ['forma-solar'] } };
      const loadout = { holdings: [{ cardId: 'golpe-solar', quantity: 1 }], equippedWeaponIds: [], activeFormIds: [] };
      expect(availableAbilityGraphIds(loadout, [linked])).not.toContain('golpe-solar');
      expect(availableAbilityGraphIds({ ...loadout, activeFormIds: ['forma-solar'] }, [linked])).toContain('golpe-solar');
    });

    it('habilidade sem weaponLinks/formLinks está sempre disponível se possuída', () => {
      const free = createAbilityGraph({ id: 'golpe', name: 'Golpe' });
      const loadout = { holdings: [{ cardId: 'golpe', quantity: 1 }], equippedWeaponIds: [], activeFormIds: [] };
      expect(availableAbilityGraphIds(loadout, [free])).toContain('golpe');
    });

    it('não inclui habilidades não possuídas', () => {
      const free = createAbilityGraph({ id: 'golpe', name: 'Golpe' });
      const loadout = { holdings: [], equippedWeaponIds: [], activeFormIds: [] };
      expect(availableAbilityGraphIds(loadout, [free])).not.toContain('golpe');
    });
  });

  describe('graphFormaVisual', () => {
    it('extrai cor/ícone/bônus de PV/Aura dos nós do grafo mesclado', () => {
      const forma = {
        ...createAbilityGraph({ id: 'f', name: 'Forma X' }),
        nodes: [
          { id: 'g', type: 'ao_ativar', family: 'gatilho' as const, props: {} },
          { id: 'b1', type: 'buff', family: 'efeito' as const, props: { stat: 'vida_maxima', operation: 'somar', value: 8, rounds: 999 } },
          { id: 'b2', type: 'buff', family: 'efeito' as const, props: { stat: 'aura_maxima', operation: 'somar', value: 3, rounds: 999 } },
          { id: 'cor', type: 'cor_token', family: 'efeito' as const, props: { color: '#38bdf8' } },
          { id: 'icone', type: 'icone_token', family: 'efeito' as const, props: { icon: 'https://x/lua.png' } },
        ],
        edges: [
          { id: 'e1', from: 'g', to: 'b1' }, { id: 'e2', from: 'b1', to: 'b2' },
          { id: 'e3', from: 'b2', to: 'cor' }, { id: 'e4', from: 'cor', to: 'icone' },
        ],
      };
      const visual = graphFormaVisual(forma, 1);
      expect(visual).toEqual({ isForma: true, color: '#38bdf8', iconOverride: 'https://x/lua.png', hpBonus: 8, auraBonus: 3 });
    });

    it('grafo sem cor_token/icone_token não é forma', () => {
      const naoForma = createAbilityGraph({ id: 'x', name: 'X' });
      expect(graphFormaVisual(naoForma, 1).isForma).toBe(false);
    });
  });

  describe('graphCosts', () => {
    it('soma os nós custo por recurso', () => {
      let graph = withCusto(danoGraph(), 'aura', 3);
      graph = withCusto(graph, 'municao', 1);
      graph = withCusto(graph, 'vida', 2);
      expect(graphCosts(graph, 1)).toEqual({ aura: 3, municao: 1, vida: 2 });
    });

    it('grafo sem nós custo retorna zeros', () => {
      expect(graphCosts(danoGraph(), 1)).toEqual({ aura: 0, municao: 0, vida: 0 });
    });

    it('ignora um nó custo desconectado do fluxo (não alcançável a partir da raiz)', () => {
      const base = danoGraph();
      const desconectado = detached(base, { id: 'custo-solto', type: 'custo', family: 'efeito', props: { recurso: 'aura', amount: 99 } });
      expect(graphCosts(desconectado, 1)).toEqual({ aura: 0, municao: 0, vida: 0 });
    });

    it('ignora custo pendurado só no ramo em_combo — não conta quando a habilidade roda sozinha (sem companheiras)', () => {
      const base: AbilityGraph = {
        ...danoGraph(),
        nodes: [
          ...danoGraph().nodes,
          { id: 'combo-root', type: 'em_combo', family: 'gatilho', props: { stackKey: 'x', maxStacks: 2 } },
          { id: 'combo-custo', type: 'custo', family: 'efeito', props: { recurso: 'aura', amount: 99 } },
        ],
        edges: [...danoGraph().edges, { id: 'e2', from: 'combo-root', to: 'combo-custo' }],
      };
      expect(graphCosts(base, 1)).toEqual({ aura: 0, municao: 0, vida: 0 });
    });

    it('grafo cujo único trigger é em_combo (companheira pura de combo) ainda conta o custo do próprio ramo', () => {
      const soCombo: AbilityGraph = {
        ...createAbilityGraph({ id: 'combo-only', name: 'Só combo' }),
        nodes: [
          { id: 'combo-root', type: 'em_combo', family: 'gatilho', props: { stackKey: 'x', maxStacks: 2 } },
          { id: 'combo-custo', type: 'custo', family: 'efeito', props: { recurso: 'aura', amount: 2 } },
        ],
        edges: [{ id: 'e1', from: 'combo-root', to: 'combo-custo' }],
      };
      expect(graphCosts(soCombo, 1)).toEqual({ aura: 2, municao: 0, vida: 0 });
    });
  });

  describe('graphCooldown', () => {
    it('lê tipo/quantidade do nó cooldown quando presente', () => {
      const graph = withCooldown(danoGraph(), 'usos', 2);
      expect(graphCooldown(graph, 1)).toEqual({ type: 'usos', amount: 2 });
    });

    it('grafo sem nó cooldown retorna sem_cooldown', () => {
      expect(graphCooldown(danoGraph(), 1)).toEqual({ type: 'sem_cooldown' });
    });

    it('ignora um nó cooldown desconectado do fluxo', () => {
      const base = danoGraph();
      const desconectado = detached(base, { id: 'cd-solto', type: 'cooldown', family: 'efeito', props: { tipo: 'rodadas', amount: 5 } });
      expect(graphCooldown(desconectado, 1)).toEqual({ type: 'sem_cooldown' });
    });
  });

  describe('advanceAbilityGraphCooldowns', () => {
    it('decrementa cooldown do tipo rodadas apenas no evento inicio_rodada', () => {
      const graph = withCooldown(danoGraph(), 'rodadas', 3);
      const holdings = [{ cardId: graph.id, quantity: 1, equipped: false, active: false, cooldownRemaining: 2 }];
      const afterTurno = advanceAbilityGraphCooldowns(holdings, [graph], 'inicio_turno');
      expect(afterTurno[0].cooldownRemaining).toBe(2);
      const afterRodada = advanceAbilityGraphCooldowns(holdings, [graph], 'inicio_rodada');
      expect(afterRodada[0].cooldownRemaining).toBe(1);
    });

    it('decrementa cooldown do tipo turnos apenas no evento inicio_turno, sem passar de zero', () => {
      const graph = withCooldown(danoGraph(), 'turnos', 1);
      const holdings = [{ cardId: graph.id, quantity: 1, equipped: false, active: false, cooldownRemaining: 1 }];
      const after = advanceAbilityGraphCooldowns(holdings, [graph], 'inicio_turno');
      expect(after[0].cooldownRemaining).toBe(0);
      const stable = advanceAbilityGraphCooldowns(after, [graph], 'inicio_turno');
      expect(stable[0].cooldownRemaining).toBe(0);
    });

    it('não mexe em holdings de cartas fora do catálogo de grafos', () => {
      const holdings = [{ cardId: 'carta-arsenal-comum', quantity: 1, equipped: false, active: false, cooldownRemaining: 2 }];
      const after = advanceAbilityGraphCooldowns(holdings, [withCooldown(danoGraph(), 'rodadas', 3)], 'inicio_rodada');
      expect(after[0].cooldownRemaining).toBe(2);
    });
  });

  describe('graphPreparation', () => {
    it('lê tipo/quantidade do nó preparacao quando presente', () => {
      const graph = withPreparacao(danoGraph(), 'turnos', 1);
      expect(graphPreparation(graph, 1).timing).toEqual({ type: 'turnos', amount: 1 });
    });

    it('grafo sem nó preparacao retorna instantânea', () => {
      expect(graphPreparation(danoGraph(), 1).timing).toEqual({ type: 'instantaneo' });
    });
  });

  describe('graphComboConfig', () => {
    it('lê stackKey/maxStacks do nó em_combo quando presente', () => {
      const graph: AbilityGraph = {
        ...danoGraph(),
        nodes: [...danoGraph().nodes, { id: 'combo', type: 'em_combo', family: 'gatilho', props: { stackKey: 'fogo', maxStacks: 3 } }],
      };
      expect(graphComboConfig(graph, 1)).toEqual({ stackKey: 'fogo', maxStacks: 3 });
    });

    it('retorna null quando não há nó em_combo', () => {
      expect(graphComboConfig(danoGraph(), 1)).toBeNull();
    });
  });

  describe('integração: buff/debuff v2 de ponta a ponta', () => {
    it('um buff de dano aplicado por um grafo afeta o dano de uma habilidade seguinte', () => {
      const buffGraph: AbilityGraph = attachToRoot(createAbilityGraph({ id: 'buff', name: 'Fúria' }), {
        id: 'mod', type: 'modificar_valor', family: 'efeito',
        props: { name: 'Fúria', target: 'dano', operation: 'somar', value: 5, rounds: 3, chance: 100, stackRule: 'renovar' },
      });
      const attackGraph: AbilityGraph = attachToRoot(createAbilityGraph({ id: 'golpe', name: 'Golpe' }), {
        id: 'dano', type: 'dano', family: 'efeito', props: { dice: undefined, flat: 4, element: null, perfurante: false, hits: 1 },
      });

      const buffed = resolveAbilityGraphAction({ graph: buffGraph, level: 1, actor: actor(), targets: [actor()], roller: () => 0 });
      expect(buffed.status).toBe('concluida');

      const result = resolveAbilityGraphAction({ graph: attackGraph, level: 1, actor: buffed.actor, targets: [target()], roller: () => 0 });
      // 4 (base) + 5 (Fúria) = 9
      expect(result.targets[0].currentHp).toBe(21);
    });

    it('custo de aura reduzido por um buff é respeitado ao pagar o custo da habilidade', () => {
      const buffGraph: AbilityGraph = attachToRoot(createAbilityGraph({ id: 'buff', name: 'Economia' }), {
        id: 'mod', type: 'modificar_valor', family: 'efeito',
        props: { name: 'Economia', target: 'custo_aura', operation: 'subtrair', value: 2, rounds: 3, chance: 100, stackRule: 'renovar' },
      });
      const spell = withCusto(createAbilityGraph({ id: 'feitico', name: 'Feitiço' }), 'aura', 3);

      const buffed = resolveAbilityGraphAction({ graph: buffGraph, level: 1, actor: actor(), targets: [actor()], roller: () => 0 });
      const result = resolveAbilityGraphAction({ graph: spell, level: 1, actor: buffed.actor, targets: [target()], roller: () => 0 });
      expect(result.status).toBe('concluida');
      expect(result.actor.currentAura).toBe(9); // 10 - (3 - 2)
    });
  });

  it('propaga defenseRollOverride do nó esquiva até o resultado da ação', () => {
    const graph = attachToRoot(createAbilityGraph({ id: 'esquiva-graph', name: 'Esquiva' }), {
      id: 'e', type: 'esquiva', family: 'efeito', props: { dice: undefined, flat: 7 },
    });
    const result = resolveAbilityGraphAction({ graph, level: 1, actor: actor(), targets: [actor()], roller: () => 0 });
    expect(result.status).toBe('concluida');
    expect(result.defenseRollOverride).toBe(7);
  });

  it('areaTargets do request chega ao nó alvo geométrico e afeta quem está na área, não os targets normais', () => {
    const graph: AbilityGraph = {
      ...createAbilityGraph({ id: 'explosao', name: 'Explosão' }),
      nodes: [
        { id: 'g', type: 'ao_ativar', family: 'gatilho', props: {} },
        { id: 'a', type: 'alvo', family: 'alvo', props: { scope: 'raio' } },
        { id: 'd', type: 'dano', family: 'efeito', props: { dice: undefined, flat: 6, element: 'fisico' } },
      ],
      edges: [{ id: 'e1', from: 'g', to: 'a' }, { id: 'e2', from: 'a', to: 'd' }],
    };
    const inArea = target({ id: 'in-area', currentHp: 20 });
    const result = resolveAbilityGraphAction({
      graph, level: 1, actor: actor(), targets: [target({ id: 'clicked', currentHp: 20 })],
      areaTargets: [inArea], roller: () => 0,
    });
    expect(result.status).toBe('concluida');
    // O alvo clicado (targets) não é afetado pelo escopo 'raio' — só quem está em areaTargets é.
    expect(result.targets[0].currentHp).toBe(20);
    expect(result.areaTargets.find(t => t.id === 'in-area')!.currentHp).toBe(14);
  });

  it('propaga movementIntents do nó mover até o resultado da ação', () => {
    const graph = attachToRoot(createAbilityGraph({ id: 'empurrao', name: 'Empurrão' }), {
      id: 'm', type: 'mover', family: 'efeito', props: { kind: 'empurrar', distance: 2 },
    });
    const result = resolveAbilityGraphAction({ graph, level: 1, actor: actor(), targets: [target()], roller: () => 0 });
    expect(result.status).toBe('concluida');
    expect(result.movementIntents).toEqual([{ targetId: 't', kind: 'empurrar', distance: 2 }]);
  });
});
