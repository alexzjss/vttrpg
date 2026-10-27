import { registerNodeType } from '../nodeRegistry';
import { applyActiveEffect, removeActiveEffect, type ArsenalActorState } from '../arsenalPipeline';
import { createStatusEffect } from './statusEffect';
import type {
  ArsenalEffect, ModifierContext, ModifierDirection, ModifierOperation, ModifierResource,
  ModifierTarget, ModifierTestKind, ValueModifier,
} from '../arsenal';
import type { Element } from '../../types';

export type ModifierStackRule = 'renovar' | 'acumular_valor' | 'acumular_duracao' | 'substituir' | 'manter_maior' | 'nao_duplicar';

export interface ModificarValorProps {
  name: string;
  target: ModifierTarget;
  operation: ModifierOperation;
  value?: number;
  dice?: string;
  rounds: number;
  chance: number;
  stackRule: ModifierStackRule;
  filterElement?: string;
  filterTags?: string;
  filterTestKind?: string;
  filterDirection?: string;
  filterResource?: string;
  filterPeriodic?: boolean;
  filterCritical?: boolean;
  filterContext?: string;
  filterCardId?: string;
  filterWeaponId?: string;
  filterFormId?: string;
  filterRequiredUserCondition?: string;
  filterRequiredTargetCondition?: string;
  filterHpSubject?: string;
  filterHpMin?: number;
  filterHpMax?: number;
  [key: string]: unknown;
}

const TARGET_LABEL: Record<ModifierTarget, string> = {
  teste: 'Teste', dano: 'Dano', cura: 'Cura',
  custo_aura: 'Custo de aura', custo_municao: 'Custo de munição', cooldown: 'Cooldown',
  defesa: 'Defesa', velocidade: 'Velocidade',
  vida_maxima: 'Vida máxima', aura_maxima: 'Aura máxima', recuperacao_aura: 'Recuperação de aura',
};

const OPERATION_LABEL: Record<ModifierOperation, string> = {
  somar: 'Somar', subtrair: 'Subtrair', multiplicar: 'Multiplicar', dividir: 'Dividir',
  adicionar_dado: 'Adicionar dado extra', remover_dado: 'Remover dado do pool',
  aumentar_dado: 'Aumentar o tipo do dado', reduzir_dado: 'Reduzir o tipo do dado',
  vantagem: 'Conceder vantagem', desvantagem: 'Conceder desvantagem',
  definir_minimo: 'Definir valor mínimo', definir_maximo: 'Definir valor máximo', definir: 'Definir valor exato',
};

/** Operações cujo campo relevante é `value` (número). */
const OPERATIONS_WITH_VALUE = new Set<ModifierOperation>(['somar', 'subtrair', 'multiplicar', 'dividir', 'remover_dado', 'aumentar_dado', 'reduzir_dado', 'definir', 'definir_minimo', 'definir_maximo']);
/** Operações cujo campo relevante é `dice` (dado). */
const OPERATIONS_WITH_DICE = new Set<ModifierOperation>(['adicionar_dado']);
/** Alvos aos quais um filtro de elemento faz sentido. */
const TARGETS_WITH_ELEMENT = new Set<ModifierTarget>(['teste', 'dano', 'cura', 'custo_aura']);
const TARGETS_WITH_DIRECTION = new Set<ModifierTarget>(['dano', 'cura']);
const TARGETS_WITH_RESOURCE = new Set<ModifierTarget>(['cura', 'recuperacao_aura', 'aura_maxima']);
const TARGETS_WITH_PERIODIC_CRITICAL = new Set<ModifierTarget>(['dano']);

export function operationUsesValue(operation: ModifierOperation): boolean { return OPERATIONS_WITH_VALUE.has(operation); }
export function operationUsesDice(operation: ModifierOperation): boolean { return OPERATIONS_WITH_DICE.has(operation); }
export function targetUsesElementFilter(target: ModifierTarget): boolean { return TARGETS_WITH_ELEMENT.has(target); }
export function targetUsesDirectionFilter(target: ModifierTarget): boolean { return TARGETS_WITH_DIRECTION.has(target); }
export function targetUsesResourceFilter(target: ModifierTarget): boolean { return TARGETS_WITH_RESOURCE.has(target); }
export function targetUsesPeriodicCriticalFilter(target: ModifierTarget): boolean { return TARGETS_WITH_PERIODIC_CRITICAL.has(target); }

function splitList(value: string | undefined): string[] | undefined {
  const list = (value ?? '').split(',').map(item => item.trim()).filter(Boolean);
  return list.length ? list : undefined;
}

