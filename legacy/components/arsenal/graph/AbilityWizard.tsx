import React from 'react';
import { Wand2, ChevronLeft, ChevronRight } from 'lucide-react';
import { WIZARD_DEFAULTS, buildGraphFromWizard, type WizardAnswers, type WizardEffectKind } from '../../../utils/abilityWizard';
import { describeAbilityGraph } from '../../../utils/abilityDescribe';
import { validateAbilityGraph } from '../../../utils/abilityValidate';
import DiceFormulaInput from './DiceFormulaInput';

const ELEMENTS = ['fisico', 'fogo', 'raio', 'agua', 'terra', 'vento', 'escuridao', 'luminoso', 'sangue', 'aura'];
const CONDITIONS = ['queimadura','congelamento','lentidao','molhado','eletrocutado','sangramento','fraqueza','acelerado','desnorteado','enraizado','desequilibrado','fraturado','iluminado','amaldicoado','paralisado','confuso'];
const EFFECT_OPTIONS: { key: WizardEffectKind; label: string }[] = [
  { key: 'dano', label: 'Dano' }, { key: 'cura', label: 'Cura' },
  { key: 'condicao', label: 'Condicao' }, { key: 'buff', label: 'Buff/Debuff' },
];

const field: React.CSSProperties = { width: '100%', padding: '8px 10px', background: 'rgba(7,9,14,.78)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#f1f1f4', outline: 'none', fontSize: 12 };
const modalLabel: React.CSSProperties = { display: 'block', marginBottom: 4, color: '#92929c', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' };
const question: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const chip = (active: boolean): React.CSSProperties => ({
  padding: '6px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
  border: `1px solid ${active ? 'rgba(125,230,255,.5)' : 'rgba(255,255,255,.14)'}`,
  background: active ? 'rgba(125,230,255,.15)' : 'rgba(255,255,255,.03)', color: '#e4e4ea',
});
const button: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.04)', color: '#e4e4ea', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const primaryButton: React.CSSProperties = { ...button, borderColor: 'rgba(125,230,255,.42)', background: 'rgba(23,64,84,.32)', color: '#bfeaff' };
const createButton: React.CSSProperties = { ...button, borderColor: 'rgba(134,239,172,.42)', background: 'rgba(20,80,48,.28)', color: '#bbf7d0' };
const disabledButton: React.CSSProperties = { ...button, opacity: 0.4, cursor: 'not-allowed' };

function toggleEffect(list: WizardEffectKind[], key: WizardEffectKind): WizardEffectKind[] {
  return list.includes(key) ? list.filter(k => k !== key) : [...list, key];
}

interface StepProps { a: WizardAnswers; patch: (p: Partial<WizardAnswers>) => void }

const StepBasico: React.FC<StepProps> = ({ a, patch }) => (
  <div style={{ display: 'grid', gap: 12 }}>
    <label style={question}><span style={modalLabel}>Nome da habilidade</span>
      <input aria-label="Nome" style={field} value={a.name} placeholder="Nova habilidade" onChange={ev => patch({ name: ev.target.value })} />
    </label>
    <div style={question}>
      <span style={modalLabel}>Quem pode ser escolhido como alvo?</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          ['alvo_da_habilidade', 'Alvo escolhido'], ['proprio', 'Proprio usuario'],
          ['todos_inimigos', 'Todos inimigos'], ['todos_aliados', 'Todos aliados'],
          ['atacante_original', 'Quem causou o gatilho'],
        ].map(([k, l]) => (
          <button key={k} type="button" style={chip(a.targetScope === k)} onClick={() => patch({ targetScope: k as WizardAnswers['targetScope'] })}>{l}</button>
        ))}
      </div>
    </div>
    <div style={question}>
      <span style={modalLabel}>A habilidade e instantanea, preparacao ou reacao?</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[['instantanea','Instantanea'],['preparacao','Preparacao'],['reacao','Reacao (ao ser alvejado)']].map(([k,l]) => (
          <button key={k} type="button" style={chip(a.timing === k)} onClick={() => patch({ timing: k as WizardAnswers['timing'] })}>{l}</button>
        ))}
      </div>
    </div>
  </div>
);

const StepTeste: React.FC<StepProps> = ({ a, patch }) => (
  <div style={{ display: 'grid', gap: 12 }}>
    <div style={question}>
      <span style={modalLabel}>Existe teste de acerto?</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" style={chip(a.hasTest)} onClick={() => patch({ hasTest: true })}>Sim</button>
        <button type="button" style={chip(!a.hasTest)} onClick={() => patch({ hasTest: false })}>Nao (acerto automatico)</button>
      </div>
      {a.hasTest && <DiceFormulaInput label="Rolagem" value={a.testDice} onChange={v => patch({ testDice: v ?? '1d20' })} />}
    </div>
  </div>
);

