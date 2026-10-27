import React from 'react';
import { LocateFixed, Minus, Plus, ZoomIn } from 'lucide-react';
import { layoutGraph, edgePath } from '../../../utils/graphLayout';
import { getNodeType } from '../../../utils/nodeRegistry';
import type { AbilityGraph, NodeFamily } from '../../../utils/abilityGraph';
import type { GraphIssue } from '../../../utils/abilityValidate';

interface Props {
  graph: AbilityGraph;
  selectedNodeId: string | null;
  issues?: GraphIssue[];
  onSelect: (nodeId: string) => void;
  onMove: (nodeId: string, position: { x: number; y: number }) => void;
  onRequestConnect: (parentId: string, branch?: 'entao' | 'senao') => void;
}

const FAMILY_COLOR: Record<NodeFamily, string> = {
  gatilho: 'rgba(212,168,83,.7)', ramo: 'rgba(167,139,250,.7)', alvo: 'rgba(125,210,240,.7)', efeito: 'rgba(125,230,150,.6)',
};

const NODE_WIDTH = 168;
const NODE_HEIGHT = 56;

const connectButton: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%',
  border: '1px solid rgba(255,255,255,.25)', background: 'rgba(20,22,28,.9)', color: '#c7c7ce', cursor: 'pointer',
};

