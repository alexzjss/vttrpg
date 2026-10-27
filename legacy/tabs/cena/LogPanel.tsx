import React from 'react';
import { Dices, HeartPulse, ScrollText, Search, Sparkles, Swords, X } from 'lucide-react';
import type { CenaLogEntry } from '../../utils/cena';

export interface LogPanelProps {
  log: CenaLogEntry[];
  hiddenEntryIds?: string[];
  notes: string;
  onNotesChange: (next: string) => void;
  streamingMode?: boolean;
  readOnly?: boolean;
}

interface Milestone { icon: string; label: string; tone: string }
interface ResultSummary { label: string; value: string; detail?: string; tone: 'damage' | 'heal' | 'effect' | 'avoid' | 'neutral' | 'defeat' }
interface ResolutionGroup {
  id: string;
  action: string;
  actor?: string;
  target?: string;
  entries: CenaLogEntry[];
  damage: number;
  healing: number;
  aura: number;
  effects: string[];
  outcome: 'success' | 'failure' | 'mixed' | 'neutral';
}

const PANEL: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
  background: '#101013', border: '1px solid #1e1e24', borderRadius: 3,
  clipPath: 'polygon(0 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%)',
};
const tab = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '13px 0', textAlign: 'center', cursor: 'pointer',
  fontFamily: "'Barlow Semi Condensed',sans-serif", fontWeight: active ? 700 : 600,
  fontSize: 13, letterSpacing: '2.5px', background: 'transparent', border: 'none',
  color: active ? '#8ce9ff' : '#61788b',
  borderBottom: active ? '2px solid #8ce9ff' : '2px solid transparent',
});

