import React from 'react';
import { GripVertical, HeartPulse, Minus, Pause, Play, Plus, RefreshCw, Swords, Target, X, Zap } from 'lucide-react';
import type { Character } from '../../types';
import type { CenaState, NpcEntry } from '../../utils/cena';
import { applyActiveEffect, removeActiveEffect, type ActiveEffectState } from '../../utils/arsenalPipeline';
import { PREDEFINED_ARSENAL_EFFECTS } from '../../utils/arsenalEffects';

export interface OverviewPanelProps {
  characters: Character[];
  npcRoster: NpcEntry[];
  benchedCastIds: string[];
  cena: CenaState;
  onTogglePause: () => void;
  onRerollInitiative: () => void;
  onResetAllStatus: () => void;
  onUpdateCharacter: (id: string, updates: Partial<Character>) => void;
  onEditNpc: (npcId: string, updates: Partial<Character>) => void;
  onReorderTurn: (fromIndex: number, toIndex: number) => void;
}

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value || 0));
const pctBand = (value: number, max: number) => {
  if (!max) return 'low';
  const pct = (clamp(value, max) / max) * 100;
  return pct > 60 ? 'high' : pct > 30 ? 'mid' : 'low';
};

type Field = 'currentHp' | 'currentAura' | 'currentAmmo';
const STAT_FIELDS: { field: Field; max: keyof Character; label: string; icon: React.ComponentType<{ size?: number }>; tone: string }[] = [
  { field: 'currentHp', max: 'maxHp', label: 'HP', icon: HeartPulse, tone: 'hp' },
  { field: 'currentAura', max: 'maxAura', label: 'Aura', icon: Zap, tone: 'aura' },
  { field: 'currentAmmo', max: 'maxAmmo', label: 'Munição', icon: Target, tone: 'ammo' },
];

/** Linha de status arrastável: edição numérica de HP/Aura/Munição e efeitos ativos (adicionar/remover/ajustar duração). */
const RosterRow: React.FC<{
  entry: Character; isNpc: boolean; isCurrentTurn: boolean; turnNumber: number | null; draggable: boolean;
  onAdjust: (id: string, field: Field, delta: number) => void;
  onSetValue: (id: string, field: Field, value: number) => void;
  onAddEffect: (id: string, effectId: string) => void;
  onRemoveEffect: (id: string, effectId: string) => void;
  onSetEffectRemaining: (id: string, effectId: string, remaining: number) => void;
  onDragStart: () => void; onDragOver: (event: React.DragEvent) => void; onDrop: () => void;
}> = ({ entry, isNpc, isCurrentTurn, turnNumber, draggable, onAdjust, onSetValue, onAddEffect, onRemoveEffect, onSetEffectRemaining, onDragStart, onDragOver, onDrop }) => {
  const [pendingEffectId, setPendingEffectId] = React.useState('');
  const activeEffects = (entry.activeEffects ?? []) as ActiveEffectState[];
  return (
    <div className="ov-row" data-current={isCurrentTurn || undefined}
      draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
      <div className="ov-row__top">
        {draggable && <span className="ov-row__handle" aria-hidden><GripVertical size={15} /></span>}
        {turnNumber != null && <span className="ov-row__turn">{turnNumber}</span>}
        <span className="ov-row__name">{entry.name}</span>
        <span className="ov-row__badge" data-npc={isNpc || undefined}>{isNpc ? 'NPC' : 'PJ'}</span>
      </div>

      <div className="ov-row__stats">
        {STAT_FIELDS.map(({ field, max, label, icon: Icon, tone }) => {
          const maxValue = (entry[max] as number) ?? 0;
          if (tone === 'ammo' && !maxValue) return null;
          const value = entry[field] ?? 0;
          const band = tone === 'hp' || tone === 'aura' ? pctBand(value, maxValue) : undefined;
          return (
            <div className="ov-row__stat" key={field}>
              <Icon size={13} />
              <div className="ov-row__bar"><div className="ov-row__fill" data-tone={tone} data-band={band} style={{ width: `${maxValue ? clamp(value, maxValue) / maxValue * 100 : 0}%` }} /></div>
              <button aria-label={`Reduzir ${label} de ${entry.name}`} onClick={() => onAdjust(entry.id, field, -1)}><Minus size={11} /></button>
              <input aria-label={`${label} de ${entry.name}`} type="number" value={value} min={0} max={maxValue}
                onChange={e => onSetValue(entry.id, field, clamp(Number(e.target.value), maxValue))} />
              <span>/{maxValue}</span>
              <button aria-label={`Aumentar ${label} de ${entry.name}`} onClick={() => onAdjust(entry.id, field, 1)}><Plus size={11} /></button>
            </div>
          );
        })}
      </div>

      <div className="ov-row__effects">
        {activeEffects.map(active => (
          <span className="ov-row__chip" key={active.effect.id}>
            {active.effect.name}
            {active.remaining != null && <input aria-label={`Duração restante de ${active.effect.name} em ${entry.name}`} type="number" min={0} value={active.remaining}
              onChange={e => onSetEffectRemaining(entry.id, active.effect.id, Math.max(0, Number(e.target.value)))} />}
            <button aria-label={`Remover ${active.effect.name} de ${entry.name}`} onClick={() => onRemoveEffect(entry.id, active.effect.id)}><X size={10} /></button>
          </span>
        ))}
        <span className="ov-row__add-effect">
          <select aria-label={`Adicionar efeito a ${entry.name}`} value={pendingEffectId} onChange={e => setPendingEffectId(e.target.value)}>
            <option value="">+ efeito…</option>
            {PREDEFINED_ARSENAL_EFFECTS.map(effect => <option key={effect.id} value={effect.id}>{effect.name}</option>)}
          </select>
          <button aria-label={`Confirmar efeito em ${entry.name}`} disabled={!pendingEffectId} onClick={() => { if (pendingEffectId) { onAddEffect(entry.id, pendingEffectId); setPendingEffectId(''); } }}><Plus size={12} /></button>
        </span>
      </div>
    </div>
  );
};

