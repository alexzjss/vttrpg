import React from 'react';
import { Trash2 } from 'lucide-react';
import { getNodeType, type FieldSchema } from '../../../utils/nodeRegistry';
import { CONDITION_FIELD_SCHEMAS, buildConditionEffect, conditionKindByName, conditionSpecificDefaults } from '../../../utils/conditionPresets';
import {
  describeValueModifier, operationUsesDice, operationUsesValue, targetUsesDirectionFilter,
  targetUsesElementFilter, targetUsesPeriodicCriticalFilter, targetUsesResourceFilter, type ModificarValorProps,
} from '../../../utils/nodes/modifierNodes';
import type { ConditionIntensity } from '../../../utils/arsenal';
import type { GraphNode } from '../../../utils/abilityGraph';
import DiceFormulaInput from './DiceFormulaInput';

/** Campos do nó "Modificar valor" que só aparecem para certas operações/alvos — o resto (nome, alvo,
 *  operação, duração, chance, regra de acúmulo e os filtros genéricos) está sempre visível. */
const MODIFIER_CONDITIONAL_FIELDS: Record<string, (p: ModificarValorProps) => boolean> = {
  value: p => operationUsesValue(p.operation),
  dice: p => operationUsesDice(p.operation),
  filterElement: p => targetUsesElementFilter(p.target),
  filterTestKind: p => p.target === 'teste',
  filterDirection: p => targetUsesDirectionFilter(p.target),
  filterResource: p => targetUsesResourceFilter(p.target),
  filterPeriodic: p => targetUsesPeriodicCriticalFilter(p.target),
  filterCritical: p => targetUsesPeriodicCriticalFilter(p.target),
};

interface Props {
  node: GraphNode | null;
  edges: { from: string; to: string }[];
  onChange: (nodeId: string, patch: Record<string, unknown>) => void;
  onRemove: (nodeId: string) => void;
}

const ELEMENTS = ['fisico', 'fogo', 'raio', 'água', 'terra', 'vento', 'escuridão', 'luminoso', 'sangue', 'aura'];

