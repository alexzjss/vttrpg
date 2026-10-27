import React from 'react';
import { Search, Sparkles, Wand2, Zap } from 'lucide-react';
import { listNodeTypes, type NodeTypeDef } from '../../../utils/nodeRegistry';
import { listAbilityTemplates, type AbilityTemplate, type AbilityTemplateOptions } from '../../../utils/abilityTemplates';
import type { AbilityGraph, NodeFamily } from '../../../utils/abilityGraph';
import DiceFormulaInput from './DiceFormulaInput';
import AbilityWizard from './AbilityWizard';

const CATEGORY_ORDER = ['Combate', 'Defesa', 'Controle', 'Forma', 'Configuração'];

function groupByCategory(items: NodeTypeDef[]): [string, NodeTypeDef[]][] {
  const byCategory = new Map<string, NodeTypeDef[]>();
  for (const def of items) {
    const key = def.category ?? '';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(def);
  }
  return [...byCategory.entries()].sort(([a], [b]) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? CATEGORY_ORDER.length : ia) - (ib === -1 ? CATEGORY_ORDER.length : ib);
  });
}

export interface PendingConnection { parentId: string; branch?: 'entao' | 'senao' }

interface Props {
  pendingConnection: PendingConnection | null;
  onPick: (type: string) => void;
  onLoadTemplate: (templateId: string, options?: AbilityTemplateOptions) => void;
  onPickTrigger: (type: string) => void;
  onAddSecondaryTrigger: (type: string) => void;
  onWizardBuild: (graph: AbilityGraph) => void;
}

const SECONDARY_TRIGGER_TYPES = new Set(['enquanto_ativa', 'em_combo']);
const FAMILY_LABEL: Record<Exclude<NodeFamily, 'gatilho'>, string> = { ramo: 'Ramos (SE)', alvo: 'Alvo', efeito: 'Efeitos' };
const FAMILIES: Exclude<NodeFamily, 'gatilho'>[] = ['ramo', 'alvo', 'efeito'];
const FAMILY_ACCENT: Record<NodeFamily, { border: string; background: string }> = {
  gatilho: { border: 'rgba(212,168,83,.35)', background: 'rgba(212,168,83,.08)' },
  ramo: { border: 'rgba(96,165,250,.35)', background: 'rgba(96,165,250,.08)' },
  alvo: { border: 'rgba(167,139,250,.35)', background: 'rgba(167,139,250,.08)' },
  efeito: { border: 'rgba(45,212,191,.35)', background: 'rgba(45,212,191,.08)' },
};
const ELEMENTS = ['fisico', 'fogo', 'raio', 'agua', 'terra', 'vento', 'escuridao', 'luminoso', 'sangue', 'aura'];
const CONDITIONS = ['Vulnerável','Exposto','Marcado','Sangrando','Queimando','Congelado','Eletrizado','Molhado','Enraizado','Frágil','Silenciado','Atordoado','Derrubado','Cego','Amedrontado'];

