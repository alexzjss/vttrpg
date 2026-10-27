import React from 'react';
import { Download, Edit3, LayoutGrid, List, Plus, Search, Shield, Sparkles, Sword, User, UserPlus, X } from 'lucide-react';
import type { Character } from '../../types';
import { useArsenal } from '../../hooks/useArsenal';
import { useAbilityGraphs } from '../../hooks/useAbilityGraphs';
import { assignCardToHoldings, assignEntryToHoldings } from '../../utils/arsenalState';
import type { ArsenalCard, ArsenalCategory } from '../../utils/arsenal';
import { createAbilityGraph, type AbilityGraph } from '../../utils/abilityGraph';
import { ensureStandardCards } from '../../utils/abilityGraphEdit';
import GraphEditor from './graph/GraphEditor';
import ArsenalAssignmentDialog from './ArsenalAssignmentDialog';
import AbilityGraphAssignmentDialog from './AbilityGraphAssignmentDialog';
import ArsenalCardPreview from './ArsenalCardPreview';
import { exportArsenalFile, exportCharacterFile } from '../../utils/characterExport';

interface Props {
  characters: Character[];
  onUpdateCharacter: (id:string, updates:Partial<Character>) => void;
  onCreateItem?: () => void;
  onEditItem?: (id:string) => void;
  onCreateSeal?: () => void;
  onEditSeal?: (id:string) => void;
}

const categoryMeta: Record<ArsenalCategory,{label:string;color:string;icon:React.ReactNode}> = {
  habilidade:{label:'Habilidades',color:'#e0102b',icon:<Sparkles size={15}/>},
  selo:{label:'Selos',color:'#f97316',icon:<Shield size={15}/>},
  item:{label:'Itens',color:'#d4a72c',icon:<Plus size={15}/>},
  arma:{label:'Armas',color:'#9ca3af',icon:<Sword size={15}/>},
};

const INITIAL_GRID_ITEMS = 12;
const INITIAL_LIST_ITEMS = 80;
const LOAD_MORE_GRID_ITEMS = 12;
const LOAD_MORE_LIST_ITEMS = 80;

