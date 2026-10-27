import React from 'react';
import { AlertTriangle, CircleAlert } from 'lucide-react';
import type { AbilityGraph } from '../../../utils/abilityGraph';
import { describeAbilityGraph } from '../../../utils/abilityDescribe';
import { validateAbilityGraph } from '../../../utils/abilityValidate';

const sectionTitle: React.CSSProperties = { color: '#92929c', fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', margin: '0 0 8px' };
const box: React.CSSProperties = { border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, background: 'rgba(255,255,255,.03)', padding: 12, fontSize: 13, lineHeight: 1.5, color: '#e4e4ea' };

const issueRow = (severity: 'erro' | 'aviso'): React.CSSProperties => ({
  display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 7, fontSize: 12,
  border: `1px solid ${severity === 'erro' ? 'rgba(248,113,113,.35)' : 'rgba(250,204,21,.35)'}`,
  background: severity === 'erro' ? 'rgba(127,29,29,.22)' : 'rgba(113,90,10,.2)',
  color: severity === 'erro' ? '#fecaca' : '#fde68a',
});

const PreviewPanel: React.FC<{ graph: AbilityGraph }> = ({ graph }) => {
  const text = React.useMemo(() => describeAbilityGraph(graph), [graph]);
  const issues = React.useMemo(() => validateAbilityGraph(graph), [graph]);
  const errors = issues.filter(i => i.severity === 'erro');
  const warnings = issues.filter(i => i.severity === 'aviso');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 12, overflowY: 'auto' }}>
      <div>
        <div style={sectionTitle}>Descricao gerada</div>
        <div style={box}>{text}</div>
      </div>
      <div>
        <div style={sectionTitle}>Validacao · {issues.length ? `${errors.length} erro(s), ${warnings.length} aviso(s)` : 'sem apontamentos'}</div>
        {!issues.length && <div style={{ ...box, color: '#86efac' }}>Nenhum problema encontrado.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...errors, ...warnings].map((issue, i) => (
            <div key={i} style={issueRow(issue.severity)}>
              {issue.severity === 'erro' ? <CircleAlert size={14} /> : <AlertTriangle size={14} />}
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PreviewPanel;