/** Constrói o ValueModifier a partir das props planas do nó (a UI só edita campos primitivos). */
export function buildValueModifier(p: ModificarValorProps): ValueModifier {
  return {
    operation: p.operation,
    target: p.target,
    value: operationUsesValue(p.operation) ? p.value : undefined,
    dice: operationUsesDice(p.operation) ? p.dice : undefined,
    filter: {
      elements: p.filterElement ? [p.filterElement as Element] : undefined,
      tags: splitList(p.filterTags),
      testKinds: p.filterTestKind ? [p.filterTestKind as ModifierTestKind] : undefined,
      direction: (p.filterDirection || undefined) as ModifierDirection | undefined,
      resource: (p.filterResource || undefined) as ModifierResource | undefined,
      periodic: p.filterPeriodic || undefined,
      critical: p.filterCritical || undefined,
      contexts: p.filterContext ? [p.filterContext as ModifierContext] : undefined,
      cardIds: splitList(p.filterCardId),
      weaponIds: splitList(p.filterWeaponId),
      formIds: splitList(p.filterFormId),
      requiredUserConditions: splitList(p.filterRequiredUserCondition),
      requiredTargetConditions: splitList(p.filterRequiredTargetCondition),
      hpRange: p.filterHpSubject ? { subject: p.filterHpSubject as 'usuario' | 'alvo', min: p.filterHpMin, max: p.filterHpMax } : undefined,
    },
  };
}

/** Descrição automática, no estilo "Somar +2 em testes de reação", a partir dos campos configurados. */
export function describeValueModifier(p: ModificarValorProps): string {
  const parts: string[] = [];
  const opLabel = OPERATION_LABEL[p.operation];
  const valuePart = operationUsesValue(p.operation) && p.value != null ? ` ${p.value}` : '';
  const dicePart = operationUsesDice(p.operation) && p.dice ? ` ${p.dice}` : '';
  parts.push(`${opLabel}${valuePart}${dicePart} em ${TARGET_LABEL[p.target]}`.trim());
  const filterBits: string[] = [];
  if (p.filterElement) filterBits.push(`elemento ${p.filterElement}`);
  if (p.filterTags) filterBits.push(`tag ${p.filterTags}`);
  if (p.filterTestKind) filterBits.push(`teste de ${p.filterTestKind}`);
  if (p.filterDirection) filterBits.push(p.filterDirection === 'causado' ? 'causado por você' : 'recebido por você');
  if (p.filterResource) filterBits.push(`recurso ${p.filterResource}`);
  if (p.filterContext) filterBits.push(`em ${p.filterContext}`);
  if (p.filterRequiredTargetCondition) filterBits.push(`se o alvo estiver ${p.filterRequiredTargetCondition}`);
  if (p.filterRequiredUserCondition) filterBits.push(`se você estiver ${p.filterRequiredUserCondition}`);
  if (p.filterHpSubject) filterBits.push(`vida ${p.filterHpSubject} entre ${p.filterHpMin ?? 0}% e ${p.filterHpMax ?? 100}%`);
  if (filterBits.length) parts.push(`(só ${filterBits.join(', ')})`);
  parts.push(`por ${p.rounds} rodada${p.rounds === 1 ? '' : 's'}`);
  if (p.chance < 100) parts.push(`${p.chance}% de chance`);
  return parts.join(' ');
}

function slug(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'modificador';
}

/** Empilha o efeito de modificador respeitando a regra de acúmulo escolhida — as 4 primeiras regras usam o
 *  StackBehavior padrão do motor; "manter o maior valor" e "não permitir duplicação" precisam de um
 *  desvio local porque o motor genérico (arsenalPipeline.stackEffect) não sabe comparar valores nem tem
 *  o conceito de "recusar uma segunda aplicação por completo". */
export function applyValueModifierEffect(target: ArsenalActorState, effect: ArsenalEffect, stackRule: ModifierStackRule, sourceId?: string): ArsenalActorState {
  const already = target.effects.find(active => active.effect.id === effect.id);
  if (stackRule === 'nao_duplicar' && already) return target;
  if (stackRule === 'manter_maior' && already) {
    const currentValue = Math.abs(already.effect.valueModifiers?.[0]?.value ?? 0);
    const incomingValue = Math.abs(effect.valueModifiers?.[0]?.value ?? 0);
    if (incomingValue <= currentValue) return { ...target, effects: applyActiveEffect(removeActiveEffect(target.effects, effect.id), already.effect, already.sourceId) };
  }
  return { ...target, effects: applyActiveEffect(target.effects, effect, sourceId) };
}

