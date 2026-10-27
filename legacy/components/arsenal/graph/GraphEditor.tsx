import React from 'react';
import { GitBranch, X } from 'lucide-react';
import { ImagePickerButton } from '../../ui';
import type { AbilityGraph } from '../../../utils/abilityGraph';
import { mergeLevel } from '../../../utils/abilityGraph';
import { addNode, removeNode, updateNodeProps, moveNode, setLevelOverride, setRootTrigger, addSecondaryTrigger } from '../../../utils/abilityGraphEdit';
import { listAbilityTemplates, type AbilityTemplateOptions } from '../../../utils/abilityTemplates';
import { validateAbilityGraph } from '../../../utils/abilityValidate';
import { arrangeGraph } from '../../../utils/graphLayout';
import NodePalette, { type PendingConnection } from './NodePalette';
import GraphCanvas from './GraphCanvas';
import NodeInspector from './NodeInspector';
import SimulatorPanel from './SimulatorPanel';
import PreviewPanel from './PreviewPanel';

interface Props {
  initial: AbilityGraph;
  onSave: (graph: AbilityGraph) => void;
  onClose: () => void;
}

const field: React.CSSProperties = { width: '100%', padding: '8px 10px', background: 'rgba(7,9,14,.78)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#f1f1f4', outline: 'none', fontSize: 12 };
const label: React.CSSProperties = { display: 'block', marginBottom: 4, color: '#92929c', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' };
const button: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.04)', color: '#e4e4ea', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const saveButton: React.CSSProperties = { ...button, border: '1px solid rgba(134,239,172,.4)', background: 'rgba(20,60,30,.3)', color: '#bbf7d0' };
const tabButton = (active: boolean): React.CSSProperties => ({ ...button, background: active ? 'rgba(125,230,255,.15)' : button.background, borderColor: active ? 'rgba(125,230,255,.4)' : (button.border as string).split(' ').slice(-1)[0] });
const headerGroup: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', paddingLeft: 16 };
const headerGroupFirst: React.CSSProperties = { ...headerGroup, paddingLeft: 0 };

function maxLevel(graph: AbilityGraph): number {
  return Math.max(1, ...graph.levelProfiles.map(p => p.level)) + 1;
}