const StepEfeitos: React.FC<StepProps> = ({ a, patch }) => (
  <div style={{ display: 'grid', gap: 12 }}>
    <div style={question}>
      <span style={modalLabel}>A habilidade causa dano, cura ou aplica efeitos? (pode marcar mais de um)</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {EFFECT_OPTIONS.map(opt => (
          <button key={opt.key} type="button" style={chip(a.effectKinds.includes(opt.key))} onClick={() => patch({ effectKinds: toggleEffect(a.effectKinds, opt.key) })}>{opt.label}</button>
        ))}
      </div>
    </div>

    {a.effectKinds.includes('dano') && (
      <div style={question}>
        <span style={modalLabel}>Dano</span>
        <DiceFormulaInput label="Dano em dados" value={a.damageDice} onChange={v => patch({ damageDice: v ?? '' })} />
        <label><span style={modalLabel}>Dano fixo</span><input aria-label="Dano fixo" style={field} type="number" value={a.damageFlat} onChange={ev => patch({ damageFlat: Number(ev.target.value) })} /></label>
        <label><span style={modalLabel}>Elemento</span><select aria-label="Elemento" style={field} value={a.element ?? ''} onChange={ev => patch({ element: ev.target.value as WizardAnswers['element'] })}>{ELEMENTS.map(k => <option key={k} value={k}>{k}</option>)}</select></label>
      </div>
    )}
    {a.effectKinds.includes('cura') && (
      <div style={question}>
        <span style={modalLabel}>Cura</span>
        <DiceFormulaInput label="Cura em dados" value={a.healDice} onChange={v => patch({ healDice: v ?? '' })} />
        <label><span style={modalLabel}>Cura fixa</span><input aria-label="Cura fixa" style={field} type="number" value={a.healFlat} onChange={ev => patch({ healFlat: Number(ev.target.value) })} /></label>
      </div>
    )}
    {a.effectKinds.includes('condicao') && (
      <div style={question}>
        <span style={modalLabel}>Condicao aplicada</span>
        <select aria-label="Condicao" style={field} value={a.conditionKind} onChange={ev => patch({ conditionKind: ev.target.value })}>{CONDITIONS.map(k => <option key={k} value={k}>{k}</option>)}</select>
        <label><span style={modalLabel}>Duracao (rodadas)</span><input aria-label="Duracao da condicao" style={field} type="number" value={a.conditionRounds} onChange={ev => patch({ conditionRounds: Number(ev.target.value) })} /></label>
        <label><span style={modalLabel}>Chance (%)</span><input aria-label="Chance da condicao" style={field} type="number" value={a.conditionChance} onChange={ev => patch({ conditionChance: Number(ev.target.value) })} /></label>
      </div>
    )}
    {a.effectKinds.includes('buff') && (
      <div style={question}>
        <span style={modalLabel}>Buff/Debuff</span>
        <select aria-label="Atributo" style={field} value={a.buffStat} onChange={ev => patch({ buffStat: ev.target.value as WizardAnswers['buffStat'] })}>
          {[['ataque','Ataque'],['defesa','Defesa'],['velocidade','Velocidade'],['vida_maxima','Vida maxima'],['aura_maxima','Aura maxima']].map(([k,l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <label><span style={modalLabel}>Valor (negativo = debuff)</span><input aria-label="Valor do buff" style={field} type="number" value={a.buffValue} onChange={ev => patch({ buffValue: Number(ev.target.value) })} /></label>
      </div>
    )}
    {!a.effectKinds.length && <p style={{ margin: 0, color: '#7a7a86', fontSize: 11 }}>Marque ao menos um efeito para a habilidade fazer algo.</p>}
  </div>
);

const StepCustoDuracao: React.FC<StepProps> = ({ a, patch }) => (
  <div style={{ display: 'grid', gap: 12 }}>
    <div style={question}>
      <span style={modalLabel}>Existe algum custo?</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" style={chip(a.hasCost)} onClick={() => patch({ hasCost: true })}>Sim</button>
        <button type="button" style={chip(!a.hasCost)} onClick={() => patch({ hasCost: false })}>Nao</button>
      </div>
      {a.hasCost && <label><span style={modalLabel}>Custo de aura</span><input aria-label="Custo de aura" style={field} type="number" value={a.auraCost} onChange={ev => patch({ auraCost: Number(ev.target.value) })} /></label>}
    </div>
    <div style={question}>
      <span style={modalLabel}>O efeito possui duracao (continuo)?</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" style={chip(a.hasDuration)} onClick={() => patch({ hasDuration: true })}>Sim</button>
        <button type="button" style={chip(!a.hasDuration)} onClick={() => patch({ hasDuration: false })}>Nao (instantaneo)</button>
      </div>
      {a.hasDuration && <label><span style={modalLabel}>Rodadas</span><input aria-label="Rodadas de duracao" style={field} type="number" value={a.durationRounds} onChange={ev => patch({ durationRounds: Number(ev.target.value) })} /></label>}
    </div>
    <div style={question}>
      <span style={modalLabel}>Pode participar de combos?</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" style={chip(a.comboEnabled)} onClick={() => patch({ comboEnabled: true })}>Sim</button>
        <button type="button" style={chip(!a.comboEnabled)} onClick={() => patch({ comboEnabled: false })}>Nao</button>
      </div>
    </div>
    <p style={{ margin: 0, color: '#5f6570', fontSize: 11 }}>Efeito adicional em acerto critico ainda nao e suportado pelo motor de combate — configure manualmente depois, se necessario.</p>
  </div>
);

interface WizardStep { key: string; label: string; render: React.FC<StepProps> }
const STEPS: WizardStep[] = [
  { key: 'basico', label: 'Alvo & Timing', render: StepBasico },
  { key: 'teste', label: 'Teste de acerto', render: StepTeste },
  { key: 'efeitos', label: 'Efeitos', render: StepEfeitos },
  { key: 'custo', label: 'Custo & Duracao', render: StepCustoDuracao },
];

const AbilityWizard: React.FC<{ onClose: () => void; onBack?: () => void; onCreate: (graph: ReturnType<typeof buildGraphFromWizard>) => void }> = ({ onClose, onBack, onCreate }) => {
  const [a, setA] = React.useState<WizardAnswers>(WIZARD_DEFAULTS);
  const [stepIndex, setStepIndex] = React.useState(0);
  const patch = (p: Partial<WizardAnswers>) => setA(cur => ({ ...cur, ...p }));

  const graph = React.useMemo(() => buildGraphFromWizard(a), [a]);
  const preview = React.useMemo(() => describeAbilityGraph(graph), [graph]);
  const issues = React.useMemo(() => validateAbilityGraph(graph), [graph]);
  const errors = issues.filter(i => i.severity === 'erro');

  const onLastStep = stepIndex === STEPS.length - 1;
  const CurrentStep = STEPS[stepIndex].render;

  return (
    <div role="dialog" aria-label="Perguntas guiadas: criacao passo a passo" style={{ position: 'fixed', inset: 0, zIndex: 260, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.62)' }}>
      <div style={{ width: 'min(680px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', border: '1px solid rgba(255,255,255,.14)', borderRadius: 8, background: '#101218', boxShadow: '0 24px 80px rgba(0,0,0,.45)', padding: 16 }}>
        <strong style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f4f7fb', fontSize: 16, marginBottom: 4 }}><Wand2 size={16} /> Perguntas guiadas</strong>
        <p style={{ margin: '0 0 10px', color: '#8c95a3', fontSize: 12 }}>Passo {stepIndex + 1} de {STEPS.length}: {STEPS[stepIndex].label}</p>

        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {STEPS.map((step, index) => (
            <div key={step.key} title={step.label} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: index <= stepIndex ? 'rgba(125,230,255,.6)' : 'rgba(255,255,255,.1)',
            }} />
          ))}
        </div>

        <CurrentStep a={a} patch={patch} />

        {onLastStep && (
          <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 12 }}>
            <div style={modalLabel}>Preview</div>
            <p style={{ margin: '4px 0 8px', color: '#e4e4ea', fontSize: 12, lineHeight: 1.5 }}>{preview}</p>
            {!!errors.length && <p style={{ margin: 0, color: '#fecaca', fontSize: 11 }}>{errors.length} erro(s) a corrigir: {errors.map(e => e.message).join(' ')}</p>}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={button} onClick={onClose}>Cancelar</button>
            {onBack && stepIndex === 0 && <button type="button" style={button} onClick={onBack}><ChevronLeft size={12} /> Escolher outro modo</button>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {stepIndex > 0 && <button type="button" style={button} onClick={() => setStepIndex(i => i - 1)}><ChevronLeft size={12} /> Voltar</button>}
            {!onLastStep && <button type="button" style={primaryButton} onClick={() => setStepIndex(i => i + 1)}>Avancar <ChevronRight size={12} /></button>}
            {onLastStep && <button type="button" style={errors.length ? disabledButton : createButton} disabled={!!errors.length} onClick={() => onCreate(graph)}>Criar grafo</button>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AbilityWizard;
