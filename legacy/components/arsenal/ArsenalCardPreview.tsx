import React from 'react';
import { Clock3, Dices, Layers3, Shield, Sparkles, Swords, Target, Zap } from 'lucide-react';
import type { ResolvedAction } from '../../utils/actions';
import type { ArsenalCard, ArsenalEffect, TargetConfig } from '../../utils/arsenal';
import type { AbilityGraph } from '../../utils/abilityGraph';
import { describeAbilityGraph } from '../../utils/abilityDescribe';
import { getNodeType } from '../../utils/nodeRegistry';
import { DAMAGE_TYPES } from '../../utils/theme';

interface Props {
  card?: ArsenalCard | null;
  graph?: AbilityGraph | null;
  action?: ResolvedAction | null;
  compact?: boolean;
  className?: string;
  footer?: React.ReactNode;
}

const CATEGORY: Record<ArsenalCard['category'], string> = { habilidade: 'Habilidade', selo: 'Selo', item: 'Item', arma: 'Arma' };
const ABILITY: Record<string, string> = { comum: 'Comum', protecao: 'Protecao', combo: 'Combo', forma: 'Forma' };
const TARGET: Record<TargetConfig['type'], string> = {
  proprio_usuario: 'Proprio usuario', um_alvo: 'Um alvo', multiplos_alvos: 'Multiplos alvos', todos_aliados: 'Todos os aliados',
  todos_inimigos: 'Todos os inimigos', todos_em_area: 'Todos na area', circulo_grid: 'Circulo no mapa', celula_grid: 'Celula do mapa',
  objeto_mapa: 'Objeto do mapa', campo_de_batalha: 'Campo inteiro',
};
const TRIGGER: Record<string, string> = { uso_manual: 'Uso manual', ao_atacar: 'Ao atacar', ao_ser_atacado: 'Ao ser atacado', ao_causar_dano: 'Ao causar dano', ao_receber_dano: 'Ao receber dano', inicio_turno: 'Inicio do turno', fim_turno: 'Fim do turno', inicio_rodada: 'Inicio da rodada', fim_rodada: 'Fim da rodada' };

const elementColor = (element?: string | null) => DAMAGE_TYPES.find(entry => entry.value === element)?.color;
const accentOf = (card?: ArsenalCard | null, graph?: AbilityGraph | null) => {
  if (graph?.header.element) return elementColor(graph.header.element) || '#e94b64';
  if (card?.abilityType === 'forma') return card.form?.color || '#f59e0b';
  if (card?.damage || card?.extraDamageDice) return elementColor(card.element) || '#fb7185';
  if (card?.healing) return '#6ee7b7';
  if (card?.category === 'item') return '#eab308';
  if (card?.conditions.some(condition => condition.type === 'reacao')) return '#38bdf8';
  return card?.element ? elementColor(card.element) || '#7dd3fc' : card?.category === 'arma' ? '#f59e0b' : card?.category === 'selo' ? '#a78bfa' : '#e94b64';
};
const formula = (value: ArsenalCard['damage']) => value ? `${value.flat || ''}${value.flat && value.dice ? ' + ' : ''}${value.dice ?? ''}` || '0' : '';
const duration = (effect: ArsenalEffect) => effect.duration.type === 'permanente' ? 'Permanente' : effect.duration.type === 'ate_removido' ? 'Ate ser removido' : effect.duration.type === 'enquanto_equipado' ? 'Enquanto equipada' : effect.duration.type === 'enquanto_forma_ativa' ? 'Enquanto a forma estiver ativa' : `${effect.duration.amount ?? 0} ${effect.duration.type}`;
const cooldown = (card: ArsenalCard) => card.cooldown.type === 'sem_cooldown' ? 'Sem recarga' : card.cooldown.type === 'fim_combate' ? 'Ate o fim do combate' : card.cooldown.type === 'descanso' ? 'Ate descansar' : card.cooldown.type === 'gatilho' ? 'Recarga por evento' : `${card.cooldown.amount} ${card.cooldown.type}`;
const preparation = (card: ArsenalCard) => { const timing = card.preparation.timing; if (timing.type === 'instantaneo') return 'Instantanea'; if (timing.type === 'turnos' || timing.type === 'rodadas') return `${timing.amount} ${timing.type}`; return timing.type.replaceAll('_', ' '); };
const summarizeGraphNode = (type: string, props: Record<string, unknown>) => {
  const def = getNodeType(type);
  if (!def) return type.replaceAll('_', ' ');
  return def.summarize(props);
};
const graphDetails = (graph?: AbilityGraph | null) => {
  if (!graph) return null;
  const count = (family: string) => graph.nodes.filter(node => node.family === family).length;
  const branchEdges = graph.edges.filter(edge => edge.branch).length;
  const progressiveNodes = graph.nodes.filter(node => (node.enabledFromLevel ?? 1) > 1).length;
  const overrideCount = graph.levelProfiles.reduce((total, profile) => total + profile.overrides.length, 0);
  const steps = graph.nodes
    .filter(node => node.family !== 'gatilho')
    .slice(0, 5)
    .map(node => summarizeGraphNode(node.type, node.props));
  return {
    triggers: count('gatilho'),
    targets: count('alvo'),
    effects: count('efeito'),
    branches: count('ramo'),
    branchEdges,
    progressiveNodes,
    overrideCount,
    steps,
  };
};

