import React from 'react';
import { createPortal } from 'react-dom';
import { Backpack, Check, Copy, Link, Sparkles, Swords, X } from 'lucide-react';
import { normalizeAbilityGraph, normalizeArsenalCard, type ActionCategory, type ResolvedAction } from '../../utils/actions';
import { arsenalCardAtLevel, arsenalMaxLevel, type ArsenalCard, type ArsenalHolding } from '../../utils/arsenal';
import { mergeLevel } from '../../utils/abilityGraph';
import type { PreparationState } from '../../utils/cena';
import ArsenalCardPreview from '../../components/arsenal/ArsenalCardPreview';

export interface ActionMenuProps {
  actions?: Record<ActionCategory, ResolvedAction[]>;
  onSelectAction?: (action: ResolvedAction) => void;
  arsenalWeapons?: ArsenalCard[];
  equippedWeaponId?: string | null;
  onEquipWeapon?: (id: string | null) => void;
  selectedLevels?: Record<string,number>;
  onSelectLevel?: (id:string,level:number) => void;
  holdings?: ArsenalHolding[];
  preparations?: PreparationState[];
  onPreviewAction?: (action: ResolvedAction | null) => void;
}

const EMPTY: Record<ActionCategory, ResolvedAction[]> = { atacar: [], habilidade: [], item: [] };
const CATS = [
  { id: 'atacar' as const, label: 'ATAQUES', hint: 'Ofensiva', key: '1', Icon: Swords },
  { id: 'habilidade' as const, label: 'HABILIDADES', hint: 'Técnicas · Formas · Guarda', key: '2', Icon: Sparkles },
  { id: 'item' as const, label: 'ITENS', hint: 'Inventário', key: '3', Icon: Backpack },
];
const CAT_LABEL: Record<ActionCategory, string> = { atacar: 'ATAQUE', habilidade: 'HABILIDADE', item: 'ITEM' };
const TARGET_LABEL: Record<string, string> = {
  proprio_usuario: 'Você mesmo', um_alvo: 'Um alvo', multiplos_alvos: 'Múltiplos alvos',
  todos_aliados: 'Todos os aliados', todos_inimigos: 'Todos os inimigos', todos_em_area: 'Área',
  circulo_grid: 'Círculo no grid', celula_grid: 'Célula do grid', objeto_mapa: 'Objeto/interação',
  campo_de_batalha: 'Campo de batalha (mapa inteiro)',
};
const targetLabelOf = (action: ResolvedAction): string =>
  action.arsenalCard ? (TARGET_LABEL[action.arsenalCard.target.type] ?? 'Alvo') : (action.targeting === 'self' ? 'Você mesmo' : 'Um alvo');
const sameAction = (a: ResolvedAction | null, b: ResolvedAction): boolean => !!a && a.source === b.source && a.id === b.id;

