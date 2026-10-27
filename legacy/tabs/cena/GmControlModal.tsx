import React from 'react';
import { Activity, Eye, EyeOff, HeartPulse, Image as ImageIcon, Pause, Play, Radio, RefreshCw, Search, ScrollText, Send, Sparkles, Swords, X } from 'lucide-react';
import type { Card, Character, Item, Seal, Weapon } from '../../types';
import type { PausedDisplayItemState, PausedDisplayKind, PausedDisplayState } from '../../utils/cena';
import type { ArsenalCard } from '../../utils/arsenal';
import type { AbilityGraph } from '../../utils/abilityGraph';
import { PREDEFINED_ARSENAL_EFFECTS } from '../../utils/arsenalEffects';
import type { ArsenalEffect } from '../../utils/arsenal';
import { ImagePickerButton } from '../../components/ui/ImagePickerButton';

export interface GmControlModalProps {
  isPaused: boolean;
  round: number;
  characters?: Character[];
  sceneParticipants?: Character[];
  cards?: Card[];
  items?: Item[];
  seals?: Seal[];
  weapons?: Weapon[];
  arsenalCards?: ArsenalCard[];
  abilityGraphs?: AbilityGraph[];
  pausedDisplay?: PausedDisplayState | null;
  onSetPausedDisplay?: (display: PausedDisplayState | null) => void;
  onTogglePause: () => void;
  onResetAllStatus: () => void;
  onClearLog: () => void;
  onRerollInitiative: () => void;
  onEndCombat: () => void;
  streamingMode?: boolean;
  onToggleStreamingMode?: () => void;
  onApplyEffectToGroup?: (effect: ArsenalEffect, target: 'todos' | 'pjs' | 'npcs') => void;
}

type DangerAction = 'log' | 'combat';
type GroupTarget = 'todos' | 'pjs' | 'npcs';
type ShowcaseType = PausedDisplayKind;
type ShowcasePreset = NonNullable<PausedDisplayState['preset']>;

const SHOWCASE_TYPES: { value: ShowcaseType; label: string }[] = [
  { value: 'habilidade', label: 'Habilidade' },
  { value: 'selo', label: 'Selo' },
  { value: 'arma', label: 'Arma' },
  { value: 'item', label: 'Item' },
  { value: 'personagem', label: 'Personagem' },
  { value: 'custom', label: 'Imagem customizada' },
];

const SHOWCASE_PRESETS: { value: ShowcasePreset; label: string; width: number; height: number; size: number }[] = [
  { value: 'center', label: 'Centro', width: 42, height: 56, size: 42 },
  { value: 'left', label: 'Lateral esquerda', width: 34, height: 45, size: 34 },
  { value: 'right', label: 'Lateral direita', width: 34, height: 45, size: 34 },
  { value: 'full', label: 'Tela cheia', width: 76, height: 86, size: 76 },
  { value: 'corner', label: 'Canto dramático', width: 30, height: 40, size: 30 },
];

interface ShowcaseOption {
  id: string;
  kind: PausedDisplayKind;
  title: string;
  subtitle: string;
  description?: string;
  image: string;
  imagePosition?: string;
}

const optionKey = (item: { id: string; kind: PausedDisplayKind }) => `${item.kind}:${item.id}`;

