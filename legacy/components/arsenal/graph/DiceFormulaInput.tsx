import React from 'react';

interface Props {
  label: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  allowEmpty?: boolean;
}

const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100];

const field: React.CSSProperties = { width: '100%', padding: '8px 10px', background: 'rgba(7,9,14,.78)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#f1f1f4', outline: 'none', fontSize: 12 };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 4, color: '#92929c', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' };
const miniButton: React.CSSProperties = { padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: '#d8dde6', fontSize: 11, fontWeight: 800, cursor: 'pointer' };

function parseDice(value: string | null | undefined): { count: number; sides: number; bonus: number; manual: string } {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return { count: 1, sides: 20, bonus: 0, manual: raw };
  return {
    count: Math.max(1, Number(match[1] || 1)),
    sides: Number(match[2] || 20),
    bonus: Number(match[3] || 0),
    manual: raw,
  };
}

function composeDice(count: number, sides: number, bonus: number): string {
  const suffix = bonus === 0 ? '' : bonus > 0 ? `+${bonus}` : String(bonus);
  return `${Math.max(1, count)}d${sides}${suffix}`;
}

const DiceFormulaInput: React.FC<Props> = ({ label, value, onChange, allowEmpty }) => {
  const parsed = React.useMemo(() => parseDice(value), [value]);
  const current = String(value ?? '');

  const update = (patch: Partial<{ count: number; sides: number; bonus: number }>) => {
    onChange(composeDice(patch.count ?? parsed.count, patch.sides ?? parsed.sides, patch.bonus ?? parsed.bonus));
  };

  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'grid', gridTemplateColumns: '70px 88px 70px', gap: 6, marginBottom: 6 }}>
        <input aria-label="Quantidade" style={{ ...field, textAlign: 'center' }} type="number" min={1} value={parsed.count} onChange={e => update({ count: Number(e.target.value || 1) })} />
        <select aria-label="Faces" style={field} value={parsed.sides} onChange={e => update({ sides: Number(e.target.value) })}>
          {DIE_SIDES.map(side => <option key={side} value={side}>d{side}</option>)}
        </select>
        <input aria-label="Bonus" style={{ ...field, textAlign: 'center' }} type="number" value={parsed.bonus} onChange={e => update({ bonus: Number(e.target.value || 0) })} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        {['1d20', '1d6', '2d6', '1d8+2'].map(preset => (
          <button key={preset} type="button" style={miniButton} onClick={() => onChange(preset)}>{preset}</button>
        ))}
        {allowEmpty && <button type="button" style={miniButton} onClick={() => onChange(null)}>Sem rolagem</button>}
      </div>
      <input aria-label={label} style={field} value={current} placeholder={allowEmpty ? 'Sem rolagem' : '1d20'} onChange={e => onChange(e.target.value || null)} />
    </div>
  );
};

export default DiceFormulaInput;