const LogPanel: React.FC<LogPanelProps> = ({ log, hiddenEntryIds = [], notes, onNotesChange, streamingMode = false, readOnly = false }) => {
  const [view, setView] = React.useState<'log' | 'notes'>('log');
  const [query, setQuery] = React.useState('');
  const feedRef = React.useRef<HTMLDivElement>(null);
  const visibleLog = React.useMemo(() => log.filter(entry => !hiddenEntryIds.includes(entry.id)), [log, hiddenEntryIds]);
  const q = query.trim().toLocaleLowerCase('pt-BR');
  const searchedLog = React.useMemo(() => {
    if (!q) return visibleLog;
    return visibleLog.filter(entry => {
      const haystack = [entry.text, entry.roll?.actorLabel, entry.roll?.targetLabel, entry.details?.actorLabel, entry.details?.targetLabel, entry.details?.actionLabel]
        .filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
      return haystack.includes(q);
    });
  }, [visibleLog, q]);
  const resolutionGroups = React.useMemo<ResolutionGroup[]>(() => {
    const groups: ResolutionGroup[] = [];
    const byKey = new Map<string, ResolutionGroup>();
    for (const entry of visibleLog) {
      const d = entry.details;
      const action = d?.actionLabel;
      if (!action) continue;
      const actor = d.actorLabel ?? entry.roll?.actorLabel;
      const target = d.targetLabel ?? entry.roll?.targetLabel;
      const key = `${action}|${actor ?? ''}|${target ?? ''}`;
      let group = byKey.get(key);
      if (!group) {
        group = { id: key, action, actor, target, entries: [], damage: 0, healing: 0, aura: 0, effects: [], outcome: 'neutral' };
        byKey.set(key, group);
        groups.push(group);
      }
      group.entries.push(entry);
      if (d?.resource === 'HP' && typeof d.amount === 'number') {
        if (/recupera|cura/i.test(entry.text)) group.healing += d.amount;
        else group.damage += d.amount;
      }
      if (d?.resource === 'Aura' && typeof d.amount === 'number') group.aura += d.amount;
      if (d?.sourceLabel && !group.effects.includes(d.sourceLabel)) group.effects.push(d.sourceLabel);
      if (d?.outcome === 'failure' || entry.roll?.success === false) group.outcome = group.outcome === 'success' ? 'mixed' : 'failure';
      if (d?.outcome === 'success' || d?.outcome === 'applied' || d?.outcome === 'renewed' || entry.roll?.success === true) group.outcome = group.outcome === 'failure' ? 'mixed' : 'success';
    }
    return groups.slice(-5).reverse();
  }, [visibleLog]);
  const milestones = React.useMemo(() => {
    const map = new Map<string, Milestone[]>();
    const push = (id: string, milestone: Milestone) => map.set(id, [...(map.get(id) ?? []), milestone]);
    let firstCrit = false, firstFumble = false, firstDefeat = false;
    let maxDamage = 0, maxDamageId: string | null = null;
    for (const entry of visibleLog) {
      if (entry.roll && entry.roll.individualRolls.length === 1 && entry.roll.numSides === 20) {
        const die = entry.roll.individualRolls[0];
        if (die === 20 && !firstCrit) { push(entry.id, { icon: '🎯', label: 'Primeiro crítico', tone: '#fbbf24' }); firstCrit = true; }
        else if (die === 1 && !firstFumble) { push(entry.id, { icon: '💀', label: 'Primeira falha crítica', tone: '#94a3b8' }); firstFumble = true; }
      }
      if (entry.kind === 'damage' && entry.details?.resource === 'HP' && typeof entry.details.amount === 'number' && !/recupera|cura/i.test(entry.text)) {
        if (entry.details.amount > maxDamage) { maxDamage = entry.details.amount; maxDamageId = entry.id; }
      }
      if (entry.kind === 'system' && entry.details?.outcome === 'defeated' && !firstDefeat) {
        push(entry.id, { icon: '☠', label: 'Primeira queda da sessão', tone: '#fb7185' });
        firstDefeat = true;
      }
    }
    if (maxDamageId && maxDamage > 0) push(maxDamageId, { icon: '🔥', label: 'Maior dano da sessão', tone: '#f97316' });
    return map;
  }, [visibleLog]);
  const lastVisibleId = visibleLog[visibleLog.length - 1]?.id;
  React.useEffect(() => {
    if (view === 'log') feedRef.current?.scrollTo?.({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [lastVisibleId, view]);
  const iconFor = (entry: CenaLogEntry) => {
    if (entry.kind === 'roll') return <Dices size={13} />;
    if (entry.kind === 'damage') return /recupera|cura/i.test(entry.text) ? <HeartPulse size={13} /> : <Swords size={13} />;
    if (entry.kind === 'condition') return <Sparkles size={13} />;
    return <ScrollText size={13} />;
  };
  const accentFor = (entry: CenaLogEntry) => {
    if (entry.kind === 'damage') return /recupera|cura/i.test(entry.text)
      ? { border: '#22c55e', wash: 'rgba(34,197,94,.09)' }
      : { border: '#E0102B', wash: 'rgba(224,16,43,.1)' };
    if (entry.kind === 'condition') return { border: '#a78bfa', wash: 'rgba(167,139,250,.08)' };
    return { border: '#6286aa', wash: 'rgba(105,196,255,.07)' };
  };
  const resultSummary = (entry: CenaLogEntry): ResultSummary | null => {
    const d = entry.details;
    if (entry.roll?.success === false) return {
      label: 'Resultado final',
      value: 'Evitou',
      detail: entry.roll.targetLabel ? `${entry.roll.targetLabel} resistiu ou esquivou.` : 'A rolagem falhou.',
      tone: 'avoid',
    };
    if (entry.roll?.success === true) return {
      label: 'Resultado final',
      value: 'Acertou',
      detail: entry.roll.targetLabel ? `${entry.roll.actorLabel} superou ${entry.roll.targetLabel}.` : 'Rolagem bem-sucedida.',
      tone: 'neutral',
    };
    if (!d) return null;
    const target = d.targetLabel ? ` em ${d.targetLabel}` : '';
    if (entry.kind === 'damage' && d.resource) {
      const amount = d.amount ?? 0;
      const isHeal = /recupera|cura/i.test(entry.text);
      if (amount === 0 || d.outcome === 'immune') return {
        label: 'Resultado final',
        value: 'Sem dano',
        detail: `${d.actionLabel ?? 'Ação'} não causou perda de ${d.resource}${target}.`,
        tone: 'avoid',
      };
      return {
        label: isHeal ? 'Recuperou' : 'Causou',
        value: `${isHeal ? '+' : '-'}${amount} ${d.resource}`,
        detail: [d.damageType, d.actionLabel, d.targetLabel].filter(Boolean).join(' · '),
        tone: isHeal ? 'heal' : 'damage',
      };
    }
    if (entry.kind === 'condition' && d.sourceLabel) return {
      label: d.outcome === 'renewed' ? 'Efeito renovado' : 'Efeito aplicado',
      value: d.sourceLabel,
      detail: [d.durationLabel, d.remainingLabel, d.targetLabel].filter(Boolean).join(' · '),
      tone: 'effect',
    };
    if (d.outcome === 'failure') return {
      label: 'Resultado final',
      value: 'Evitou',
      detail: `${d.targetLabel ?? 'O alvo'} evitou ${d.actionLabel ?? 'o efeito'}.`,
      tone: 'avoid',
    };
    if (d.outcome === 'defeated') return {
      label: 'Resultado final',
      value: 'Derrotado',
      detail: d.targetLabel ?? entry.text,
      tone: 'defeat',
    };
    if (d.outcome === 'expired') return {
      label: 'Resultado final',
      value: 'Expirou',
      detail: d.sourceLabel ?? d.actionLabel,
      tone: 'neutral',
    };
    return null;
  };
  const ResultFooter = ({ entry }: { entry: CenaLogEntry }) => {
    const result = resultSummary(entry);
    if (!result) return null;
    return <div className={`cena-log-result is-${result.tone}`}>
      <span>{result.label}</span>
      <strong>{result.value}</strong>
      {result.detail && <small>{result.detail}</small>}
    </div>;
  };
  const MilestoneBadges = ({ id }: { id: string }) => {
    const list = milestones.get(id);
    if (!list?.length) return null;
    return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
      {list.map((m, index) => <span key={index} className="cena-log-milestone" style={{ color: m.tone, borderColor: `${m.tone}55`, background: `${m.tone}18` }}>
        <span aria-hidden>{m.icon}</span>{m.label}
      </span>)}
    </div>;
  };
  const ResolutionPanel = () => {
    if (!resolutionGroups.length) return null;
    const current = resolutionGroups[0];
    const steps = current.entries.map(entry => {
      const summary = resultSummary(entry);
      return {
        id: entry.id,
        label: summary?.value ?? (entry.kind === 'roll' ? 'Rolagem' : entry.kind === 'condition' ? 'Efeito' : entry.kind === 'damage' ? 'Recurso' : 'Sistema'),
        text: entry.text,
      };
    }).slice(-6);
    return <section className={`cena-resolution-panel is-${current.outcome}`} aria-label="Painel de resolucao">
      <div className="cena-resolution-panel__head">
        <span>RESOLUCAO</span>
        <strong>{current.action}</strong>
        <small>{[current.actor, current.target ? `alvo: ${current.target}` : null].filter(Boolean).join(' · ')}</small>
      </div>
      <div className="cena-resolution-panel__totals">
        <span><b>{current.damage}</b><em>DANO</em></span>
        <span><b>{current.healing}</b><em>CURA</em></span>
        <span><b>{current.aura}</b><em>AURA</em></span>
        <span><b>{current.effects.length}</b><em>EFEITOS</em></span>
      </div>
      <ol className="cena-resolution-panel__steps">
        {steps.map(step => <li key={step.id}><b>{step.label}</b><span>{step.text}</span></li>)}
      </ol>
    </section>;
  };
  const detailChips = (entry: CenaLogEntry) => {
    const d = entry.details;
    if (!d) return null;
    const chips = [
      d.amount !== undefined ? `${d.amount} ${d.resource ?? ''}`.trim() : '',
      d.damageType ? d.damageType : '',
      d.durationLabel ? `duração: ${d.durationLabel}` : '',
      d.remainingLabel ?? '',
      ...(d.notes ?? []),
    ].filter(Boolean);
    if (!chips.length) return null;
    return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
      {chips.map((chip, index) => <span key={`${chip}-${index}`} style={{ padding: '2px 6px', borderRadius: 8, border: '1px solid rgba(120,223,242,.2)', background: 'rgba(120,223,242,.07)', color: '#91b9c5', fontSize: 9, fontWeight: 700, letterSpacing: '.35px' }}>{chip}</span>)}
    </div>;
  };
  return (
    <div className="cena-glass-panel" style={PANEL}>
      <style>{`
        @keyframes cena-roll-enter {
          0% { opacity: 0; transform: translateX(-14px); border-left-color: #fff; }
          60% { opacity: 1; transform: translateX(3px); }
          100% { transform: translateX(0); }
        }
        @keyframes cena-log-enter {
          0% { opacity: 0; transform: translateY(7px); box-shadow: 0 0 0 rgba(119,224,255,0); }
          45% { opacity: 1; transform: translateY(0); box-shadow: 0 0 22px rgba(119,224,255,.28); }
          100% { box-shadow: 0 0 0 rgba(119,224,255,0); }
        }
        @keyframes cena-roll-value { 0% { transform: scale(.55); opacity: 0; } 70% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
        .cena-log-entry { animation: cena-log-enter 760ms ease-out both; }
        .cena-roll-entry { animation: cena-roll-enter 420ms cubic-bezier(.2,1,.25,1) both, cena-log-enter 760ms ease-out both; }
        .cena-roll-value { animation: cena-roll-value 480ms 120ms cubic-bezier(.2,1.5,.3,1) both; }
        @keyframes cena-round-divider-enter { 0% { opacity: 0; transform: scaleX(.6); } 100% { opacity: 1; transform: scaleX(1); } }
        .cena-log-round-divider { display: flex; align-items: center; gap: 10px; margin: 2px 0; color: #c49a58; font: 800 10px 'Barlow Semi Condensed', sans-serif; letter-spacing: 2.5px; text-transform: uppercase; animation: cena-round-divider-enter 420ms ease-out both; }
        .cena-log-round-divider i { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, #c49a58aa, transparent); }
        .cena-log-milestone { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 999px; border: 1px solid; font-size: 9.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; transform: translateZ(0); animation: none !important; }
        .cena-log-result { margin-top: 9px; padding: 8px 10px; display: grid; grid-template-columns: auto 1fr; align-items: baseline; gap: 2px 9px; border: 1px solid rgba(255,255,255,.12); border-radius: 10px; background: linear-gradient(135deg, rgba(255,255,255,.06), rgba(0,0,0,.18)); box-shadow: inset 3px 0 var(--result-tone, #8ce9ff); }
        .cena-log-result span { color: rgba(226,232,240,.58); font: 900 8px 'Barlow Semi Condensed', sans-serif; letter-spacing: .16em; text-transform: uppercase; }
        .cena-log-result strong { color: var(--result-tone, #f8fafc); font: 900 19px 'Anton', 'Barlow Semi Condensed', sans-serif; line-height: 1; letter-spacing: .04em; text-transform: uppercase; text-shadow: 0 0 12px color-mix(in srgb, var(--result-tone, #8ce9ff) 35%, transparent); }
        .cena-log-result small { grid-column: 1 / -1; color: rgba(203,213,225,.72); font-size: 10.5px; line-height: 1.3; }
        .cena-log-result.is-damage { --result-tone: #ff4d67; background: linear-gradient(135deg, rgba(224,16,43,.17), rgba(20,8,12,.42)); border-color: rgba(255,77,103,.28); }
        .cena-log-result.is-heal { --result-tone: #4ade80; background: linear-gradient(135deg, rgba(34,197,94,.15), rgba(8,20,14,.42)); border-color: rgba(74,222,128,.26); }
        .cena-log-result.is-effect { --result-tone: #c4b5fd; background: linear-gradient(135deg, rgba(167,139,250,.16), rgba(17,12,30,.42)); border-color: rgba(196,181,253,.26); }
        .cena-log-result.is-avoid { --result-tone: #93c5fd; background: linear-gradient(135deg, rgba(59,130,246,.14), rgba(8,14,24,.42)); border-color: rgba(147,197,253,.26); }
        .cena-log-result.is-defeat { --result-tone: #fb7185; background: linear-gradient(135deg, rgba(190,18,60,.2), rgba(24,8,14,.48)); border-color: rgba(251,113,133,.3); }
        .cena-resolution-panel { margin: 10px 14px 0; padding: 11px; border: 1px solid rgba(140,233,255,.2); border-radius: 10px; background: linear-gradient(135deg, rgba(15,23,32,.92), rgba(8,10,14,.86)); box-shadow: inset 3px 0 var(--resolution-tone, #8ce9ff), 0 12px 26px rgba(0,0,0,.18); }
        .cena-resolution-panel.is-success { --resolution-tone: #22c55e; }
        .cena-resolution-panel.is-failure { --resolution-tone: #fb7185; }
        .cena-resolution-panel.is-mixed { --resolution-tone: #f59e0b; }
        .cena-resolution-panel__head { display: grid; gap: 2px; margin-bottom: 9px; }
        .cena-resolution-panel__head span { color: rgba(226,232,240,.48); font: 900 8px 'Barlow Semi Condensed', sans-serif; letter-spacing: .18em; }
        .cena-resolution-panel__head strong { color: #f8fafc; font: 900 18px 'Anton', sans-serif; line-height: 1; text-transform: uppercase; }
        .cena-resolution-panel__head small { color: rgba(203,213,225,.68); font-size: 10px; }
        .cena-resolution-panel__totals { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-bottom: 9px; }
        .cena-resolution-panel__totals span { padding: 7px 6px; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; background: rgba(255,255,255,.035); text-align: center; }
        .cena-resolution-panel__totals b { display: block; color: #f8fafc; font: 900 17px 'Anton', sans-serif; line-height: 1; }
        .cena-resolution-panel__totals em { display: block; margin-top: 3px; color: rgba(203,213,225,.55); font-style: normal; font-size: 8px; font-weight: 900; letter-spacing: .12em; }
        .cena-resolution-panel__steps { margin: 0; padding: 0; list-style: none; display: grid; gap: 5px; }
        .cena-resolution-panel__steps li { display: grid; grid-template-columns: 70px minmax(0, 1fr); gap: 8px; align-items: start; color: rgba(226,232,240,.72); font-size: 10.5px; line-height: 1.35; }
        .cena-resolution-panel__steps b { color: var(--resolution-tone, #8ce9ff); font-size: 9px; text-transform: uppercase; letter-spacing: .08em; }
        .cena-resolution-panel__steps span { overflow-wrap: anywhere; }
        @media (prefers-reduced-motion: reduce) { .cena-log-entry, .cena-roll-entry, .cena-roll-value, .cena-log-round-divider, .cena-log-milestone { animation: none; } }
      `}</style>
      <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid #1e1e24' }}>
        <button role="tab" aria-selected={view === 'log'} style={tab(view === 'log')} onClick={() => setView('log')}>LOG</button>
        {!readOnly && <button role="tab" aria-selected={view === 'notes'} style={tab(view === 'notes')} onClick={() => setView('notes')}>NOTAS</button>}
      </div>
      {view === 'log' && (
        <>
        <ResolutionPanel />
        <div style={{ position: 'relative', padding: '10px 14px 0' }}>
          <Search size={13} style={{ position: 'absolute', left: 24, top: 18, color: '#5a5a62', pointerEvents: 'none' }} />
          <input
            value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar no log…" aria-label="Buscar no log"
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 30px', background: '#15151a', border: '1px solid #26262e', borderRadius: 4, color: '#d8e4ee', fontSize: 12, outline: 'none' }}
          />
          {query && <button onClick={() => setQuery('')} aria-label="Limpar busca" style={{ position: 'absolute', right: 22, top: 16, background: 'none', border: 0, color: '#5a5a62', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>}
        </div>
        </>
      )}
      <div ref={feedRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {view === 'log' ? (
          searchedLog.length === 0 ? (
            visibleLog.length === 0
              ? <div style={{ fontSize: 13, color: '#5a5a62', fontStyle: 'italic', letterSpacing: '.5px' }}>— Nada aconteceu ainda —</div>
              : <div style={{ fontSize: 13, color: '#5a5a62', fontStyle: 'italic', letterSpacing: '.5px' }}>— Nenhum resultado para "{query}" —</div>
          ) : (
            searchedLog.map(e => e.kind === 'round' ? (
              <div key={e.id} className="cena-log-round-divider" role="separator" aria-label={e.text}>
                <i /><span>{e.text}</span><i />
              </div>
            ) : e.roll ? (
              <div key={e.id} className="cena-log-entry cena-roll-entry" style={{
                background: `linear-gradient(100deg, ${e.roll.success === false ? 'rgba(224,16,43,.12)' : 'rgba(34,197,94,.09)'}, #15151a 62%)`,
                borderLeft: `3px solid ${e.roll.success === false ? '#E0102B' : '#22c55e'}`,
                padding: '10px 12px', borderRadius: '0 3px 3px 0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '1.2px', color: '#85858e', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 6, color: '#78dff2' }}>{iconFor(e)}</span>
                      {e.roll.actorLabel}{e.roll.targetLabel ? ` × ${e.roll.targetLabel}` : ''}
                    </div>
                    <div style={{ marginTop: 3, fontSize: 11, color: '#a9a9b1', fontFamily: 'monospace' }}>
                      {e.roll.notation} · {e.roll.individualRolls.join(' + ')}{e.roll.bonus ? ` ${e.roll.bonus > 0 ? '+' : '−'} ${Math.abs(e.roll.bonus)}` : ''}
                    </div>
                  </div>
                  <strong className="cena-roll-value" style={{ fontFamily: "'Anton', sans-serif", fontSize: 28, lineHeight: 1, color: e.roll.success === false ? '#ff5066' : '#f1f1f3' }}>{e.roll.total}</strong>
                  {e.roll.targetValue !== undefined && <><span style={{ color: '#55555d', fontWeight: 900 }}>VS</span><strong style={{ fontFamily: "'Anton', sans-serif", fontSize: 22, color: '#a9a9b1' }}>{e.roll.targetValue}</strong></>}
                </div>
                <div style={{ marginTop: 7, fontSize: 12, color: '#cfcfd4', lineHeight: 1.35 }}>{e.text}</div>
                {detailChips(e)}
                <ResultFooter entry={e} />
                <MilestoneBadges id={e.id} />
              </div>
            ) : (
              <div key={e.id} className="cena-log-entry" style={{ background: `linear-gradient(100deg, ${accentFor(e).wash}, rgba(12,18,30,.72))`, borderLeft: `2px solid ${accentFor(e).border}`, padding: '10px 12px', borderRadius: '0 8px 8px 0' }}>
                <div style={{ fontSize: 14, color: '#d8e4ee', lineHeight: 1.35, display: 'flex', gap: 8, alignItems: 'flex-start' }}><span style={{ color: accentFor(e).border, flex: 'none', marginTop: 2 }}>{iconFor(e)}</span><span>{e.text}</span></div>
                {detailChips(e)}
                <ResultFooter entry={e} />
                <MilestoneBadges id={e.id} />
              </div>
            ))
          )
        ) : streamingMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: '100%', minHeight: 200, color: '#5a5a62', fontSize: 12, textAlign: 'center', padding: 20 }}>
            <span style={{ fontSize: 20 }}>🔒</span>
            <span>Notas ocultas em modo streaming.<br/>Desative o modo streaming no dashboard do mestre pra ver/editar.</span>
          </div>
        ) : (
          <textarea
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            placeholder="Anotações do mestre…"
            style={{ width: '100%', height: '100%', minHeight: 200, resize: 'none', background: '#0a0a0c',
              color: '#ececef', border: '1px solid #1e1e24', borderRadius: 3, padding: 12, fontSize: 14,
              fontFamily: "'Barlow Condensed',sans-serif", outline: 'none' }}
          />
        )}
      </div>
    </div>
  );
};

export default LogPanel;