const OverviewPanel: React.FC<OverviewPanelProps> = ({
  characters, npcRoster, benchedCastIds, cena, onTogglePause, onRerollInitiative, onResetAllStatus, onUpdateCharacter, onEditNpc, onReorderTurn,
}) => {
  const party = characters.filter(c => !benchedCastIds.includes(c.id));
  const roster: { entry: Character; isNpc: boolean }[] = [
    ...party.map(entry => ({ entry, isNpc: false })),
    ...npcRoster.map(entry => ({ entry, isNpc: true })),
  ];
  const order = cena.encounter.order;
  const inCombat = order.length > 0;
  const ordered = inCombat
    ? order.map(o => roster.find(r => r.entry.id === o.refId)).filter((r): r is typeof roster[number] => !!r)
    : roster;
  const currentTurnId = order[cena.encounter.turnIndex]?.refId;
  const currentTurnName = roster.find(r => r.entry.id === currentTurnId)?.entry.name;

  const dragIndex = React.useRef<number | null>(null);

  const update = (id: string, isNpc: boolean, updates: Partial<Character>) => (isNpc ? onEditNpc : onUpdateCharacter)(id, updates);
  const findEntry = (id: string) => roster.find(r => r.entry.id === id);

  const adjust = (id: string, field: Field, delta: number) => {
    const target = findEntry(id); if (!target) return;
    const maxKey = STAT_FIELDS.find(s => s.field === field)!.max;
    const next = clamp((target.entry[field] ?? 0) + delta, target.entry[maxKey] as number);
    update(id, target.isNpc, { [field]: next });
  };
  const setValue = (id: string, field: Field, value: number) => {
    const target = findEntry(id); if (!target) return;
    update(id, target.isNpc, { [field]: value });
  };
  const addEffect = (id: string, effectId: string) => {
    const target = findEntry(id); if (!target) return;
    const preset = PREDEFINED_ARSENAL_EFFECTS.find(effect => effect.id === effectId); if (!preset) return;
    const next = applyActiveEffect((target.entry.activeEffects ?? []) as ActiveEffectState[], preset);
    update(id, target.isNpc, { activeEffects: next });
  };
  const removeEffect = (id: string, effectId: string) => {
    const target = findEntry(id); if (!target) return;
    const next = removeActiveEffect((target.entry.activeEffects ?? []) as ActiveEffectState[], effectId);
    update(id, target.isNpc, { activeEffects: next });
  };
  const setEffectRemaining = (id: string, effectId: string, remaining: number) => {
    const target = findEntry(id); if (!target) return;
    const next = ((target.entry.activeEffects ?? []) as ActiveEffectState[]).map(active => active.effect.id === effectId ? { ...active, remaining } : active);
    update(id, target.isNpc, { activeEffects: next });
  };

  return (
    <div className="ov-panel">
      <style>{`
        .ov-panel{display:flex;flex-direction:column;gap:20px;height:100%;padding:22px clamp(16px,3vw,40px);box-sizing:border-box;overflow:auto}
        .ov-block{display:flex;flex-direction:column;gap:12px}
        .ov-block__title{color:#9098a4;font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}
        .ov-status{display:flex;align-items:center;gap:16px;padding:16px 18px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:linear-gradient(135deg,rgba(217,183,110,.08),rgba(255,255,255,.02));flex-wrap:wrap}
        .ov-status__signal{width:44px;height:44px;flex:none;display:grid;place-items:center;border-radius:12px;color:${cena.encounter.isPaused ? '#f0b76c' : '#70d49b'};background:${cena.encounter.isPaused ? 'rgba(240,183,108,.1)' : 'rgba(112,212,155,.1)'};border:1px solid currentColor}
        .ov-status h3{margin:0;color:#f0e9dc;font:600 17px 'Cinzel',serif}
        .ov-status p{margin:4px 0 0;color:#828b98;font-size:12px}
        .ov-status p b{color:${cena.encounter.isPaused ? '#e9b978' : '#78d7a0'}}
        .ov-actions{margin-left:auto;display:flex;gap:8px}
        .ov-actions button{display:flex;align-items:center;gap:7px;padding:9px 13px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#d3d8e0;font-size:11px;font-weight:800;cursor:pointer;transition:.15s}
        .ov-actions button:hover{border-color:rgba(217,183,110,.4);background:rgba(217,183,110,.08);color:#f0e6cf}
        .ov-list{display:flex;flex-direction:column;gap:8px}
        .ov-row{padding:10px 14px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:rgba(255,255,255,.02);display:flex;flex-direction:column;gap:8px}
        .ov-row[data-current]{border-color:rgba(217,183,110,.5);background:rgba(217,183,110,.06);box-shadow:0 0 0 1px rgba(217,183,110,.15) inset}
        .ov-row__top{display:flex;align-items:center;gap:8px}
        .ov-row__handle{color:#5c6472;cursor:grab;flex:none}
        .ov-row__turn{flex:none;width:20px;height:20px;display:grid;place-items:center;border-radius:6px;background:rgba(217,183,110,.16);color:#e3c58c;font-size:10px;font-weight:900}
        .ov-row__name{color:#eef1f5;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
        .ov-row__badge{flex:none;padding:2px 7px;border-radius:999px;font-size:8px;font-weight:900;letter-spacing:.08em;background:rgba(90,154,232,.15);color:#8fbdf0}
        .ov-row__badge[data-npc]{background:rgba(224,16,43,.15);color:#f0899a}
        .ov-row__stats{display:flex;gap:16px;flex-wrap:wrap}
        .ov-row__stat{display:flex;align-items:center;gap:6px;color:#8b93a0;min-width:150px;flex:1}
        .ov-row__bar{width:46px;height:5px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden;flex:none}
        .ov-row__fill{height:100%;border-radius:99px}
        .ov-row__fill[data-tone=hp][data-band=high]{background:linear-gradient(90deg,#16a34a,#22c55e)}
        .ov-row__fill[data-tone=hp][data-band=mid]{background:linear-gradient(90deg,#f97316,#fb923c)}
        .ov-row__fill[data-tone=hp][data-band=low]{background:linear-gradient(90deg,#dc2626,#f43f5e)}
        .ov-row__fill[data-tone=aura][data-band=high]{background:linear-gradient(90deg,#06b6d4,#67e8f9)}
        .ov-row__fill[data-tone=aura][data-band=mid]{background:linear-gradient(90deg,#2563eb,#60a5fa)}
        .ov-row__fill[data-tone=aura][data-band=low]{background:linear-gradient(90deg,#7e22ce,#a855f7)}
        .ov-row__fill[data-tone=ammo]{background:linear-gradient(90deg,#7dd3fc,#38bdf8)}
        .ov-row__stat button{width:19px;height:19px;flex:none;display:grid;place-items:center;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#c7cdd6;cursor:pointer}
        .ov-row__stat button:hover{border-color:rgba(217,183,110,.4);color:#f0e6cf}
        .ov-row__stat input{width:38px;padding:2px 4px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.1);border-radius:5px;color:#eef1f5;font-size:11px;font-weight:700;text-align:center}
        .ov-row__stat span{font-size:10px;color:#aeb5c0;font-weight:700}
        .ov-row__effects{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
        .ov-row__chip{display:flex;align-items:center;gap:5px;padding:3px 4px 3px 9px;border-radius:999px;background:rgba(167,139,250,.14);border:1px solid rgba(167,139,250,.28);color:#ddd6fe;font-size:10px;font-weight:700}
        .ov-row__chip input{width:30px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.1);border-radius:4px;color:#eef1f5;font-size:10px;text-align:center}
        .ov-row__chip button{display:grid;place-items:center;width:16px;height:16px;border-radius:50%;border:0;background:rgba(255,255,255,.08);color:#ddd6fe;cursor:pointer}
        .ov-row__add-effect{display:flex;gap:4px;align-items:center}
        .ov-row__add-effect select{padding:3px 6px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#c7cdd6;font-size:10px;max-width:130px}
        .ov-row__add-effect button{width:20px;height:20px;display:grid;place-items:center;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#c7cdd6;cursor:pointer}
        .ov-row__add-effect button:disabled{opacity:.4;cursor:default}
        .ov-empty{padding:26px;text-align:center;border:1px dashed rgba(255,255,255,.1);border-radius:11px;color:#69707c;font-size:12px}
        @media(max-width:640px){.ov-status{flex-wrap:wrap}.ov-actions{margin-left:0;width:100%}.ov-actions button{flex:1;justify-content:center}}
      `}</style>

      <div className="ov-block">
        <div className="ov-status">
          <div className="ov-status__signal">{cena.encounter.isPaused ? <Pause size={20} /> : <Swords size={20} />}</div>
          <div>
            <h3>Rodada {cena.encounter.round}</h3>
            <p><b>{cena.encounter.isPaused ? 'Combate pausado' : 'Combate em andamento'}</b>{currentTurnName ? ` · turno de ${currentTurnName}` : ''}</p>
          </div>
          <div className="ov-actions">
            <button onClick={onTogglePause}>{cena.encounter.isPaused ? <Play size={14} /> : <Pause size={14} />} {cena.encounter.isPaused ? 'Retomar' : 'Pausar'}</button>
            <button onClick={onRerollInitiative}><RefreshCw size={14} /> Iniciativa</button>
            <button onClick={onResetAllStatus}><HeartPulse size={14} /> Restaurar grupo</button>
          </div>
        </div>
      </div>

      <div className="ov-block">
        <span className="ov-block__title">Elenco em cena · {ordered.length}{inCombat ? ' · arraste para reordenar o turno' : ''}</span>
        {ordered.length === 0
          ? <div className="ov-empty">Nenhum personagem ou NPC em cena no momento.</div>
          : <div className="ov-list">
              {ordered.map(({ entry, isNpc }, index) => (
                <RosterRow key={entry.id} entry={entry} isNpc={isNpc} isCurrentTurn={entry.id === currentTurnId}
                  turnNumber={inCombat ? index + 1 : null} draggable={inCombat}
                  onAdjust={adjust} onSetValue={setValue} onAddEffect={addEffect} onRemoveEffect={removeEffect} onSetEffectRemaining={setEffectRemaining}
                  onDragStart={() => { dragIndex.current = index; }}
                  onDragOver={event => event.preventDefault()}
                  onDrop={() => { if (dragIndex.current != null && dragIndex.current !== index) onReorderTurn(dragIndex.current, index); dragIndex.current = null; }}
                />
              ))}
            </div>}
      </div>
    </div>
  );
};

export default OverviewPanel;