const field: React.CSSProperties = { width: '100%', padding: '8px 10px', background: 'rgba(7,9,14,.78)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#f1f1f4', outline: 'none', fontSize: 12 };
const sectionTitle: React.CSSProperties = { color: '#92929c', fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', margin: '10px 0 6px' };
const subsectionTitle: React.CSSProperties = { color: '#5f6570', fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', margin: '6px 0 2px 4px' };
const nodeButton: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', padding: '7px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)', color: '#e4e4ea', fontSize: 12, cursor: 'pointer' };
const modalLabel: React.CSSProperties = { display: 'block', marginBottom: 4, color: '#92929c', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' };

function familyButtonStyle(family: NodeFamily, extra: React.CSSProperties = {}): React.CSSProperties {
  const accent = FAMILY_ACCENT[family];
  return { ...nodeButton, borderColor: accent.border, background: accent.background, ...extra };
}

const TemplateCreatorModal: React.FC<{
  template: AbilityTemplate;
  draft: AbilityTemplateOptions;
  onChange: (patch: AbilityTemplateOptions) => void;
  onClose: () => void;
  onCreate: () => void;
}> = ({ template, draft, onChange, onClose, onCreate }) => (
  <div role="dialog" aria-label="Criador rapido de habilidade" style={{ position: 'fixed', inset: 0, zIndex: 260, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.62)' }}>
    <div style={{ width: 'min(520px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, background: '#101218', boxShadow: '0 24px 80px rgba(0,0,0,.45)', padding: 16 }}>
      <strong style={{ display: 'block', color: '#f4f7fb', fontSize: 16, marginBottom: 4 }}>{template.label}</strong>
      <p style={{ margin: '0 0 14px', color: '#8c95a3', fontSize: 12 }}>{template.description}</p>
      <div style={{ display: 'grid', gap: 10 }}>
        <label><span style={modalLabel}>Nome</span><input aria-label="Nome do modelo" style={field} value={draft.name ?? ''} placeholder={template.label} onChange={ev => onChange({ name: ev.target.value })} /></label>
        {template.fields.map(f => {
          const value = draft[f.key];
          if (f.kind === 'dice') return <DiceFormulaInput key={f.key} label={f.label} value={value == null ? null : String(value)} allowEmpty onChange={next => onChange({ [f.key]: next })} />;
          if (f.kind === 'number') return <label key={f.key}><span style={modalLabel}>{f.label}</span><input aria-label={f.label} style={field} type="number" value={Number(value ?? 0)} onChange={ev => onChange({ [f.key]: Number(ev.target.value) })} /></label>;
          if (f.kind === 'condition') return <label key={f.key}><span style={modalLabel}>{f.label}</span><select aria-label={f.label} style={field} value={String(value ?? '')} onChange={ev => onChange({ [f.key]: ev.target.value })}>{CONDITIONS.map(k => <option key={k} value={k}>{k}</option>)}</select></label>;
          if (f.kind === 'element') return <label key={f.key}><span style={modalLabel}>{f.label}</span><select aria-label={f.label} style={field} value={String(value ?? '')} onChange={ev => onChange({ [f.key]: ev.target.value as AbilityTemplateOptions['element'] })}>{ELEMENTS.map(k => <option key={k} value={k}>{k}</option>)}</select></label>;
          if (f.kind === 'buffStat') return <label key={f.key}><span style={modalLabel}>{f.label}</span><select aria-label={f.label} style={field} value={String(value ?? 'vida_maxima')} onChange={ev => onChange({ [f.key]: ev.target.value as AbilityTemplateOptions['formBuffStat'] })}>{[
            ['ataque', 'Ataque'], ['defesa', 'Defesa'], ['velocidade', 'Velocidade'], ['vida_maxima', 'Vida maxima'], ['aura_maxima', 'Aura maxima'],
          ].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>;
          if (f.kind === 'color') return <label key={f.key}><span style={modalLabel}>{f.label}</span><input aria-label={f.label} style={{ ...field, height: 38 }} type="color" value={String(value ?? '#f59e0b')} onChange={ev => onChange({ [f.key]: ev.target.value })} /></label>;
          return <label key={f.key}><span style={modalLabel}>{f.label}</span><input aria-label={f.label} style={field} value={String(value ?? '')} onChange={ev => onChange({ [f.key]: ev.target.value })} /></label>;
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" style={{ ...nodeButton, width: 'auto' }} onClick={onClose}>Cancelar</button>
        <button type="button" style={{ ...nodeButton, width: 'auto', borderColor: 'rgba(134,239,172,.42)', background: 'rgba(20,80,48,.28)', color: '#bbf7d0' }} onClick={onCreate}>Criar no grafo</button>
      </div>
    </div>
  </div>
);

const AbilityCreatorSelector: React.FC<{
  templates: AbilityTemplate[];
  onClose: () => void;
  onPickTemplate: (template: AbilityTemplate) => void;
  onPickGuided: () => void;
}> = ({ templates, onClose, onPickTemplate, onPickGuided }) => {
  const [query, setQuery] = React.useState('');
  const q = query.trim().toLocaleLowerCase('pt-BR');
  const filtered = templates.filter(template => !q || template.label.toLocaleLowerCase('pt-BR').includes(q));
  return (
    <div role="dialog" aria-label="Criar habilidade" style={{ position: 'fixed', inset: 0, zIndex: 260, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.62)' }}>
      <div style={{ width: 'min(620px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, background: '#101218', boxShadow: '0 24px 80px rgba(0,0,0,.45)', padding: 16 }}>
        <strong style={{ display: 'block', color: '#f4f7fb', fontSize: 16, marginBottom: 4 }}>Criar habilidade</strong>
        <p style={{ margin: '0 0 12px', color: '#8c95a3', fontSize: 12 }}>Escolha um modelo pronto pra ajustar, ou monte do zero com perguntas guiadas passo a passo.</p>
        <label style={{ position: 'relative', display: 'block', marginBottom: 12 }}>
          <Search size={14} style={{ position: 'absolute', left: 9, top: 9, color: '#697383' }} />
          <input style={{ ...field, paddingLeft: 30 }} placeholder="Buscar modelo..." value={query} onChange={ev => setQuery(ev.target.value)} />
        </label>
        <button
          type="button"
          onClick={onPickGuided}
          style={{ ...nodeButton, width: '100%', marginBottom: 10, borderColor: 'rgba(125,230,255,.4)', background: 'rgba(23,64,84,.28)', padding: '10px 12px' }}
        >
          <Wand2 size={14} />
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <strong style={{ fontSize: 12 }}>Personalizado (perguntas guiadas)</strong>
            <span style={{ fontSize: 10, color: '#9fb4c2' }}>Wizard passo a passo pra montar do zero</span>
          </span>
        </button>
        <div style={sectionTitle}>Modelos prontos · {filtered.length}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {filtered.map(template => (
            <button
              key={template.id} type="button" title={template.description}
              onClick={() => onPickTemplate(template)}
              style={{ ...nodeButton, width: '100%', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '10px 12px' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={12} /> {template.label}</span>
              <span style={{ fontSize: 10, color: '#7a7a86', fontWeight: 400 }}>{template.description}</span>
            </button>
          ))}
          {!filtered.length && <p style={{ color: '#7a7a86', fontSize: 11 }}>Nenhum modelo encontrado.</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" style={{ ...nodeButton, width: 'auto' }} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
};

const NodePalette: React.FC<Props> = ({ pendingConnection, onPick, onLoadTemplate, onPickTrigger, onAddSecondaryTrigger, onWizardBuild }) => {
  const [query, setQuery] = React.useState('');
  const [selectorOpen, setSelectorOpen] = React.useState(false);
  const [creator, setCreator] = React.useState<{ template: AbilityTemplate; draft: AbilityTemplateOptions } | null>(null);
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const q = query.trim().toLocaleLowerCase('pt-BR');
  const templates = listAbilityTemplates();
  const allTriggers = listNodeTypes('gatilho').filter(def => !q || def.label.toLocaleLowerCase('pt-BR').includes(q));
  const triggers = allTriggers.filter(def => !SECONDARY_TRIGGER_TYPES.has(def.type));
  const secondaryTriggers = allTriggers.filter(def => SECONDARY_TRIGGER_TYPES.has(def.type));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 12, overflowY: 'auto' }}>
      <label style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 9, top: 9, color: '#697383' }} />
        <input style={{ ...field, paddingLeft: 30 }} placeholder="Buscar nó ou tipo..." value={query} onChange={ev => setQuery(ev.target.value)} />
      </label>

      {!!triggers.length && <>
        <div style={sectionTitle}>Gatilho (raiz da habilidade) · {triggers.length}</div>
        {triggers.map(def => (
          <button key={def.type} type="button" style={familyButtonStyle('gatilho')} onClick={() => onPickTrigger(def.type)} title={def.summarize({})}>
            <Zap size={12} /> {def.label}
          </button>
        ))}
      </>}

      {!!secondaryTriggers.length && <>
        <div style={sectionTitle}>Raiz secundaria (opcional) · {secondaryTriggers.length}</div>
        {secondaryTriggers.map(def => (
          <button key={def.type} type="button" style={familyButtonStyle('gatilho')} onClick={() => onAddSecondaryTrigger(def.type)} title={def.summarize({})}>
            <Zap size={12} /> {def.label}
          </button>
        ))}
      </>}

      {!!pendingConnection && !!allTriggers.length && <>
        <div style={sectionTitle}>Evento (conectar como filho) · {allTriggers.length}</div>
        {allTriggers.map(def => (
          <button key={`child-${def.type}`} type="button" style={familyButtonStyle('gatilho')} onClick={() => onPick(def.type)} title={def.summarize({})}>
            <Zap size={12} /> {def.label}
          </button>
        ))}
      </>}

      {!pendingConnection && <p style={{ color: '#7a7a86', fontSize: 11, marginTop: 8 }}>Selecione um "+" no canvas para conectar um novo no.</p>}

      <div style={sectionTitle}>Criar habilidade</div>
      <button type="button" style={familyButtonStyle('gatilho')} onClick={() => setSelectorOpen(true)}>
        <Wand2 size={12} /> Criar habilidade · {templates.length} modelos
      </button>

      {FAMILIES.map(family => {
        const items = listNodeTypes(family).filter(def => !q || def.label.toLocaleLowerCase('pt-BR').includes(q));
        if (!items.length) return null;
        const groups = groupByCategory(items);
        return (
          <React.Fragment key={family}>
            <div style={sectionTitle}>{FAMILY_LABEL[family]} · {items.length}</div>
            {groups.map(([category, groupItems]) => (
              <React.Fragment key={category}>
                {category && <div style={subsectionTitle}>{category}</div>}
                {groupItems.map(def => (
                  <button key={def.type} type="button" style={familyButtonStyle(family, { opacity: pendingConnection ? 1 : 0.45 })} disabled={!pendingConnection} onClick={() => onPick(def.type)}>
                    {def.label}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </React.Fragment>
        );
      })}

      {selectorOpen && (
        <AbilityCreatorSelector
          templates={templates}
          onClose={() => setSelectorOpen(false)}
          onPickTemplate={template => { setSelectorOpen(false); setCreator({ template, draft: { ...template.defaults } }); }}
          onPickGuided={() => { setSelectorOpen(false); setWizardOpen(true); }}
        />
      )}

      {wizardOpen && (
        <AbilityWizard
          onClose={() => setWizardOpen(false)}
          onBack={() => { setWizardOpen(false); setSelectorOpen(true); }}
          onCreate={graph => { onWizardBuild(graph); setWizardOpen(false); }}
        />
      )}

      {creator && (
        <TemplateCreatorModal
          template={creator.template}
          draft={creator.draft}
          onChange={patch => setCreator(cur => cur ? { ...cur, draft: { ...cur.draft, ...patch } } : cur)}
          onClose={() => { setCreator(null); setSelectorOpen(true); }}
          onCreate={() => {
            onLoadTemplate(creator.template.id, creator.draft);
            setCreator(null);
          }}
        />
      )}
    </div>
  );
};

export default NodePalette;