const GraphCanvas: React.FC<Props> = ({ graph, selectedNodeId, issues, onSelect, onMove, onRequestConnect }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 40, y: 30 });
  const positions = React.useMemo(() => layoutGraph(graph), [graph]);
  const issueByNode = React.useMemo(() => {
    const map = new Map<string, 'erro' | 'aviso'>();
    for (const issue of issues ?? []) {
      if (!issue.nodeId) continue;
      if (issue.severity === 'erro' || !map.has(issue.nodeId)) map.set(issue.nodeId, issue.severity);
    }
    return map;
  }, [issues]);
  const dragState = React.useRef<{ nodeId: string; startX: number; startY: number; origin: { x: number; y: number } } | null>(null);

  const startDrag = (nodeId: string, e: React.MouseEvent) => {
    const origin = positions.get(nodeId) ?? { x: 0, y: 0 };
    dragState.current = { nodeId, startX: e.clientX, startY: e.clientY, origin };
  };

  React.useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const drag = dragState.current;
      if (!drag) return;
      const dx = (e.clientX - drag.startX) / zoom;
      const dy = (e.clientY - drag.startY) / zoom;
      onMove(drag.nodeId, { x: drag.origin.x + dx, y: drag.origin.y + dy });
    };
    const handleUp = () => { dragState.current = null; };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [zoom, onMove]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(2, Math.max(0.4, z - e.deltaY * 0.001)));
  };
  const resetView = () => {
    setZoom(1);
    setPan({ x: 40, y: 30 });
  };

  const panState = React.useRef<{ startX: number; startY: number; origin: { x: number; y: number } } | null>(null);
  const startPan = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-graph-pan-ignore="true"]')) return;
    panState.current = { startX: e.clientX, startY: e.clientY, origin: pan };
  };
  React.useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const drag = panState.current;
      if (!drag) return;
      setPan({ x: drag.origin.x + (e.clientX - drag.startX), y: drag.origin.y + (e.clientY - drag.startY) });
    };
    const handleUp = () => { panState.current = null; };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  return (
    <div
      ref={containerRef} onWheel={handleWheel} onMouseDown={startPan}
      data-testid="graph-canvas"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'rgba(4,5,8,.5)', cursor: 'grab' }}
    >
      <div data-graph-pan-ignore="true" style={{ position: 'absolute', left: 12, top: 12, zIndex: 3, display: 'flex', gap: 6, alignItems: 'center', padding: 6, border: '1px solid rgba(255,255,255,.09)', borderRadius: 8, background: 'rgba(10,12,18,.82)', boxShadow: '0 10px 28px rgba(0,0,0,.25)' }}>
        <button type="button" aria-label="Reduzir zoom" title="Reduzir zoom" style={toolbarButton} onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}><Minus size={13} /></button>
        <span style={{ minWidth: 42, textAlign: 'center', color: '#aeb7c3', fontSize: 10, fontWeight: 800 }}>{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Aumentar zoom" title="Aumentar zoom" style={toolbarButton} onClick={() => setZoom(z => Math.min(2, z + 0.1))}><ZoomIn size={13} /></button>
        <button type="button" aria-label="Centralizar grafo" title="Centralizar grafo" style={toolbarButton} onClick={resetView}><LocateFixed size={13} /></button>
      </div>
      <div style={{ position: 'absolute', right: 12, top: 12, zIndex: 3, maxWidth: 280, padding: '7px 9px', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, background: 'rgba(10,12,18,.72)', color: '#7f8996', fontSize: 10, lineHeight: 1.35 }}>
        Clique em um bloco para selecionar. Use o + para conectar. Arraste o fundo para navegar.
      </div>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
        <svg data-testid="graph-edges" width={4000} height={3000} style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none' }}>
          {graph.edges.map(edge => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;
            return (
              <path key={edge.id}
                d={edgePath({ x: from.x + NODE_WIDTH / 2, y: from.y + NODE_HEIGHT }, { x: to.x + NODE_WIDTH / 2, y: to.y })}
                stroke={edge.branch === 'senao' ? 'rgba(251,113,133,.6)' : edge.branch === 'entao' ? 'rgba(134,239,172,.6)' : 'rgba(255,255,255,.25)'}
                strokeWidth={2.5} fill="none" strokeLinecap="round" />
            );
          })}
          {graph.edges.map(edge => {
            if (!edge.branch) return null;
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;
            return <text key={`${edge.id}-label`} x={(from.x + to.x) / 2 + NODE_WIDTH / 2 + 8} y={(from.y + to.y) / 2 + 18} fill={edge.branch === 'entao' ? '#86efac' : '#fb7185'} fontSize="10" fontWeight="800" letterSpacing=".08em">{edge.branch === 'entao' ? 'SE' : 'SENAO'}</text>;
          })}
        </svg>

        {graph.nodes.map(node => {
          const pos = positions.get(node.id) ?? { x: 0, y: 0 };
          const def = getNodeType(node.type);
          const selected = node.id === selectedNodeId;
          const issueSeverity = issueByNode.get(node.id);
          const issueColor = issueSeverity === 'erro' ? '#f87171' : issueSeverity === 'aviso' ? '#facc15' : undefined;
          return (
            <div key={node.id}
              data-testid={`graph-node-${node.id}`}
              data-graph-pan-ignore="true"
              title={node.family === 'ramo' ? undefined : 'Clique para selecionar e conectar um novo bloco'}
              onMouseDown={e => { e.stopPropagation(); startDrag(node.id, e); }}
              onClick={e => {
                e.stopPropagation();
                onSelect(node.id);
                // Blocos comuns já armam a conexão ao clicar — só blocos SE exigem escolher ENTÃO/SENÃO nos botões dedicados.
                if (node.family !== 'ramo') onRequestConnect(node.id, undefined);
              }}
              style={{
                position: 'absolute', left: pos.x, top: pos.y, width: NODE_WIDTH, minHeight: NODE_HEIGHT,
                padding: 8, borderRadius: 10, background: 'rgba(18,20,26,.92)', color: '#e4e4ea', fontSize: 11,
                border: `1.5px solid ${issueColor ?? (selected ? '#f1f1f4' : FAMILY_COLOR[node.family])}`,
                boxShadow: selected ? '0 0 0 3px rgba(241,241,244,.18), 0 0 14px rgba(241,241,244,.25)' : 'none',
                cursor: 'grab', userSelect: 'none',
              }}
            >
              {issueColor && (
                <span
                  data-testid={`graph-node-${node.id}-issue`}
                  title={issueSeverity === 'erro' ? 'Este nó tem um erro de validação' : 'Este nó tem um aviso de validação'}
                  style={{
                    position: 'absolute', top: -6, right: -6, width: 14, height: 14, borderRadius: '50%',
                    background: issueColor, border: '1.5px solid rgba(10,11,15,.9)',
                  }}
                />
              )}
              {def?.summarize(node.props) ?? node.type}
              {node.family === 'ramo' ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <button type="button" data-testid={`graph-node-${node.id}-connect-entao`} title="Adicionar ao SE"
                    style={connectButton} onClick={e => { e.stopPropagation(); onRequestConnect(node.id, 'entao'); }}><Plus size={11} /></button>
                  <button type="button" data-testid={`graph-node-${node.id}-connect-senao`} title="Adicionar ao SENÃO"
                    style={connectButton} onClick={e => { e.stopPropagation(); onRequestConnect(node.id, 'senao'); }}><Plus size={11} /></button>
                </div>
              ) : (
                <button type="button" data-testid={`graph-node-${node.id}-connect`} title="Adicionar nó"
                  style={{ ...connectButton, marginTop: 6 }} onClick={e => { e.stopPropagation(); onRequestConnect(node.id, undefined); }}><Plus size={11} /></button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const toolbarButton: React.CSSProperties = {
  width: 28,
  height: 26,
  display: 'grid',
  placeItems: 'center',
  border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 6,
  background: 'rgba(255,255,255,.04)',
  color: '#d7dee8',
  cursor: 'pointer',
};

export default GraphCanvas;
