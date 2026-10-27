import React from 'react';
import { Dice5, EyeOff, RotateCcw, Sparkles } from 'lucide-react';
import { DEFAULT_DICE_CONTROL, DICE_CONTROL_EVENT, readDiceControl, writeDiceControl, type DiceControlSettings } from '../../utils/diceControl';

const field: React.CSSProperties = { background:'#0b0d12', color:'#f1e7d3', border:'1px solid rgba(217,183,110,.3)', borderRadius:6, padding:'9px 10px', width:'100%', boxSizing:'border-box' };
const card: React.CSSProperties = { background:'#11141b', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:18 };
const shortcutButton: React.CSSProperties = { padding:'9px 13px', background:'#1a1e27', border:'1px solid rgba(217,183,110,.22)', borderRadius:8, color:'#e3c58c', fontSize:11, fontWeight:800, cursor:'pointer', textAlign:'left' };

const SHORTCUTS: { label: string; hint: string; patch: Partial<DiceControlSettings> }[] = [
  { label: 'Favorecer grupo', hint: 'Só resultados 12+', patch: { enabled:true, min:12, max:null, allowedValues:[], defaultAdjustment:0, forcedNext:null } },
  { label: 'Punir levemente', hint: 'Teto 12, -2 no total', patch: { enabled:true, min:null, max:12, allowedValues:[], defaultAdjustment:-2, forcedNext:null } },
  { label: 'Crítico garantido', hint: 'Força 20 na próxima', patch: { enabled:true, forcedNext:20 } },
  { label: 'Falha garantida', hint: 'Força 1 na próxima', patch: { enabled:true, forcedNext:1 } },
];

export default function DiceControlPanel() {
  const [settings, setSettings] = React.useState(readDiceControl);
  const [allowed, setAllowed] = React.useState(settings.allowedValues.join(', '));
  React.useEffect(() => { const sync=()=>setSettings(readDiceControl()); addEventListener('storage',sync); addEventListener(DICE_CONTROL_EVENT,sync); return()=>{removeEventListener('storage',sync);removeEventListener(DICE_CONTROL_EVENT,sync)}; }, []);
  const save = (patch: Partial<DiceControlSettings>) => { const next={...settings,...patch}; setSettings(next); writeDiceControl(next); };
  const numberOrNull = (value:string) => value.trim()==='' ? null : Number(value);
  return <div style={{maxWidth:900,margin:'0 auto',padding:24,color:'#d9dde5'}}>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}><Dice5 color="#d9b76e"/><div><h2 style={{margin:0,color:'#f1e7d3',fontFamily:"'Cinzel',serif"}}>Controle secreto dos dados</h2><small style={{color:'#8f97a5'}}>Nada desta tela ou das regras configuradas aparece para os jogadores.</small></div></div>
    <div style={{...card,display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}><div><b>Manipulação global</b><div style={{fontSize:12,color:'#8f97a5',marginTop:4}}>Afeta as próximas rolagens enquanto estiver ligada.</div></div><button onClick={()=>save({enabled:!settings.enabled})} style={{...field,width:'auto',cursor:'pointer',background:settings.enabled?'#c49a58':'#252a34',color:settings.enabled?'#171109':'#d9dde5',fontWeight:800}}>{settings.enabled?'ATIVA':'DESATIVADA'}</button></div>
    <div style={{...card,marginBottom:14}}>
      <b>Atalhos rápidos</b><p style={{fontSize:12,color:'#8f97a5',margin:'4px 0 12px'}}>Aplica uma configuração pronta de uma vez.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8}}>
        {SHORTCUTS.map(shortcut => <button key={shortcut.label} style={shortcutButton} onClick={()=>{setAllowed('');save(shortcut.patch)}}>{shortcut.label}<div style={{fontSize:10,color:'#8f97a5',fontWeight:600,marginTop:2}}>{shortcut.hint}</div></button>)}
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:14}}>
      <section style={card}><b>Faixa secreta</b><p style={{fontSize:12,color:'#8f97a5'}}>O total natural será sorteado apenas dentro destes limites.</p><div style={{display:'flex',gap:10}}><label style={{flex:1,fontSize:11}}>MÍNIMO<input aria-label="Resultado mínimo" type="number" value={settings.min??''} onChange={e=>save({min:numberOrNull(e.target.value)})} style={field}/></label><label style={{flex:1,fontSize:11}}>MÁXIMO<input aria-label="Resultado máximo" type="number" value={settings.max??''} onChange={e=>save({max:numberOrNull(e.target.value)})} style={field}/></label></div></section>
      <section style={card}><b>Valores possíveis</b><p style={{fontSize:12,color:'#8f97a5'}}>Lista opcional, por exemplo: 3, 7, 12, 18. Tem prioridade dentro da faixa.</p><input aria-label="Valores possíveis" value={allowed} onChange={e=>setAllowed(e.target.value)} onBlur={()=>save({allowedValues:allowed.split(/[,;\s]+/).map(Number).filter(Number.isFinite)})} placeholder="3, 7, 12, 18" style={field}/></section>
      <section style={card}><b>Ajuste padrão</b><p style={{fontSize:12,color:'#8f97a5'}}>Aplicado ao total como bônus ou redução. Use -2 para reduzir dois pontos.</p><input aria-label="Ajuste padrão" type="number" value={settings.defaultAdjustment} onChange={e=>save({defaultAdjustment:Number(e.target.value)||0})} style={field}/></section>
      <section style={card}><b>Próximo resultado</b><p style={{fontSize:12,color:'#8f97a5'}}>Força apenas a próxima rolagem e se apaga automaticamente.</p><div style={{display:'flex',gap:8}}><input aria-label="Próximo resultado forçado" type="number" value={settings.forcedNext??''} onChange={e=>save({forcedNext:numberOrNull(e.target.value)})} style={field}/><button title="Limpar" onClick={()=>save({forcedNext:null})} style={{...field,width:42,cursor:'pointer'}}><RotateCcw size={15}/></button></div></section>
    </div>
    <div style={{...card,marginTop:14,fontSize:12,color:'#aeb5c0',display:'flex',gap:9}}><EyeOff size={17} color="#d9b76e"/><span>Os bônus escritos na ficha continuam valendo. A faixa e os valores secretos controlam a soma natural dos dados; o ajuste padrão entra depois, como uma redução ou bônus invisível.</span></div>
    <button onClick={()=>{setAllowed('');save(DEFAULT_DICE_CONTROL)}} style={{marginTop:14,...field,width:'auto',cursor:'pointer',display:'flex',gap:7,alignItems:'center'}}><Sparkles size={14}/> Restaurar aleatoriedade normal</button>
  </div>;
}
