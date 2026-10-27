import { registerNodeType } from '../nodeRegistry';
import { applyDamage, applyHeal, applyAuraRestore, applyCondition, removeActiveEffects } from '../abilityPrimitives';
import { createStatusEffect } from './statusEffect';
import { CONDITION_FIELD_SCHEMAS, buildConditionEffect, conditionKindByName } from '../conditionPresets';
import { resolveCausedAndReceivedValue } from '../effectModifiers';
import type { ConditionIntensity, ConditionParams } from '../arsenal';
import type { InterpretCtx } from '../abilityInterpreter';
import type { Element } from '../../types';

type ScopeKind = 'proprio' | 'alvo_da_habilidade' | 'atacante_original' | 'todos_inimigos' | 'todos_aliados' | 'aleatorio_inimigo' | 'aleatorio_aliado'
  | 'linha' | 'raio' | 'cone' | 'quadrado' | 'escolha';

const AREA_SCOPES: ReadonlySet<ScopeKind> = new Set(['linha', 'raio', 'cone', 'quadrado']);

/** Escolhe 1 alvo aleatório (via ctx.roller, testável/determinístico) dentre o time indicado. */
function pickRandomFromTeam(ctx: InterpretCtx, sameTeamAsActor: boolean): InterpretCtx['scope'] {
  const pool = (ctx.allTargets ?? []).filter(t => (t.teamId === ctx.actor.teamId) === sameTeamAsActor);
  if (pool.length === 0) return [];
  const index = pool.length === 1 ? 0 : ctx.roller(`1d${pool.length}`, 'Alvo aleatório') - 1;
  return [pool[Math.min(pool.length - 1, Math.max(0, index))]];
}

/** Atributos com modificador clássico (EffectModifier — somar/multiplicar/definir, com filtro por elemento/tag/carta). */
type LegacyBuffStat = 'ataque' | 'defesa' | 'velocidade' | 'vida_maxima' | 'aura_maxima'
  | 'dano' | 'cura' | 'aura' | 'cura_recebida' | 'aura_recebida';
/** Deltas de guarda/stagger (sempre somados — não passam pelo motor de EffectModifier). */
type GuardBuffStat = 'defesa_reducao' | 'defesa_regeneracao' | 'stagger_max' | 'stagger_recuperacao' | 'stagger_multiplicador_dano';
/** Afinidade elemental concedida (ElementalAffinity — usa o campo `elemento` do nó). */
type AffinityBuffStat = 'resistencia_elemental' | 'vulnerabilidade_elemental' | 'imunidade_elemental';
type BuffStat = LegacyBuffStat | GuardBuffStat | AffinityBuffStat;
type BuffOperation = 'somar' | 'multiplicar' | 'definir';

const GUARD_STAT_KEY: Record<GuardBuffStat, 'defenseReductionDelta' | 'defenseRegenerationDelta' | 'staggerMaxDelta' | 'staggerRecoveryDelta' | 'staggerDamageMultiplierDelta'> = {
  defesa_reducao: 'defenseReductionDelta', defesa_regeneracao: 'defenseRegenerationDelta',
  stagger_max: 'staggerMaxDelta', stagger_recuperacao: 'staggerRecoveryDelta', stagger_multiplicador_dano: 'staggerDamageMultiplierDelta',
};