const GraphEditor: React.FC<Props> = ({ initial, onSave, onClose }) => {
  const [graph, setGraph] = React.useState(initial);
  const [level, setLevel] = React.useState(1);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = React.useState<PendingConnection | null>(null);
  const [rightTab, setRightTab] = React.useState<'propriedades' | 'simulador' | 'preview'>('propriedades');

  const displayed = React.useMemo(() => mergeLevel(graph, level), [graph, level]);
  const selectedNode = displayed.nodes.find(n => n.id === selectedNodeId) ?? null;
  const issues = React.useMemo(() => validateAbilityGraph(displayed), [displayed]);
  const patchHeader = (patch: Partial<AbilityGraph['header']>) => setGraph(g => ({ ...g, header: { ...g.header, ...patch } }));

  const handlePick = (type: string) => {
    if (!pendingConnection) return;
    const { graph: next, nodeId } = addNode(graph, pendingConnection.parentId, type, pendingConnection.branch);
    const withLevel = level > 1
      ? { ...next, nodes: next.nodes.map(n => n.id === nodeId ? { ...n, enabledFromLevel: level } : n) }
      : next;
    setGraph(withLevel);
    setPendingConnection(null);
    setSelectedNodeId(nodeId);
  };

  const confirmReplace = () =>
    graph.nodes.length <= 1
    || window.confirm('Isso substitui todo o grafo atual pelo novo, descartando o que já foi montado manualmente. Continuar?');

  const handleLoadTemplate = (templateId: string, options?: AbilityTemplateOptions) => {
    if (!confirmReplace()) return;
    const template = listAbilityTemplates().find(t => t.id === templateId);
    if (!template) return;
    const built = template.build(options);
    setGraph({ ...built, id: graph.id, header: { ...built.header, name: options?.name || graph.header.name || built.header.name } });
    setSelectedNodeId(null);
  };

  const handleWizardBuild = (built: AbilityGraph) => {
    if (!confirmReplace()) return;
    setGraph({ ...built, id: graph.id, header: { ...built.header, name: built.header.name || graph.header.name } });
    setSelectedNodeId(null);
  };

  const handleInspectorChange = (nodeId: string, patch: Record<string, unknown>) => {
    if (level === 1) {
      setGraph(g => updateNodeProps(g, nodeId, patch));
      return;
    }
    setGraph(g => {
      let next = g;
      for (const [key, value] of Object.entries(patch)) next = setLevelOverride(next, level, nodeId, key, value);
      return next;
    });
  };

  return (
    <div role="dialog" aria-label="Editor de Habilidade" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', background: '#0a0b0f', color: '#e4e4ea' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 0, alignItems: 'flex-end', padding: 16, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div style={headerGroupFirst}>
          <ImagePickerButton value={graph.header.icon} onUpdate={icon => patchHeader({ icon })} label="Icone" buttonLabel="Escolher icone" previewHeight={48} compact />
          <label style={{ minWidth: 160 }}><span style={label}>Nome</span><input aria-label="Nome" style={field} value={graph.header.name} onChange={e => patchHeader({ name: e.target.value })} /></label>
          <label style={{ minWidth: 220, flex: 1 }}><span style={label}>Descricao</span><input aria-label="Descricao" style={field} value={graph.header.description} onChange={e => patchHeader({ description: e.target.value })} /></label>
        </div>

        <div style={{ ...headerGroup, borderLeft: '1px solid rgba(255,255,255,.08)', alignItems: 'center' }}>
          <span style={label}>Nivel</span>
          <button type="button" aria-label="Diminuir nivel" style={button} onClick={() => setLevel(l => Math.max(1, l - 1))}>-</button>
          <strong>{level}</strong>
          <button type="button" aria-label="Aumentar nivel" style={button} onClick={() => setLevel(l => Math.min(maxLevel(graph), l + 1))}>+</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button type="button" style={button} onClick={() => setGraph(g => arrangeGraph(g))} title="Organizar blocos automaticamente">
            <GitBranch size={13} /> Organizar
          </button>
          <button type="button" style={saveButton} onClick={() => onSave(graph)}>Salvar</button>
          <button type="button" aria-label="Fechar" style={button} onClick={onClose}><X size={13} /></button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ width: 240, borderRight: '1px solid rgba(255,255,255,.08)', overflowY: 'auto' }}>
          <NodePalette
            pendingConnection={pendingConnection}
            onPick={handlePick}
            onLoadTemplate={handleLoadTemplate}
            onPickTrigger={type => setGraph(g => setRootTrigger(g, type))}
            onAddSecondaryTrigger={type => setGraph(g => addSecondaryTrigger(g, type))}
            onWizardBuild={handleWizardBuild}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <GraphCanvas
            graph={displayed}
            selectedNodeId={selectedNodeId}
            issues={issues}
            onSelect={setSelectedNodeId}
            onMove={(nodeId, position) => setGraph(g => moveNode(g, nodeId, position))}
            onRequestConnect={(parentId, branch) => setPendingConnection({ parentId, branch })}
          />
        </div>

        <div style={{ width: 300, borderLeft: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 8, padding: 12 }}>
            <button type="button" style={tabButton(rightTab === 'propriedades')} onClick={() => setRightTab('propriedades')}>Propriedades</button>
            <button type="button" style={tabButton(rightTab === 'simulador')} onClick={() => setRightTab('simulador')}>Simulador</button>
            <button type="button" style={tabButton(rightTab === 'preview')} onClick={() => setRightTab('preview')}>Preview</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {rightTab === 'propriedades' && <NodeInspector node={selectedNode} edges={displayed.edges} onChange={handleInspectorChange} onRemove={nodeId => setGraph(g => removeNode(g, nodeId))} />}
            {rightTab === 'simulador' && <SimulatorPanel graph={graph} level={level} />}
            {rightTab === 'preview' && <PreviewPanel graph={displayed} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphEditor;