const Chip: React.FC<{ icon?: React.ReactNode; label: string; value: string; accent?: string }> = ({ icon, label, value, accent }) => (
  <span style={chip}>
    <i style={{ color: accent ?? '#8290a1', display: 'grid', flex: '0 0 auto' }}>{icon}</i>
    <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <small style={{ color: '#aab4c2', fontSize: 7.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</small>
      <b style={{ color: '#f3f6fb', fontSize: 9.5, fontWeight: 800, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{value}</b>
    </span>
  </span>
);

export default function ArsenalCardPreview({ card, graph, action, compact = false, className, footer }: Props) {
  const accent = accentOf(card, graph);
  const name = graph?.header.name ?? card?.name ?? action?.name ?? 'Carta sem nome';
  const category = graph ? 'Habilidade' : card ? CATEGORY[card.category] : action?.category === 'atacar' ? 'Ataque' : action?.category === 'item' ? 'Item' : 'Habilidade';
  const minHeight = compact ? 340 : 460;
  const graphSummary = React.useMemo(() => !compact && graph ? describeAbilityGraph(graph) : '', [compact, graph]);
  const description = graphSummary || graph?.header.description || card?.description || action?.description || 'Sem descricao.';
  const image = graph?.header.icon || card?.icon || action?.image;
  const target = graph ? TARGET[graph.header.target.type] : card ? TARGET[card.target.type] : action?.targeting === 'self' ? 'Proprio usuario' : 'Um alvo';
  const effects = card?.effects ?? [];
  const artPosition = graph?.header.iconPosition || card?.iconPosition || '50% 50%';
  const maxGraphLevel = Math.max(1, ...(graph?.levelProfiles ?? []).map(item => item.level));
  const graphInfo = graphDetails(graph);
  const nameBlock = <div><h3 style={{ fontSize: compact ? 17 : 21, color: '#f8fafc', lineHeight: 1.15, margin: 0 }}>{name}</h3>{card?.levels.length ? <span style={level}>ATE NV {Math.max(...card.levels.map(item => item.level), 1)}</span> : graph && maxGraphLevel > 1 ? <span style={level}>ATE NV {maxGraphLevel}</span> : null}</div>;

  return (
    <article className={className} data-testid="arsenal-card-preview" data-has-art={image ? 'true' : 'false'} data-art-layout="full" style={{ ...shell, minHeight, borderColor: `${accent}66`, boxShadow: compact ? `0 10px 28px ${accent}0f` : `0 18px 55px ${accent}12` }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: -1, backgroundImage: image ? `url(${image})` : undefined, backgroundSize: 'cover', backgroundPosition: artPosition }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: -1, background: image ? 'linear-gradient(180deg,rgba(8,10,14,.04) 0%,rgba(8,10,14,.18) 38%,rgba(7,9,13,.48) 66%,rgba(6,8,12,.78) 100%)' : `radial-gradient(circle at 66% 22%,${accent}38,transparent 44%),linear-gradient(145deg,#151922,#090b10)` }} />
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 15px 0' }}>
        <span style={{ ...pillBase, color: accent, borderColor: `${accent}55` }}>{category}{card?.abilityType && card.abilityType !== 'comum' ? ` · ${ABILITY[card.abilityType]}` : ''}</span>
        {(graph?.header.element || card?.element) && <span style={{ ...pillBase, color: accent, border: 'none' }}>{graph?.header.element ?? card?.element}</span>}
      </div>
      <div style={{ ...body, padding: compact ? 12 : 15, gap: compact ? 9 : 12, position: 'relative', marginTop: 'auto', background: 'linear-gradient(180deg,rgba(7,9,13,.14) 0%,rgba(7,9,13,.58) 22%,rgba(6,8,12,.82) 100%)', textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>
        {nameBlock}
        <p style={{ fontSize: compact ? 10.5 : 11.5, color: '#d7dee8', lineHeight: 1.55, margin: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{description}</p>
        <div style={chips}>
          {(card?.testDice || action?.diceRoll) && <Chip icon={<Dices size={12} />} label="Teste" value={card?.testDice ?? action!.diceRoll} accent={accent} />}
          <Chip icon={<Target size={12} />} label="Alvo" value={target} />
          {(card?.auraConsumed || action?.auraCost) ? <Chip icon={<Zap size={12} />} label="Aura" value={card?.auraConsumed ? formula(card.auraConsumed) : String(action?.auraCost ?? 0)} accent="#c4b5fd" /> : null}
          {card?.ammoConsumed ? <Chip icon={<Target size={12} />} label="Municao" value={formula(card.ammoConsumed)} accent="#f5b93f" /> : null}
          {card?.charges && <Chip icon={<Layers3 size={12} />} label="Cargas" value={`${card.charges.current}/${card.charges.maximum}`} />}
          {graph?.header.charges && <Chip icon={<Layers3 size={12} />} label="Cargas" value={`${graph.header.charges.current}/${graph.header.charges.maximum}`} />}
        </div>
        {(card?.damage || card?.extraDamageDice || card?.healing || card?.auraRestored || card?.ammoRestored || action?.damage || action?.healHp || action?.healAura) && <section style={section}>
          <span style={sectionTitle}>RESULTADOS</span><div style={resultGrid}>
            {(card?.damage || action?.damage) ? <Chip icon={<Swords size={12} />} label="Dano" value={`${card?.damage ? formula(card.damage) : action?.damage}${card?.element ? ` · ${card.element}` : action?.damageType ? ` · ${action.damageType}` : ''}`} accent="#fb7185" /> : null}
            {card?.extraDamageDice && <Chip icon={<Dices size={12} />} label="Dano extra" value={card.extraDamageDice} accent="#fb7185" />}
            {(card?.healing || action?.healHp) ? <Chip icon={<Sparkles size={12} />} label="Cura" value={card?.healing ? formula(card.healing) : String(action?.healHp)} accent="#6ee7b7" /> : null}
            {(card?.auraRestored || action?.healAura) ? <Chip icon={<Zap size={12} />} label="Restaura aura" value={card?.auraRestored ? formula(card.auraRestored) : String(action?.healAura)} accent="#93c5fd" /> : null}
            {card?.ammoRestored && <Chip icon={<Target size={12} />} label="Restaura municao" value={formula(card.ammoRestored)} accent="#f5b93f" />}
          </div>
        </section>}
        {!compact && card && <section style={section}><span style={sectionTitle}>RITMO E USO</span><div style={resultGrid}><Chip icon={<Clock3 size={12} />} label="Preparacao" value={preparation(card)} /><Chip icon={<Clock3 size={12} />} label="Recarga" value={cooldown(card)} />{card.area && <Chip icon={<Target size={12} />} label="Area" value={`${card.area.shape} · ${card.area.size} ${card.area.unit}`} />}</div></section>}
        {effects.length > 0 && <section style={section}><span style={sectionTitle}>EFEITOS</span><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{effects.map((effect, index) => <div key={`${effect.id}-${index}`} style={effectRow}><Sparkles size={12} color={accent} /><span><b>{effect.name}</b><small>{effect.description || `${duration(effect)} · ${effect.stackBehavior.replaceAll('_', ' ')}`}</small></span></div>)}</div></section>}
        {!compact && card && card.conditions.length > 0 && <section style={section}><span style={sectionTitle}>REQUISITOS</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{card.conditions.map((condition, index) => <span key={index} style={tag}><Shield size={10} />{condition.type.replaceAll('_', ' ')}</span>)}</div></section>}
        {!compact && graph && graphInfo && <section style={section}>
          <span style={sectionTitle}>GRAFO</span>
          <div style={resultGrid}>
            <Chip icon={<Sparkles size={12} />} label="Nos" value={String(graph.nodes.length)} accent={accent} />
            <Chip icon={<Layers3 size={12} />} label="Fluxos" value={String(graph.edges.length)} />
            <Chip icon={<Zap size={12} />} label="Gatilhos" value={String(graphInfo.triggers)} accent={accent} />
            <Chip icon={<Target size={12} />} label="Alvos" value={String(graphInfo.targets)} />
            <Chip icon={<Swords size={12} />} label="Efeitos" value={String(graphInfo.effects)} accent="#fb7185" />
            {graphInfo.branches > 0 && <Chip icon={<Shield size={12} />} label="Ramos" value={`${graphInfo.branches} / ${graphInfo.branchEdges} saidas`} />}
            {graphInfo.progressiveNodes > 0 && <Chip icon={<Layers3 size={12} />} label="Progressao" value={`${graphInfo.progressiveNodes} nos + ${graphInfo.overrideCount} ajustes`} />}
            {graph.header.area && <Chip icon={<Target size={12} />} label="Area" value={`${graph.header.area.shape} · ${graph.header.area.size} ${graph.header.area.unit}`} />}
          </div>
          {graphInfo.steps.length > 0 && <div style={graphSteps}>
            {graphInfo.steps.map((step, index) => <span key={`${step}-${index}`} style={graphStep}><b>{index + 1}</b>{step}</span>)}
          </div>}
        </section>}
        {graph?.header.tags.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{graph.header.tags.slice(0, compact ? 4 : 8).map(tagName => <span key={tagName} style={tag}>{tagName}</span>)}</div> : null}
        {card?.tags.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{card.tags.slice(0, compact ? 4 : 8).map(tagName => <span key={tagName} style={tag}>{tagName}</span>)}</div> : null}
      </div>
      {footer && <footer style={footerStyle}>{footer}</footer>}
    </article>
  );
}

const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignSelf: 'start', position: 'relative', isolation: 'isolate', width: '100%', minWidth: 0, height: 'auto', boxSizing: 'border-box', overflow: 'hidden', border: '1px solid rgba(255,255,255,.12)', borderRadius: 18, background: 'linear-gradient(155deg,#171b22,#0d1015)', color: '#d8e0ea', transition: 'transform .2s ease, box-shadow .2s ease' };
const pillBase: React.CSSProperties = { padding: '4px 7px', border: '1px solid', borderRadius: 999, background: 'rgba(6,9,13,.58)', backdropFilter: 'blur(8px)', fontSize: 8.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.12em' };
const body: React.CSSProperties = { display: 'flex', flexDirection: 'column' };
const chips: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 };
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 78, maxWidth: '100%', padding: '6px 8px', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, background: 'rgba(5,7,10,.34)', backdropFilter: 'blur(8px)' };
const section: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.11)' };
const sectionTitle: React.CSSProperties = { color: '#b0bac8', fontSize: 8, fontWeight: 900, letterSpacing: '.15em' };
const resultGrid: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 };
const graphSteps: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };
const graphStep: React.CSSProperties = { display: 'grid', gridTemplateColumns: '18px minmax(0,1fr)', gap: 6, alignItems: 'start', padding: '6px 8px', border: '1px solid rgba(255,255,255,.09)', borderRadius: 8, background: 'rgba(5,7,10,.26)', color: '#d7dee8', fontSize: 9.5, lineHeight: 1.35, overflowWrap: 'anywhere' };
const effectRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '16px minmax(0,1fr)', gap: 6, alignItems: 'start', padding: '7px 8px', borderRadius: 8, background: 'rgba(5,7,10,.3)', overflowWrap: 'anywhere' };
const tag: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 7px', border: '1px solid rgba(255,255,255,.12)', borderRadius: 999, color: '#d0d7e1', background: 'rgba(5,7,10,.24)', fontSize: 8.5, textTransform: 'capitalize' };
const level: React.CSSProperties = { display: 'inline-block', marginTop: 5, color: '#fbbf24', fontSize: 8, fontWeight: 900 };
const footerStyle: React.CSSProperties = { display: 'flex', gap: 7, padding: 10, borderTop: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.28)', backdropFilter: 'blur(10px)' };
