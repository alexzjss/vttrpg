import React from 'react';
import { Dices } from 'lucide-react';
import { simulateAbility } from '../../../utils/abilitySimulator';
import type { AbilityGraphActionResult } from '../../../utils/abilityGraphAction';
import type { AbilityGraph } from '../../../utils/abilityGraph';

interface Props {
  graph: AbilityGraph;
  level: number;
}

const buttonStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(125,230,255,.35)', background: 'rgba(35,93,116,.28)', color: '#dff8ff', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const traceItem: React.CSSProperties = { padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,.03)', color: '#c7c7ce', fontSize: 12 };
const blockedStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, background: 'rgba(120,20,30,.15)', border: '1px solid rgba(251,113,133,.4)', color: '#fda4af', fontSize: 12 };

const SimulatorPanel: React.FC<Props> = ({ graph, level }) => {
  const [result, setResult] = React.useState<AbilityGraphActionResult | null>(null);

  const run = () => setResult(simulateAbility(graph, level));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
      <button type="button" style={buttonStyle} onClick={run}><Dices size={14} /> Simular</button>
      {result && result.status === 'bloqueada' && (
        <div style={blockedStyle}>Bloqueada: {result.reason}</div>
      )}
      {result && result.status !== 'bloqueada' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: '#92929c', fontSize: 11 }}>
            {result.targets.map(target => (
              <div key={target.id}>
                {target.name} — HP: {target.currentHp}/{target.maxHp}
                {!result.hitTargetIds.includes(target.id) && ' (errou)'}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {result.trace.map((step, index) => (
              <div key={index} style={traceItem}>{index + 1}. {step.detail ?? step.node}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulatorPanel;