const ActionMenu: React.FC<ActionMenuProps> = ({ actions = EMPTY, onSelectAction, arsenalWeapons = [], equippedWeaponId = null, onEquipWeapon, selectedLevels = {}, onSelectLevel, holdings = [], preparations = [], onPreviewAction }) => {
  const [open, setOpen] = React.useState<ActionCategory | null>(null);
  const [selected, setSelected] = React.useState<ResolvedAction | null>(null);
  const [castingId, setCastingId] = React.useState<string | null>(null);
  const [justReady, setJustReady] = React.useState<Set<string>>(new Set());
  React.useEffect(() => { onPreviewAction?.(selected); }, [selected, onPreviewAction]);
  React.useEffect(() => () => onPreviewAction?.(null), []);
  const equippedWeapon=arsenalWeapons.find(weapon=>weapon.id===equippedWeaponId);
  const levelCapOf = (id:string) => holdings.find(holding=>holding.cardId===id)?.maxLevel;
  const maxUsableLevel = (id:string, maxLevel:number) => Math.max(1, Math.min(maxLevel, levelCapOf(id) ?? maxLevel));
  const LevelSwitch=({card}:{card:ArsenalCard})=>card.levels.length?<label style={levelSwitch}><span>NÍVEL</span><select aria-label={`Nível de ${card.name}`} value={Math.min(selectedLevels[card.id]??1,maxUsableLevel(card.id,arsenalMaxLevel(card)))} onChange={e=>onSelectLevel?.(card.id,Number(e.target.value))}>{Array.from({length:maxUsableLevel(card.id,arsenalMaxLevel(card))},(_,index)=>index+1).map(level=><option key={level} value={level}>NV {level}</option>)}</select></label>:null;
  const graphMaxLevel = (graph: NonNullable<ResolvedAction['abilityGraph']>) => Math.max(1, ...graph.levelProfiles.map(profile => profile.level), ...graph.nodes.map(node => node.enabledFromLevel ?? 1));
  const rawSelectedLevel = selected ? (selectedLevels[selected.id] ?? selected.abilityGraphLevel ?? 1) : 1;
  const selectedMaxLevel = selected?.arsenalCard ? maxUsableLevel(selected.id, arsenalMaxLevel(selected.arsenalCard)) : selected?.abilityGraph ? maxUsableLevel(selected.id, graphMaxLevel(selected.abilityGraph)) : 1;
  const selectedLevel = Math.min(rawSelectedLevel, selectedMaxLevel);
  const selectedCard = selected?.arsenalCard ? arsenalCardAtLevel(selected.arsenalCard, selectedLevel) : undefined;
  const selectedGraph = selected?.abilityGraph ? mergeLevel(selected.abilityGraph, selectedLevel) : null;
  const selectedLevelOptions = Array.from({ length: selectedMaxLevel }, (_, index) => index + 1);
  const changeSelectedLevel = (level: number) => {
    if (!selected) return;
    onSelectLevel?.(selected.id, level);
    setSelected(current => {
      if (!current || !sameAction(current, selected)) return current;
      if (current.abilityGraph) return normalizeAbilityGraph(current.abilityGraph, level);
      if (current.arsenalCard) return normalizeArsenalCard(arsenalCardAtLevel(current.arsenalCard, level));
      return {
        ...current,
        abilityGraphLevel: current.abilityGraph ? level : current.abilityGraphLevel,
        arsenalCard: current.arsenalCard ? arsenalCardAtLevel(current.arsenalCard, level) : current.arsenalCard,
      };
    });
  };
  const useSelected = () => {
    if (!selected) return;
    const usedId = selected.id;
    setCastingId(usedId);
    onSelectAction?.(selected);
    setSelected(null);
    setTimeout(() => setCastingId(id => id === usedId ? null : id), 400);
  };
  const statusOf = (action:ResolvedAction) => {
    if (!action.arsenalCard) return null;
    const holding=holdings.find(item=>item.cardId===action.id);
    const preparation=preparations.find(item=>item.entryId===action.id);
    if (preparation) return { text:preparation.roundsRemaining>0?`CARGA ${preparation.roundsRemaining}T`:'PRONTA', blocked:preparation.roundsRemaining>0 };
    if ((holding?.cooldownRemaining ?? 0)>0) {
      const unit=action.arsenalCard.cooldown.type==='rodadas'?'R':action.arsenalCard.cooldown.type==='usos'?'U':'T';
      return { text:`COOLDOWN ${holding!.cooldownRemaining}${unit}`, blocked:true };
    }
    if (action.arsenalCard.charges) {
      const current=holding?.currentCharges ?? action.arsenalCard.charges.current;
      return { text:`CARGAS ${current}/${action.arsenalCard.charges.maximum}`, blocked:current<=0 };
    }
    return null;
  };
  const progressOf = (action:ResolvedAction): { pct:number; color:string } | null => {
    if (!action.arsenalCard) return null;
    const card = action.arsenalCard;
    const holding = holdings.find(item => item.cardId === action.id);
    const cooldownRemaining = holding?.cooldownRemaining ?? 0;
    if (cooldownRemaining > 0 && (card.cooldown.type === 'turnos' || card.cooldown.type === 'rodadas' || card.cooldown.type === 'usos')) {
      const total = card.cooldown.amount || 1;
      return { pct: Math.max(0, Math.min(1, cooldownRemaining / total)), color: '#fca5a5' };
    }
    if (card.charges) {
      const current = holding?.currentCharges ?? card.charges.current;
      const total = card.charges.maximum || 1;
      return { pct: Math.max(0, Math.min(1, current / total)), color: current > 0 ? '#67e8f9' : '#fca5a5' };
    }
    return null;
  };
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing) return;
      if (event.key === '1' || event.key === '2' || event.key === '3') {
        const cat = CATS[Number(event.key) - 1];
        if (!cat) return;
        event.preventDefault();
        setOpen(current => (current === cat.id ? null : cat.id));
        setSelected(null);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (selected) setSelected(null);
        else setOpen(null);
        return;
      }
      if (!open) return;
      const list = actions[open] ?? [];
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!list.length) return;
        event.preventDefault();
        const idx = selected ? list.findIndex(action => sameAction(selected, action)) : -1;
        const nextIdx = event.key === 'ArrowDown' ? (idx + 1) % list.length : (idx - 1 + list.length) % list.length;
        setSelected(list[nextIdx]);
        return;
      }
      if (event.key === 'Enter' && selected) {
        event.preventDefault();
        if (!statusOf(selected)?.blocked) useSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected, actions, holdings, preparations]);
  const [copied, setCopied] = React.useState(false);
  const copyCardNames = () => {
    const text = CATS.map(({ id, label }) => {
      const list = actions[id] ?? [];
      if (!list.length) return null;
      return `${label}:\n${list.map(action => `- ${action.name}`).join('\n')}`;
    }).filter(Boolean).join('\n\n');
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  const blockedRef = React.useRef<Map<string, boolean>>(new Map());
  const allActions = React.useMemo(() => Object.values(actions).flat(), [actions]);
  React.useEffect(() => {
    const newlyReady: string[] = [];
    allActions.forEach(action => {
      if (!action.arsenalCard) return;
      const blocked = !!statusOf(action)?.blocked;
      const prev = blockedRef.current.get(action.id);
      if (prev === true && !blocked) newlyReady.push(action.id);
      blockedRef.current.set(action.id, blocked);
    });
    if (!newlyReady.length) return;
    setJustReady(prev => new Set([...prev, ...newlyReady]));
    const timer = setTimeout(() => {
      setJustReady(prev => { const next = new Set(prev); newlyReady.forEach(id => next.delete(id)); return next; });
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings, preparations]);
  return (
    <section className="cena-actions">
      <header className="cena-section-head"><div><span>ARSENAL</span><strong>COMANDOS</strong></div>
        <button type="button" onClick={copyCardNames} title="Copiar nomes de todas as cartas disponíveis" aria-label="Copiar nomes de todas as cartas disponíveis" className="cena-copy-cards-btn" disabled={!allActions.length}>
          {copied ? <><Check size={12}/> Copiado</> : <><Copy size={12}/> Copiar cartas</>}
        </button>
      </header>
      {!!arsenalWeapons.length && <div className="cena-actions__weapon">
        <select aria-label="Arma equipada" value={equippedWeaponId ?? ''} onChange={e => onEquipWeapon?.(e.target.value || null)}>
          <option value="">Sem arma equipada</option>
          {arsenalWeapons.map(weapon => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
        </select>
        {equippedWeapon&&<LevelSwitch card={equippedWeapon}/>}
        {equippedWeaponId && <button onClick={() => onEquipWeapon?.(null)}>×</button>}
      </div>}
      <div className="cena-actions__grid">
        {CATS.map(({ id, label, hint, key, Icon }) => {
          const list = actions[id] ?? [];
          const isOpen = open === id;
          const availableCount = list.filter(action => !statusOf(action)?.blocked).length;
          const allReady = availableCount === list.length;
          return <React.Fragment key={id}>
            <button type="button" data-category={id} aria-label={label} aria-expanded={isOpen} className={`cena-command ${isOpen ? 'is-open' : ''}`} onClick={() => setOpen(isOpen ? null : id)}>
              <span className="cena-command__key"><i>{key}</i></span><Icon size={19} /><span className="cena-command__copy"><strong>{label}</strong><small>{hint}</small></span>
              <b className="cena-command-count" data-all-ready={allReady} title={`${availableCount} de ${list.length} disponíveis`}>{list.length ? `${availableCount}/${list.length}` : 0}</b>
            </button>
            {isOpen && <div className="cena-command-list">
              {list.length === 0 ? <em>Nada nesta categoria.</em> : <>
                {list.map(action => { const status=statusOf(action); const progress=progressOf(action); return <div key={action.id} style={actionRow}>
                <button style={{flex:1,opacity:status?.blocked?.58:1}} className={[sameAction(selected,action)&&'is-selected',justReady.has(action.id)&&'is-just-ready',castingId===action.id&&'is-casting'].filter(Boolean).join(' ')} onClick={() => setSelected(current => sameAction(current,action) ? null : action)}>
                  {progress?<span className="cena-command-ring" style={{['--pct' as string]:`${progress.pct*100}%`,['--ring-color' as string]:progress.color}}><i>◇</i></span>:<i>◇</i>}
                  <span>{action.name}</span>{action.arsenalCard?.abilityType==='combo'&&<Link size={11} className="cena-command-combo-tag" aria-label="Combinável"/>}{status?<b style={{color:status.blocked?'#fca5a5':'#67e8f9'}}>{status.text}</b>:action.auraCost ? <b>{action.auraCost} AURA</b> : null}</button>
                {action.arsenalCard&&<LevelSwitch card={action.arsenalCard}/>}
              </div>})}
                <div className="cena-command-hint">↑↓ navegar · Enter usar · Esc fechar</div>
              </>}
            </div>}
          </React.Fragment>;
        })}
      </div>
      {selected && createPortal(
        <div role="dialog" aria-label={`Detalhes de ${selected.name}`} style={previewOverlay}>
          <button style={previewClose} aria-label="Fechar detalhes" onClick={()=>setSelected(null)}><X size={14}/></button>
          <ArsenalCardPreview card={selectedCard} graph={selectedGraph} action={selected} footer={<>
            {selectedLevelOptions.length > 1 && <label style={previewLevelSwitch}>
              <span>NIVEL</span>
              <select aria-label={`Nivel de ${selected.name}`} value={selectedLevel} onChange={event => changeSelectedLevel(Number(event.target.value))}>
                {selectedLevelOptions.map(level => <option key={level} value={level}>NV {level}</option>)}
              </select>
            </label>}
            <button style={{...useButton,opacity:statusOf(selected)?.blocked?.55:1}} disabled={statusOf(selected)?.blocked} onClick={useSelected}>{statusOf(selected)?.text ?? 'USAR CARTA'}</button><button style={cancelButton} onClick={()=>setSelected(null)}>CANCELAR</button></>}/>
        </div>,document.body,
      )}
    </section>
  );
};

const actionRow:React.CSSProperties={display:'flex',alignItems:'stretch',gap:6};
const levelSwitch:React.CSSProperties={display:'flex',alignItems:'center',gap:5,padding:'0 7px',border:'1px solid rgba(255,255,255,.1)',background:'rgba(0,0,0,.25)',color:'#8f98a8',fontSize:8,fontWeight:900,letterSpacing:'.08em'};
const previewOverlay:React.CSSProperties={position:'fixed',right:28,bottom:28,zIndex:10000,width:512,maxWidth:'calc(100vw - 32px)',maxHeight:'calc(100vh - 56px)',overflow:'auto',filter:'drop-shadow(0 25px 55px rgba(0,0,0,.7))'};
const previewClose:React.CSSProperties={position:'absolute',right:8,top:8,zIndex:2,width:28,height:28,display:'grid',placeItems:'center',border:'1px solid rgba(255,255,255,.14)',borderRadius:8,background:'rgba(5,8,12,.82)',color:'#cbd5e1',cursor:'pointer'};
const previewLevelSwitch:React.CSSProperties={display:'flex',alignItems:'center',gap:7,padding:'8px 10px',border:'1px solid rgba(255,255,255,.12)',borderRadius:8,background:'rgba(5,8,12,.62)',color:'#cbd5e1',fontSize:9,fontWeight:900,letterSpacing:'.08em'};
const useButton:React.CSSProperties={flex:1,padding:'10px 12px',border:'1px solid #67e8f9',borderRadius:8,background:'#0891b2',color:'#fff',fontSize:10,fontWeight:900,cursor:'pointer'};
const cancelButton:React.CSSProperties={padding:'10px 12px',border:'1px solid rgba(255,255,255,.12)',borderRadius:8,background:'rgba(255,255,255,.04)',color:'#9ca3af',fontSize:10,fontWeight:900,cursor:'pointer'};

export default ActionMenu;
