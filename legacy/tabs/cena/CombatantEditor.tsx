import React from 'react';
import { HeartPulse, Shield, Sparkles, X, Zap } from 'lucide-react';
import type { Character } from '../../types';
import { migrateCharacterDefense } from '../../utils/defense';

interface CombatantEditorProps {
  character: Character;
  onClose: () => void;
  onSave: (updates: Partial<Character>) => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const CombatantEditor: React.FC<CombatantEditorProps> = ({ character, onClose, onSave }) => {
  const stats = migrateCharacterDefense(character);
  const [draft, setDraft] = React.useState(() => ({
    currentHp: character.currentHp, maxHp: character.maxHp,
    currentAura: character.currentAura, maxAura: character.maxAura,
    currentAmmo: character.currentAmmo, maxAmmo: character.maxAmmo,
    defense: character.defense ?? 10,
    defenseMax: stats.defenseMax,
    defenseCurrent: stats.defenseCurrent,
    defenseReduction: Math.round(stats.defenseReduction * 100),
    defenseRegeneration: stats.defenseRegeneration,
    defenseActivationThreshold: Math.round(stats.defenseActivationThreshold * 100),
    staggerMax: stats.staggerMax,
    staggerCurrent: stats.staggerCurrent,
    staggerRecovery: stats.staggerRecovery,
    staggerDamageMultiplier: stats.staggerDamageMultiplier,
    staggerDuration: stats.staggerDuration,
    speed: character.speed ?? character.baseInitiative ?? 0,
    isDefenseBroken: stats.isDefenseBroken,
    isStaggered: stats.isStaggered,
  }));
  const number = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: Number(value) }));
  const toggle = (key: 'isDefenseBroken' | 'isStaggered', checked: boolean) => setDraft(current => ({ ...current, [key]: checked }));
  const save = () => {
    const maxHp = Math.max(1, draft.maxHp || 1);
    const maxAura = Math.max(0, draft.maxAura || 0);
    const maxAmmo = Math.max(0, draft.maxAmmo || 0);
    const defenseMax = Math.max(0, draft.defenseMax || 0);
    const staggerMax = Math.max(0, draft.staggerMax || 0);
    onSave({ ...draft, maxHp, maxAura, maxAmmo, currentHp: clamp(draft.currentHp, 0, maxHp), currentAura: clamp(draft.currentAura, 0, maxAura), currentAmmo: clamp(draft.currentAmmo, 0, maxAmmo), defense: Math.max(0, draft.defense || 0), defenseMax, defenseCurrent: clamp(draft.defenseCurrent, 0, defenseMax), defenseReduction: Math.max(0, draft.defenseReduction) / 100, defenseRegeneration: Math.max(0, draft.defenseRegeneration), defenseActivationThreshold: Math.max(0, draft.defenseActivationThreshold) / 100, staggerMax, staggerCurrent: clamp(draft.staggerCurrent, 0, staggerMax), staggerRecovery: Math.max(0, draft.staggerRecovery), staggerDamageMultiplier: Math.max(0, draft.staggerDamageMultiplier), staggerDuration: Math.max(0, Math.floor(draft.staggerDuration)), isDefenseBroken: draft.isDefenseBroken, isStaggered: draft.isStaggered });
  };
  type NumberField = { key: Exclude<keyof typeof draft, 'isDefenseBroken' | 'isStaggered'>; label: string; Icon: React.ComponentType<{ size?: number }>; suffix?: string };
  const sections: { title: string; fields: NumberField[] }[] = [
    { title: 'Vitalidade', fields: [
      { key: 'currentHp', label: 'HP atual', Icon: HeartPulse }, { key: 'maxHp', label: 'HP máximo', Icon: HeartPulse },
      { key: 'currentAura', label: 'Aura atual', Icon: Sparkles }, { key: 'maxAura', label: 'Aura máxima', Icon: Sparkles },
      { key: 'currentAmmo', label: 'Munição atual', Icon: Zap }, { key: 'maxAmmo', label: 'Munição máxima', Icon: Zap },
    ] },
    { title: 'Defesa (dificulta ser acertado)', fields: [
      { key: 'defense', label: 'Defesa', Icon: Shield },
    ] },
    { title: 'Escudo de Defesa', fields: [
      { key: 'defenseMax', label: 'Escudo máximo', Icon: Shield }, { key: 'defenseCurrent', label: 'Escudo atual', Icon: Shield },
      { key: 'defenseReduction', label: 'Redução de dano ao acertar', Icon: Shield, suffix: '%' }, { key: 'defenseRegeneration', label: 'Regeneração por rodada', Icon: Shield },
      { key: 'defenseActivationThreshold', label: 'Mínimo de escudo p/ proteger', Icon: Shield, suffix: '%' },
    ] },
    { title: 'Desequilíbrio (Stagger)', fields: [
      { key: 'staggerMax', label: 'Limite de desequilíbrio', Icon: Zap }, { key: 'staggerCurrent', label: 'Desequilíbrio atual', Icon: Zap },
      { key: 'staggerRecovery', label: 'Recuperação por rodada', Icon: Zap }, { key: 'staggerDamageMultiplier', label: 'Dano extra ao atordoar', Icon: Zap, suffix: 'x' },
      { key: 'staggerDuration', label: 'Turnos perdidos ao atordoar', Icon: Zap },
    ] },
    { title: 'Outros', fields: [{ key: 'speed', label: 'Velocidade', Icon: Zap }] },
  ];

  return <div className="cena-editor-backdrop" role="dialog" aria-modal="true" aria-label={`Editar status de ${character.name}`}>
    <div className="cena-editor">
      <header><div className="cena-editor__portrait" style={character.icon ? { backgroundImage: `url(${character.icon})` } : undefined}>{!character.icon && character.name.charAt(0)}</div><div><span>AJUSTE RÁPIDO</span><h2>{character.name}</h2><p>Valores atuais do combatente</p></div><button aria-label="Fechar editor" onClick={onClose}><X size={20} /></button></header>
      {sections.map(section => <div key={section.title} className="cena-editor__section">
        <h6 className="cena-editor__section-title">{section.title}</h6>
        <div className="cena-editor__stats">{section.fields.map(({ key, label, Icon, suffix }) => <label key={key}><span><Icon size={14} />{label}{suffix ? ` (${suffix})` : ''}</span><input type="number" step={key === 'staggerDamageMultiplier' ? 0.1 : undefined} value={draft[key]} onChange={event => number(key, event.target.value)} /></label>)}</div>
        {section.title === 'Escudo de Defesa' && <label className="cena-editor__toggle"><input type="checkbox" checked={draft.isDefenseBroken} onChange={e => toggle('isDefenseBroken', e.target.checked)} /> Escudo quebrado</label>}
        {section.title === 'Desequilíbrio (Stagger)' && <label className="cena-editor__toggle"><input type="checkbox" checked={draft.isStaggered} onChange={e => toggle('isStaggered', e.target.checked)} /> Atordoado</label>}
      </div>)}
      <footer><button onClick={onClose}>CANCELAR</button><button className="is-primary" onClick={save}>SALVAR ALTERAÇÕES</button></footer>
    </div>
  </div>;
};

export default CombatantEditor;
