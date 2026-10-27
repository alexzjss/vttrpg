import React from 'react';
import GraphEditor from './GraphEditor';
import { listAbilityTemplates } from '../../../utils/abilityTemplates';
import { ensureNodesRegistered } from '../../../utils/nodes';
import type { AbilityGraph } from '../../../utils/abilityGraph';

ensureNodesRegistered();

/** Harness de demonstração do editor de grafo — acessível via ?view=graph-editor-demo.
 * Não persiste nada: onSave apenas loga o grafo resultante no console. */
const GraphEditorDemo: React.FC = () => {
  const [graph, setGraph] = React.useState<AbilityGraph>(() => listAbilityTemplates()[4].build()); // Combo condicional

  return (
    <GraphEditor
      initial={graph}
      onSave={next => { setGraph(next); console.log('[graph-editor-demo] onSave', next); }}
      onClose={() => console.log('[graph-editor-demo] onClose')}
    />
  );
};

export default GraphEditorDemo;