export default function ArsenalWorkspace({ characters, onUpdateCharacter, onCreateItem, onEditItem, onCreateSeal, onEditSeal }:Props) {
  const { cards, loading, error, remove: removeCard } = useArsenal();
  const { graphs, loading: loadingGraphs, save: saveGraph } = useAbilityGraphs();
  const [category,setCategory] = React.useState<ArsenalCategory>('habilidade');
  const [search,setSearch] = React.useState('');
  const [editingGraph,setEditingGraph] = React.useState<AbilityGraph|null>(null);
  const [creatingGraph,setCreatingGraph] = React.useState(false);
  const [assigning,setAssigning] = React.useState<ArsenalCard|null>(null);
  const [assigningGraph,setAssigningGraph] = React.useState<AbilityGraph|null>(null);
  const [selectedCharacterId,setSelectedCharacterId] = React.useState('');
  const [viewMode,setViewMode] = React.useState<'grid'|'list'>('grid');
  const deferredSearch = React.useDeferredValue(search);
  const [visibleLimit,setVisibleLimit] = React.useState(INITIAL_GRID_ITEMS);
  const selectedCharacter=React.useMemo(()=>characters.find(character=>character.id===selectedCharacterId),[characters,selectedCharacterId]);
  const selectedCardIds=React.useMemo(()=>new Set((selectedCharacter?.arsenal??[]).map(holding=>holding.cardId)),[selectedCharacter]);
  const query=deferredSearch.trim().toLocaleLowerCase('pt-BR');
  const cardCounts=React.useMemo(()=>{
    const counts:Record<ArsenalCategory,number>={habilidade:0,selo:0,item:0,arma:0};
    for(const card of cards) counts[card.category]+=1;
    return counts;
  },[cards]);
  const legacyAbilityCards = React.useMemo(()=>cards.filter(card=>card.category==='habilidade'),[cards]);
  const visibleCards = React.useMemo(() => cards.filter(card => {
    if(card.category!==category) return false;
    if(selectedCharacter&&!selectedCardIds.has(card.id)) return false;
    if(!query) return true;
    return `${card.name} ${card.description} ${card.tags.join(' ')}`.toLocaleLowerCase('pt-BR').includes(query);
  }), [cards, category, query, selectedCharacter, selectedCardIds]);
  const visibleGraphs = React.useMemo(() => graphs.filter(graph => {
    if(selectedCharacter&&!selectedCardIds.has(graph.id)) return false;
    if(!query) return true;
    return `${graph.header.name} ${graph.header.description} ${graph.header.tags.join(' ')}`.toLocaleLowerCase('pt-BR').includes(query);
  }), [graphs, query, selectedCharacter, selectedCardIds]);
  const isHabilidade = category==='habilidade';
  React.useEffect(()=>{
    setVisibleLimit(viewMode==='list'?INITIAL_LIST_ITEMS:INITIAL_GRID_ITEMS);
  },[category, query, selectedCharacterId, viewMode]);
  const graphLimit = isHabilidade ? Math.min(visibleGraphs.length, visibleLimit) : 0;
  const remainingLimit = Math.max(0, visibleLimit - graphLimit);
  const shownGraphs = isHabilidade ? visibleGraphs.slice(0, graphLimit) : [];
  const shownCards = isHabilidade ? visibleCards.slice(0, remainingLimit) : visibleCards.slice(0, visibleLimit);
  const totalVisible = isHabilidade ? visibleGraphs.length + visibleCards.length : visibleCards.length;
  const shownTotal = isHabilidade ? shownGraphs.length + shownCards.length : shownCards.length;
  const canShowMore = shownTotal < totalVisible;
  const loadMoreAmount = viewMode==='list' ? LOAD_MORE_LIST_ITEMS : LOAD_MORE_GRID_ITEMS;
  const openNew = () => {
    if(isHabilidade) setCreatingGraph(true);
    else if(category==='item') onCreateItem?.();
    else if(category==='selo') onCreateSeal?.();
  };
  const editCard = (card:ArsenalCard) => {
    if(card.category==='item') onEditItem?.(card.id);
    else if(card.category==='selo') onEditSeal?.(card.id);
  };
  const assign = (characterIds:string[], quantity:number, maxLevel?:number) => {
    if(!assigning) return;
    for(const characterId of characterIds){
      const character=characters.find(item=>item.id===characterId); if(!character) continue;
      const holdings=character.arsenal??[];
      onUpdateCharacter(character.id,{arsenal:assignCardToHoldings(holdings,assigning,quantity,maxLevel)});
    }
  };
  const assignGraph = (characterIds:string[], maxLevel?:number) => {
    if(!assigningGraph) return;
    for(const characterId of characterIds){
      const character=characters.find(item=>item.id===characterId); if(!character) continue;
      onUpdateCharacter(character.id,{arsenal:assignEntryToHoldings(character.arsenal??[],assigningGraph.id,maxLevel)});
    }
  };
  const saveGraphAndAssign = async (graph:AbilityGraph) => {
    await saveGraph(graph);
    if(selectedCharacter && !selectedCardIds.has(graph.id)) onUpdateCharacter(selectedCharacter.id,{arsenal:assignEntryToHoldings(selectedCharacter.arsenal??[],graph.id)});
    setCreatingGraph(false); setEditingGraph(null);
  };
  const deleteAllLegacyAbilities = async () => {
    if(legacyAbilityCards.length===0) return;
    if(!window.confirm(`Excluir ${legacyAbilityCards.length} habilidade(s) do sistema antigo e remover de todos os personagens? Esta aÃ§Ã£o nÃ£o pode ser desfeita.`)) return;
    const legacyIds = new Set(legacyAbilityCards.map(card=>card.id));
    for(const character of characters){
      const holdings = character.arsenal??[];
      const filtered = holdings.filter(holding=>!legacyIds.has(holding.cardId));
      if(filtered.length!==holdings.length) onUpdateCharacter(character.id,{arsenal:filtered});
    }
    for(const card of legacyAbilityCards) await removeCard(card.id);
  };

  return <div className="anim-fade-up mp-darktab" style={{height:'100%',display:'flex',flexDirection:'column',gap:18,overflow:'hidden',padding:'22px clamp(16px,3vw,40px)',boxSizing:'border-box'}}>
    <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',padding:'10px 12px',background:'#11141b',border:'1px solid #303642',borderRadius:8}}>
      <label style={{position:'relative'}}><Search size={15} style={{position:'absolute',left:12,top:12,color:'#666'}}/><input aria-label="Buscar no arsenal" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cartasâ€¦" style={{width:220,padding:'10px 12px 10px 36px',background:'#111117',border:'1px solid #292932',color:'#eee',borderRadius:8,boxSizing:'border-box'}}/></label>
      {(isHabilidade || category==='item' || category==='selo') && <button onClick={openNew} style={primary}><Plus size={15}/> {isHabilidade ? 'Nova carta' : category==='item' ? 'Novo item' : 'Novo selo'}</button>}
      {isHabilidade && legacyAbilityCards.length>0 && <button onClick={deleteAllLegacyAbilities} style={danger}><X size={15}/> Excluir sistema antigo ({legacyAbilityCards.length})</button>}
      <span style={{width:1,alignSelf:'stretch',background:'rgba(255,255,255,.08)'}}/>
      <User size={15} style={{color:selectedCharacter?'#d9b76e':'#7e8490'}}/>
      <label htmlFor="arsenal-character" style={{fontSize:10,fontWeight:900,letterSpacing:'.1em',color:'#aeb3bc'}}>PERSONAGEM</label>
      <select id="arsenal-character" value={selectedCharacterId} onChange={event=>setSelectedCharacterId(event.target.value)} style={{minWidth:160,maxWidth:220,padding:'7px 9px',background:'#0b0d12',border:'1px solid #353b47',color:'#f1f2f4',borderRadius:6}}>
        <option value="">Todo o arsenal</option>
        {characters.map(character=><option key={character.id} value={character.id}>{character.name}</option>)}
      </select>
      {selectedCharacter&&<span style={{fontSize:10,color:'#858b96'}}>{selectedCardIds.size} carta(s) atribuÃ­da(s)</span>}
      <button onClick={()=>selectedCharacter?exportCharacterFile(selectedCharacter,cards,graphs):exportArsenalFile(cards,graphs)} style={secondary} title={selectedCharacter?'Exportar personagem e todas as cartas atribuÃ­das':'Exportar todo o arsenal'}><Download size={14}/> {selectedCharacter?'Exportar personagem':'Exportar arsenal'}</button>
      {selectedCharacter&&<button onClick={()=>setSelectedCharacterId('')} style={icon} aria-label="Limpar seleÃ§Ã£o"><X size={14}/></button>}
      <span style={{width:1,alignSelf:'stretch',background:'rgba(255,255,255,.08)'}}/>
      <div role="tablist" style={{display:'flex',gap:7,flexWrap:'wrap'}}>{(Object.keys(categoryMeta) as ArsenalCategory[]).map(key=>{const meta=categoryMeta[key];const active=category===key;const count=key==='habilidade'?graphs.length:cardCounts[key];return <button role="tab" aria-selected={active} key={key} onClick={()=>setCategory(key)} style={{...tab,borderColor:active?meta.color:'rgba(255,255,255,.08)',color:active?'#fff':'#777',background:active?`${meta.color}22`:'rgba(255,255,255,.02)'}}>{meta.icon}{meta.label}<span style={{opacity:.55}}>{count}</span></button>})}</div>
      <div aria-label="Modo de visualizaÃ§Ã£o" style={{display:'flex',marginLeft:'auto',padding:3,border:'1px solid #303642',borderRadius:8,background:'#0b0d12'}}>
        <button aria-label="Visualizar em grade" aria-pressed={viewMode==='grid'} onClick={()=>setViewMode('grid')} style={{...viewButton,...(viewMode==='grid'?activeViewButton:{})}}><LayoutGrid size={14}/><span>Grade</span></button>
        <button aria-label="Visualizar como lista" aria-pressed={viewMode==='list'} onClick={()=>setViewMode('list')} style={{...viewButton,...(viewMode==='list'?activeViewButton:{})}}><List size={14}/><span>Lista</span></button>
      </div>
    </div>
    {error&&<div style={{padding:10,border:'1px solid rgba(244,63,94,.4)',color:'#fb7185'}}>{error}</div>}
    <div style={{flex:1,minHeight:0,overflowY:'auto',overflowX:'hidden',...(viewMode==='grid'?{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%, 360px),1fr))',gridAutoRows:'max-content',alignContent:'start',alignItems:'start',columnGap:24,rowGap:28,padding:'0 6px 12px 0'}:{padding:'0 6px 12px 0'})}}>
      {isHabilidade ? <>
        {(loadingGraphs||loading)&&<Empty>Carregando habilidadesâ€¦</Empty>}
        {!loadingGraphs&&!loading&&visibleGraphs.length===0&&visibleCards.length===0&&<Empty>{selectedCharacter?'Nenhuma habilidade atribuÃ­da a este personagem.':'Nenhuma habilidade criada ainda.'}</Empty>}
        {!loadingGraphs&&shownGraphs.map(graph=><div key={graph.id} style={itemShell}>
          <ArsenalCardPreview compact graph={graph} footer={<>
            <button aria-label={`Editar ${graph.header.name}`} onClick={()=>setEditingGraph(graph)} style={{...secondary,flex:1,justifyContent:'center'}}><Edit3 size={13}/> Editar</button>
            <button aria-label={`Atribuir ${graph.header.name}`} onClick={()=>setAssigningGraph(graph)} style={{...secondary,flex:1,justifyContent:'center'}}><UserPlus size={13}/> Atribuir</button>
          </>}/>
        </div>)}
        {!loading&&visibleCards.length>0&&<div style={{gridColumn:'1/-1',display:'flex',alignItems:'center',gap:8,margin:'6px 0 -8px'}}>
          <span style={{fontSize:9,fontWeight:900,letterSpacing:'.1em',color:'#c96a6a'}}>SISTEMA ANTIGO (LEGADO)</span>
          <span style={{flex:1,height:1,background:'rgba(255,255,255,.08)'}}/>
        </div>}
        {!loading&&shownCards.map(card=><div key={card.id} style={itemShell}><ArsenalCardPreview compact card={card} footer={<button aria-label={`Atribuir ${card.name}`} onClick={()=>setAssigning(card)} style={{...secondary,flex:1,justifyContent:'center'}}><UserPlus size={13}/> Atribuir</button>}/></div>)}
      </> : <>
        {loading&&<Empty>Carregando arsenalâ€¦</Empty>}
        {!loading&&viewMode==='grid'&&shownCards.map(card=><div key={card.id} style={itemShell}><ArsenalCardPreview compact card={card} footer={<>
          {(card.category==='item'||card.category==='selo')&&<button aria-label={`Editar ${card.name}`} onClick={()=>editCard(card)} style={{...secondary,flex:1,justifyContent:'center'}}><Edit3 size={13}/> Editar</button>}
          <button aria-label={`Atribuir ${card.name}`} onClick={()=>setAssigning(card)} style={{...secondary,flex:1,justifyContent:'center'}}><UserPlus size={13}/> Atribuir</button>
        </>}/></div>) }
        {!loading&&viewMode==='list'&&visibleCards.length>0&&<div style={tableShell}><table style={tableStyle}><thead><tr><th style={th}>CARTA</th><th style={th}>CATEGORIA</th><th style={th}>DESCRIÃ‡ÃƒO</th><th style={th}>DETALHES</th><th style={{...th,textAlign:'right'}}>AÃ‡Ã•ES</th></tr></thead><tbody>{shownCards.map(card=><tr key={card.id} style={tableRow}><td style={td}><strong style={{color:'#f1f3f6'}}>{card.name}</strong>{card.element&&<small style={subline}>{card.element}</small>}</td><td style={td}><span style={{...categoryBadge,borderColor:`${categoryMeta[card.category].color}66`,color:categoryMeta[card.category].color}}>{categoryMeta[card.category].label}</span></td><td style={{...td,maxWidth:420}}><span style={descriptionCell}>{card.description||'Sem descriÃ§Ã£o.'}</span></td><td style={td}><span style={subline}>{card.testDice&&`Teste ${card.testDice}`}{card.testDice&&card.effects.length>0?' Â· ':''}{card.effects.length>0?`${card.effects.length} efeito(s)`:''}{!card.testDice&&card.effects.length===0?'â€”':''}</span></td><td style={{...td,textAlign:'right'}}><div style={{display:'flex',justifyContent:'flex-end',gap:6}}>{(card.category==='item'||card.category==='selo')&&<button aria-label={`Editar ${card.name}`} onClick={()=>editCard(card)} style={iconAction} title="Editar"><Edit3 size={14}/></button>}<button aria-label={`Atribuir ${card.name}`} onClick={()=>setAssigning(card)} style={iconAction} title="Atribuir"><UserPlus size={14}/></button></div></td></tr>)}</tbody></table></div>}
        {!loading&&visibleCards.length===0&&<Empty>{selectedCharacter?'Nenhuma carta desta categoria atribuÃ­da a este personagem.':category==='item'?'Nenhum item criado ainda.':category==='selo'?'Nenhum selo criado ainda.':'Nenhuma carta nesta categoria.'}</Empty>}
      </>}
      {canShowMore&&<div style={{gridColumn:'1/-1',display:'grid',placeItems:'center',padding:'8px 0 4px'}}>
        <button onClick={()=>setVisibleLimit(limit=>limit+loadMoreAmount)} style={loadMoreButton}>Mostrar mais {Math.min(loadMoreAmount,totalVisible-shownTotal)} de {totalVisible}</button>
      </div>}
    </div>
    {(creatingGraph||editingGraph)&&<GraphEditor
      initial={editingGraph??(() => { const g = createAbilityGraph({id:crypto.randomUUID(),name:'Nova habilidade'}); return ensureStandardCards(g, g.nodes[0].id); })()}
      onSave={saveGraphAndAssign}
      onClose={()=>{setCreatingGraph(false);setEditingGraph(null)}}
    />}
    {assigning&&<ArsenalAssignmentDialog card={assigning} characters={characters} onAssign={assign} onClose={()=>setAssigning(null)}/>}
    {assigningGraph&&<AbilityGraphAssignmentDialog graph={assigningGraph} characters={characters} onAssign={assignGraph} onClose={()=>setAssigningGraph(null)}/>}
  </div>;
}

const primary:React.CSSProperties={display:'flex',alignItems:'center',gap:7,padding:'10px 15px',border:'1px solid #e0102b',background:'#b50f27',color:'#fff',borderRadius:8,fontSize:11,fontWeight:900,cursor:'pointer'};
const secondary:React.CSSProperties={display:'flex',alignItems:'center',gap:6,padding:'7px 10px',border:'1px solid #4a5260',background:'#1b2029',color:'#dfe3e8',borderRadius:6,fontSize:10,fontWeight:800,cursor:'pointer'};
const danger:React.CSSProperties={display:'flex',alignItems:'center',gap:7,padding:'10px 15px',border:'1px solid rgba(244,63,94,.5)',background:'rgba(244,63,94,.12)',color:'#fb7185',borderRadius:8,fontSize:11,fontWeight:900,cursor:'pointer'};
const tab:React.CSSProperties={display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'9px 14px',border:'1px solid rgba(255,255,255,.08)',background:'rgba(255,255,255,.02)',color:'#888',fontSize:10,fontWeight:900,letterSpacing:'.08em',cursor:'pointer'};
const icon:React.CSSProperties={display:'grid',placeItems:'center',width:28,height:28,border:'1px solid rgba(255,255,255,.1)',background:'rgba(0,0,0,.25)',color:'#aaa',cursor:'pointer'};
const viewButton:React.CSSProperties={display:'flex',alignItems:'center',gap:6,padding:'7px 9px',border:0,borderRadius:5,background:'transparent',color:'#777f8b',fontSize:9,fontWeight:900,textTransform:'uppercase',cursor:'pointer'};
const activeViewButton:React.CSSProperties={background:'#252b35',color:'#f3f4f6'};
const itemShell:React.CSSProperties={minWidth:0,width:'100%',position:'relative',isolation:'isolate',contentVisibility:'auto',containIntrinsicSize:'340px'};
const loadMoreButton:React.CSSProperties={padding:'10px 16px',border:'1px solid #3f4652',borderRadius:8,background:'#171c24',color:'#d8dee8',fontSize:10,fontWeight:900,letterSpacing:'.08em',textTransform:'uppercase',cursor:'pointer'};
const tableShell:React.CSSProperties={width:'100%',overflowX:'auto',border:'1px solid #2b3039',borderRadius:10,background:'#101319'};
const tableStyle:React.CSSProperties={width:'100%',minWidth:820,borderCollapse:'collapse',tableLayout:'fixed'};
const th:React.CSSProperties={padding:'10px 12px',borderBottom:'1px solid #303641',color:'#707b8a',fontSize:8,fontWeight:900,letterSpacing:'.12em',textAlign:'left'};
const td:React.CSSProperties={padding:'11px 12px',borderBottom:'1px solid rgba(255,255,255,.055)',color:'#aeb7c3',fontSize:10,verticalAlign:'middle',overflowWrap:'anywhere'};
const tableRow:React.CSSProperties={background:'rgba(255,255,255,.008)'};
const subline:React.CSSProperties={display:'block',marginTop:3,color:'#778291',fontSize:9,textTransform:'capitalize'};
const descriptionCell:React.CSSProperties={display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',lineHeight:1.45};
const categoryBadge:React.CSSProperties={display:'inline-flex',padding:'4px 7px',border:'1px solid',borderRadius:999,fontSize:8,fontWeight:900,textTransform:'uppercase',letterSpacing:'.08em'};
const iconAction:React.CSSProperties={display:'grid',placeItems:'center',width:30,height:28,border:'1px solid #3b424d',borderRadius:5,background:'#1b2029',color:'#cbd2db',cursor:'pointer'};
const Empty:React.FC<{children:React.ReactNode}>=({children})=><div style={{gridColumn:'1/-1',minHeight:220,display:'grid',placeItems:'center',border:'1px dashed rgba(255,255,255,.1)',color:'#686872',fontSize:12}}>{children}</div>;