export function registerModifierNodes(): void {
  registerNodeType<ModificarValorProps>({
    type: 'modificar_valor', family: 'efeito', label: 'Modificar valor', category: 'Combate',
    fields: [
      { key: 'name', kind: 'texto', label: 'Nome do buff/debuff' },
      { key: 'target', kind: 'select', label: 'O que modificar', options: Object.entries(TARGET_LABEL).map(([value, label]) => ({ value, label })) },
      { key: 'operation', kind: 'select', label: 'Operação', options: Object.entries(OPERATION_LABEL).map(([value, label]) => ({ value, label })) },
      { key: 'value', kind: 'numero', label: 'Valor' },
      { key: 'dice', kind: 'dado', label: 'Dado' },
      { key: 'rounds', kind: 'numero', label: 'Duração (rodadas)' },
      { key: 'chance', kind: 'numero', label: 'Chance de aplicar (%)' },
      { key: 'stackRule', kind: 'select', label: 'Regra de acúmulo', options: [
        { value: 'renovar', label: 'Renovar duração' }, { value: 'acumular_valor', label: 'Acumular valor' },
        { value: 'acumular_duracao', label: 'Acumular duração' }, { value: 'substituir', label: 'Substituir efeito anterior' },
        { value: 'manter_maior', label: 'Manter apenas o maior valor' }, { value: 'nao_duplicar', label: 'Não permitir duplicação' },
      ] },
      { key: 'filterElement', kind: 'elemento', label: 'Filtro: elemento' },
      { key: 'filterTags', kind: 'texto', label: 'Filtro: tags da carta (separadas por vírgula)' },
      { key: 'filterTestKind', kind: 'select', label: 'Filtro: tipo de teste', options: [
        { value: '', label: '— Qualquer —' }, { value: 'ataque', label: 'Ataque' }, { value: 'reacao', label: 'Reação' },
        { value: 'esquiva', label: 'Esquiva' }, { value: 'defesa', label: 'Defesa' }, { value: 'fisico', label: 'Físico' },
        { value: 'magico', label: 'Mágico/aura' }, { value: 'cura', label: 'Cura' },
      ] },
      { key: 'filterDirection', kind: 'select', label: 'Filtro: direção', options: [
        { value: '', label: '— Qualquer —' }, { value: 'causado', label: 'Causado por você' }, { value: 'recebido', label: 'Recebido por você' },
      ] },
      { key: 'filterResource', kind: 'select', label: 'Filtro: recurso', options: [
        { value: '', label: '— Qualquer —' }, { value: 'vida', label: 'Vida' }, { value: 'aura', label: 'Aura' },
      ] },
      { key: 'filterPeriodic', kind: 'toggle', label: 'Só dano ao longo do tempo (periódico)' },
      { key: 'filterCritical', kind: 'toggle', label: 'Só dano crítico' },
      { key: 'filterContext', kind: 'select', label: 'Filtro: contexto de uso', options: [
        { value: '', label: '— Qualquer —' }, { value: 'normal', label: 'Ação normal' }, { value: 'reacao', label: 'Reação' },
        { value: 'combo', label: 'Combo' }, { value: 'preparacao', label: 'Preparação' },
      ] },
      { key: 'filterCardId', kind: 'texto', label: 'Filtro: id de carta específica (separados por vírgula)' },
      { key: 'filterWeaponId', kind: 'texto', label: 'Filtro: id de arma equipada (separados por vírgula)' },
      { key: 'filterFormId', kind: 'texto', label: 'Filtro: id de forma ativa (separados por vírgula)' },
      { key: 'filterRequiredUserCondition', kind: 'texto', label: 'Filtro: você precisa estar com a condição' },
      { key: 'filterRequiredTargetCondition', kind: 'texto', label: 'Filtro: alvo precisa estar com a condição' },
      { key: 'filterHpSubject', kind: 'select', label: 'Filtro: faixa de vida de', options: [
        { value: '', label: '— Nenhuma —' }, { value: 'usuario', label: 'Você' }, { value: 'alvo', label: 'Alvo' },
      ] },
      { key: 'filterHpMin', kind: 'numero', label: 'Filtro: vida mínima (%)' },
      { key: 'filterHpMax', kind: 'numero', label: 'Filtro: vida máxima (%)' },
    ],
    defaults: () => ({
      name: '', target: 'dano', operation: 'somar', value: 2, dice: undefined, rounds: 2, chance: 100, stackRule: 'renovar',
      filterElement: undefined, filterTags: undefined, filterTestKind: undefined, filterDirection: undefined, filterResource: undefined,
      filterPeriodic: false, filterCritical: false, filterContext: undefined, filterCardId: undefined, filterWeaponId: undefined,
      filterFormId: undefined, filterRequiredUserCondition: undefined, filterRequiredTargetCondition: undefined,
      filterHpSubject: undefined, filterHpMin: undefined, filterHpMax: undefined,
    }),
    summarize: p => describeValueModifier(p),
    interpret: (p, ctx) => {
      const modifier = buildValueModifier(p);
      const name = p.name?.trim() || `${OPERATION_LABEL[p.operation]} — ${TARGET_LABEL[p.target]}`;
      const effect = createStatusEffect({
        name, rounds: p.rounds, description: describeValueModifier(p), valueModifiers: [modifier],
        stackBehavior: p.stackRule === 'acumular_valor' ? 'acumula_intensidade' : p.stackRule === 'acumular_duracao' ? 'acumula_duracao' : 'renova_duracao',
        maxStacks: p.stackRule === 'acumular_valor' ? 99 : 1,
      });
      effect.id = `modifier-${slug(name)}`;
      ctx.scope = ctx.scope.map(target => {
        if (ctx.roller('1d100', `Chance: ${name}`) > p.chance) {
          ctx.trace.push({ node: 'modificar_valor', detail: `falhou na chance de aplicar ${name} em ${target.name}` });
          return target;
        }
        const next = applyValueModifierEffect(target, effect, p.stackRule, ctx.actor.id);
        ctx.trace.push({ node: 'modificar_valor', detail: `${next === target ? 'sem efeito' : 'aplicou'} ${name} em ${target.name}` });
        return next;
      });
      ctx.commit?.();
    },
  });
}