const field: React.CSSProperties = { width: '100%', padding: '8px 10px', background: 'rgba(7,9,14,.78)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#f1f1f4', outline: 'none', fontSize: 12 };
const label: React.CSSProperties = { display: 'block', marginBottom: 4, color: '#92929c', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' };

function parseFieldValue(schema: FieldSchema, raw: string): unknown {
  if (schema.kind === 'numero') return Number(raw);
  if (schema.kind === 'condicao' || schema.kind === 'duracao') {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

const FieldInput: React.FC<{ schema: FieldSchema; value: unknown; onChange: (value: unknown) => void }> = ({ schema, value, onChange }) => {
  if (schema.kind === 'dado') {
    return <DiceFormulaInput label={schema.label} value={value == null ? null : String(value)} onChange={onChange} allowEmpty />;
  }
  if (schema.kind === 'toggle') {
    return <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#c7c7ce', fontSize: 12 }}>
      <input id={schema.key} type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} /> {schema.label}
    </label>;
  }
  if (schema.kind === 'select') {
    return <label><span style={label}>{schema.label}</span>
      <select id={schema.key} aria-label={schema.label} style={field} value={String(value ?? '')} onChange={e => onChange(e.target.value)}>
        {(schema.options ?? []).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </label>;
  }
  if (schema.kind === 'elemento') {
    return <label><span style={label}>{schema.label}</span>
      <select aria-label={schema.label} style={field} value={String(value ?? '')} onChange={e => onChange(e.target.value || null)}>
        <option value="">—</option>
        {ELEMENTS.map(el => <option key={el} value={el}>{el}</option>)}
      </select>
    </label>;
  }
  if (schema.kind === 'condicao' || schema.kind === 'duracao') {
    return <label><span style={label}>{schema.label}</span>
      <textarea aria-label={schema.label} style={{ ...field, minHeight: 70, fontFamily: 'monospace' }}
        value={JSON.stringify(value ?? null)} onChange={e => onChange(parseFieldValue(schema, e.target.value))} />
    </label>;
  }
  return <label><span style={label}>{schema.label}</span>
    <input aria-label={schema.label} style={field} type={schema.kind === 'numero' ? 'number' : 'text'}
      value={value === undefined || value === null ? '' : String(value)}
      onChange={e => onChange(parseFieldValue(schema, e.target.value))} />
  </label>;
};

const NodeInspector: React.FC<Props> = ({ node, edges, onChange, onRemove }) => {
  if (!node) return <div style={{ padding: 16, color: '#7a7a86', fontSize: 12 }}>Selecione um nó no canvas para editar suas propriedades.</div>;
  const def = getNodeType(node.type);
  if (!def) return <div style={{ padding: 16, color: '#fda4af', fontSize: 12 }}>Tipo de nó desconhecido: {node.type}</div>;

  const isCondicao = node.type === 'aplicar_condicao';
  const conditionName = String(node.props.conditionName ?? '');
  const conditionKind = isCondicao ? conditionKindByName(conditionName) : undefined;
  const intensity = (node.props.intensity as ConditionIntensity | undefined) ?? 'normal';
  const conditionDescription = conditionKind
    ? buildConditionEffect(conditionKind, intensity, {
        durationRounds: Number(node.props.rounds) || undefined,
        applicationChance: node.props.chance != null ? Number(node.props.chance) : undefined,
        maxStacks: Number(node.props.maxStacks) || undefined,
        savingThrow: node.props.savingThrowDice && node.props.savingThrowMinimum
          ? { dice: String(node.props.savingThrowDice), minimum: Number(node.props.savingThrowMinimum) } : null,
        ...Object.fromEntries(CONDITION_FIELD_SCHEMAS[conditionKind].map(schema => [schema.key, node.props[schema.key]]).filter(([, v]) => v !== undefined)),
      } as never).description
    : undefined;
  const isModifier = node.type === 'modificar_valor';
  const modifierDescription = isModifier ? describeValueModifier(node.props as unknown as ModificarValorProps) : undefined;

  const fields = conditionKind
    ? [...def.fields, ...CONDITION_FIELD_SCHEMAS[conditionKind]]
    : isModifier
      ? def.fields.filter(schema => !(schema.key in MODIFIER_CONDITIONAL_FIELDS) || MODIFIER_CONDITIONAL_FIELDS[schema.key](node.props as unknown as ModificarValorProps))
      : def.fields;

  /** Trocar condição ou intensidade reinicia os campos específicos para o padrão da nova seleção. */
  const handleChange = (key: string, value: unknown) => {
    if (!isCondicao || (key !== 'conditionName' && key !== 'intensity')) { onChange(node.id, { [key]: value }); return; }
    const nextConditionName = key === 'conditionName' ? String(value) : conditionName;
    const nextIntensity = (key === 'intensity' ? value : intensity) as ConditionIntensity;
    const nextKind = conditionKindByName(nextConditionName);
    onChange(node.id, { [key]: value, ...(nextKind ? conditionSpecificDefaults(nextKind, nextIntensity) : {}) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <strong style={{ color: '#eef2f7', fontSize: 13 }}>{def.label}</strong>
      {conditionDescription && (
        <p style={{ margin: 0, padding: '8px 10px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, color: '#9199a4', fontSize: 11, lineHeight: 1.5 }}>
          {conditionDescription}
        </p>
      )}
      {modifierDescription && (
        <p style={{ margin: 0, padding: '8px 10px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, color: '#9199a4', fontSize: 11, lineHeight: 1.5 }}>
          {modifierDescription}
        </p>
      )}
      {fields.map(schema => (
        <FieldInput key={schema.key} schema={schema} value={node.props[schema.key]}
          onChange={value => handleChange(schema.key, value)} />
      ))}
      {!(node.family === 'gatilho' && !edges.some(e => e.to === node.id)) && (
        <button type="button" onClick={() => { if (window.confirm('Remover este nó e todos os nós conectados abaixo dele? Esta ação não pode ser desfeita.')) onRemove(node.id); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(251,113,133,.4)', background: 'rgba(120,20,30,.15)', color: '#fda4af', fontSize: 12, cursor: 'pointer' }}>
          <Trash2 size={13} /> Remover nó
        </button>
      )}
    </div>
  );
};

export default NodeInspector;