const uniqueByOptionKey = <T extends { id: string; kind: PausedDisplayKind }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = optionKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const GmControlModal: React.FC<GmControlModalProps> = ({
  isPaused, round, characters = [], sceneParticipants = [], cards = [], items = [], seals = [], weapons = [], arsenalCards = [], abilityGraphs = [], pausedDisplay, onSetPausedDisplay, onTogglePause, onResetAllStatus, onClearLog, onRerollInitiative,
  onEndCombat, streamingMode = false, onToggleStreamingMode, onApplyEffectToGroup,
}) => {
  const [confirming, setConfirming] = React.useState<DangerAction | null>(null);
  const [massEffectId, setMassEffectId] = React.useState('');
  const [massTarget, setMassTarget] = React.useState<GroupTarget>('npcs');
  const [showcaseType, setShowcaseType] = React.useState<ShowcaseType>('habilidade');
  const [showcaseId, setShowcaseId] = React.useState('');
  const [showcaseSearch, setShowcaseSearch] = React.useState('');
  const [showcasePreset, setShowcasePreset] = React.useState<ShowcasePreset>('center');
  const [showcaseSize, setShowcaseSize] = React.useState(42);
  const [customWidth, setCustomWidth] = React.useState(42);
  const [customHeight, setCustomHeight] = React.useState(56);
  const [showcaseX, setShowcaseX] = React.useState(50);
  const [showcaseY, setShowcaseY] = React.useState(46);
  const [customImage, setCustomImage] = React.useState('');
  const [customImagePosition, setCustomImagePosition] = React.useState('50% 50%');
  const [customTitle, setCustomTitle] = React.useState('Imagem customizada');
  const confirm = (action: DangerAction, callback: () => void) => {
    if (confirming !== action) return setConfirming(action);
    callback();
    setConfirming(null);
  };
  const applyMassEffect = () => {
    const effect = PREDEFINED_ARSENAL_EFFECTS.find(e => e.id === massEffectId);
    if (effect && onApplyEffectToGroup) onApplyEffectToGroup(effect, massTarget);
  };
  const characterOptions: ShowcaseOption[] = uniqueByOptionKey([...sceneParticipants, ...characters].map(character => ({
    id: character.id, kind: 'personagem', title: character.name, subtitle: sceneParticipants.some(p => p.id === character.id) ? 'Na cena' : 'Elenco', description: character.code,
    image: character.icon, imagePosition: character.iconPosition,
  })));
  const showcaseOptions: ShowcaseOption[] = [
    ...abilityGraphs.map(graph => ({ id: graph.id, kind: 'habilidade' as const, title: graph.header.name, subtitle: 'Grafo de habilidade', description: graph.header.description, image: graph.header.icon, imagePosition: graph.header.iconPosition })),
    ...arsenalCards.filter(card => card.category === 'habilidade').map(card => ({ id: card.id, kind: 'habilidade' as const, title: card.name, subtitle: 'Habilidade', description: card.description, image: card.icon, imagePosition: card.iconPosition })),
    ...cards.map(card => ({ id: card.id, kind: 'habilidade' as const, title: card.name, subtitle: card.type, description: card.description, image: card.image })),
    ...arsenalCards.filter(card => card.category === 'selo').map(card => ({ id: card.id, kind: 'selo' as const, title: card.name, subtitle: 'Selo', description: card.description, image: card.icon, imagePosition: card.iconPosition })),
    ...seals.map(seal => ({ id: seal.id, kind: 'selo' as const, title: seal.name, subtitle: 'Selo', description: seal.description, image: seal.image })),
    ...arsenalCards.filter(card => card.category === 'arma').map(card => ({ id: card.id, kind: 'arma' as const, title: card.name, subtitle: 'Arma', description: card.description, image: card.icon, imagePosition: card.iconPosition })),
    ...weapons.map(weapon => ({ id: weapon.id, kind: 'arma' as const, title: weapon.name, subtitle: weapon.category || 'Arma', description: weapon.description, image: weapon.image })),
    ...arsenalCards.filter(card => card.category === 'item').map(card => ({ id: card.id, kind: 'item' as const, title: card.name, subtitle: 'Item', description: card.description, image: card.icon, imagePosition: card.iconPosition })),
    ...items.map(item => ({ id: item.id, kind: 'item' as const, title: item.name, subtitle: item.category || 'Item', description: item.description, image: item.image })),
    ...characterOptions,
  ];
  const searchNeedle = showcaseSearch.trim().toLocaleLowerCase('pt-BR');
  const filteredShowcaseOptions = uniqueByOptionKey(showcaseOptions.filter(option => {
    if (option.kind !== showcaseType) return false;
    if (!searchNeedle) return true;
    return `${option.title} ${option.subtitle} ${option.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(searchNeedle);
  }));
  const allTypeOptions = uniqueByOptionKey(showcaseOptions.filter(option => option.kind === showcaseType));
  const selectedShowcase = allTypeOptions.find(option => option.id === showcaseId) ?? filteredShowcaseOptions[0] ?? allTypeOptions[0];
  React.useEffect(() => {
    if (showcaseType === 'custom') return;
    if (!selectedShowcase) setShowcaseId('');
    else if (!allTypeOptions.some(option => option.id === showcaseId)) setShowcaseId(selectedShowcase.id);
  }, [showcaseType, showcaseId, selectedShowcase?.id, allTypeOptions.length]);
  const applyPreset = (preset: ShowcasePreset) => {
    const config = SHOWCASE_PRESETS.find(item => item.value === preset) ?? SHOWCASE_PRESETS[0];
    setShowcasePreset(config.value);
    setShowcaseSize(config.size);
    setCustomWidth(config.width);
    setCustomHeight(config.height);
    if (config.value === 'left') { setShowcaseX(25); setShowcaseY(45); }
    else if (config.value === 'right') { setShowcaseX(75); setShowcaseY(45); }
    else if (config.value === 'corner') { setShowcaseX(84); setShowcaseY(22); }
    else if (config.value === 'full') { setShowcaseX(50); setShowcaseY(48); }
    else { setShowcaseX(50); setShowcaseY(46); }
  };
  const displayItems = pausedDisplay?.items?.length ? pausedDisplay.items : pausedDisplay ? [pausedDisplay] : [];
  const setDisplayItems = (items: PausedDisplayItemState[]) => {
    if (!onSetPausedDisplay) return;
    onSetPausedDisplay(items.length ? { ...items[0], items } : null);
  };
  const setPreciseSize = (width: number, height: number) => {
    const nextWidth = Math.max(8, Math.min(120, Math.round(width)));
    const nextHeight = Math.max(8, Math.min(120, Math.round(height)));
    setCustomWidth(nextWidth);
    setCustomHeight(nextHeight);
    setShowcaseSize(Math.max(nextWidth, nextHeight));
  };
  const publishShowcase = () => {
    if (!onSetPausedDisplay) return;
    const option: ShowcaseOption | null = showcaseType === 'custom'
      ? { id: 'custom', kind: 'custom', title: customTitle.trim() || 'Imagem customizada', subtitle: 'Custom', image: customImage, imagePosition: customImagePosition }
      : selectedShowcase ?? null;
    if (!option || (showcaseType === 'custom' && !option.image)) return;
    const preset = SHOWCASE_PRESETS.find(item => item.value === showcasePreset) ?? SHOWCASE_PRESETS[0];
    const width = showcaseType === 'custom' ? customWidth : customWidth || preset.width;
    const height = showcaseType === 'custom' ? customHeight : customHeight || preset.height;
    const nextItem: PausedDisplayItemState = {
      id: `${option.kind}-${option.id}-${Date.now()}`,
      kind: option.kind,
      title: option.title,
      subtitle: option.subtitle,
      description: option.description,
      image: option.image,
      imagePosition: option.imagePosition,
      preset: showcasePreset,
      size: Math.max(width, height),
      width,
      height,
      x: showcaseX,
      y: showcaseY,
      nonce: Date.now(),
    };
    setDisplayItems([...displayItems, nextItem]);
  };

  return (
    <div className="gm-command-shell" role="region" aria-label="Comandos do mestre">
      <style>{`
        .gm-command-shell .gm-command{width:100%;color:#dce2ea}
        .gm-command__signal{width:44px;height:44px;display:grid;place-items:center;border-radius:13px;color:${isPaused ? '#f0b76c' : '#70d49b'};background:${isPaused ? 'rgba(240,183,108,.1)' : 'rgba(112,212,155,.1)'};border:1px solid currentColor}
        .gm-command__status{display:flex;align-items:center;gap:12px;padding-bottom:18px;margin-bottom:4px;border-bottom:1px solid rgba(255,255,255,.08)}.gm-command__status p{margin:0;color:#798390;font-size:12px}.gm-command__status p b{color:${isPaused ? '#e9b978' : '#78d7a0'}}
        .gm-command__label{margin:22px 0 10px;color:#757e8a;font-size:9px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}
        .gm-command__primary{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:10px}.gm-command__button{min-height:94px;padding:18px;display:flex;align-items:center;gap:15px;text-align:left;color:#dce2ea;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.09);border-radius:12px;cursor:pointer;transition:transform .18s,border-color .18s,background .18s}.gm-command__button:hover{transform:translateY(-2px);border-color:rgba(217,183,110,.32);background:rgba(217,183,110,.055)}.gm-command__button svg{flex:none;color:#c7a86c}.gm-command__button strong{display:block;color:#f0f2f5;font-size:14px}.gm-command__button span{display:block;margin-top:4px;color:#77808c;font-size:11px;line-height:1.35}.gm-command__button--main{background:linear-gradient(135deg,rgba(217,183,110,.15),rgba(217,183,110,.045));border-color:rgba(217,183,110,.3)}.gm-command__button--main svg{color:${isPaused ? '#76d89f' : '#f0bd72'}}
        .gm-command__mass{display:flex;gap:9px;padding:14px 16px;border:1px solid rgba(167,139,250,.22);border-radius:12px;background:rgba(91,33,182,.06)}.gm-command__mass select{flex:1;padding:9px 10px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#dce2ea;font-size:11px}.gm-command__mass button{display:flex;align-items:center;gap:7px;padding:9px 14px;border-radius:8px;border:1px solid rgba(167,139,250,.35);background:rgba(167,139,250,.14);color:#ddd6fe;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap}.gm-command__mass button:disabled{opacity:.4;cursor:default}
        .gm-command__showcase{display:grid;grid-template-columns:130px minmax(220px,1fr) 170px auto;gap:9px;align-items:end;padding:14px 16px;border:1px solid rgba(217,183,110,.2);border-radius:12px;background:rgba(217,183,110,.045)}.gm-command__field{display:flex;flex-direction:column;gap:5px}.gm-command__field label{color:#77808c;font-size:8px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.gm-command__field input,.gm-command__field select{width:100%;padding:9px 10px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#dce2ea;font-size:11px}.gm-command__showcase button{display:flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:9px 13px;border-radius:8px;border:1px solid rgba(217,183,110,.34);background:rgba(217,183,110,.12);color:#f4ddb0;font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;white-space:nowrap}.gm-command__showcase button:disabled{opacity:.38;cursor:default}.gm-command__showcase-tools{display:flex;gap:7px}.gm-command__size-tools{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px}.gm-command__size-tools button{min-height:28px;padding:6px 9px;color:#aab2bd;background:rgba(255,255,255,.035);border-color:rgba(255,255,255,.1)}.gm-command__content-picker{grid-column:1/-1;display:grid;grid-template-columns:minmax(220px,320px) minmax(240px,1fr);gap:10px;align-items:start}.gm-command__search{position:relative}.gm-command__search svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#6f7782}.gm-command__search input{padding-left:30px}.gm-command__result-list{max-height:172px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:7px}.gm-command__result{width:100%;display:grid!important;grid-template-columns:32px 1fr;align-items:center;justify-content:stretch!important;text-align:left!important;min-height:46px!important;padding:6px!important;text-transform:none!important;letter-spacing:0!important}.gm-command__result.is-selected{background:rgba(217,183,110,.22);border-color:rgba(242,207,132,.68);color:#fff1d3}.gm-command__thumb{width:32px;height:32px;border-radius:6px;background:linear-gradient(145deg,#2c2f38,#111318) center/cover no-repeat;border:1px solid rgba(255,255,255,.1);display:grid;place-items:center;color:#d9b76e;font-size:12px}.gm-command__result strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:inherit;font-size:11px}.gm-command__result span{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8f98a5;font-size:9px}.gm-command__empty{padding:12px;border:1px dashed rgba(255,255,255,.12);border-radius:8px;color:#7f8792;font-size:11px}.gm-command__presets{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px}.gm-command__presets button{min-height:30px;padding:7px 10px;color:#9ea6b0;background:rgba(255,255,255,.035);border-color:rgba(255,255,255,.1)}.gm-command__presets button.is-active{color:#171109;background:#d9b76e;border-color:#d9b76e}.gm-command__custom{grid-column:1/-1;display:grid;grid-template-columns:minmax(180px,1fr) auto minmax(220px,1fr);gap:9px;align-items:end}.gm-command__stage{position:relative;grid-column:1/-1;height:280px;display:grid;place-items:center;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.11);background:radial-gradient(circle at 50% 42%,rgba(217,183,110,.16),transparent 38%),linear-gradient(145deg,#111722,#07090f)}.gm-command__stage-card{position:relative;width:clamp(24px,calc(var(--preview-w) * 2.35px),94%);height:clamp(24px,calc(var(--preview-h) * 2.35px),94%);border:1px solid rgba(244,216,151,.85);background:linear-gradient(160deg,#2b2030,#0b0d12 72%);box-shadow:0 14px 28px rgba(0,0,0,.45),0 0 22px rgba(217,183,110,.16);overflow:hidden}.gm-command__stage-image{position:absolute;inset:8px 8px 38px;background:linear-gradient(#17101955,#03040755),var(--stage-image) var(--stage-pos,50% 50%)/cover no-repeat,#101218;display:grid;place-items:center;color:#f4ead8;font:800 26px Georgia,serif}.gm-command__stage-title{position:absolute;left:10px;right:10px;bottom:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f7ead0;font-size:10px;font-weight:900}.gm-command__stage:after{content:'Preview de tamanho. Arraste na tela pausada.';position:absolute;left:0;right:0;bottom:8px;text-align:center;color:#707986;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.gm-command__current{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:7px;color:#8d96a3;font-size:10px}.gm-command__current b{color:#f0d69c}.gm-command__chip{display:flex;align-items:center;gap:6px;padding:5px 7px;border:1px solid rgba(255,255,255,.09);border-radius:999px;background:rgba(255,255,255,.035)}.gm-command__chip button{min-height:18px!important;width:18px!important;padding:0!important;border-radius:50%!important}.gm-command__warn{grid-column:1/-1;color:#e7aa72;font-size:10px}.gm-command__warn+.gm-command__current{display:none}
        .gm-command__broadcast{display:flex;align-items:center;gap:16px;padding:16px 18px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(255,255,255,.025)}.gm-command__broadcast>svg{color:${streamingMode ? '#e97989' : '#7f8996'}}.gm-command__broadcast div{flex:1}.gm-command__broadcast strong{display:block;font-size:13px;color:#eef0f3}.gm-command__broadcast span{font-size:11px;color:#77808c}.gm-command__switch{min-width:114px;padding:10px 14px;color:${streamingMode ? '#ffd8dd' : '#d8dee6'};background:${streamingMode ? 'rgba(215,65,85,.14)' : 'rgba(255,255,255,.055)'};border:1px solid ${streamingMode ? 'rgba(233,91,111,.38)' : 'rgba(255,255,255,.12)'};border-radius:9px;font-size:10px;font-weight:900;letter-spacing:.08em;cursor:pointer}
        .gm-command__danger{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.gm-command__danger button{padding:12px 14px;display:flex;align-items:center;justify-content:center;gap:8px;color:#9b8387;background:rgba(126,39,51,.055);border:1px solid rgba(211,76,94,.13);border-radius:9px;font-size:11px;font-weight:800;cursor:pointer;transition:.18s}.gm-command__danger button:hover{color:#e7abb4;border-color:rgba(211,76,94,.3);background:rgba(126,39,51,.12)}.gm-command__danger button.is-confirming{color:#fff0f2;background:#7d2634;border-color:#c95466;animation:gmDangerPulse 1.2s infinite}.gm-command__cancel{margin-top:8px;color:#77808c;font-size:10px;text-align:center}
        @keyframes gmDangerPulse{50%{box-shadow:0 0 0 3px rgba(201,84,102,.13)}}
        @media(max-width:740px){.gm-command__primary,.gm-command__danger,.gm-command__showcase,.gm-command__custom,.gm-command__content-picker{grid-template-columns:1fr}.gm-command__button{min-height:76px}.gm-command__broadcast{align-items:flex-start;flex-wrap:wrap}.gm-command__switch{width:100%}.gm-command__mass{flex-wrap:wrap}.gm-command__mass select{min-width:120px}.gm-command__showcase-tools{width:100%}.gm-command__showcase-tools button{flex:1}}
      `}</style>
      <div className="gm-command">
        <div className="gm-command__status">
          <div className="gm-command__signal">{isPaused ? <Pause size={20}/> : <Activity size={20}/>}</div>
          <p>Rodada {round} · <b>{isPaused ? 'Combate pausado' : 'Combate em andamento'}</b></p>
        </div>

        <div className="gm-command__label">Ações rápidas</div>
        <section className="gm-command__primary">
          <button className="gm-command__button gm-command__button--main" onClick={onTogglePause}>
            {isPaused ? <Play size={24}/> : <Pause size={24}/>}<div><strong>{isPaused ? 'Continuar combate' : 'Pausar combate'}</strong><span>{isPaused ? 'Libera novamente o avanço dos turnos.' : 'Interrompe o avanço sem perder a rodada.'}</span></div>
          </button>
          <button className="gm-command__button" onClick={onRerollInitiative}><RefreshCw size={22}/><div><strong>Rolar iniciativa</strong><span>Cria uma nova ordem de turnos.</span></div></button>
          <button className="gm-command__button" onClick={onResetAllStatus}><HeartPulse size={22}/><div><strong>Restaurar grupo</strong><span>Cura e remove efeitos ativos.</span></div></button>
        </section>

        {onSetPausedDisplay && <><div className="gm-command__label">Vitrine da pausa</div>
          <section className="gm-command__showcase">
            <div className="gm-command__field">
              <label>Tipo</label>
              <select value={showcaseType} onChange={e => { setShowcaseType(e.target.value as ShowcaseType); setShowcaseId(''); setShowcaseSearch(''); }}>
                {SHOWCASE_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div className="gm-command__field">
              <label>Dimensoes</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                <input aria-label="Width da vitrine" type="number" min={8} max={120} step={1} value={customWidth} onChange={e => setPreciseSize(Number(e.target.value) || 8, customHeight)} />
                <input aria-label="Height da vitrine" type="number" min={8} max={120} step={1} value={customHeight} onChange={e => setPreciseSize(customWidth, Number(e.target.value) || 8)} />
              </div>
            </div>
            <div className="gm-command__field">
              <label>Preset</label>
              <select value={showcasePreset} onChange={e => applyPreset(e.target.value as ShowcasePreset)}>
                {SHOWCASE_PRESETS.map(preset => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
              </select>
            </div>
            <div className="gm-command__showcase-tools">
              <button onClick={publishShowcase} disabled={showcaseType === 'custom' ? !customImage : !selectedShowcase}><Send size={13}/> Adicionar</button>
              {displayItems.length > 0 && <button onClick={() => onSetPausedDisplay(null)}><X size={13}/> Limpar</button>}
            </div>
            <div className="gm-command__presets" aria-label="Presets de exibição">
              {SHOWCASE_PRESETS.map(preset => <button key={preset.value} className={showcasePreset === preset.value ? 'is-active' : ''} onClick={() => applyPreset(preset.value)}>{preset.label}</button>)}
            </div>
            <div className="gm-command__size-tools" aria-label="Ajustes rápidos de tamanho">
              <button type="button" onClick={() => setPreciseSize(customWidth - 1, customHeight)}>W -1</button>
              <button type="button" onClick={() => setPreciseSize(customWidth + 1, customHeight)}>W +1</button>
              <button type="button" onClick={() => setPreciseSize(customWidth, customHeight - 1)}>H -1</button>
              <button type="button" onClick={() => setPreciseSize(customWidth, customHeight + 1)}>H +1</button>
              <button type="button" onClick={() => setPreciseSize(customWidth, Math.round(customWidth * 4 / 3))}>3:4</button>
              <button type="button" onClick={() => setPreciseSize(customWidth, customWidth)}>1:1</button>
              <button type="button" onClick={() => setPreciseSize(customWidth, Math.round(customWidth * 9 / 16))}>16:9</button>
            </div>
            <div className="gm-command__stage" aria-label="Preview proporcional do tamanho">
              <div
                className="gm-command__stage-card"
                style={{
                  ['--preview-w' as string]: customWidth,
                  ['--preview-h' as string]: customHeight,
                  ['--stage-image' as string]: (showcaseType === 'custom' ? customImage : selectedShowcase?.image) ? `url(${showcaseType === 'custom' ? customImage : selectedShowcase?.image})` : 'none',
                  ['--stage-pos' as string]: (showcaseType === 'custom' ? customImagePosition : selectedShowcase?.imagePosition) || '50% 50%',
                }}
              >
                <div className="gm-command__stage-image">{!(showcaseType === 'custom' ? customImage : selectedShowcase?.image) && (showcaseType === 'custom' ? customTitle : selectedShowcase?.title ?? '?').trim().slice(0, 1).toUpperCase()}</div>
                <div className="gm-command__stage-title">{showcaseType === 'custom' ? customTitle : selectedShowcase?.title ?? 'Selecione algo'}</div>
              </div>
            </div>
            {showcaseType !== 'custom' && <div className="gm-command__content-picker">
              <div className="gm-command__field gm-command__search">
                <label>Pesquisar</label>
                <div><Search size={13}/><input value={showcaseSearch} onChange={e => setShowcaseSearch(e.target.value)} placeholder={`Buscar ${SHOWCASE_TYPES.find(type => type.value === showcaseType)?.label.toLocaleLowerCase('pt-BR') ?? 'conteúdo'}...`} /></div>
              </div>
              <div className="gm-command__result-list">
                {filteredShowcaseOptions.map(option => (
                  <button key={optionKey(option)} className={`gm-command__result ${selectedShowcase?.id === option.id ? 'is-selected' : ''}`} onClick={() => setShowcaseId(option.id)}>
                    <i className="gm-command__thumb" style={{ backgroundImage: option.image ? `url(${option.image})` : undefined }}>{!option.image && option.title.trim().slice(0, 1).toUpperCase()}</i>
                    <span><strong>{option.title}</strong><span>{option.subtitle}</span></span>
                  </button>
                ))}
                {!filteredShowcaseOptions.length && <div className="gm-command__empty">Nada encontrado aqui. Tente outro termo ou confira se a habilidade foi salva no arsenal/grafo.</div>}
              </div>
            </div>}
            {showcaseType === 'custom' && <div className="gm-command__custom">
              <div className="gm-command__field">
                <label>Titulo</label>
                <input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Nome exibido na carta" />
              </div>
              <ImagePickerButton value={customImage} onUpdate={setCustomImage} position={customImagePosition} onPositionChange={setCustomImagePosition} label="Imagem customizada" buttonLabel="Escolher imagem" showPreviewInline={false} />
              <div className="gm-command__field"><label>Imagem</label><input value={customImage} onChange={e => setCustomImage(e.target.value)} placeholder="URL ou envie pelo botao ao lado" /></div>
            </div>}
            {!isPaused && <div className="gm-command__warn">O destaque fica preparado; ele aparece na tela assim que o combate estiver pausado.</div>}
            {pausedDisplay && <div className="gm-command__current"><ImageIcon size={13}/><span>Em exibição: <b>{pausedDisplay.title}</b></span></div>}
            {displayItems.length > 0 && <div className="gm-command__current"><ImageIcon size={13}/><span>Itens na tela:</span>{displayItems.map(item => (
              <span key={item.id} className="gm-command__chip"><b>{item.title}</b><button aria-label={`Remover ${item.title}`} onClick={() => setDisplayItems(displayItems.filter(existing => existing.id !== item.id))}><X size={11}/></button></span>
            ))}</div>}
          </section></>}

        {onApplyEffectToGroup && <><div className="gm-command__label">Efeito em massa</div>
          <section className="gm-command__mass">
            <select aria-label="Efeito a aplicar em massa" value={massEffectId} onChange={e => setMassEffectId(e.target.value)}>
              <option value="">Selecione um efeito…</option>
              {PREDEFINED_ARSENAL_EFFECTS.map(effect => <option key={effect.id} value={effect.id}>{effect.name}</option>)}
            </select>
            <select aria-label="Alvo do efeito em massa" value={massTarget} onChange={e => setMassTarget(e.target.value as GroupTarget)}>
              <option value="npcs">Todos os NPCs</option>
              <option value="pjs">Todos os PJs</option>
              <option value="todos">Todo mundo em cena</option>
            </select>
            <button disabled={!massEffectId} onClick={applyMassEffect}><Sparkles size={14}/> Aplicar</button>
          </section></>}

        {onToggleStreamingMode && <><div className="gm-command__label">Visibilidade para jogadores</div>
          <section className="gm-command__broadcast">
            {streamingMode ? <EyeOff size={21}/> : <Eye size={21}/>}<div><strong>Ocultar informações secretas</strong><span>{streamingMode ? 'Detalhes de NPCs e notas estão protegidos.' : 'Mostra valores completos e notas na tela principal.'}</span></div>
            <button className="gm-command__switch" onClick={onToggleStreamingMode}><Radio size={12} style={{display:'inline',marginRight:6,verticalAlign:-2}}/>{streamingMode ? 'PROTEGIDO' : 'VISÍVEL'}</button>
          </section></>}

        <div className="gm-command__label">Encerrar ou limpar</div>
        <section className="gm-command__danger">
          <button className={confirming === 'log' ? 'is-confirming' : ''} onClick={() => confirm('log', onClearLog)}><ScrollText size={15}/>{confirming === 'log' ? 'Clique para confirmar' : 'Limpar histórico'}</button>
          <button className={confirming === 'combat' ? 'is-confirming' : ''} onClick={() => confirm('combat', onEndCombat)}><Swords size={15}/>{confirming === 'combat' ? 'Clique para confirmar' : 'Reiniciar combate'}</button>
        </section>
        {confirming && <div className="gm-command__cancel">A ação pode apagar progresso. Se mudou de ideia, escolha outro comando.</div>}
      </div>
    </div>
  );
};

export default GmControlModal;
