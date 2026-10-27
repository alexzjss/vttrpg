import { registerNodeType } from '../nodeRegistry';

type MoveKind = 'empurrar' | 'puxar' | 'teleportar' | 'trocar_lugar';

/** 'Silenciar' e 'Incapacitar' foram removidos: eram wrappers finos e redundantes com as condições
 *  'Silenciado'/'Atordoado' do nó 'aplicar_condicao', que já cobrem o mesmo efeito com chance de aplicar,
 *  teste de resistência, stacks e sub-campos específicos (blocksAuraCards/blocksForms/allowsReactions,
 *  losesAction/losesReaction/endsAfterTakingDamage). Use 'aplicar_condicao' para esses efeitos. */
export function registerControlNodes(): void {
  registerNodeType<{ kind: MoveKind; distance: number }>({
    type: 'mover', family: 'efeito', label: 'Mover', category: 'Controle',
    fields: [
      { key: 'kind', kind: 'select', label: 'Tipo', options: [
        { value: 'empurrar', label: 'Empurrar' }, { value: 'puxar', label: 'Puxar' },
        { value: 'teleportar', label: 'Teleportar' }, { value: 'trocar_lugar', label: 'Trocar de lugar' } ] },
      { key: 'distance', kind: 'numero', label: 'Distância' },
    ],
    defaults: () => ({ kind: 'empurrar', distance: 1 }),
    summarize: p => `${p.kind} ${p.distance}`,
    interpret: (p, ctx) => {
      for (const target of ctx.scope) {
        ctx.movementIntents = [...(ctx.movementIntents ?? []), { targetId: target.id, kind: p.kind, distance: p.distance }];
        ctx.trace.push({ node: 'mover', detail: `${p.kind} ${target.name} em ${p.distance}` });
      }
    },
  });
  registerNodeType<{ entityName: string; teamId: 'party' | 'npc'; rounds: number; maxHp: number; maxAura: number; speed: number }>({
    type: 'invocar', family: 'efeito', label: 'Invocar', category: 'Controle',
    fields: [
      { key: 'entityName', kind: 'texto', label: 'Nome da invocação' },
      { key: 'teamId', kind: 'select', label: 'Equipe', options: [{ value: 'party', label: 'Aliada' }, { value: 'npc', label: 'Inimiga' }] },
      { key: 'rounds', kind: 'numero', label: 'Rodadas (0 = permanente)' },
      { key: 'maxHp', kind: 'numero', label: 'Pontos de Vida' }, { key: 'maxAura', kind: 'numero', label: 'Aura' }, { key: 'speed', kind: 'numero', label: 'Velocidade' },
    ],
    defaults: () => ({ entityName: 'Invocação', teamId: 'party', rounds: 3, maxHp: 10, maxAura: 0, speed: 5 }),
    summarize: p => `${p.entityName} · ${p.teamId === 'party' ? 'aliada' : 'inimiga'} · ${p.rounds || 'permanente'}`,
    interpret: (p, ctx) => { ctx.summonIntents = [...(ctx.summonIntents ?? []), { entityName: p.entityName || 'Invocação', teamId: p.teamId, rounds: Math.max(0, p.rounds), maxHp: Math.max(1, p.maxHp), maxAura: Math.max(0, p.maxAura), speed: p.speed }]; ctx.trace.push({ node: 'invocar', detail: `Invoca ${p.entityName}` }); },
  });
  registerNodeType<{ intoFormId: string }>({
    type: 'transformar', family: 'efeito', label: 'Transformar', category: 'Controle',
    fields: [{ key: 'intoFormId', kind: 'texto', label: 'ID da forma' }], defaults: () => ({ intoFormId: '' }),
    summarize: p => `Forma ${p.intoFormId || 'não definida'}`,
    interpret: (p, ctx) => { if (!p.intoFormId) return; for (const target of ctx.scope) ctx.transformIntents = [...(ctx.transformIntents ?? []), { targetId: target.id, intoFormId: p.intoFormId }]; ctx.trace.push({ node: 'transformar', detail: `Transforma em ${p.intoFormId}` }); },
  });
}
