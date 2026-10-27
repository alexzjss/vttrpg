import React from 'react';
import { Check, Minus, Plus, Search, UserPlus, X } from 'lucide-react';
import type { Character } from '../../types';
import type { ArsenalCard } from '../../utils/arsenal';

interface Props { card: ArsenalCard; characters: Character[]; onAssign: (ids:string[], quantity:number, maxLevel?:number)=>void; onClose:()=>void }

export default function ArsenalAssignmentDialog({card,characters,onAssign,onClose}:Props){
  const [search,setSearch]=React.useState('');
  const [selected,setSelected]=React.useState<string[]>([]);
  const [quantity,setQuantity]=React.useState(Math.max(1,card.item?.quantity??1));
  const isItem=card.category==='item';
  const maxCardLevel=Math.max(1,...card.levels.map(level=>level.level));
  const [maxLevel,setMaxLevel]=React.useState(maxCardLevel);
  const query=search.trim().toLocaleLowerCase('pt-BR');
  const visible=characters.filter(c=>`${c.name} ${c.code??''}`.toLocaleLowerCase('pt-BR').includes(query));
  const holdingOf=(character:Character)=>character.arsenal?.find(holding=>holding.cardId===card.id);
  const eligible=visible.filter(character=>isItem||!holdingOf(character));
  const toggle=(id:string)=>setSelected(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  const toggleAll=()=>{const ids=eligible.map(c=>c.id);const all=ids.length>0&&ids.every(id=>selected.includes(id));setSelected(current=>all?current.filter(id=>!ids.includes(id)):[...new Set([...current,...ids])]);};
  const confirm=()=>{if(selected.length){const levelLimit=!isItem&&maxCardLevel>1?maxLevel:undefined;levelLimit?onAssign(selected,quantity,levelLimit):onAssign(selected,quantity);onClose();}};

  return <div role="dialog" aria-modal="true" aria-label={`Atribuir ${card.name}`} style={overlay} onClick={event=>{if(event.target===event.currentTarget)onClose()}}>
    <div style={panel}>
      <header style={{display:'flex',alignItems:'start',gap:12,padding:'20px 22px',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
        <div style={{width:42,height:42,display:'grid',placeItems:'center',background:'rgba(224,16,43,.14)',border:'1px solid rgba(224,16,43,.35)',color:'#fb7185'}}><UserPlus size={19}/></div>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:9,fontWeight:900,letterSpacing:'.2em',color:'#e0102b'}}>ATRIBUIR CARTA</div><h3 style={{fontSize:19,color:'#fff',marginTop:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{card.name}</h3><p style={{color:'#73737d',fontSize:11,marginTop:3}}>Selecione um ou vários personagens.</p></div>
        <button aria-label="Fechar atribuição" onClick={onClose} style={iconButton}><X size={16}/></button>
      </header>
      <div style={{padding:'15px 22px 12px',display:'grid',gridTemplateColumns:isItem||maxCardLevel>1?'1fr 154px':'1fr',gap:10,borderBottom:'1px solid rgba(255,255,255,.06)'}}>
        <label style={{position:'relative'}}><Search size={14} style={{position:'absolute',left:11,top:11,color:'#696973'}}/><input autoFocus aria-label="Pesquisar personagens" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome, código ou função…" style={{...input,paddingLeft:34}}/></label>
        {isItem&&<div><span style={smallLabel}>Quantidade a adicionar</span><div style={{display:'grid',gridTemplateColumns:'34px 1fr 34px',gap:5}}><button aria-label="Diminuir quantidade" style={quantityButton} onClick={()=>setQuantity(value=>Math.max(1,value-1))}><Minus size={13}/></button><input aria-label="Quantidade do item" min={1} type="number" value={quantity} onChange={e=>setQuantity(Math.max(1,Number(e.target.value)||1))} style={{...input,textAlign:'center',padding:7}}/><button aria-label="Aumentar quantidade" style={quantityButton} onClick={()=>setQuantity(value=>value+1)}><Plus size={13}/></button></div></div>}
        {!isItem&&maxCardLevel>1&&<label><span style={smallLabel}>Acesso ate nivel</span><select aria-label="Nivel maximo permitido" value={maxLevel} onChange={e=>setMaxLevel(Number(e.target.value))} style={{...input,padding:8}}>
          {Array.from({length:maxCardLevel},(_,index)=>index+1).map(level=><option key={level} value={level}>NV {level}</option>)}
        </select></label>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 22px',background:'rgba(255,255,255,.018)'}}><button onClick={toggleAll} disabled={!eligible.length} style={secondaryButton}>{eligible.length>0&&eligible.every(c=>selected.includes(c.id))?'Limpar visíveis':'Selecionar visíveis'}</button><span style={{flex:1,color:'#696973',fontSize:10}}>{visible.length} resultado(s)</span><span style={{fontSize:10,fontWeight:800,color:selected.length?'#f0b5bd':'#696973'}}>{selected.length} selecionado(s)</span></div>
      <div style={{padding:'0 14px 14px',overflow:'auto',minHeight:180,maxHeight:'46vh'}}>
        {visible.map(character=>{const holding=holdingOf(character);const blocked=!!holding&&!isItem;const checked=selected.includes(character.id);return <button key={character.id} disabled={blocked} onClick={()=>toggle(character.id)} aria-pressed={checked} style={{width:'100%',display:'grid',gridTemplateColumns:'40px 1fr auto',alignItems:'center',gap:11,padding:'10px 11px',marginTop:6,textAlign:'left',border:`1px solid ${checked?'rgba(224,16,43,.55)':'rgba(255,255,255,.07)'}`,background:checked?'rgba(224,16,43,.11)':'rgba(255,255,255,.025)',color:'#ddd',cursor:blocked?'not-allowed':'pointer',opacity:blocked?.55:1}}>
          {character.icon?<img src={character.icon} alt="" style={{width:38,height:38,objectFit:'cover',border:'1px solid rgba(255,255,255,.12)'}}/>:<span style={{width:38,height:38,display:'grid',placeItems:'center',background:'#24242c',fontSize:14,fontWeight:900}}>{character.name.slice(0,1).toUpperCase()}</span>}
          <span style={{minWidth:0}}><strong style={{display:'block',fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{character.name}</strong>{character.code&&<span style={{display:'block',fontSize:9,color:'#707079',marginTop:2,textTransform:'uppercase'}}>{character.code}</span>}</span>
          <span style={{display:'flex',alignItems:'center',gap:7}}>{holding&&<span style={{fontSize:9,color:isItem?'#d4a72c':'#777'}}>{isItem?`Possui ${holding.quantity}`:'Já possui'}</span>}<span style={{width:21,height:21,display:'grid',placeItems:'center',border:`1px solid ${checked?'#e0102b':'#4a4a53'}`,background:checked?'#b50f27':'transparent',color:'#fff'}}>{checked&&<Check size={13}/>}</span></span>
        </button>})}
        {!visible.length&&<div style={{height:180,display:'grid',placeItems:'center',color:'#666',fontSize:12}}>Nenhum personagem encontrado.</div>}
      </div>
      <footer style={{display:'flex',alignItems:'center',gap:9,padding:'14px 22px',borderTop:'1px solid rgba(255,255,255,.08)'}}><button onClick={onClose} style={{...secondaryButton,marginLeft:'auto'}}>Cancelar</button><button disabled={!selected.length} onClick={confirm} style={{...primaryButton,opacity:selected.length?1:.45,cursor:selected.length?'pointer':'not-allowed'}}><UserPlus size={14}/> Atribuir{isItem?` ×${quantity}`:''}</button></footer>
    </div>
  </div>;
}

const overlay:React.CSSProperties={position:'fixed',inset:0,zIndex:100001,background:'rgba(3,4,8,.88)',display:'grid',placeItems:'center',backdropFilter:'blur(12px)',padding:20};
const panel:React.CSSProperties={width:'min(600px,94vw)',maxHeight:'88vh',display:'flex',flexDirection:'column',background:'linear-gradient(145deg,#17171d,#0f0f14)',border:'1px solid rgba(224,16,43,.35)',boxShadow:'0 28px 90px rgba(0,0,0,.76)'};
const input:React.CSSProperties={width:'100%',padding:'9px 11px',background:'#0c0c11',border:'1px solid rgba(255,255,255,.11)',color:'#eee',outline:'none',fontSize:11};
const smallLabel:React.CSSProperties={display:'block',fontSize:8,fontWeight:900,letterSpacing:'.1em',color:'#73737d',textTransform:'uppercase',marginBottom:4};
const quantityButton:React.CSSProperties={display:'grid',placeItems:'center',border:'1px solid rgba(255,255,255,.1)',background:'rgba(255,255,255,.04)',color:'#aaa',cursor:'pointer'};
const secondaryButton:React.CSSProperties={padding:'8px 11px',border:'1px solid rgba(255,255,255,.1)',background:'rgba(255,255,255,.035)',color:'#92929b',fontSize:10,fontWeight:800,cursor:'pointer'};
const primaryButton:React.CSSProperties={display:'flex',alignItems:'center',gap:7,padding:'9px 14px',border:'1px solid #e0102b',background:'#b50f27',color:'#fff',fontSize:10,fontWeight:900};
const iconButton:React.CSSProperties={display:'grid',placeItems:'center',width:32,height:32,border:'1px solid rgba(255,255,255,.1)',background:'rgba(255,255,255,.04)',color:'#aaa',cursor:'pointer'};