export function registerCoreNodes(): void {
  registerNodeType({
    type: 'ao_ativar', family: 'gatilho', label: 'Quando usada', fields: [],
    defaults: () => ({}), summarize: () => 'Quando a habilidade é usada',
  });

  registerNodeType({
    type: 'ao_ser_alvejado', family: 'gatilho', label: 'Quando alvejado', fields: [],
    defaults: () => ({}), summarize: () => 'Quando o personagem é alvejado por uma carta',
  });

  registerNodeType({
    type: 'ao_atacar', family: 'gatilho', label: 'Quando atacar', fields: [],
    defaults: () => ({}), summarize: () => 'Quando o personagem realiza qualquer ataque',
  });

  registerNodeType({
    type: 'ao_esquivar', family: 'gatilho', label: 'Quando esquivar', fields: [],
    defaults: () => ({}), summarize: () => 'Quando o personagem esquiva com sucesso de um ataque recebido',
  });

  registerNodeType({
    type: 'enquanto_ativa', family: 'gatilho', label: 'Enquanto ativa', fields: [],
    defaults: () => ({}), summarize: () => 'A cada início de turno, enquanto o efeito durar',
  });

  registerNodeType<{ stackKey: string; maxStacks: number }>({
    type: 'em_combo', family: 'gatilho', label: 'Em combo',
    fields: [
      { key: 'stackKey', kind: 'texto', label: 'Grupo do combo' },
      { key: 'maxStacks', kind: 'numero', label: 'Máximo de stacks' },
    ],
    defaults: () => ({ stackKey: '', maxStacks: 2 }),
    summarize: p => `Efeito extra em combo (${p.stackKey || 'sem grupo'}, até ${p.maxStacks})`,
  });

  registerNodeType<{ recurso: 'aura' | 'municao' | 'vida'; amount: number }>({
    type: 'custo', family: 'efeito', label: 'Custo de recurso', category: 'Configuração',
    fields: [
      { key: 'recurso', kind: 'select', label: 'Recurso', options: [
        { value: 'aura', label: 'Aura' }, { value: 'municao', label: 'Munição' }, { value: 'vida', label: 'Vida' } ] },
      { key: 'amount', kind: 'numero', label: 'Quantidade' },
    ],
    defaults: () => ({ recurso: 'aura', amount: 1 }),
    summarize: p => `Custo: ${p.amount} de ${p.recurso}`,
    interpret: (p, ctx) => { ctx.trace.push({ node: 'custo', detail: `Custo de ${p.amount} de ${p.recurso}` }); },
  });

  registerNodeType<{ alvo: 'proprio' | 'alvo_atual'; rounds: number }>({
    type: 'aplicar_como_efeito', family: 'efeito', label: 'Aplicar como efeito', category: 'Configuração',
    fields: [
      { key: 'alvo', kind: 'select', label: 'Alvo', options: [
        { value: 'proprio', label: 'Próprio usuário' }, { value: 'alvo_atual', label: 'Alvo atual' } ] },
      { key: 'rounds', kind: 'numero', label: 'Duração (rodadas)' },
    ],
    defaults: () => ({ alvo: 'proprio', rounds: 3 }),
    summarize: p => `Aplica como efeito em ${p.alvo === 'proprio' ? 'si mesmo' : 'alvo atual'} por ${p.rounds} rod.`,
    interpret: (p, ctx) => {
      const target = p.alvo === 'proprio' ? ctx.actor : (ctx.scope[0] ?? ctx.actor);
      ctx.ongoingEffectIntents = [...(ctx.ongoingEffectIntents ?? []), {
        targetId: target.id, casterId: ctx.actor.id, rounds: p.rounds,
        ...(ctx.pendingReactions?.length ? { pendingReactions: ctx.pendingReactions } : {}),
      }];
      ctx.trace.push({ node: 'aplicar_como_efeito', detail: `Aplicado como efeito contínuo em ${target.name} por ${p.rounds} rodadas` });
    },
  });

  registerNodeType<{ scope: ScopeKind; distance: number; width: number; radius: number; range: number; angle: number; size: number }>({
    type: 'alvo', family: 'alvo', label: 'Mudar alvo',
    fields: [
      { key: 'scope', kind: 'select', label: 'Escopo', options: [
        { value: 'proprio', label: 'Próprio usuário' },
        { value: 'alvo_da_habilidade', label: 'Alvo da habilidade' },
        { value: 'atacante_original', label: 'Atacante original' },
        { value: 'todos_inimigos', label: 'Todos os inimigos' },
        { value: 'todos_aliados', label: 'Todos os aliados' },
        { value: 'aleatorio_inimigo', label: 'Um inimigo aleatório' },
        { value: 'aleatorio_aliado', label: 'Um aliado aleatório' },
        { value: 'linha', label: 'Linha reta (a partir de mim)' },
        { value: 'raio', label: 'Raio ao redor de mim' },
        { value: 'cone', label: 'Cone (a partir de mim)' },
        { value: 'quadrado', label: 'Área quadrada ao redor de mim' },
        { value: 'escolha', label: 'Escolha manual (pede ao jogador para clicar no alvo)' },
      ] },
      { key: 'distance', kind: 'numero', label: 'Distância (linha)' },
      { key: 'width', kind: 'numero', label: 'Largura (linha)' },
      { key: 'radius', kind: 'numero', label: 'Raio' },
      { key: 'range', kind: 'numero', label: 'Alcance (cone)' },
      { key: 'angle', kind: 'numero', label: 'Ângulo de abertura (cone, em graus)' },
      { key: 'size', kind: 'numero', label: 'Tamanho do lado (quadrado)' },
    ],
    defaults: () => ({ scope: 'alvo_da_habilidade', distance: 3, width: 1, radius: 2, range: 3, angle: 60, size: 2 }),
    summarize: p => AREA_SCOPES.has(p.scope) ? `Alvo → ${p.scope} (área)` : `Alvo → ${p.scope}`,
    interpret: (p, ctx) => {
      if (p.scope === 'proprio') ctx.scope = [ctx.actor];
      else if (p.scope === 'atacante_original') ctx.scope = ctx.additionalTargets?.slice(0, 1) ?? [];
      else if (p.scope === 'todos_inimigos') ctx.scope = ctx.allTargets?.filter(t => t.teamId !== ctx.actor.teamId) ?? ctx.scope;
      else if (p.scope === 'todos_aliados') ctx.scope = ctx.allTargets?.filter(t => t.teamId === ctx.actor.teamId) ?? ctx.scope;
      else if (p.scope === 'aleatorio_inimigo') ctx.scope = pickRandomFromTeam(ctx, false);
      else if (p.scope === 'aleatorio_aliado') ctx.scope = pickRandomFromTeam(ctx, true);
      // Linha/raio/cone/quadrado: a geometria já foi resolvida fora do interpretador (a Cena tem acesso a
      // cena.tokens, o núcleo headless não) — ver utils/abilityArea.ts. O nó só consome a lista pronta.
      else if (AREA_SCOPES.has(p.scope)) ctx.scope = ctx.areaTargets ?? [];
      else if (p.scope === 'escolha') { /* interceptado no interpretador: pausa o walk aguardando escolha do jogador */ }
      else ctx.scope = ctx.primaryTargets ?? ctx.scope;
    },
  });

  registerNodeType<{ dice?: string; flat: number; element: Element | null; perfurante: boolean; hits: number }>({
    type: 'dano', family: 'efeito', label: 'Dano', category: 'Combate',
    fields: [
      { key: 'dice', kind: 'dado', label: 'Dado' },
      { key: 'flat', kind: 'numero', label: 'Fixo' },
      { key: 'element', kind: 'elemento', label: 'Elemento' },
      { key: 'perfurante', kind: 'toggle', label: 'Perfurante (ignora a Defesa, dano direto ao HP)' },
      { key: 'hits', kind: 'numero', label: 'Golpes (multi-hit, cada um rolado à parte)' },
    ],
    defaults: () => ({ dice: '1d6', flat: 0, element: null, perfurante: false, hits: 1 }),
    summarize: p => `Dano ${p.dice ?? ''}+${p.flat} ${p.element ?? ''}${p.perfurante ? ' · Perfurante' : ''}${p.hits > 1 ? ` · ${p.hits}x` : ''}`.trim(),
    interpret: (p, ctx) => {
      const hits = Math.max(1, Math.floor(p.hits || 1));
      const element = p.element ?? ctx.element;
      ctx.scope = ctx.scope.map(target => {
        const multiplier = ctx.scopeMultiplier?.get(target.id) ?? 1;
        let current = target;
        for (let hit = 0; hit < hits; hit += 1) {
          const resolved = resolveCausedAndReceivedValue({
            target: 'dano', baseDice: p.dice, baseFlat: p.flat, source: ctx.actor, recipient: current,
            ctx: { element, cardId: ctx.cardId, cardTags: ctx.cardTags, context: ctx.context },
            roller: ctx.roller, label: hits > 1 ? `Dano (golpe ${hit + 1}/${hits})` : 'Dano',
          });
          const amount = Math.round(resolved.total * multiplier);
          const r = applyDamage(current, amount, element, ctx.roller, p.perfurante);
          ctx.trace.push({ node: 'dano', detail: `${resolved.steps.join(' · ')}${hits > 1 ? ` (golpe ${hit + 1}/${hits})` : ''} → ${r.appliedDamage} de dano${p.perfurante ? ' perfurante' : ''} em ${current.name}` });
          current = r.target;
        }
        return current;
      });
      ctx.commit?.();
    },
  });

  registerNodeType<{ dice?: string; flat: number; recurso: 'vida' | 'aura' | 'ambos' }>({
    type: 'cura', family: 'efeito', label: 'Cura', category: 'Combate',
    fields: [
      { key: 'dice', kind: 'dado', label: 'Dado' }, { key: 'flat', kind: 'numero', label: 'Fixo' },
      { key: 'recurso', kind: 'select', label: 'Recupera', options: [
        { value: 'vida', label: 'Vida' }, { value: 'aura', label: 'Aura' }, { value: 'ambos', label: 'Vida e Aura' } ] },
    ],
    defaults: () => ({ dice: '1d4', flat: 0, recurso: 'vida' }),
    summarize: p => `Cura ${p.dice ?? ''}+${p.flat}${p.recurso !== 'vida' ? ` (${p.recurso === 'aura' ? 'Aura' : 'Vida+Aura'})` : ''}`.trim(),
    interpret: (p, ctx) => {
      const recurso = p.recurso ?? 'vida';
      ctx.scope = ctx.scope.map(target => {
        const multiplier = ctx.scopeMultiplier?.get(target.id) ?? 1;
        const resolved = resolveCausedAndReceivedValue({
          target: 'cura', baseDice: p.dice, baseFlat: p.flat, source: ctx.actor, recipient: target,
          ctx: { cardId: ctx.cardId, cardTags: ctx.cardTags, context: ctx.context, resource: 'vida' },
          roller: ctx.roller, label: 'Cura',
        });
        const amount = Math.round(resolved.total * multiplier);
        let current = target;
        if (recurso === 'vida' || recurso === 'ambos') {
          const r = applyHeal(current, amount);
          ctx.trace.push({ node: 'cura', detail: `${resolved.steps.join(' · ')} → ${-r.appliedDamage} de cura em ${current.name}` });
          current = r.target;
        }
        if (recurso === 'aura' || recurso === 'ambos') {
          const r = applyAuraRestore(current, amount);
          ctx.trace.push({ node: 'cura', detail: `${-r.appliedDamage} de Aura recuperada em ${current.name}` });
          current = r.target;
        }
        return current;
      });
      ctx.commit?.();
    },
  });

  interface AplicarCondicaoProps {
    conditionName: string;
    intensity: ConditionIntensity;
    rounds: number;
    chance: number;
    maxStacks: number;
    savingThrowDice: string;
    savingThrowMinimum: number;
    [key: string]: unknown;
  }

  registerNodeType<AplicarCondicaoProps>({
    type: 'aplicar_condicao', family: 'efeito', label: 'Aplicar condição', category: 'Combate',
    fields: [
      { key: 'conditionName', kind: 'select', label: 'Condição', options: [
        'Vulnerável', 'Exposto', 'Marcado', 'Sangrando', 'Queimando', 'Congelado', 'Eletrizado',
        'Molhado', 'Enraizado', 'Frágil', 'Silenciado', 'Atordoado', 'Derrubado', 'Cego', 'Amedrontado',
      ].map(k => ({ value: k, label: k })) },
      { key: 'intensity', kind: 'select', label: 'Intensidade', options: [
        { value: 'fraco', label: 'Fraco' }, { value: 'normal', label: 'Normal' }, { value: 'forte', label: 'Forte' },
      ] },
      { key: 'rounds', kind: 'numero', label: 'Duração (rodadas)' },
      { key: 'chance', kind: 'numero', label: 'Chance de aplicar (%)' },
      { key: 'maxStacks', kind: 'numero', label: 'Acumula até (stacks)' },
      { key: 'savingThrowDice', kind: 'texto', label: 'Teste de resistência (dado, ex.: 1d20)' },
      { key: 'savingThrowMinimum', kind: 'numero', label: 'Resistência: mínimo para resistir' },
    ],
    defaults: () => ({ conditionName: 'Queimando', intensity: 'normal', rounds: 2, chance: 100, maxStacks: 1, savingThrowDice: '', savingThrowMinimum: 0 }),
    summarize: p => `Aplica ${p.conditionName} (${p.chance}% chance)`,
    interpret: (p, ctx) => {
      const kind = conditionKindByName(p.conditionName);
      if (!kind) { ctx.trace.push({ node: 'aplicar_condicao', detail: `condição desconhecida: ${p.conditionName}` }); return; }
      const specificKeys = CONDITION_FIELD_SCHEMAS[kind].map(schema => schema.key);
      const overrides: Partial<ConditionParams> = {
        durationRounds: p.rounds,
        applicationChance: p.chance,
        maxStacks: p.maxStacks || undefined,
        savingThrow: p.savingThrowDice && p.savingThrowMinimum ? { dice: p.savingThrowDice, minimum: p.savingThrowMinimum } : null,
      } as Partial<ConditionParams>;
      for (const key of specificKeys) if (p[key] !== undefined) (overrides as Record<string, unknown>)[key] = p[key];
      const effect = buildConditionEffect(kind, p.intensity ?? 'normal', overrides);
      ctx.scope = ctx.scope.map(target => {
        if (ctx.roller('1d100', `Chance: ${p.conditionName}`) > p.chance) {
          ctx.trace.push({ node: 'aplicar_condicao', detail: `falhou na chance de aplicar ${p.conditionName} em ${target.name}` });
          return target;
        }
        if (effect.condition?.savingThrow) {
          const roll = ctx.roller(effect.condition.savingThrow.dice, `Resistência: ${p.conditionName}`);
          if (roll >= effect.condition.savingThrow.minimum) {
            ctx.trace.push({ node: 'aplicar_condicao', detail: `${target.name} resistiu a ${p.conditionName}` });
            return target;
          }
        }
        const next = applyCondition(target, effect, ctx.roller, ctx.actor.id);
        const applied = next !== target;
        if (applied) ctx.lastEffectKind?.set(target.id, p.conditionName);
        ctx.trace.push({ node: 'aplicar_condicao', detail: `${applied ? 'aplicou' : 'imune a'} ${p.conditionName} em ${target.name}` });
        return next;
      });
      ctx.commit?.();
    },
  });

  registerNodeType<{ tipo: 'sem_cooldown' | 'turnos' | 'rodadas' | 'usos'; amount: number }>({
    type: 'cooldown', family: 'efeito', label: 'Cooldown', category: 'Configuração',
    fields: [
      { key: 'tipo', kind: 'select', label: 'Tipo', options: [
        { value: 'sem_cooldown', label: 'Sem cooldown' }, { value: 'turnos', label: 'Turnos' },
        { value: 'rodadas', label: 'Rodadas' }, { value: 'usos', label: 'Usos' } ] },
      { key: 'amount', kind: 'numero', label: 'Quantidade' },
    ],
    defaults: () => ({ tipo: 'sem_cooldown', amount: 1 }),
    summarize: p => p.tipo === 'sem_cooldown' ? 'Sem cooldown' : `Cooldown: ${p.amount} ${p.tipo}`,
    interpret: (p, ctx) => { ctx.trace.push({ node: 'cooldown', detail: `Cooldown: ${p.tipo === 'sem_cooldown' ? 'nenhum' : `${p.amount} ${p.tipo}`}` }); },
  });

  registerNodeType<{ tipo: 'instantaneo' | 'turnos' | 'rodadas'; amount: number }>({
    type: 'preparacao', family: 'efeito', label: 'Preparação', category: 'Configuração',
    fields: [
      { key: 'tipo', kind: 'select', label: 'Tipo', options: [
        { value: 'instantaneo', label: 'Instantânea' }, { value: 'turnos', label: 'Turnos' }, { value: 'rodadas', label: 'Rodadas' } ] },
      { key: 'amount', kind: 'numero', label: 'Duração' },
    ],
    defaults: () => ({ tipo: 'instantaneo', amount: 1 }),
    summarize: p => p.tipo === 'instantaneo' ? 'Instantânea' : `Preparação: ${p.amount} ${p.tipo}`,
    interpret: (p, ctx) => { ctx.trace.push({ node: 'preparacao', detail: `Preparação: ${p.tipo === 'instantaneo' ? 'instantânea' : `${p.amount} ${p.tipo}`}` }); },
  });

  const GUARD_STATS = new Set<BuffStat>(['defesa_reducao', 'defesa_regeneracao', 'stagger_max', 'stagger_recuperacao', 'stagger_multiplicador_dano']);
  const AFFINITY_STATS = new Set<BuffStat>(['resistencia_elemental', 'vulnerabilidade_elemental', 'imunidade_elemental']);

  /** vida_maxima/aura_maxima só têm efeito quando lidos estruturalmente por graphFormaVisual (composição de Forma);
   * fora desse contexto o modificador fica registrado no efeito mas nenhum código de combate o aplica.
   * Os demais atributos legados (ataque/defesa/velocidade/dano/cura/aura/cura_recebida/aura_recebida) usam
   * o motor de EffectModifier (utils/effectModifiers.ts) e têm efeito real em combate. Guarda/stagger somam
   * deltas diretos (ArsenalEffect.guardModifiers); resistência/vulnerabilidade/imunidade elemental usam
   * ElementalAffinity — ambos plenamente funcionais (abilityPrimitives.ts). */
  registerNodeType<{ stat: BuffStat; operation: BuffOperation; value: number; element: Element | null; rounds: number }>({
    type: 'buff', family: 'efeito', label: 'Buff/Debuff', category: 'Combate',
    fields: [
      { key: 'stat', kind: 'select', label: 'Atributo', options: [
        { value: 'ataque', label: 'Ataque' }, { value: 'defesa', label: 'Defesa' }, { value: 'velocidade', label: 'Velocidade' },
        { value: 'vida_maxima', label: 'Vida máxima' }, { value: 'aura_maxima', label: 'Aura máxima' },
        { value: 'dano', label: 'Dano causado' }, { value: 'cura', label: 'Cura causada' }, { value: 'aura', label: 'Custo de Aura' },
        { value: 'cura_recebida', label: 'Cura recebida' }, { value: 'aura_recebida', label: 'Aura recebida' },
        { value: 'defesa_reducao', label: 'Redução de dano (Guarda)' }, { value: 'defesa_regeneracao', label: 'Regeneração de Guarda' },
        { value: 'stagger_max', label: 'Estagger máximo' }, { value: 'stagger_recuperacao', label: 'Recuperação de Estagger' },
        { value: 'stagger_multiplicador_dano', label: 'Multiplicador de dano ao estaggerar' },
        { value: 'resistencia_elemental', label: 'Resistência elemental (%)' }, { value: 'vulnerabilidade_elemental', label: 'Vulnerabilidade elemental (%)' },
        { value: 'imunidade_elemental', label: 'Imunidade elemental' },
      ] },
      { key: 'operation', kind: 'select', label: 'Operação (ignorado em Guarda/Estagger/Afinidade)', options: [
        { value: 'somar', label: 'Somar' }, { value: 'multiplicar', label: 'Multiplicar (%)' }, { value: 'definir', label: 'Definir' } ] },
      { key: 'value', kind: 'numero', label: 'Valor (± ou %, conforme o atributo)' },
      { key: 'element', kind: 'elemento', label: 'Elemento (só para afinidade elemental)' },
      { key: 'rounds', kind: 'numero', label: 'Rodadas' },
    ],
    defaults: () => ({ stat: 'ataque', operation: 'somar', value: 2, element: null, rounds: 3 }),
    summarize: p => AFFINITY_STATS.has(p.stat)
      ? `${p.stat} ${p.element ?? 'qualquer elemento'}${p.stat === 'imunidade_elemental' ? '' : ` ${p.value}%`} por ${p.rounds} rod.`
      : `${p.stat} ${GUARD_STATS.has(p.stat) ? '' : p.operation} ${p.value >= 0 ? '+' : ''}${p.value} por ${p.rounds} rod.`,
    interpret: (p, ctx) => {
      const base = {
        id: `buff-${p.stat}-${crypto.randomUUID()}`, name: `${p.stat} ${p.value}`,
        description: '', tags: [], duration: { type: 'rodadas' as const, amount: p.rounds },
        stackBehavior: 'renova_duracao' as const, maxStacks: 1, triggers: [],
        modifiers: [], periodicDamage: null, periodicHealing: null, auraConsumed: null, auraRestored: null,
        attackModifier: 0, defenseModifier: 0, speedModifier: 0, customEffect: null,
      };
      const effect = GUARD_STATS.has(p.stat)
        ? { ...base, guardModifiers: { [GUARD_STAT_KEY[p.stat as GuardBuffStat]]: p.value } }
        : AFFINITY_STATS.has(p.stat)
          ? { ...base, elementalAffinities: p.element ? [{
              element: p.element,
              kind: (p.stat === 'resistencia_elemental' ? 'resistencia' : p.stat === 'vulnerabilidade_elemental' ? 'vulnerabilidade' : 'imunidade') as 'resistencia' | 'vulnerabilidade' | 'imunidade',
              percent: p.value,
            }] : [] }
          : { ...base, modifiers: [{ stat: p.stat as LegacyBuffStat, operation: p.operation, value: p.value }] };
      ctx.scope = ctx.scope.map(target => applyCondition(target, effect, ctx.roller, ctx.actor.id));
      ctx.trace.push({ node: 'buff', detail: `${effect.name} por ${p.rounds} rodadas` });
      ctx.commit?.();
    },
  });

  registerNodeType<{ target: 'teste' | 'dano' | 'dano_extra' | 'cura'; bonusDice?: string; bonusFlat: number; elemento: Element | null; rounds: number }>({
    type: 'bonus_dado', family: 'efeito', label: 'Bônus de dado', category: 'Combate',
    fields: [
      { key: 'target', kind: 'select', label: 'Aplica em', options: [
        { value: 'teste', label: 'Teste (acerto)' }, { value: 'dano', label: 'Dano' },
        { value: 'dano_extra', label: 'Dano extra' }, { value: 'cura', label: 'Cura' } ] },
      { key: 'bonusDice', kind: 'dado', label: 'Dado extra' },
      { key: 'bonusFlat', kind: 'numero', label: 'Bônus fixo' },
      { key: 'elemento', kind: 'elemento', label: 'Elemento (vazio = qualquer)' },
      { key: 'rounds', kind: 'numero', label: 'Rodadas' },
    ],
    defaults: () => ({ target: 'teste', bonusDice: undefined, bonusFlat: 2, elemento: null, rounds: 3 }),
    summarize: p => `+${p.bonusFlat}${p.bonusDice ? `+${p.bonusDice}` : ''} em ${p.target}${p.elemento ? ` (${p.elemento})` : ''} por ${p.rounds} rod.`,
    interpret: (p, ctx) => {
      const effect = createStatusEffect({
        name: `bonus-${p.target}`, rounds: p.rounds,
        diceBonuses: [{ target: p.target, bonusDice: p.bonusDice ?? null, bonusFlat: p.bonusFlat, filter: p.elemento ? { damageType: [p.elemento] } : undefined }],
      });
      ctx.scope = ctx.scope.map(target => applyCondition(target, effect, ctx.roller, ctx.actor.id));
      ctx.trace.push({ node: 'bonus_dado', detail: `${effect.name} por ${p.rounds} rodadas` });
      ctx.commit?.();
    },
  });

  registerNodeType<{ recurso: 'vida' | 'aura'; dice?: string; flat: number; rounds: number }>({
    type: 'regeneracao', family: 'efeito', label: 'Regeneração', category: 'Combate',
    fields: [
      { key: 'recurso', kind: 'select', label: 'Recurso', options: [
        { value: 'vida', label: 'Vida' }, { value: 'aura', label: 'Aura' } ] },
      { key: 'dice', kind: 'dado', label: 'Dado' },
      { key: 'flat', kind: 'numero', label: 'Fixo' },
      { key: 'rounds', kind: 'numero', label: 'Rodadas' },
    ],
    defaults: () => ({ recurso: 'vida', dice: undefined, flat: 3, rounds: 3 }),
    summarize: p => `Regenera ${p.dice ? `${p.dice}+` : ''}${p.flat} de ${p.recurso} por ${p.rounds} rod.`,
    interpret: (p, ctx) => {
      const formula = { flat: p.flat, dice: p.dice };
      const effect = createStatusEffect({
        name: `regeneracao-${p.recurso}`, rounds: p.rounds,
        periodicHealing: p.recurso === 'vida' ? formula : null,
        auraRestored: p.recurso === 'aura' ? formula : null,
      });
      ctx.scope = ctx.scope.map(target => applyCondition(target, effect, ctx.roller, ctx.actor.id));
      ctx.trace.push({ node: 'regeneracao', detail: `${effect.name} por ${p.rounds} rodadas` });
      ctx.commit?.();
    },
  });

  registerNodeType<{ categoria: 'positivo' | 'negativo' | 'qualquer'; quantidade: number }>({
    type: 'dispersar', family: 'efeito', label: 'Dispersar efeitos', category: 'Combate',
    fields: [
      { key: 'categoria', kind: 'select', label: 'Categoria', options: [
        { value: 'positivo', label: 'Positivo (buffs)' }, { value: 'negativo', label: 'Negativo (debuffs)' },
        { value: 'qualquer', label: 'Qualquer' } ] },
      { key: 'quantidade', kind: 'numero', label: 'Quantidade' },
    ],
    defaults: () => ({ categoria: 'negativo', quantidade: 1 }),
    summarize: p => `Remove ${p.quantidade} efeito(s) ${p.categoria}`,
    interpret: (p, ctx) => {
      ctx.scope = ctx.scope.map(target => {
        const { target: next, removedNames } = removeActiveEffects(target, p.categoria, p.quantidade);
        ctx.trace.push({
          node: 'dispersar',
          detail: removedNames.length ? `Removeu ${removedNames.join(', ')} de ${target.name}` : `Nada para remover em ${target.name}`,
        });
        return next;
      });
      ctx.commit?.();
    },
  });

  registerNodeType<{ cardIds: string; tags: string; element: Element | null; cardType: '' | 'habilidade' | 'arma' | 'item' | 'forma' }>({
    type: 'liberar_cartas', family: 'efeito', label: 'Liberar cartas', category: 'Configuração',
    fields: [
      { key: 'cardIds', kind: 'texto', label: 'IDs de cartas específicas (separadas por vírgula)' },
      { key: 'tags', kind: 'texto', label: 'Libera por tags (separadas por vírgula)' },
      { key: 'element', kind: 'elemento', label: 'Libera por elemento (vazio = qualquer)' },
      { key: 'cardType', kind: 'select', label: 'Libera por tipo de carta', options: [
        { value: '', label: 'Qualquer tipo' }, { value: 'habilidade', label: 'Habilidade' },
        { value: 'arma', label: 'Arma' }, { value: 'item', label: 'Item' }, { value: 'forma', label: 'Forma' } ] },
    ],
    defaults: () => ({ cardIds: '', tags: '', element: null, cardType: '' }),
    summarize: p => {
      const parts: string[] = [];
      if (p.cardIds?.trim()) parts.push(`cartas: ${p.cardIds}`);
      if (p.tags?.trim()) parts.push(`tags: ${p.tags}`);
      if (p.element) parts.push(`elemento: ${p.element}`);
      if (p.cardType) parts.push(`tipo: ${p.cardType}`);
      return parts.length ? `Libera ${parts.join(' · ')}` : 'Libera cartas (sem critério configurado)';
    },
    interpret: (p, ctx) => {
      const cardIds = (p.cardIds ?? '').split(',').map(s => s.trim()).filter(Boolean);
      const tags = (p.tags ?? '').split(',').map(s => s.trim()).filter(Boolean);
      const intent = { cardIds, tags, element: p.element ?? null, cardType: p.cardType || null };
      ctx.unlockCardIntents = [...(ctx.unlockCardIntents ?? []), intent];
      ctx.ongoingEffectIntents = (ctx.ongoingEffectIntents ?? []).map(effectIntent => ({
        ...effectIntent,
        unlockCardIntents: [...(effectIntent.unlockCardIntents ?? []), intent],
      }));
      ctx.trace.push({ node: 'liberar_cartas', detail: cardIds.length || tags.length || p.element || p.cardType ? `Libera cartas (${[cardIds.length ? `${cardIds.length} por id` : '', tags.length ? `${tags.length} por tag` : '', p.element ?? '', p.cardType ?? ''].filter(Boolean).join(', ')})` : 'Nenhum critério de liberação configurado' });
    },
  });
}
