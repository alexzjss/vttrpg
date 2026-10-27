import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Backpack,
  Swords,
  Users,
  Layers,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  Zap,
  Save,
  Search,
  ChevronDown,

  Sparkles,
  Image as ImageIcon,
  Heart,
  Database,
  Shield,
  Download,
  Dices,
  UserPlus,
  Link as LinkIcon,
  PackageOpen,
  Hash,
  Star,
  Eye,
  EyeOff
} from 'lucide-react';
import { Card, CardLevel, CardBonus, Character, CombatState, CardType, Item, JourneyState, ConditionEffect, ConditionEffectType, Seal, SealExecutionMode, DamageType, PRESET_CONDITIONS, Recipe, UpgradeOffer, UpgradeOfferType, Weapon } from './types';
import { DatabaseService, SNAPSHOT_VERSION } from './utils/database';
import type { RollResult } from './utils/dice';
import DiceAnimation from './components/DiceAnimation';
import CardRevealAnimation, { CardAnimPayload } from './components/CardRevealAnimation';
import { DAMAGE_TYPES } from './utils/theme';
import { resolveOwnedItems, giveOwned, consumeOwned, setOwnedQuantity, removeOwned, type ResolvedItem } from './utils/items';
import type { ActionCategory } from './components/combat/ActionIconRail';
import { migrateCombatState } from './utils/combatMigration';
import { applySectionTheme } from './utils/sectionTheme';
import type { CenaState } from './utils/cena';
import { createDefaultCena, mergeNpcLiveUpdates, syncNpcFromCharacter } from './utils/cena';
import type { ArsenalCard, ArsenalEffect } from './utils/arsenal';
import type { AbilityGraph } from './utils/abilityGraph';
import { TabSweep, Title, ImagePickerButton } from './components/ui';
import { useKeyboardNav } from './components/nav';
import CenaTab from './tabs/CenaTab';
import { useUnifiedAutosave } from './hooks/useUnifiedAutosave';


// --- Portal de Confirmação (escapa stacking context de backdrop-filter/overflow) ---
const ConfirmPortal: React.FC<{
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: React.ReactNode;
  confirmLabel?: string;
  confirmClass?: string;
}> = ({ message, onConfirm, onCancel, icon, confirmLabel = 'Confirmar', confirmClass = 'bg-rose-700 hover:bg-rose-600' }) => {
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 anim-fade"
      style={{ zIndex: 99999, background: 'rgba(8,10,16,0.85)', backdropFilter: 'blur(12px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="rounded-[2rem] p-8 max-w-sm w-full shadow-[0_25px_80px_rgba(0,0,0,0.7)] text-center anim-scale-in" style={{ background:'var(--bg-surface)', border:'1px solid var(--border-gold)' }}>
        <div className="flex justify-center mb-5">
          <div className="p-4 rounded-2xl" style={{ background:'rgba(220,38,38,0.12)', border:'1px solid rgba(220,38,38,0.3)' }}>
            {icon || <Trash2 className="w-7 h-7 text-rose-400" />}
          </div>
        </div>
        <p className="text-white font-bold text-base mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 rounded-2xl font-bold uppercase text-xs tracking-widest transition-all"
            style={{ background:'var(--bg-raised)', color:'var(--text-secondary)', border:'1px solid var(--border-mid)' }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-6 py-3 rounded-2xl text-white font-bold uppercase text-xs tracking-widest shadow-lg ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// --- Componentes de Utilidade ---

const ImageUploader: React.FC<{ 
  value: string; 
  onChange: (val: string) => void; 
  label: string; 
  compact?: boolean;
 }> = ({ value, onChange, label, compact }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit (IndexedDB suporta bem mais)
        alert("⚠️ Arquivo muito grande!\nPor favor use imagens menores que 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => onChange(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  if (compact) {
    return (
        <div>
            <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-slate-900/80 backdrop-blur hover:bg-white text-white hover:text-black rounded-xl border border-white/20 transition-all shadow-lg"
                title="Alterar Imagem de Fundo"
            >
                <ImageIcon className="w-5 h-5" />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
        </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="text-[11px] font-extrabold uppercase text-slate-500 tracking-[0.3em]">{label}</label>
      <div className="flex gap-3">
        <input 
          type="text" 
          placeholder="URL da Imagem..." 
          className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl px-6 py-4 text-sm focus:ring-4 ring-amber-600/10 outline-none text-white transition-all shadow-inner"
          value={value.startsWith('data:') ? '' : value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button 
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-6 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-slate-700 transition-all flex items-center gap-2 text-xs font-extrabold uppercase text-slate-300"
        >
          <ImageIcon className="w-5 h-5" />
          <span className="hidden sm:inline">Upload</span>
        </button>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
      </div>
      {value && (
        <div className="mt-4 relative inline-block">
          <img src={value} className="w-24 h-24 object-cover rounded-[1.5rem] border-2 border-amber-600/30 shadow-2xl" alt="Preview" />
          <button type="button" onClick={() => onChange('')} className="absolute -top-3 -right-3 bg-rose-600 text-white rounded-full p-2 shadow-xl border-2 border-slate-950">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};

const StatBar: React.FC<{ label: string, current: number, max: number, color: string, icon?: React.ReactNode, onEdit?: () => void }> = ({ label, current, max, color, icon, onEdit }) => {
  const pct = Math.min(100, Math.max(0, (current / max) * 100));
  const isDanger = pct <= 30;
  return (
    <div className="space-y-1.5 cursor-pointer group" onClick={onEdit}>
      <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>
        <span className="flex items-center gap-2 group-hover:text-slate-300 transition-colors">{icon}{label}</span>
        <span className={`font-mono font-bold px-3 py-0.5 rounded-full border transition-all ${isDanger ? 'text-rose-400 bg-rose-950/40 border-rose-700/50 animate-danger' : 'text-white bg-slate-800/80 border-slate-700/60 group-hover:border-amber-500/50'}`}>{current} / {max}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden border transition-colors group-hover:border-slate-600" style={{ background:'rgba(0,0,0,0.4)', borderColor:'var(--border-faint)' }}>
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out animate-bar-fill ${color} ${isDanger ? 'animate-danger' : ''}`}
          style={{ width: `${pct}%`, boxShadow: `0 0 6px currentColor` }}
        />
      </div>
    </div>
  );
};

// --- Helper de Cores ---
const getCardColors = (type: CardType) => {
  switch (type) {
    case 'ataque': 
      return { 
        border: 'border-red-600', 
        bg: 'bg-red-950/30', 
        text: 'text-red-100', 
        iconBg: 'bg-red-600', 
        hoverBorder: 'hover:border-red-400',
        badge: 'bg-red-700',
        glow: 'shadow-red-900/40'
      };
    case 'reação': 
      return { 
        border: 'border-blue-500', 
        bg: 'bg-blue-950/30', 
        text: 'text-blue-100', 
        iconBg: 'bg-blue-600', 
        hoverBorder: 'hover:border-blue-400',
        badge: 'bg-blue-600',
        glow: 'shadow-blue-900/40'
      };
    case 'vínculo': 
      return { 
        border: 'border-slate-500', 
        bg: 'bg-slate-900/40', 
        text: 'text-slate-300', 
        iconBg: 'bg-slate-600', 
        hoverBorder: 'hover:border-slate-400',
        badge: 'bg-slate-600',
        glow: 'shadow-slate-900/40'
      };
    case 'ação': 
      return { 
        border: 'border-yellow-500', 
        bg: 'bg-yellow-950/30', 
        text: 'text-yellow-100', 
        iconBg: 'bg-yellow-600', 
        hoverBorder: 'hover:border-yellow-400',
        badge: 'bg-yellow-600',
        glow: 'shadow-yellow-900/40'
      };
    case 'reforço': 
      return { 
        border: 'border-green-500', 
        bg: 'bg-green-950/30', 
        text: 'text-green-100', 
        iconBg: 'bg-green-600', 
        hoverBorder: 'hover:border-green-400',
        badge: 'bg-green-600',
        glow: 'shadow-green-900/40'
      };
    case 'combinação':
      return {
        border: 'border-purple-500',
        bg: 'bg-purple-950/30',
        text: 'text-purple-100',
        iconBg: 'bg-purple-600',
        hoverBorder: 'hover:border-purple-400',
        badge: 'bg-purple-600',
        glow: 'shadow-purple-900/40'
      };
    case 'forma':
      return {
        border: 'border-amber-400',
        bg: 'bg-amber-950/30',
        text: 'text-amber-100',
        iconBg: 'bg-amber-500',
        hoverBorder: 'hover:border-amber-300',
        badge: 'bg-amber-500',
        glow: 'shadow-amber-900/40'
      };
    default: 
      return { 
        border: 'border-slate-800', 
        bg: 'bg-slate-900', 
        text: 'text-white', 
        iconBg: 'bg-slate-700', 
        hoverBorder: 'hover:border-white',
        badge: 'bg-slate-700',
        glow: 'shadow-slate-900'
      };
  }
};

// --- Componentes Adicionais ---

function TabButton({ icon, active, onClick, children }: {
  icon: React.ReactNode; active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`mp-cta ${active ? 'mp-cta--primary' : 'mp-cta--ghost'} flex items-center gap-2`}
      style={{ padding: '8px 14px', fontWeight: active ? 800 : 600 }}
    >
      <span aria-hidden>{icon}</span>
      <span>{children}</span>
    </button>
  );
}

// Etapa B: metadados de cabeçalho por aba (kicker + título grande)
type AppTab = 'cena' | 'combat' | 'arsenal' | 'characters' | 'journey';
const TAB_META: Record<AppTab, { label: string; kicker: string }> = {
  cena:       { label: 'Cena',        kicker: 'Exploração & Combate' },
  combat:     { label: 'Combate',     kicker: 'Arena & Iniciativa' },
  journey:    { label: 'Jornada',     kicker: 'Exploração & Aventura' },
  characters: { label: 'Personagens', kicker: 'Receptáculos & Vínculos' },
  arsenal:    { label: 'Arsenal',     kicker: 'Habilidades, Itens & Selos' },
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 anim-fade" style={{ background: 'rgba(8,10,14,0.88)', backdropFilter: 'blur(20px)' }}>
    <div className="border rounded-[2rem] max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scroll shadow-[0_30px_100px_rgba(0,0,0,0.8)] anim-scale-in" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-gold)', backgroundImage: 'radial-gradient(ellipse at 60% 0%, rgba(201,152,58,0.05) 0%, transparent 65%)' }}>
      <div className="flex justify-between items-center p-7 pb-5 border-b sticky top-0 rounded-t-[2rem] z-10" style={{ background: 'rgba(22,27,38,0.97)', borderColor: 'var(--border-gold)', backdropFilter: 'blur(8px)' }}>
        <h3 style={{ fontFamily:"'Cinzel', serif", fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</h3>
        <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-rose-600/20 hover:text-rose-400 transition-all" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-faint)' }}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-7 pt-5">
        {children}
      </div>
    </div>
  </div>
);

const CharacterForm: React.FC<{ cards: Card[]; weapons: Weapon[]; seals: Seal[]; initialData?: Character; onSubmit: (c: Character) => void; onDelete: (id: string) => void }> = ({ cards, weapons, seals, initialData, onSubmit, onDelete }) => {
  const [formData, setFormData] = useState<Character>(initialData?.id ? initialData : {
    id: '', name: '', icon: '', maxHp: 10, currentHp: 10, maxAura: 10, currentAura: 10, maxAmmo: 0, currentAmmo: 0, baseInitiative: 0, speed: 0, cardIds: [], weaponIds: [], sealIds: [], conditions: [], items: [], code: ''
  });

  const toggleCard = (id: string) => {
    setFormData(prev => ({
      ...prev,
      cardIds: prev.cardIds.includes(id) ? prev.cardIds.filter(cid => cid !== id) : [...prev.cardIds, id]
    }));
  };

  const toggleWeapon = (id: string) => {
    setFormData(prev => ({
      ...prev,
      weaponIds: (prev.weaponIds ?? []).includes(id) ? (prev.weaponIds ?? []).filter(wid => wid !== id) : [...(prev.weaponIds ?? []), id]
    }));
  };

  const toggleSeal = (id: string) => {
    setFormData(prev => ({
      ...prev,
      sealIds: (prev.sealIds ?? []).includes(id) ? (prev.sealIds ?? []).filter(sid => sid !== id) : [...(prev.sealIds ?? []), id]
    }));
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Nome</label>
            <input 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
              className="bg-slate-900/80 border-slate-800 w-full border rounded-2xl px-6 py-4 text-white font-bold focus:border-amber-600 outline-none"
              placeholder="Nome do Personagem"
            />
          </div>
          <ImagePickerButton value={formData.icon} onUpdate={val => setFormData({ ...formData, icon: val })} label="Avatar do Personagem" buttonLabel="Avatar" showPreviewInline={!!formData.icon} previewHeight={80} />
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Max HP</label>
              <input type="number" value={formData.maxHp} onChange={e => setFormData({ ...formData, maxHp: Number(e.target.value), currentHp: Number(e.target.value) })} className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 text-white font-black text-xl text-center focus:border-rose-600 outline-none" />
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Max Aura</label>
              <input type="number" value={formData.maxAura} onChange={e => setFormData({ ...formData, maxAura: Number(e.target.value), currentAura: Number(e.target.value) })} className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 text-white font-black text-xl text-center focus:border-amber-600 outline-none" />
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Max Munição 🎯</label>
              <input type="number" value={formData.maxAmmo || 0} onChange={e => setFormData({ ...formData, maxAmmo: Number(e.target.value), currentAmmo: Number(e.target.value) })} className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 text-white font-black text-xl text-center focus:border-orange-600 outline-none" />
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Velocidade</label>
              <input type="number" value={formData.speed ?? formData.baseInitiative ?? 0} onChange={e => setFormData({ ...formData, speed: Number(e.target.value), baseInitiative: Number(e.target.value) })} className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 text-white font-black text-xl text-center focus:border-slate-500 outline-none" />
           </div>
        </div>
      </div>

      {/* Code */}
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">
            Código do Personagem
            {formData.id && <span className="ml-2 font-mono text-amber-500">#{formData.id.slice(0,8).toUpperCase()}</span>}
          </label>
          <input
            value={formData.code || ''}
            onChange={e => setFormData({ ...formData, code: e.target.value })}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold focus:border-amber-600 outline-none font-mono"
            placeholder="Código personalizado (ex: HERO01)"
          />
        </div>
      </div>

      {/* ── VÍNCULOS ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">⛓ Vínculos</label>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, bonds: [...(prev.bonds || []), ''] }))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-900/40 border border-indigo-700/50 text-indigo-400 text-[9px] font-extrabold uppercase tracking-widest hover:bg-indigo-800/40 transition-all"
          >
            <Plus className="w-3 h-3" /> Adicionar Vínculo
          </button>
        </div>
        {(formData.bonds || []).length === 0 && (
          <p className="text-[10px] text-slate-600 italic pl-2">Nenhum vínculo definido. Vínculos podem ser requisitos de selos.</p>
        )}
        <div className="space-y-2">
          {(formData.bonds || []).map((bond, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                value={bond}
                onChange={e => {
                  const updated = [...(formData.bonds || [])];
                  updated[idx] = e.target.value;
                  setFormData(prev => ({ ...prev, bonds: updated }));
                }}
                placeholder={`Ex: Pacto de Sangue, Irmãos de Arma, Escolhido de Ignis…`}
                className="flex-1 bg-slate-900/80 border border-indigo-900/50 rounded-xl px-4 py-2.5 text-white text-sm font-bold focus:border-indigo-500 outline-none placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, bonds: (prev.bonds || []).filter((_, i) => i !== idx) }))}
                className="p-2 text-rose-500 hover:bg-rose-900/30 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Habilidades Conhecidas</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto custom-scroll p-2 border border-slate-800 rounded-2xl bg-slate-900/30">
          {cards.map(card => (
            <div 
              key={card.id} 
              onClick={() => toggleCard(card.id)}
              className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${formData.cardIds.includes(card.id) ? 'bg-amber-950/60 border-amber-500' : 'bg-slate-900/80 border-slate-800 opacity-60 hover:opacity-100'}`}
            >
              <img src={card.image || undefined} className="w-10 h-10 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                 <p className="text-xs font-extrabold uppercase text-white truncate">{card.name}</p>
                 <p className="text-[9px] text-slate-400 uppercase">{card.type}</p>
              </div>
              {formData.cardIds.includes(card.id) && <Check className="w-4 h-4 text-amber-400" />}
            </div>
          ))}
          {cards.length === 0 && <p className="text-slate-500 text-xs p-4 text-center col-span-full">Nenhuma carta disponível no grimório.</p>}
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Armas Equipadas</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto custom-scroll p-2 border border-slate-800 rounded-2xl bg-slate-900/30">
          {weapons.map(w => (
            <div
              key={w.id}
              onClick={() => toggleWeapon(w.id)}
              className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${(formData.weaponIds ?? []).includes(w.id) ? 'bg-amber-950/60 border-amber-500' : 'bg-slate-900/80 border-slate-800 opacity-60 hover:opacity-100'}`}
            >
              {w.image ? <img src={w.image} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-lg">⚔</div>}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold uppercase text-white truncate">{w.name}</p>
                <p className="text-[9px] text-slate-400 uppercase">{w.category || w.range || '—'}</p>
              </div>
              {(formData.weaponIds ?? []).includes(w.id) && <Check className="w-4 h-4 text-amber-400" />}
            </div>
          ))}
          {weapons.length === 0 && <p className="text-slate-500 text-xs p-4 text-center col-span-full">Nenhuma arma no catálogo.</p>}
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Selos Conhecidos</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto custom-scroll p-2 border border-slate-800 rounded-2xl bg-slate-900/30">
          {seals.map(s => (
            <div
              key={s.id}
              onClick={() => toggleSeal(s.id)}
              className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${(formData.sealIds ?? []).includes(s.id) ? 'bg-orange-950/60 border-orange-500' : 'bg-slate-900/80 border-slate-800 opacity-60 hover:opacity-100'}`}
            >
              {s.image ? <img src={s.image} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-lg">🔯</div>}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold uppercase text-white truncate">{s.name}</p>
                <p className="text-[9px] text-orange-400 font-mono">#{s.code}</p>
              </div>
              {(formData.sealIds ?? []).includes(s.id) && <Check className="w-4 h-4 text-orange-400" />}
            </div>
          ))}
          {seals.length === 0 && <p className="text-slate-500 text-xs p-4 text-center col-span-full">Nenhum selo no catálogo.</p>}
        </div>
      </div>

      {/* ── STACKS ──────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Stacks Personalizados</label>
          <button
            onClick={() => setFormData(prev => ({
              ...prev,
              stacks: [...(prev.stacks || []), { id: Math.random().toString(36).substr(2,9), name: 'Stack', color: '#6366f1', current: 0, max: 10 }]
            }))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-extrabold uppercase tracking-widest transition-all"
            style={{ background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)', color:'#a5b4fc' }}
          >
            <Plus className="w-3 h-3" /> Adicionar Stack
          </button>
        </div>
        {(formData.stacks || []).length === 0 && (
          <p className="text-[10px] text-slate-600 italic text-center py-2">Nenhum stack. Adicione contadores personalizados como Cargas, Pontos de Magia, etc.</p>
        )}
        <div className="space-y-2">
          {(formData.stacks || []).map((stack, idx) => (
            <div key={stack.id} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-800 bg-slate-900/50">
              <input
                type="color"
                value={stack.color}
                onChange={e => setFormData(prev => ({ ...prev, stacks: (prev.stacks||[]).map((s,i) => i===idx ? {...s, color: e.target.value} : s) }))}
                style={{ width:28, height:28, borderRadius:6, border:'none', cursor:'pointer', padding:0, background:'none' }}
                title="Cor do stack"
              />
              <input
                value={stack.name}
                onChange={e => setFormData(prev => ({ ...prev, stacks: (prev.stacks||[]).map((s,i) => i===idx ? {...s, name: e.target.value} : s) }))}
                placeholder="Nome do stack"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none focus:border-indigo-500"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-slate-500 font-bold uppercase">Val</span>
                <input
                  type="number" min={0}
                  value={stack.current}
                  onChange={e => setFormData(prev => ({ ...prev, stacks: (prev.stacks||[]).map((s,i) => i===idx ? {...s, current: parseInt(e.target.value)||0} : s) }))}
                  className="w-14 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold text-center outline-none"
                />
                <span className="text-slate-600">/</span>
                <input
                  type="number" min={1}
                  value={stack.max}
                  onChange={e => setFormData(prev => ({ ...prev, stacks: (prev.stacks||[]).map((s,i) => i===idx ? {...s, max: parseInt(e.target.value)||1} : s) }))}
                  className="w-14 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold text-center outline-none"
                />
              </div>
              <button
                onClick={() => setFormData(prev => ({ ...prev, stacks: (prev.stacks||[]).filter((_,i) => i!==idx) }))}
                className="p-1.5 rounded-lg hover:bg-rose-900/40 hover:text-rose-400 text-slate-600 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 pt-4 border-t border-slate-800">
        {initialData?.id && (
          <button onClick={() => onDelete(initialData.id)} className="px-6 py-4 bg-rose-950/50 text-rose-500 hover:bg-rose-900/50 border border-rose-900/30 rounded-2xl font-extrabold uppercase text-xs tracking-widest transition-colors">
            Excluir
          </button>
        )}
        <button onClick={() => onSubmit(formData)} className="flex-1 py-4 text-white rounded-2xl font-extrabold uppercase text-xs tracking-widest border border-amber-400/30" style={{ background: 'linear-gradient(135deg, #c9983a, #a07828)', boxShadow: '0 0 20px rgba(201,152,58,0.3)' }}>
          Salvar Personagem
        </button>
      </div>
    </div>
  );
};

// ─── BonusEditor: editor de bônus para cartas ação/reforço/combinação/forma ────
const BONUS_TYPE_LABELS: Record<string, string> = {
  healHp: '💚 Cura HP',
  recoverAura: '⚡ Recuperar Aura',
  recoverAmmo: '🎯 Recuperar Munição',
  rollBonusGeneral: '🎲 Bônus Geral de Rolagem',
  rollBonusByType: '🃏 Bônus por Tipo de Carta',
  rollBonusByElement: '✨ Bônus por Elemento',
};
const ELEMENTS = [
  { value: 'fogo', label: '🔥 Fogo' },
  { value: 'água', label: '💧 Água' },
  { value: 'terra', label: '🪨 Terra' },
  { value: 'vento', label: '🍃 Vento' },
  { value: 'raio',  label: '⚡ Raio'  },
];

// DAMAGE_TYPES movido para utils/theme.ts (fonte única)
const CARD_TYPES_FOR_BONUS: CardType[] = ['ataque','reação','ação','reforço','vínculo','combinação','forma'];

// ── Seletor de Tipo de Dano ──────────────────────────────────────────────────
const DamageTypeSelector: React.FC<{
  value?: DamageType;
  onChange: (v: DamageType) => void;
  small?: boolean;
}> = ({ value, onChange, small }) => {
  const current = DAMAGE_TYPES.find(d => d.value === (value || 'fisico')) || DAMAGE_TYPES[0];
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position:'relative', display:'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display:'flex', alignItems:'center', gap:small?3:5,
          padding: small ? '3px 8px' : '7px 12px',
          borderRadius:10,
          background:`${current.color}18`,
          border:`1.5px solid ${current.color}55`,
          color:current.color,
          fontSize: small ? 9 : 11,
          fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
          transition:'all 0.15s',
        }}
      >
        <span style={{ fontSize: small ? 10 : 13 }}>{current.emoji}</span>
        <span>{current.label}</span>
        <ChevronDown style={{ width: small ? 8 : 10, height: small ? 8 : 10, opacity:0.6 }} />
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'110%', left:0, zIndex:9999,
          background:'#0f1117', border:'1px solid rgba(255,255,255,0.12)',
          borderRadius:12, padding:6, display:'flex', flexWrap:'wrap', gap:4, width:220,
          boxShadow:'0 8px 32px rgba(0,0,0,0.8)',
        }}>
          {DAMAGE_TYPES.map(dt => (
            <button key={dt.value} type="button"
              onClick={() => { onChange(dt.value); setOpen(false); }}
              style={{
                display:'flex', alignItems:'center', gap:4, padding:'4px 8px',
                borderRadius:8, border:`1px solid ${dt.value === (value||'fisico') ? dt.color : 'transparent'}`,
                background: dt.value === (value||'fisico') ? `${dt.color}22` : 'rgba(255,255,255,0.04)',
                color: dt.value === (value||'fisico') ? dt.color : 'rgba(255,255,255,0.6)',
                fontSize:10, fontWeight:700, cursor:'pointer', flex:'0 0 auto',
              }}
            >
              <span>{dt.emoji}</span><span>{dt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Seletor de Condição Pré-definida ─────────────────────────────────────────
const PresetConditionPicker: React.FC<{
  onSelect: (name: string, duration: number) => void;
}> = ({ onSelect }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position:'relative', display:'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display:'flex', alignItems:'center', gap:4,
          padding:'4px 10px', borderRadius:8,
          background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)',
          color:'#f59e0b', fontSize:9, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
        }}
      >
        <Star style={{width:8,height:8}}/>
        Pré-definidas
        <ChevronDown style={{width:8,height:8,opacity:0.6}}/>
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'110%', left:0, zIndex:9999,
          background:'#0f1117', border:'1px solid rgba(245,158,11,0.2)',
          borderRadius:12, padding:8, width:260,
          boxShadow:'0 8px 32px rgba(0,0,0,0.8)',
        }}>
          <div style={{ fontSize:8, fontWeight:700, color:'rgba(245,158,11,0.5)', textTransform:'uppercase', letterSpacing:'0.2em', marginBottom:6 }}>
            Condições pré-definidas
          </div>
          {PRESET_CONDITIONS.map(pc => (
            <button key={pc.name} type="button"
              onClick={() => { onSelect(pc.name, pc.defaultDuration); setOpen(false); }}
              style={{
                width:'100%', display:'flex', alignItems:'flex-start', gap:6, padding:'6px 8px',
                borderRadius:8, border:'none', background:'transparent',
                cursor:'pointer', marginBottom:2,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize:14, lineHeight:1 }}>{pc.emoji}</span>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:10, fontWeight:700, color:pc.color }}>{pc.name}</div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.35)', marginTop:1 }}>{pc.description}</div>
              </div>
              <span style={{ marginLeft:'auto', fontSize:8, color:'rgba(255,255,255,0.25)', whiteSpace:'nowrap', flexShrink:0 }}>{pc.defaultDuration}t</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const BonusEditor: React.FC<{ bonuses: CardBonus[]; onChange: (b: CardBonus[]) => void }> = ({ bonuses, onChange }) => {
  const addBonus = () => {
    onChange([...bonuses, { type: 'healHp', value: 1, duration: 0 }]);
  };
  const updateBonus = (idx: number, patch: Partial<CardBonus>) => {
    const updated = bonuses.map((b, i) => i === idx ? { ...b, ...patch } : b);
    onChange(updated);
  };
  const removeBonus = (idx: number) => onChange(bonuses.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3 p-4 rounded-2xl border border-emerald-800/40 bg-emerald-950/10">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-widest flex items-center gap-2">🎁 Bônus ao Ativar</p>
        <button
          type="button"
          onClick={addBonus}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-900/40 border border-emerald-700/50 text-emerald-400 text-[9px] font-extrabold uppercase tracking-widest hover:bg-emerald-800/40 transition-all"
        >
          <Plus className="w-3 h-3" /> Adicionar Bônus
        </button>
      </div>
      {bonuses.length === 0 && (
        <p className="text-[9px] text-slate-500 italic">Nenhum bônus configurado. Esta carta só tem os efeitos base.</p>
      )}
      {bonuses.map((bonus, idx) => (
        <div key={idx} className="p-3 rounded-xl bg-slate-900/60 border border-emerald-900/40 space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={bonus.type}
              onChange={e => updateBonus(idx, { type: e.target.value as CardBonus['type'] })}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-emerald-300 text-[10px] font-bold outline-none focus:border-emerald-600"
            >
              {Object.entries(BONUS_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <button type="button" onClick={() => removeBonus(idx)} className="p-1.5 text-rose-500 hover:bg-rose-900/30 rounded-lg transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <label className="text-[8px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">Valor</label>
              <input
                type="number"
                value={bonus.value}
                onChange={e => updateBonus(idx, { value: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-emerald-300 text-sm font-black text-center outline-none focus:border-emerald-600"
              />
            </div>
            <div className="space-y-0.5">
              <label className="text-[8px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">Duração (0=perm)</label>
              <input
                type="number"
                min={0}
                value={bonus.duration ?? 0}
                onChange={e => updateBonus(idx, { duration: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 text-sm font-black text-center outline-none focus:border-amber-600"
              />
            </div>
          </div>

          {bonus.type === 'rollBonusByType' && (
            <div className="space-y-0.5">
              <label className="text-[8px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">Tipo de Carta Alvo</label>
              <select
                value={bonus.targetCardType || 'ataque'}
                onChange={e => updateBonus(idx, { targetCardType: e.target.value as CardType })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 text-[10px] font-bold outline-none focus:border-emerald-600"
              >
                {CARD_TYPES_FOR_BONUS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {bonus.type === 'rollBonusByElement' && (
            <div className="space-y-0.5">
              <label className="text-[8px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">Elemento Alvo</label>
              <select
                value={bonus.targetElement || 'fogo'}
                onChange={e => updateBonus(idx, { targetElement: e.target.value as CardBonus['targetElement'] })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 text-[10px] font-bold outline-none focus:border-emerald-600"
              >
                {ELEMENTS.map(el => <option key={el.value} value={el.value}>{el.label}</option>)}
              </select>
            </div>
          )}

          <div className="space-y-0.5">
            <label className="text-[8px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">Descrição do Bônus (Opcional)</label>
            <input
              value={bonus.label || ''}
              onChange={e => updateBonus(idx, { label: e.target.value })}
              placeholder="Ex: +3 em rolagens de Fogo"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 text-[10px] outline-none focus:border-emerald-600"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ── ConditionEffectsEditor ────────────────────────────────────────────────────
const COND_EFFECT_LABELS: Record<ConditionEffectType, { label: string; emoji: string; color: string }> = {
  damage:      { label: 'Dano por rodada',       emoji: '🩸', color: '#f87171' },
  heal:        { label: 'Cura por rodada',        emoji: '💚', color: '#4ade80' },
  drainAura:   { label: 'Drenar Aura/rodada',     emoji: '🔥', color: '#fbbf24' },
  recoverAura: { label: 'Recuperar Aura/rodada',  emoji: '⚡', color: '#a78bfa' },
  drainAmmo:   { label: 'Drenar Munição/rodada',  emoji: '🎯', color: '#f97316' },
  recoverAmmo: { label: 'Recuperar Munição/rod.', emoji: '🔄', color: '#67e8f9' },
  dicePenalty: { label: 'Penalidade no dado',     emoji: '📉', color: '#fb923c' },
  diceBonus:   { label: 'Bônus no dado',          emoji: '📈', color: '#86efac' },
};

const ConditionEffectsEditor: React.FC<{
  conditionName: string;
  effects: ConditionEffect[];
  onChange: (effects: ConditionEffect[]) => void;
}> = ({ conditionName, effects, onChange }) => {
  const addEffect = () => onChange([...effects, { type: 'damage', value: 1 }]);
  const update = (i: number, patch: Partial<ConditionEffect>) => {
    const next = effects.map((e, idx) => idx === i ? { ...e, ...patch } : e);
    onChange(next);
  };
  const remove = (i: number) => onChange(effects.filter((_, idx) => idx !== i));

  return (
    <div style={{ background: 'rgba(120,60,10,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 14, padding: '10px 12px', marginTop: 4 }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.35em', color: '#f59e0b' }}>
          ✦ Efeitos de <span style={{ color: '#fcd34d' }}>{conditionName}</span> por rodada
        </span>
        <button
          type="button"
          onClick={addEffect}
          style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}
          className="hover:bg-amber-500/20 transition-colors"
        >+ Efeito</button>
      </div>

      {effects.length === 0 && (
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '6px 0' }}>
          Nenhum efeito. Clique em "+ Efeito" para adicionar.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {effects.map((eff, i) => {
          const meta = COND_EFFECT_LABELS[eff.type];
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.25)', borderRadius: 9, padding: '6px 8px', border: `1px solid ${meta.color}22` }}>
              {/* Effect type selector */}
              <select
                value={eff.type}
                onChange={e => update(i, { type: e.target.value as ConditionEffectType })}
                style={{ flex: 1, fontSize: 10, fontWeight: 700, background: '#1e2230', border: `1px solid ${meta.color}55`, borderRadius: 7, padding: '5px 6px', color: meta.color, outline: 'none', cursor: 'pointer' }}
              >
                {(Object.entries(COND_EFFECT_LABELS) as [ConditionEffectType, typeof COND_EFFECT_LABELS[keyof typeof COND_EFFECT_LABELS]][]).map(([val, m]) => (
                  <option key={val} value={val}>{m.emoji} {m.label}</option>
                ))}
              </select>

              {/* Dice roll (optional) */}
              <input
                type="text"
                placeholder="dado (ex: 1d6)"
                value={eff.diceRoll ?? ''}
                onChange={e => update(i, { diceRoll: e.target.value || undefined })}
                style={{ width: 80, fontSize: 10, fontWeight: 700, background: '#1e2230', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '5px 6px', color: 'rgba(255,255,255,0.7)', outline: 'none', textAlign: 'center' }}
              />

              {/* Flat value (used when no diceRoll, or as bonus to dice) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>{eff.diceRoll ? '±' : '#'}</span>
                <input
                  type="number"
                  min={0}
                  value={eff.value}
                  onChange={e => update(i, { value: Math.max(0, Number(e.target.value)) })}
                  style={{ width: 48, fontSize: 11, fontWeight: 800, background: '#1e2230', border: `1px solid ${meta.color}55`, borderRadius: 7, padding: '5px 4px', color: meta.color, outline: 'none', textAlign: 'center' }}
                />
              </div>

              <button
                type="button"
                onClick={() => remove(i)}
                style={{ padding: '4px 6px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#f87171', cursor: 'pointer', fontSize: 10 }}
                className="hover:bg-rose-500/20 transition-colors"
              >✕</button>
            </div>
          );
        })}
      </div>

      {effects.length > 0 && (
        <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', marginTop: 6, textAlign: 'right' }}>
          Efeitos aplicados ao <em>início de cada rodada</em> enquanto a condição estiver ativa
        </p>
      )}
    </div>
  );
};

const CardForm: React.FC<{ initialData?: Card; onSubmit: (c: Card) => void; onDelete: (id: string) => void }> = ({ initialData, onSubmit, onDelete }) => {
  const [formData, setFormData] = useState<Card>(initialData?.id ? initialData : {
    id: '', name: '', image: '', type: 'ataque', auraCost: 0, diceRoll: '1d20', description: '', damage: 0, isAreaEffect: false
  });
  const [editingLevelIdx, setEditingLevelIdx] = useState<number | null>(null);
  const [levelDraft, setLevelDraft] = useState<Partial<CardLevel>>({});

  const isCombo = formData.type === 'combinação';

  const addLevel = () => {
    const nextNum = (formData.levels?.length ?? 0) + 2; // level 1 = base
    const newLevel: CardLevel = {
      level: nextNum,
      name: formData.name,
      auraCost: formData.auraCost,
      diceRoll: formData.diceRoll,
      damage: formData.damage,
      dc: formData.dc,
      conditionEffect: formData.conditionEffect,
      conditionDuration: formData.conditionDuration,
      description: formData.description,
    };
    const newLevels = [...(formData.levels || []), newLevel];
    setFormData({ ...formData, levels: newLevels });
    setEditingLevelIdx(newLevels.length - 1);
    setLevelDraft(newLevel);
  };

  const saveLevel = (idx: number) => {
    const newLevels = [...(formData.levels || [])];
    newLevels[idx] = { ...newLevels[idx], ...levelDraft };
    setFormData({ ...formData, levels: newLevels });
    setEditingLevelIdx(null);
    setLevelDraft({});
  };

  const removeLevel = (idx: number) => {
    const newLevels = (formData.levels || []).filter((_, i) => i !== idx);
    setFormData({ ...formData, levels: newLevels.length ? newLevels : undefined });
    setEditingLevelIdx(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Nome</label>
            <input 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
              className="bg-slate-900/80 border-slate-800 w-full border rounded-2xl px-6 py-4 text-white font-bold focus:border-amber-600 outline-none"
              placeholder="Nome da Habilidade"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Tipo</label>
            <div className="grid grid-cols-4 gap-2">
               {(['ataque', 'reação', 'ação', 'reforço', 'vínculo', 'combinação', 'forma'] as CardType[]).map(t => {
                 const colors: Record<string, string> = {
                   combinação: 'bg-purple-700 border-purple-400',
                   forma: 'bg-amber-500 border-amber-300',
                 };
                 const icons: Record<string, string> = { combinação: '🔗 ', forma: '✦ ' };
                 const activeClass = formData.type === t ? (colors[t] || 'bg-amber-600 border-amber-400') + ' text-white' : 'bg-slate-900/80 text-slate-500 border-slate-800 hover:bg-slate-900';
                 return (
                   <button
                     key={t}
                     onClick={() => setFormData({ ...formData, type: t })}
                     className={`px-2 py-3 rounded-xl text-[10px] font-extrabold uppercase border transition-all ${activeClass}`}
                     style={formData.type === t && t === 'combinação' ? { boxShadow: '0 0 14px rgba(168,85,247,0.5)' }
                           : formData.type === t && t === 'forma' ? { boxShadow: `0 0 14px ${formData.formaColor || 'rgba(251,191,36,0.5)'}` }
                           : {}}
                   >
                     {icons[t] || ''}{t}
                   </button>
                 );
               })}
            </div>
          </div>
          <ImagePickerButton value={formData.image} onUpdate={val => setFormData({ ...formData, image: val })} label="Imagem da Habilidade" buttonLabel="Imagem" showPreviewInline={!!formData.image} previewHeight={80} />
        </div>

        <div className="space-y-4">
           <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                 <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">⚡ Custo Aura</label>
                 <input type="number" value={formData.auraCost} onChange={e => setFormData({ ...formData, auraCost: Number(e.target.value) })} className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 text-white font-black text-xl text-center focus:border-cyan-600 outline-none" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">🎯 Custo Munição</label>
                 <input type="number" value={formData.ammoCost || 0} onChange={e => setFormData({ ...formData, ammoCost: Number(e.target.value) })} className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 text-white font-black text-xl text-center focus:border-orange-600 outline-none" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Rolagem</label>
                 <input type="text" value={formData.diceRoll} onChange={e => setFormData({ ...formData, diceRoll: e.target.value })} className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 text-white font-black text-xl text-center focus:border-amber-600 outline-none" placeholder="1d20" />
              </div>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Dano (Opcional)</label>
                 <input type="number" value={formData.damage || 0} onChange={e => setFormData({ ...formData, damage: Number(e.target.value) })} className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 text-white font-black text-xl text-center focus:border-rose-600 outline-none" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">CD (Opcional)</label>
                 <input type="number" value={formData.dc || 0} onChange={e => setFormData({ ...formData, dc: Number(e.target.value) })} className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 text-white font-black text-xl text-center focus:border-emerald-600 outline-none" />
              </div>
           </div>
           {(formData.damage || 0) > 0 && (
             <div className="space-y-2">
               <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Tipo de Dano</label>
               <DamageTypeSelector value={(formData as any).damageType || 'fisico'} onChange={v => setFormData({ ...formData, damageType: v } as any)} />
             </div>
           )}

           <div className="space-y-3">
               <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Efeito de Condição (Opcional)</label>
               <div className="flex gap-2 items-center">
                 <PresetConditionPicker onSelect={(name, dur) => setFormData({ ...formData, conditionEffect: name, conditionDuration: dur })} />
               </div>
               <div className="flex gap-2">
                  <input type="text" placeholder="Nome (Ex: Atordoado)" value={formData.conditionEffect || ''} onChange={e => setFormData({ ...formData, conditionEffect: e.target.value })} className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-3 text-white text-sm focus:border-amber-600 outline-none" />
                  <input type="number" placeholder="Dur." value={formData.conditionDuration || 3} onChange={e => setFormData({ ...formData, conditionDuration: Number(e.target.value) })} className="w-20 bg-slate-900/80 border border-slate-800 rounded-2xl px-2 py-3 text-white text-sm text-center focus:border-amber-600 outline-none" />
               </div>
               {/* Per-condition round effects */}
               {formData.conditionEffect && (
                 <ConditionEffectsEditor
                   conditionName={formData.conditionEffect}
                   effects={(formData.conditionEffects || {})[formData.conditionEffect] || []}
                   onChange={effects => {
                     const newMap = { ...(formData.conditionEffects || {}) };
                     if (effects.length === 0) { delete newMap[formData.conditionEffect!]; }
                     else { newMap[formData.conditionEffect!] = effects; }
                     setFormData({ ...formData, conditionEffects: Object.keys(newMap).length ? newMap : undefined });
                   }}
                 />
               )}
           </div>

           {/* Combination fields */}
           {isCombo && (
             <div className="space-y-3 p-4 rounded-2xl border border-purple-800/50 bg-purple-950/20">
               <p className="text-[10px] font-extrabold uppercase text-purple-400 tracking-widest mb-1">⚙️ Configuração de Combinação</p>
               
               <div className="flex items-center gap-3">
                 <button
                   type="button"
                   onClick={() => setFormData({ ...formData, comboFixedUsers: !formData.comboFixedUsers })}
                   className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-[10px] font-extrabold uppercase ${formData.comboFixedUsers ? 'bg-purple-700 border-purple-500 text-white' : 'bg-slate-900/80 border-slate-800 text-slate-500'}`}
                 >
                   <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${formData.comboFixedUsers ? 'bg-purple-500 border-purple-400' : 'border-slate-600'}`}>
                     {formData.comboFixedUsers && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                   </div>
                   Nº Fixo de Usuários
                 </button>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                   <label className="text-[9px] font-extrabold uppercase text-purple-500 tracking-widest ml-1">{formData.comboFixedUsers ? 'Nº Exato' : 'Mínimo'} de Usuários</label>
                   <input
                     type="number"
                     min={2}
                     value={formData.comboMinUsers ?? 2}
                     onChange={e => setFormData({ ...formData, comboMinUsers: Math.max(2, Number(e.target.value)) })}
                     className="w-full bg-slate-900/80 border border-purple-800/50 rounded-xl px-3 py-3 text-white font-black text-lg text-center focus:border-purple-500 outline-none"
                   />
                 </div>
                 {!formData.comboFixedUsers && (
                   <div className="space-y-1">
                     <label className="text-[9px] font-extrabold uppercase text-purple-500 tracking-widest ml-1">Máximo (0 = ilimitado)</label>
                     <input
                       type="number"
                       min={0}
                       value={formData.comboMaxUsers ?? 0}
                       onChange={e => setFormData({ ...formData, comboMaxUsers: Number(e.target.value) })}
                       className="w-full bg-slate-900/80 border border-purple-800/50 rounded-xl px-3 py-3 text-white font-black text-lg text-center focus:border-purple-500 outline-none"
                     />
                   </div>
                 )}
               </div>

               <div className="space-y-1">
                 <label className="text-[9px] font-extrabold uppercase text-purple-500 tracking-widest ml-1">Modo de Resolução dos Dados</label>
                 <div className="grid grid-cols-2 gap-2">
                   {([{v:'sum',l:'Soma dos Dados',e:'➕'},{v:'highest',l:'Maior Dado',e:'🏆'}] as const).map(opt => (
                     <button
                       key={opt.v}
                       type="button"
                       onClick={() => setFormData({ ...formData, comboDiceMode: opt.v })}
                       className={`py-2.5 px-3 rounded-xl border text-[10px] font-extrabold flex items-center gap-2 transition-all ${(formData.comboDiceMode ?? 'sum') === opt.v ? 'bg-purple-700 border-purple-500 text-white' : 'bg-slate-900/80 border-slate-800 text-slate-500 hover:border-purple-800'}`}
                     >
                       <span>{opt.e}</span>{opt.l}
                     </button>
                   ))}
                 </div>
               </div>
             </div>
           )}

           {/* Area Effect toggle — hidden for combo cards */}
           {!isCombo && (
             <button
               type="button"
               onClick={() => setFormData({ ...formData, isAreaEffect: !formData.isAreaEffect })}
               className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl border transition-all ${formData.isAreaEffect ? 'bg-orange-950/40 border-orange-600/60 text-orange-300' : 'bg-slate-900/80 border-slate-800 text-slate-500 hover:border-slate-600'}`}
             >
               <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${formData.isAreaEffect ? 'bg-orange-600 border-orange-500' : 'border-slate-600'}`}>
                 {formData.isAreaEffect && <svg viewBox="0 0 10 8" className="w-3 h-3" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
               </div>
               <div className="flex-1 text-left">
                 <p className="text-[11px] font-extrabold uppercase tracking-widest">Efeito em Área</p>
                 <p className="text-[9px] mt-0.5 opacity-60">Permite selecionar múltiplos alvos simultaneamente</p>
               </div>
               <span className="text-lg">{formData.isAreaEffect ? '💥' : '◎'}</span>
             </button>
           )}

           {/* Element selector */}
           <div className="space-y-2">
             <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Elemento (Opcional)</label>
             <div className="grid grid-cols-6 gap-2">
               <button
                 type="button"
                 onClick={() => setFormData({ ...formData, element: undefined } as any)}
                 className={`py-2.5 rounded-xl text-[10px] font-extrabold border transition-all flex flex-col items-center gap-1 ${!(formData as any).element ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-900/80 border-slate-800 text-slate-500 hover:border-slate-600'}`}
               >
                 <span className="text-sm">—</span>
                 <span>Nenhum</span>
               </button>
               {([
                 { value: 'fogo',  emoji: '🔥', label: 'Fogo',  color: '#ef4444' },
                 { value: 'água',  emoji: '💧', label: 'Água',  color: '#3b82f6' },
                 { value: 'terra', emoji: '🪨', label: 'Terra', color: '#92400e' },
                 { value: 'vento', emoji: '🍃', label: 'Vento', color: '#86efac' },
                 { value: 'raio',  emoji: '⚡', label: 'Raio',  color: '#facc15' },
               ] as Array<{value: string; emoji: string; label: string; color: string}>).map(el => (
                 <button
                   key={el.value}
                   type="button"
                   onClick={() => setFormData({ ...formData, element: el.value } as any)}
                   className={`py-2.5 rounded-xl text-[10px] font-extrabold border transition-all flex flex-col items-center gap-1 ${(formData as any).element === el.value ? 'text-white' : 'bg-slate-900/80 text-slate-500 hover:border-slate-600 border-slate-800'}`}
                   style={(formData as any).element === el.value ? {
                     background: `${el.color}22`,
                     borderColor: el.color,
                     boxShadow: `0 0 12px ${el.color}44`,
                   } : {}}
                 >
                   <span className="text-lg">{el.emoji}</span>
                   <span style={(formData as any).element === el.value ? { color: el.color } : {}}>{el.label}</span>
                 </button>
               ))}
             </div>
           </div>
        </div>
      </div>
      
      <div className="space-y-2">
         <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Descrição</label>
         <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm focus:border-amber-600 outline-none min-h-[100px]" placeholder="Descreva os efeitos..." />
      </div>

      {/* ── FORMA CONFIG ── */}
      {formData.type === 'forma' && (
        <div className="space-y-4 p-5 rounded-2xl border border-amber-500/40 bg-amber-950/15">
          <p className="text-[10px] font-extrabold uppercase text-amber-400 tracking-widest flex items-center gap-2">✦ Configuração de Forma</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-extrabold uppercase text-amber-500/70 tracking-widest ml-1">Cor da Forma</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.formaColor || '#f59e0b'}
                  onChange={e => setFormData({ ...formData, formaColor: e.target.value })}
                  style={{ width:44, height:44, borderRadius:10, border:'2px solid rgba(245,158,11,0.4)', padding:2, cursor:'pointer', background:'transparent' }}
                />
                <div>
                  <p className="text-xs font-bold text-white">{formData.formaColor || '#f59e0b'}</p>
                  <p className="text-[9px] text-slate-500">Cor do brilho e animação</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-extrabold uppercase text-amber-500/70 tracking-widest ml-1">Ícone Customizado</label>
              <ImagePickerButton
                value={formData.formaIcon || ''}
                onUpdate={val => setFormData({ ...formData, formaIcon: val })}
                label="Ícone da Forma"
                accentColor={formData.formaColor || '#f59e0b'}
                previewHeight={48}
                showPreviewInline={!!formData.formaIcon}
                placement="bottom-left"
              />
              <p className="text-[9px] text-slate-500 ml-1">Substitui o avatar do personagem</p>
            </div>
          </div>

          {/* Duração e bônus de status */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold uppercase text-amber-500/70 tracking-widest ml-1">Duração (rodadas)</label>
              <input
                type="number"
                min={0}
                value={formData.formaDuration ?? 0}
                onChange={e => setFormData({ ...formData, formaDuration: Number(e.target.value) })}
                className="w-full bg-slate-900/60 border border-amber-800/40 rounded-xl px-3 py-2 text-amber-200 text-sm font-black text-center focus:border-amber-500 outline-none"
                placeholder="0 = perm"
              />
              <p className="text-[9px] text-slate-500 ml-1">0 = permanente</p>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold uppercase text-amber-500/70 tracking-widest ml-1">❤ Bônus HP Máx</label>
              <input
                type="number"
                value={formData.formaHpBonus ?? 0}
                onChange={e => setFormData({ ...formData, formaHpBonus: Number(e.target.value) })}
                className="w-full bg-slate-900/60 border border-rose-800/40 rounded-xl px-3 py-2 text-rose-300 text-sm font-black text-center focus:border-rose-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold uppercase text-amber-500/70 tracking-widest ml-1">⚡ Bônus Aura Máx</label>
              <input
                type="number"
                value={formData.formaAuraBonus ?? 0}
                onChange={e => setFormData({ ...formData, formaAuraBonus: Number(e.target.value) })}
                className="w-full bg-slate-900/60 border border-amber-800/40 rounded-xl px-3 py-2 text-amber-200 text-sm font-black text-center focus:border-amber-500 outline-none"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[9px] font-extrabold uppercase text-amber-500/70 tracking-widest ml-1">Cartas Desbloqueadas (IDs)</label>
            <p className="text-[9px] text-slate-500 ml-1">Cartas disponíveis enquanto a forma estiver ativa. Cole os IDs separados por vírgula.</p>
            <textarea
              value={(formData.formaCardIds || []).join(', ')}
              onChange={e => {
                const ids = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                setFormData({ ...formData, formaCardIds: ids });
              }}
              placeholder="id-carta-1, id-carta-2, ..."
              className="w-full bg-slate-900/60 border border-amber-800/40 rounded-xl px-4 py-3 text-amber-200 text-xs font-mono focus:border-amber-500 outline-none min-h-[60px] resize-none"
            />
          </div>
        </div>
      )}

      {/* ── BONUS SYSTEM (for ação, reforço, combinação, forma) ── */}
      {(['ação', 'reforço', 'combinação', 'forma'] as CardType[]).includes(formData.type) && (
        <BonusEditor
          bonuses={formData.bonuses || []}
          onChange={bonuses => setFormData({ ...formData, bonuses })}
        />
      )}

      {/* ── LEVEL EVOLUTION ── */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Evolução de Níveis</p>
            <p className="text-[9px] text-slate-600 ml-2 mt-0.5">Nível 1 = dados base acima. Adicione níveis com atributos alternativos.</p>
          </div>
          <button
            type="button"
            onClick={addLevel}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-900/40 border border-amber-700/50 text-amber-400 text-[10px] font-extrabold uppercase tracking-widest hover:bg-amber-800/40 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Nível {(formData.levels?.length ?? 0) + 2}
          </button>
        </div>

        {/* Level list */}
        {formData.levels && formData.levels.length > 0 && (
          <div className="space-y-2">
            {formData.levels.map((lv, idx) => (
              <div key={idx} className="rounded-2xl border border-amber-900/40 bg-slate-900/50 overflow-hidden">
                <div
                  className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-800/40"
                  onClick={() => {
                    if (editingLevelIdx === idx) { setEditingLevelIdx(null); }
                    else { setEditingLevelIdx(idx); setLevelDraft({ ...lv }); }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-amber-700/30 border border-amber-600/40 text-amber-300 text-sm font-extrabold flex items-center justify-center">{lv.level}</span>
                    <span className="text-white text-sm font-bold">{lv.name || formData.name}</span>
                    <span className="text-[9px] text-slate-500 font-mono">{lv.diceRoll || formData.diceRoll} · ⚡{lv.auraCost ?? formData.auraCost}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); removeLevel(idx); }}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-900/30 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${editingLevelIdx === idx ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {editingLevelIdx === idx && (
                  <div className="p-4 border-t border-amber-900/30 space-y-3 bg-slate-950/50">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">Nome (Opcional)</label>
                        <input value={levelDraft.name ?? ''} onChange={e => setLevelDraft({...levelDraft, name: e.target.value})} placeholder={formData.name} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:border-amber-600 outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">Rolagem</label>
                        <input value={levelDraft.diceRoll ?? ''} onChange={e => setLevelDraft({...levelDraft, diceRoll: e.target.value})} placeholder={formData.diceRoll} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-mono text-center focus:border-amber-600 outline-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">⚡ Aura</label>
                        <input type="number" value={levelDraft.auraCost ?? ''} onChange={e => setLevelDraft({...levelDraft, auraCost: Number(e.target.value)})} placeholder={String(formData.auraCost)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-white text-sm font-black text-center focus:border-cyan-600 outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">⚔ Dano</label>
                        <input type="number" value={levelDraft.damage ?? ''} onChange={e => setLevelDraft({...levelDraft, damage: Number(e.target.value)})} placeholder={String(formData.damage ?? 0)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-white text-sm font-black text-center focus:border-rose-600 outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">CD</label>
                        <input type="number" value={levelDraft.dc ?? ''} onChange={e => setLevelDraft({...levelDraft, dc: Number(e.target.value)})} placeholder={String(formData.dc ?? 0)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-white text-sm font-black text-center focus:border-emerald-600 outline-none" />
                      </div>
                    </div>
                    {((levelDraft.damage ?? formData.damage) || 0) > 0 && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">Tipo de Dano</label>
                        <DamageTypeSelector small value={(levelDraft as any).damageType || (formData as any).damageType || 'fisico'} onChange={v => setLevelDraft({...levelDraft, damageType: v} as any)} />
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">Condição</label>
                      <div className="flex gap-2 items-center mb-1">
                        <PresetConditionPicker onSelect={(name, dur) => setLevelDraft({...levelDraft, conditionEffect: name, conditionDuration: dur})} />
                      </div>
                      <div className="flex gap-2">
                        <input value={levelDraft.conditionEffect ?? ''} onChange={e => setLevelDraft({...levelDraft, conditionEffect: e.target.value})} placeholder={formData.conditionEffect || 'Nome...'} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:border-amber-600 outline-none" />
                        <input type="number" value={levelDraft.conditionDuration ?? ''} onChange={e => setLevelDraft({...levelDraft, conditionDuration: Number(e.target.value)})} placeholder="Dur." className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-white text-sm text-center focus:border-amber-600 outline-none" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">Descrição do Nível</label>
                      <textarea value={levelDraft.description ?? ''} onChange={e => setLevelDraft({...levelDraft, description: e.target.value})} placeholder={formData.description} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:border-amber-600 outline-none min-h-[70px]" />
                    </div>
                    <button
                      type="button"
                      onClick={() => saveLevel(idx)}
                      className="w-full py-2.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-[10px] font-extrabold uppercase tracking-widest transition-all"
                    >
                      <Check className="w-3.5 h-3.5 inline mr-2" />Salvar Nível {lv.level}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-4 pt-4 border-t border-slate-800">
        {initialData?.id && (
          <button onClick={() => onDelete(initialData.id)} className="px-6 py-4 bg-rose-950/50 text-rose-500 hover:bg-rose-900/50 border border-rose-900/30 rounded-2xl font-extrabold uppercase text-xs tracking-widest transition-colors">
            Excluir
          </button>
        )}
        <div className="flex-1 flex flex-col gap-3">
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">
              Código da Habilidade
              {initialData?.id && <span className="ml-2 font-mono text-amber-500">#{initialData.id.slice(0,8).toUpperCase()}</span>}
            </label>
            <input
              value={formData.code || ''}
              onChange={e => setFormData({ ...formData, code: e.target.value })}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-6 py-3 text-white font-bold focus:border-amber-600 outline-none font-mono text-sm"
              placeholder="Código personalizado (ex: FIRE01)"
            />
          </div>
          <button onClick={() => onSubmit(formData)} className="w-full py-4 text-white rounded-2xl font-extrabold uppercase text-xs tracking-widest border border-amber-400/30" style={{ background: 'linear-gradient(135deg, #c9983a, #a07828)', boxShadow: '0 0 20px rgba(201,152,58,0.3)' }}>
            Salvar Habilidade
          </button>
        </div>
      </div>
    </div>
  );
};

type QuickEffectKind = 'periodicDamage' | 'periodicHealing' | 'auraRestored' | 'modifier' | 'shield' | 'silence' | 'incapacitate' | 'dispel' | 'movement';

const blankEffect = (kind: QuickEffectKind): ArsenalEffect => {
  const id = `effect-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const base: ArsenalEffect = {
    id,
    name: 'Novo efeito',
    description: '',
    tags: [],
    duration: { type: 'rodadas', amount: 1 },
    stackBehavior: 'renova_duracao',
    maxStacks: 1,
    triggers: [],
    modifiers: [],
    periodicDamage: null,
    periodicHealing: null,
    auraConsumed: null,
    auraRestored: null,
    attackModifier: 0,
    defenseModifier: 0,
    speedModifier: 0,
    customEffect: null,
  };
  if (kind === 'periodicDamage') return { ...base, name: 'Dano continuo', periodicDamage: { flat: 1 } };
  if (kind === 'periodicHealing') return { ...base, name: 'Regeneracao', periodicHealing: { flat: 1 } };
  if (kind === 'auraRestored') return { ...base, name: 'Recupera aura', auraRestored: { flat: 1 } };
  if (kind === 'modifier') return { ...base, name: 'Modificador', valueModifiers: [{ target: 'dano', operation: 'somar', value: 1 }] };
  if (kind === 'shield') return { ...base, name: 'Escudo', shield: { flat: 3 } };
  if (kind === 'silence') return { ...base, name: 'Silenciar', silence: { blocksBasicAttack: false } };
  if (kind === 'incapacitate') return { ...base, name: 'Incapacitar', incapacitate: true };
  if (kind === 'dispel') return { ...base, name: 'Dissipar', dispel: { category: 'negativo', count: 1 } };
  return { ...base, name: 'Mover', movement: { kind: 'empurrar', distance: 1 } };
};

const effectKindOf = (effect: ArsenalEffect): QuickEffectKind => {
  if (effect.periodicDamage) return 'periodicDamage';
  if (effect.periodicHealing) return 'periodicHealing';
  if (effect.auraRestored) return 'auraRestored';
  if (effect.valueModifiers?.length) return 'modifier';
  if (effect.shield) return 'shield';
  if (effect.silence) return 'silence';
  if (effect.incapacitate) return 'incapacitate';
  if (effect.dispel) return 'dispel';
  if (effect.movement) return 'movement';
  return 'modifier';
};

const AdvancedEffectsEditor: React.FC<{ effects: ArsenalEffect[]; onChange: (effects: ArsenalEffect[]) => void; accent?: string }> = ({ effects, onChange, accent = 'violet' }) => {
  const patch = (index: number, update: Partial<ArsenalEffect>) => onChange(effects.map((effect, i) => i === index ? { ...effect, ...update } : effect));
  const patchAmount = (index: number, key: 'periodicDamage' | 'periodicHealing' | 'auraRestored' | 'shield', field: 'flat' | 'dice', value: string) => {
    const current = effects[index][key] ?? { flat: 0 };
    patch(index, { [key]: { ...current, [field]: field === 'flat' ? Number(value) || 0 : value || undefined } } as Partial<ArsenalEffect>);
  };
  const patchDuration = (index: number, amount: number) => patch(index, { duration: { ...(effects[index].duration ?? { type: 'rodadas' }), type: 'rodadas', amount } });
  const patchModifier = (index: number, field: 'target' | 'operation' | 'value', value: string) => {
    const current = effects[index].valueModifiers?.[0] ?? { target: 'dano' as const, operation: 'somar' as const, value: 1 };
    patch(index, { valueModifiers: [{ ...current, [field]: field === 'value' ? Number(value) || 0 : value }] as ArsenalEffect['valueModifiers'] });
  };
  return (
    <div className={`space-y-3 p-4 rounded-2xl border border-${accent}-900/40 bg-${accent}-950/10`}>
      <div className="flex items-center justify-between gap-3">
        <label className={`text-[10px] font-extrabold uppercase text-${accent}-300 tracking-widest`}>Efeitos avançados</label>
        <select
          value=""
          onChange={event => {
            if (!event.target.value) return;
            onChange([...effects, blankEffect(event.target.value as QuickEffectKind)]);
            event.currentTarget.value = '';
          }}
          className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs font-bold outline-none"
        >
          <option value="">+ Adicionar efeito</option>
          <option value="periodicDamage">Dano continuo</option>
          <option value="periodicHealing">Regeneracao</option>
          <option value="auraRestored">Recuperar aura</option>
          <option value="modifier">Modificar valor</option>
          <option value="shield">Escudo</option>
          <option value="silence">Silenciar</option>
          <option value="incapacitate">Incapacitar</option>
          <option value="dispel">Dissipar</option>
          <option value="movement">Movimento</option>
        </select>
      </div>
      {effects.length === 0 && <p className="text-[10px] text-slate-500 italic">Nenhum efeito avançado configurado.</p>}
      {effects.map((effect, index) => {
        const kind = effectKindOf(effect);
        return (
          <div key={effect.id || index} className="space-y-3 p-3 rounded-xl border border-slate-800 bg-slate-950/55">
            <div className="grid grid-cols-[1fr_92px_32px] gap-2">
              <input value={effect.name} onChange={event => patch(index, { name: event.target.value })} className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs font-bold outline-none" placeholder="Nome do efeito" />
              <input type="number" min="0" value={effect.duration.amount ?? 1} onChange={event => patchDuration(index, Number(event.target.value) || 0)} className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs font-bold text-center outline-none" />
              <button type="button" onClick={() => onChange(effects.filter((_, i) => i !== index))} className="rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 font-black">×</button>
            </div>
            {(['periodicDamage', 'periodicHealing', 'auraRestored', 'shield'] as QuickEffectKind[]).includes(kind) && (
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={(effect[kind as 'periodicDamage'] as any)?.flat ?? 0} onChange={event => patchAmount(index, kind as 'periodicDamage' | 'periodicHealing' | 'auraRestored' | 'shield', 'flat', event.target.value)} className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs text-center outline-none" placeholder="Valor fixo" />
                <input value={(effect[kind as 'periodicDamage'] as any)?.dice ?? ''} onChange={event => patchAmount(index, kind as 'periodicDamage' | 'periodicHealing' | 'auraRestored' | 'shield', 'dice', event.target.value)} className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs text-center outline-none" placeholder="Dado ex: 1d6" />
              </div>
            )}
            {kind === 'modifier' && (
              <div className="grid grid-cols-3 gap-2">
                <select value={effect.valueModifiers?.[0]?.target ?? 'dano'} onChange={event => patchModifier(index, 'target', event.target.value)} className="bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-2 text-white text-xs outline-none"><option value="teste">Teste</option><option value="dano">Dano</option><option value="cura">Cura</option><option value="defesa">Defesa</option><option value="velocidade">Velocidade</option></select>
                <select value={effect.valueModifiers?.[0]?.operation ?? 'somar'} onChange={event => patchModifier(index, 'operation', event.target.value)} className="bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-2 text-white text-xs outline-none"><option value="somar">Somar</option><option value="subtrair">Subtrair</option><option value="multiplicar">Multiplicar</option><option value="dividir">Dividir</option><option value="vantagem">Vantagem</option><option value="desvantagem">Desvantagem</option></select>
                <input type="number" value={effect.valueModifiers?.[0]?.value ?? 0} onChange={event => patchModifier(index, 'value', event.target.value)} className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs text-center outline-none" />
              </div>
            )}
            {kind === 'silence' && <label className="flex items-center gap-2 text-[10px] text-slate-300"><input type="checkbox" checked={!!effect.silence?.blocksBasicAttack} onChange={event => patch(index, { silence: { blocksBasicAttack: event.target.checked } })} /> Bloqueia ataque basico</label>}
            {kind === 'dispel' && <div className="grid grid-cols-2 gap-2"><select value={effect.dispel?.category ?? 'negativo'} onChange={event => patch(index, { dispel: { category: event.target.value as any, count: effect.dispel?.count ?? 1 } })} className="bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-2 text-white text-xs outline-none"><option value="positivo">Positivo</option><option value="negativo">Negativo</option><option value="qualquer">Qualquer</option></select><input type="number" min="1" value={effect.dispel?.count ?? 1} onChange={event => patch(index, { dispel: { category: effect.dispel?.category ?? 'negativo', count: Number(event.target.value) || 1 } })} className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs text-center outline-none" /></div>}
            {kind === 'movement' && <div className="grid grid-cols-2 gap-2"><select value={effect.movement?.kind ?? 'empurrar'} onChange={event => patch(index, { movement: { kind: event.target.value as any, distance: effect.movement?.distance ?? 1 } })} className="bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-2 text-white text-xs outline-none"><option value="empurrar">Empurrar</option><option value="puxar">Puxar</option><option value="teleportar">Teleportar</option><option value="trocar_lugar">Trocar lugar</option></select><input type="number" min="0" value={effect.movement?.distance ?? 1} onChange={event => patch(index, { movement: { kind: effect.movement?.kind ?? 'empurrar', distance: Number(event.target.value) || 0 } })} className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs text-center outline-none" /></div>}
          </div>
        );
      })}
    </div>
  );
};

const ItemForm: React.FC<{ initialData?: Item; onSubmit: (item: Item) => void; onDelete: (id: string) => void }> = ({ initialData, onSubmit, onDelete }) => {
  const [formData, setFormData] = useState<Item>(initialData?.id ? initialData : {
    id: '', name: '', description: '', image: '', link: '', quantity: 1, usableInCombat: false
  });
  const [effects, setEffects] = useState<ArsenalEffect[]>(initialData?.effects ?? []);

  const set = (patch: Partial<Item>) => setFormData(prev => ({ ...prev, ...patch }));
  const submitItem = () => onSubmit({ ...formData, effects });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Nome do Item</label>
          <input 
            value={formData.name} 
            onChange={e => set({ name: e.target.value })} 
            className="bg-slate-900/80 border-slate-800 w-full border rounded-2xl px-6 py-4 text-white font-bold focus:border-amber-600 outline-none"
            placeholder="Ex: Poção de Cura"
          />
        </div>
        <ImagePickerButton value={formData.image} onUpdate={val => set({ image: val })} label="Imagem do Item" buttonLabel="Imagem" showPreviewInline={!!formData.image} previewHeight={80} />
      </div>

      <div className="space-y-2">
         <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Descrição</label>
         <textarea value={formData.description} onChange={e => set({ description: e.target.value })} className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm focus:border-amber-600 outline-none min-h-[100px]" placeholder="Efeitos e detalhes..." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Quantidade</label>
          <input type="number" min="1" value={formData.quantity || 1} onChange={e => set({ quantity: Math.max(1, Number(e.target.value)) })} className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 text-white font-black text-xl text-center focus:border-amber-600 outline-none" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Categoria</label>
          <select value={formData.category || ''} onChange={e => set({ category: e.target.value })} className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 text-white font-bold text-sm focus:border-amber-600 outline-none">
            <option value="">Misc</option>
            <option value="weapon">⚔ Arma</option>
            <option value="armor">🛡 Armadura</option>
            <option value="consumable">🧪 Consumível</option>
            <option value="special">✨ Especial</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 p-4 rounded-2xl border border-slate-800 bg-slate-950/40">
        <div className="space-y-1">
          <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">Máx. Estoque</label>
          <input type="number" min="0" value={formData.maxQuantity ?? ''} onChange={e => set({ maxQuantity: e.target.value === '' ? undefined : Number(e.target.value) })} className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-bold text-center outline-none focus:border-amber-600" placeholder="∞" />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">Desgaste</label>
          <input type="number" min="0" value={formData.durability ?? ''} onChange={e => set({ durability: e.target.value === '' ? undefined : Number(e.target.value) })} className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-bold text-center outline-none focus:border-amber-600" placeholder="Atual" />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">Máx. Desgaste</label>
          <input type="number" min="0" value={formData.maxDurability ?? ''} onChange={e => set({ maxDurability: e.target.value === '' ? undefined : Number(e.target.value) })} className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-bold text-center outline-none focus:border-amber-600" placeholder="Máx." />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-widest ml-1">Gasta/Uso</label>
          <input type="number" min="0" value={formData.wearPerUse ?? ''} onChange={e => set({ wearPerUse: e.target.value === '' ? undefined : Number(e.target.value) })} className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-bold text-center outline-none focus:border-amber-600" placeholder="0" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Link Externo (Opcional)</label>
        <div className="flex gap-2 bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 focus-within:border-amber-600 transition-colors">
           <LinkIcon className="w-5 h-5 text-slate-500" />
           <input 
             value={formData.link || ''} 
             onChange={e => set({ link: e.target.value })} 
             className="flex-1 bg-transparent outline-none text-white text-sm"
             placeholder="https://..."
           />
        </div>
      </div>

      {/* ── COMBAT USAGE SECTION ── */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => set({ usableInCombat: !formData.usableInCombat })}
          className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all ${formData.usableInCombat ? 'bg-emerald-950/40 border-emerald-600/60' : 'bg-slate-900/80 border-slate-800 hover:border-slate-600'}`}
        >
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${formData.usableInCombat ? 'bg-emerald-600 border-emerald-500' : 'border-slate-600'}`}>
            {formData.usableInCombat && <svg viewBox="0 0 10 8" className="w-3 h-3" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <div className="flex-1 text-left">
            <p className={`text-[11px] font-extrabold uppercase tracking-widest ${formData.usableInCombat ? 'text-emerald-300' : 'text-slate-500'}`}>⚔ Usável em Combate</p>
            <p className={`text-[9px] mt-0.5 ${formData.usableInCombat ? 'text-emerald-500/60' : 'text-slate-600'}`}>Aparece no menu de Itens durante o combate</p>
          </div>
          <span className="text-lg">{formData.usableInCombat ? '🟢' : '⚪'}</span>
        </button>

        {formData.usableInCombat && (
          <div className="space-y-4 p-5 rounded-2xl border border-emerald-800/40 bg-emerald-950/10 anim-fade">
            <p className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-widest flex items-center gap-2">⚔ Efeitos em Combate <span className="text-slate-600 font-normal normal-case tracking-normal">(todos opcionais)</span></p>

            {/* Row 1: heal, damage, dice */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-emerald-500/70 tracking-widest ml-1">💚 Cura (HP)</label>
                <input type="number" min="0" value={formData.combatHeal ?? ''} onChange={e => set({ combatHeal: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full bg-slate-900/60 border border-emerald-800/40 rounded-xl px-3 py-2.5 text-emerald-300 text-sm font-black text-center focus:border-emerald-500 outline-none" placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-rose-500/70 tracking-widest ml-1">⚔ Dano</label>
                <input type="number" min="0" value={formData.combatDamage ?? ''} onChange={e => set({ combatDamage: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full bg-slate-900/60 border border-rose-800/40 rounded-xl px-3 py-2.5 text-rose-300 text-sm font-black text-center focus:border-rose-500 outline-none" placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-amber-500/70 tracking-widest ml-1">🎲 Dado</label>
                <input type="text" value={formData.combatDiceRoll ?? ''} onChange={e => set({ combatDiceRoll: e.target.value || undefined })}
                  className="w-full bg-slate-900/60 border border-amber-800/40 rounded-xl px-3 py-2.5 text-amber-200 text-sm font-mono text-center focus:border-amber-500 outline-none" placeholder="1d6" />
              </div>
            </div>

            {/* Row 2: aura, ammo, dc */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-cyan-500/70 tracking-widest ml-1">⚡ Rec. Aura</label>
                <input type="number" min="0" value={formData.combatAuraRecover ?? ''} onChange={e => set({ combatAuraRecover: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full bg-slate-900/60 border border-cyan-800/40 rounded-xl px-3 py-2.5 text-cyan-300 text-sm font-black text-center focus:border-cyan-500 outline-none" placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-orange-500/70 tracking-widest ml-1">🎯 Rec. Munição</label>
                <input type="number" min="0" value={formData.combatAmmoRecover ?? ''} onChange={e => set({ combatAmmoRecover: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full bg-slate-900/60 border border-orange-800/40 rounded-xl px-3 py-2.5 text-orange-300 text-sm font-black text-center focus:border-orange-500 outline-none" placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-slate-500/70 tracking-widest ml-1">◎ CD</label>
                <input type="number" min="0" value={formData.combatDc ?? ''} onChange={e => set({ combatDc: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full bg-slate-900/60 border border-slate-700/40 rounded-xl px-3 py-2.5 text-slate-300 text-sm font-black text-center focus:border-slate-500 outline-none" placeholder="0" />
              </div>
            </div>

            {/* Damage type (if damage > 0) */}
            {(formData.combatDamage || 0) > 0 && (
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-rose-500/70 tracking-widest ml-1">Tipo de Dano</label>
                <DamageTypeSelector small value={(formData as any).combatDamageType || 'fisico'} onChange={v => set({ combatDamageType: v } as any)} />
              </div>
            )}

            {/* Row 3: condition */}
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold uppercase text-purple-500/70 tracking-widest ml-1">✦ Condição Aplicada</label>
              <div className="flex gap-2 items-center mb-1">
                <PresetConditionPicker onSelect={(name, dur) => set({ combatConditionEffect: name, combatConditionDuration: dur })} />
              </div>
              <div className="flex gap-2">
                <input type="text" value={formData.combatConditionEffect ?? ''} onChange={e => set({ combatConditionEffect: e.target.value || undefined })}
                  className="flex-1 bg-slate-900/60 border border-purple-800/40 rounded-xl px-3 py-2.5 text-purple-200 text-sm focus:border-purple-500 outline-none" placeholder="Nome da condição..." />
                <input type="number" min="1" value={formData.combatConditionDuration ?? ''} onChange={e => set({ combatConditionDuration: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-20 bg-slate-900/60 border border-purple-800/40 rounded-xl px-3 py-2.5 text-purple-300 text-sm font-black text-center focus:border-purple-500 outline-none" placeholder="Dur." />
              </div>
            </div>

            {/* Row: ammo cost + targeting */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-orange-500/70 tracking-widest ml-1">🎯 Consome Munição</label>
                <input type="number" min="0" value={formData.combatAmmoCost ?? ''} onChange={e => set({ combatAmmoCost: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full bg-slate-900/60 border border-orange-800/40 rounded-xl px-3 py-2.5 text-orange-300 text-sm font-black text-center focus:border-orange-500 outline-none" placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-sky-500/70 tracking-widest ml-1">🎯 Alvo</label>
                <select value={formData.combatTargeting ?? 'self'} onChange={e => set({ combatTargeting: e.target.value as any })}
                  className="w-full bg-slate-900/60 border border-sky-800/40 rounded-xl px-3 py-2.5 text-sky-200 text-sm font-bold focus:border-sky-500 outline-none">
                  <option value="self">A si mesmo</option>
                  <option value="other">Outro personagem</option>
                  <option value="area">Área (todos)</option>
                  <option value="choice">Escolher ao usar</option>
                </select>
              </div>
            </div>

            {/* Consume on use */}
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold uppercase text-emerald-500/70 tracking-widest ml-1">Unidades por ativação</label>
              <input type="number" min="1" value={formData.usesPerActivation ?? 1} onChange={e => set({ usesPerActivation: Math.max(1, Number(e.target.value) || 1) })} className="w-full bg-slate-900/60 border border-emerald-800/40 rounded-xl px-3 py-2.5 text-emerald-300 text-sm font-black text-center focus:border-emerald-500 outline-none" />
            </div>

            <button
              type="button"
              onClick={() => set({ consumeOnUse: !formData.consumeOnUse })}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${formData.consumeOnUse ? 'bg-rose-950/30 border-rose-700/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-600'}`}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${formData.consumeOnUse ? 'bg-rose-600 border-rose-500' : 'border-slate-600'}`}>
                {formData.consumeOnUse && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div className="flex-1 text-left">
                <p className={`text-[10px] font-extrabold uppercase tracking-widest ${formData.consumeOnUse ? 'text-rose-400' : 'text-slate-500'}`}>Consumir ao usar</p>
                <p className="text-[9px] text-slate-600 mt-0.5">Reduz a quantidade em 1 quando utilizado em combate</p>
              </div>
            </button>
          </div>
        )}
      </div>

      <AdvancedEffectsEditor effects={effects} onChange={setEffects} />

      <div className="flex gap-4 pt-4 border-t border-slate-800">
        {initialData?.id && (
          <button onClick={() => onDelete(initialData.id)} className="px-6 py-4 bg-rose-950/50 text-rose-500 hover:bg-rose-900/50 border border-rose-900/30 rounded-2xl font-extrabold uppercase text-xs tracking-widest transition-colors">
            Excluir
          </button>
        )}
        <button onClick={submitItem} className="flex-1 py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-extrabold uppercase text-xs tracking-widest shadow-xl transition-all">
          {initialData?.id ? 'Salvar Alterações' : 'Adicionar ao Inventário'}
        </button>
      </div>
    </div>
  );
};

const WeaponForm: React.FC<{ initialData?: Weapon; onSubmit: (w: Weapon) => void; onDelete: (id: string) => void }> = ({ initialData, onSubmit, onDelete }) => {
  const [formData, setFormData] = useState<Weapon>(initialData?.id ? initialData : {
    id: '', name: '', description: '', image: '',
  });
  const set = (patch: Partial<Weapon>) => setFormData(prev => ({ ...prev, ...patch }));

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Nome da Arma</label>
          <input value={formData.name} onChange={e => set({ name: e.target.value })}
            className="bg-slate-900/80 border-slate-800 w-full border rounded-2xl px-6 py-4 text-white font-bold focus:border-amber-600 outline-none"
            placeholder="Ex: Espada Longa" />
        </div>
        <ImagePickerButton value={formData.image} onUpdate={val => set({ image: val })} label="Imagem da Arma" buttonLabel="Imagem" showPreviewInline={!!formData.image} previewHeight={80} />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Descrição</label>
        <textarea value={formData.description} onChange={e => set({ description: e.target.value })}
          className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm focus:border-amber-600 outline-none min-h-[80px]"
          placeholder="Habilidades e características..." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Categoria</label>
          <select value={formData.category || ''} onChange={e => set({ category: e.target.value || undefined })}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 text-white font-bold text-sm focus:border-amber-600 outline-none">
            <option value="">—</option>
            <option value="espada">⚔ Espada</option>
            <option value="arco">🏹 Arco</option>
            <option value="maça">🔨 Maça</option>
            <option value="cajado">🪄 Cajado</option>
            <option value="adaga">🗡 Adaga</option>
            <option value="lança">⚡ Lança</option>
            <option value="escudo">🛡 Escudo</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Alcance</label>
          <select value={formData.range || ''} onChange={e => set({ range: (e.target.value as any) || undefined })}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 text-white font-bold text-sm focus:border-amber-600 outline-none">
            <option value="">—</option>
            <option value="melee">⚔ Corpo a corpo</option>
            <option value="ranged">🏹 À distância</option>
            <option value="thrown">🎯 Arremessável</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold uppercase text-rose-500/70 tracking-widest ml-2">⚔ Dano Base</label>
          <input type="number" min="0" value={formData.damage ?? ''} onChange={e => set({ damage: e.target.value === '' ? undefined : Number(e.target.value) })}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 text-rose-300 font-black text-xl text-center focus:border-rose-600 outline-none" placeholder="0" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold uppercase text-emerald-500/70 tracking-widest ml-2">+ Bônus de Ataque</label>
          <input type="number" value={formData.bonus ?? ''} onChange={e => set({ bonus: e.target.value === '' ? undefined : Number(e.target.value) })}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-4 text-emerald-300 font-black text-xl text-center focus:border-emerald-600 outline-none" placeholder="0" />
        </div>
      </div>

      {(formData.damage ?? 0) > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold uppercase text-rose-500/70 tracking-widest ml-2">Tipo de Dano</label>
          <DamageTypeSelector value={formData.damageType || 'fisico'} onChange={v => set({ damageType: v })} />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest ml-2">Traços (separados por vírgula)</label>
        <input value={formData.traits?.join(', ') || ''} onChange={e => set({ traits: e.target.value ? e.target.value.split(',').map(t => t.trim()).filter(Boolean) : [] })}
          className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm focus:border-amber-600 outline-none"
          placeholder="Ex: versátil, leve, pesada" />
      </div>

      {/* ── COMBAT USAGE SECTION ── */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => set({ usableInCombat: !formData.usableInCombat })}
          className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all ${formData.usableInCombat ? 'bg-emerald-950/40 border-emerald-600/60' : 'bg-slate-900/80 border-slate-800 hover:border-slate-600'}`}
        >
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${formData.usableInCombat ? 'bg-emerald-600 border-emerald-500' : 'border-slate-600'}`}>
            {formData.usableInCombat && <svg viewBox="0 0 10 8" className="w-3 h-3" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <div className="flex-1 text-left">
            <p className={`text-[11px] font-extrabold uppercase tracking-widest ${formData.usableInCombat ? 'text-emerald-300' : 'text-slate-500'}`}>⚔ Usável em Combate</p>
            <p className={`text-[9px] mt-0.5 ${formData.usableInCombat ? 'text-emerald-500/60' : 'text-slate-600'}`}>Aparece no menu de Itens durante o combate</p>
          </div>
          <span className="text-lg">{formData.usableInCombat ? '🟢' : '⚪'}</span>
        </button>

        {formData.usableInCombat && (
          <div className="space-y-4 p-5 rounded-2xl border border-emerald-800/40 bg-emerald-950/10 anim-fade">
            <p className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-widest flex items-center gap-2">⚔ Efeitos em Combate <span className="text-slate-600 font-normal normal-case tracking-normal">(todos opcionais)</span></p>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-emerald-500/70 tracking-widest ml-1">💚 Cura (HP)</label>
                <input type="number" min="0" value={formData.combatHeal ?? ''} onChange={e => set({ combatHeal: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full bg-slate-900/60 border border-emerald-800/40 rounded-xl px-3 py-2.5 text-emerald-300 text-sm font-black text-center focus:border-emerald-500 outline-none" placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-rose-500/70 tracking-widest ml-1">⚔ Dano</label>
                <input type="number" min="0" value={formData.combatDamage ?? ''} onChange={e => set({ combatDamage: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full bg-slate-900/60 border border-rose-800/40 rounded-xl px-3 py-2.5 text-rose-300 text-sm font-black text-center focus:border-rose-500 outline-none" placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-amber-500/70 tracking-widest ml-1">🎲 Dado</label>
                <input type="text" value={formData.combatDiceRoll ?? ''} onChange={e => set({ combatDiceRoll: e.target.value || undefined })}
                  className="w-full bg-slate-900/60 border border-amber-800/40 rounded-xl px-3 py-2.5 text-amber-200 text-sm font-mono text-center focus:border-amber-500 outline-none" placeholder="1d6" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-cyan-500/70 tracking-widest ml-1">⚡ Rec. Aura</label>
                <input type="number" min="0" value={formData.combatAuraRecover ?? ''} onChange={e => set({ combatAuraRecover: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full bg-slate-900/60 border border-cyan-800/40 rounded-xl px-3 py-2.5 text-cyan-300 text-sm font-black text-center focus:border-cyan-500 outline-none" placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-orange-500/70 tracking-widest ml-1">🎯 Rec. Munição</label>
                <input type="number" min="0" value={formData.combatAmmoRecover ?? ''} onChange={e => set({ combatAmmoRecover: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full bg-slate-900/60 border border-orange-800/40 rounded-xl px-3 py-2.5 text-orange-300 text-sm font-black text-center focus:border-orange-500 outline-none" placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-slate-500/70 tracking-widest ml-1">◎ CD</label>
                <input type="number" min="0" value={formData.combatDc ?? ''} onChange={e => set({ combatDc: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full bg-slate-900/60 border border-slate-700/40 rounded-xl px-3 py-2.5 text-slate-300 text-sm font-black text-center focus:border-slate-500 outline-none" placeholder="0" />
              </div>
            </div>

            {(formData.combatDamage || 0) > 0 && (
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-rose-500/70 tracking-widest ml-1">Tipo de Dano</label>
                <DamageTypeSelector small value={formData.combatDamageType || 'fisico'} onChange={v => set({ combatDamageType: v })} />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[9px] font-extrabold uppercase text-purple-500/70 tracking-widest ml-1">✦ Condição Aplicada</label>
              <div className="flex gap-2 items-center mb-1">
                <PresetConditionPicker onSelect={(name, dur) => set({ combatConditionEffect: name, combatConditionDuration: dur })} />
              </div>
              <div className="flex gap-2">
                <input type="text" value={formData.combatConditionEffect ?? ''} onChange={e => set({ combatConditionEffect: e.target.value || undefined })}
                  className="flex-1 bg-slate-900/60 border border-purple-800/40 rounded-xl px-3 py-2.5 text-purple-200 text-sm focus:border-purple-500 outline-none" placeholder="Nome da condição..." />
                <input type="number" min="1" value={formData.combatConditionDuration ?? ''} onChange={e => set({ combatConditionDuration: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-20 bg-slate-900/60 border border-purple-800/40 rounded-xl px-3 py-2.5 text-purple-300 text-sm font-black text-center focus:border-purple-500 outline-none" placeholder="Dur." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-orange-500/70 tracking-widest ml-1">🎯 Consome Munição</label>
                <input type="number" min="0" value={formData.combatAmmoCost ?? ''} onChange={e => set({ combatAmmoCost: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full bg-slate-900/60 border border-orange-800/40 rounded-xl px-3 py-2.5 text-orange-300 text-sm font-black text-center focus:border-orange-500 outline-none" placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold uppercase text-sky-500/70 tracking-widest ml-1">🎯 Alvo</label>
                <select value={formData.combatTargeting ?? 'self'} onChange={e => set({ combatTargeting: e.target.value as any })}
                  className="w-full bg-slate-900/60 border border-sky-800/40 rounded-xl px-3 py-2.5 text-sky-200 text-sm font-bold focus:border-sky-500 outline-none">
                  <option value="self">A si mesmo</option>
                  <option value="other">Outro personagem</option>
                  <option value="area">Área (todos)</option>
                  <option value="choice">Escolher ao usar</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => set({ consumeOnUse: !formData.consumeOnUse })}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${formData.consumeOnUse ? 'bg-rose-950/30 border-rose-700/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-600'}`}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${formData.consumeOnUse ? 'bg-rose-600 border-rose-500' : 'border-slate-600'}`}>
                {formData.consumeOnUse && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div className="flex-1 text-left">
                <p className={`text-[10px] font-extrabold uppercase tracking-widest ${formData.consumeOnUse ? 'text-rose-400' : 'text-slate-500'}`}>Consumir ao usar</p>
                <p className="text-[9px] text-slate-600 mt-0.5">Reduz a quantidade em 1 quando utilizado em combate</p>
              </div>
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-4 pt-4 border-t border-slate-800">
        {initialData?.id && (
          <button onClick={() => onDelete(initialData.id)} className="px-6 py-4 bg-rose-950/50 text-rose-500 hover:bg-rose-900/50 border border-rose-900/30 rounded-2xl font-extrabold uppercase text-xs tracking-widest transition-colors">
            Excluir
          </button>
        )}
        <button onClick={() => onSubmit(formData)} className="flex-1 py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-extrabold uppercase text-xs tracking-widest shadow-xl transition-all">
          {initialData?.id ? 'Salvar Alterações' : 'Adicionar Arma'}
        </button>
      </div>
    </div>
  );
};

// ImagePickerButton → extraído para components/ui/ImagePickerButton.tsx

// BgImageButton agora é um alias do ImagePickerButton para compatibilidade
const BgImageButton: React.FC<{ backgroundImage: string; onUpdate: (url: string) => void }> = ({ backgroundImage, onUpdate }) => (
  <ImagePickerButton value={backgroundImage} onUpdate={onUpdate} label="Cenário" buttonLabel={`Cenário${backgroundImage ? ' ●' : ''}`} />
);

// --- AssignCardModal: assign a card to a character ---
const AssignCardModal: React.FC<{
  card: Card;
  characters: Character[];
  onAssign: (charId: string, add: boolean) => void;
  onClose: () => void;
}> = ({ card, characters, onAssign, onClose }) => {
  const [search, setSearch] = React.useState('');
  const filtered = characters.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal title={`Atribuir "${card.name}" a Personagem`} onClose={onClose}>
      <div className="space-y-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar personagem..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl pl-11 pr-5 py-4 text-white font-bold focus:border-amber-600 outline-none placeholder-slate-600 text-sm"
            autoFocus
          />
        </div>
        <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scroll">
          {filtered.map(char => {
            const hasCard = char.cardIds.includes(card.id);
            return (
              <div
                key={char.id}
                className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${hasCard ? 'bg-emerald-950/30 border-emerald-700/50' : 'bg-slate-900/50 border-slate-700'}`}
              >
                {char.icon
                  ? <img src={char.icon} className="w-12 h-12 rounded-2xl object-cover flex-shrink-0" />
                  : <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center flex-shrink-0"><Users className="w-5 h-5 text-slate-500" /></div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold uppercase text-white italic text-sm truncate">{char.name}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">{char.cardIds.length} habilidades</p>
                </div>
                <button
                  onClick={() => onAssign(char.id, !hasCard)}
                  className={`px-4 py-2 rounded-xl font-extrabold uppercase text-xs tracking-widest border transition-all ${hasCard ? 'bg-rose-900/40 border-rose-700/50 text-rose-400 hover:bg-rose-800/50' : 'bg-emerald-900/40 border-emerald-700/50 text-emerald-400 hover:bg-emerald-800/50'}`}
                >
                  {hasCard ? <><X className="w-3.5 h-3.5 inline mr-1" />Remover</> : <><Check className="w-3.5 h-3.5 inline mr-1" />Atribuir</>}
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-slate-500 uppercase font-black text-center py-8 opacity-40">Nenhum personagem encontrado</p>
          )}
        </div>
      </div>
    </Modal>
  );
};

const AssignWeaponModal: React.FC<{
  weapon: Weapon;
  characters: Character[];
  onAssign: (charId: string, add: boolean) => void;
  onClose: () => void;
}> = ({ weapon, characters, onAssign, onClose }) => {
  const [search, setSearch] = React.useState('');
  const filtered = characters.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal title={`Atribuir "${weapon.name}" a Personagem`} onClose={onClose}>
      <div className="space-y-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input type="text" placeholder="Buscar personagem..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl pl-11 pr-5 py-4 text-white font-bold focus:border-amber-600 outline-none placeholder-slate-600 text-sm" autoFocus />
        </div>
        <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scroll">
          {filtered.map(char => {
            const hasWeapon = (char.weaponIds ?? []).includes(weapon.id);
            return (
              <div key={char.id} className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${hasWeapon ? 'bg-emerald-950/30 border-emerald-700/50' : 'bg-slate-900/50 border-slate-700'}`}>
                {char.icon ? <img src={char.icon} className="w-12 h-12 rounded-2xl object-cover flex-shrink-0" /> : <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center flex-shrink-0"><Users className="w-5 h-5 text-slate-500" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold uppercase text-white italic text-sm truncate">{char.name}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">{(char.weaponIds ?? []).length} armas</p>
                </div>
                <button onClick={() => onAssign(char.id, !hasWeapon)}
                  className={`px-4 py-2 rounded-xl font-extrabold uppercase text-xs tracking-widest border transition-all ${hasWeapon ? 'bg-rose-900/40 border-rose-700/50 text-rose-400 hover:bg-rose-800/50' : 'bg-emerald-900/40 border-emerald-700/50 text-emerald-400 hover:bg-emerald-800/50'}`}>
                  {hasWeapon ? <><X className="w-3.5 h-3.5 inline mr-1" />Remover</> : <><Check className="w-3.5 h-3.5 inline mr-1" />Atribuir</>}
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-slate-500 uppercase font-black text-center py-8 opacity-40">Nenhum personagem encontrado</p>}
        </div>
      </div>
    </Modal>
  );
};

const AssignSealModal: React.FC<{
  seal: Seal;
  characters: Character[];
  onAssign: (charId: string, add: boolean) => void;
  onClose: () => void;
}> = ({ seal, characters, onAssign, onClose }) => {
  const [search, setSearch] = React.useState('');
  const filtered = characters.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal title={`Atribuir "${seal.name}" a Personagem`} onClose={onClose}>
      <div className="space-y-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input type="text" placeholder="Buscar personagem..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl pl-11 pr-5 py-4 text-white font-bold focus:border-amber-600 outline-none placeholder-slate-600 text-sm" autoFocus />
        </div>
        <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scroll">
          {filtered.map(char => {
            const hasSeal = (char.sealIds ?? []).includes(seal.id);
            return (
              <div key={char.id} className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${hasSeal ? 'bg-orange-950/30 border-orange-700/50' : 'bg-slate-900/50 border-slate-700'}`}>
                {char.icon ? <img src={char.icon} className="w-12 h-12 rounded-2xl object-cover flex-shrink-0" /> : <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center flex-shrink-0"><Users className="w-5 h-5 text-slate-500" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold uppercase text-white italic text-sm truncate">{char.name}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">{(char.sealIds ?? []).length} selos</p>
                </div>
                <button onClick={() => onAssign(char.id, !hasSeal)}
                  className={`px-4 py-2 rounded-xl font-extrabold uppercase text-xs tracking-widest border transition-all ${hasSeal ? 'bg-rose-900/40 border-rose-700/50 text-rose-400 hover:bg-rose-800/50' : 'bg-orange-900/40 border-orange-700/50 text-orange-400 hover:bg-orange-800/50'}`}>
                  {hasSeal ? <><X className="w-3.5 h-3.5 inline mr-1" />Remover</> : <><Check className="w-3.5 h-3.5 inline mr-1" />Atribuir</>}
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-slate-500 uppercase font-black text-center py-8 opacity-40">Nenhum personagem encontrado</p>}
        </div>
      </div>
    </Modal>
  );
};

//  SealForm Component
// ─────────────────────────────────────────────────────────────────
const SealForm: React.FC<{
  initialData?: Seal;
  characters: Character[];
  cards: Card[];
  onSubmit: (s: Seal) => void;
  onDelete: (id: string) => void;
}> = ({ initialData, characters, cards, onSubmit, onDelete }) => {
  const blank: Partial<Seal> = {
    name: '', code: '', image: '', description: '',
    diceRoll: '1d20', dc: 0, damage: 0, healHp: 0, healAura: 0,
    conditionEffect: '', conditionDuration: 3, duration: 0,
    executionMode: 'immediate', executionModes: ['immediate'], preparationRounds: 2,
    comboMinUsers: 2, comboMaxUsers: 4,
    damageModTarget: 'none', damageModValue: 0, damageModPercent: 0,
    combatTargeting: 'other', directionMode: 'source_to_target', range: 1, areaSize: 1,
    connectors: ['top', 'right', 'bottom', 'left'],
    cost: { hp: 0, aura: 0, ammo: 0 },
    requirements: [],
    symbol: '',
  };
  const [form, setForm] = React.useState<Partial<Seal>>({ ...blank, ...(initialData || {}) });
  const [effects, setEffects] = React.useState<ArsenalEffect[]>(initialData?.effects ?? []);
  const set = (p: Partial<Seal>) => setForm(prev => ({ ...prev, ...p }));
  const setCost = (p: Partial<any>) => setForm(prev => ({ ...prev, cost: { ...(prev.cost || {}), ...p } }));
  const submitSeal = () => onSubmit({ ...(form as Seal), effects });

  const addRequirement = () => {
    setForm(prev => ({ ...prev, requirements: [...(prev.requirements || []), { type: 'minHp', value: 50 }] }));
  };
  const removeRequirement = (i: number) => {
    setForm(prev => ({ ...prev, requirements: (prev.requirements || []).filter((_, idx) => idx !== i) }));
  };
  const updateRequirement = (i: number, p: any) => {
    setForm(prev => {
      const reqs = [...(prev.requirements || [])];
      reqs[i] = { ...reqs[i], ...p };
      return { ...prev, requirements: reqs };
    });
  };

  const INPUT = { background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'8px 12px', color:'white', fontSize:12, outline:'none', width:'100%', boxSizing:'border-box' as const };
  const LBL = { fontSize:9, fontWeight:700, color:'rgba(251,146,60,0.7)', textTransform:'uppercase' as const, letterSpacing:'0.12em', display:'block' as const, marginBottom:4 };
  const SECT = { background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:16, padding:'14px 16px' };
  const color = '#fb923c';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, maxHeight:'70vh', overflowY:'auto', paddingRight:4 }}>
      {/* ── Basic Info ── */}
      <div style={SECT}>
        <p style={{ fontSize:10, fontWeight:900, color, textTransform:'uppercase', letterSpacing:'0.2em', marginBottom:12 }}>Identidade</p>
        <div style={{ display:'flex', gap:10, marginBottom:10 }}>
          <div style={{ flex:2 }}>
            <label style={LBL}>Nome</label>
            <input style={INPUT} value={form.name || ''} onChange={e => set({ name: e.target.value })} placeholder="Nome do Selo..." autoFocus />
          </div>
          <div style={{ flex:1 }}>
            <label style={LBL}>Código</label>
            <input style={{...INPUT, fontFamily:'monospace', fontWeight:700, letterSpacing:'0.1em'}}
              value={form.code || ''} onChange={e => set({ code: e.target.value.toUpperCase() })} placeholder="AUTO" />
          </div>
        </div>
        <div>
          <label style={LBL}>URL da Imagem</label>
          <input style={INPUT} value={form.image || ''} onChange={e => set({ image: e.target.value })} placeholder="https://..." />
        </div>
        {form.image && <img src={form.image} style={{ width:60, height:60, borderRadius:12, objectFit:'cover', border:'2px solid rgba(234,88,12,0.4)', marginTop:8 }} />}
        <div style={{ marginTop:10 }}>
          <label style={LBL}>Descrição</label>
          <textarea style={{...INPUT, resize:'none'}} rows={3} value={form.description || ''} onChange={e => set({ description: e.target.value })} placeholder="Descreva o poder deste selo..." />
        </div>
      </div>

      {/* ── Effect Stats ── */}
      <div style={SECT}>
        <p style={{ fontSize:10, fontWeight:900, color, textTransform:'uppercase', letterSpacing:'0.2em', marginBottom:12 }}>Efeitos</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
          <div><label style={LBL}>Dado</label><input style={INPUT} value={form.diceRoll || ''} onChange={e => set({ diceRoll: e.target.value })} placeholder="1d20" /></div>
          <div><label style={LBL}>CD</label><input style={INPUT} type="number" min={0} value={form.dc ?? 0} onChange={e => set({ dc: +e.target.value })} /></div>
          <div><label style={LBL}>Duração (turnos)</label><input style={INPUT} type="number" min={0} value={form.duration ?? 0} onChange={e => set({ duration: +e.target.value })} /></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
          <div><label style={LBL}>Dano</label><input style={INPUT} type="number" min={0} value={form.damage ?? 0} onChange={e => set({ damage: +e.target.value })} /></div>
          <div><label style={LBL}>Cura HP</label><input style={INPUT} type="number" min={0} value={form.healHp ?? 0} onChange={e => set({ healHp: +e.target.value })} /></div>
          <div><label style={LBL}>Restaura Aura</label><input style={INPUT} type="number" min={0} value={form.healAura ?? 0} onChange={e => set({ healAura: +e.target.value })} /></div>
        </div>
        {(form.damage || 0) > 0 && (
          <div style={{ marginBottom:10 }}>
            <label style={LBL}>Tipo de Dano</label>
            <DamageTypeSelector small value={(form as any).damageType || 'fisico'} onChange={v => set({ damageType: v } as any)} />
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            <label style={LBL}>Condição</label>
            <div style={{ marginBottom:4 }}>
              <PresetConditionPicker onSelect={(name, dur) => set({ conditionEffect: name, conditionDuration: dur })} />
            </div>
            <input style={INPUT} value={form.conditionEffect || ''} onChange={e => set({ conditionEffect: e.target.value })} placeholder="ex: veneno" />
          </div>
          <div><label style={LBL}>Duração Condição</label><input style={INPUT} type="number" min={0} value={form.conditionDuration ?? 3} onChange={e => set({ conditionDuration: +e.target.value })} /></div>
        </div>
      </div>

      {/* ── Damage Modifier ── */}
      <div style={SECT}>
        <p style={{ fontSize:10, fontWeight:900, color:'#38bdf8', textTransform:'uppercase', letterSpacing:'0.2em', marginBottom:12 }}>Direcionamento em Combate</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
          <div><label style={LBL}>Alvo</label><select style={INPUT} value={form.combatTargeting || 'other'} onChange={e => set({ combatTargeting: e.target.value as any })}><option value="self">A si mesmo</option><option value="other">Um alvo</option><option value="area">Área</option><option value="choice">Escolher ao usar</option></select></div>
          <div><label style={LBL}>Direção</label><select style={INPUT} value={form.directionMode || 'source_to_target'} onChange={e => set({ directionMode: e.target.value as any })}><option value="source_to_target">Usuário para alvo</option><option value="target_to_source">Alvo para usuário</option><option value="around_user">Ao redor do usuário</option><option value="line">Linha</option><option value="cone">Cone</option><option value="free">Livre</option></select></div>
          <div><label style={LBL}>Alcance</label><input style={INPUT} type="number" min={0} value={form.range ?? 1} onChange={e => set({ range: +e.target.value })} /></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:10 }}>
          <div><label style={LBL}>Tamanho da Área</label><input style={INPUT} type="number" min={0} value={form.areaSize ?? 1} onChange={e => set({ areaSize: +e.target.value })} /></div>
          <div>
            <label style={LBL}>Conectores do ritual</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const }}>
              {(['top','right','bottom','left','topLeft','topRight','bottomLeft','bottomRight'] as const).map(connector => {
                const active = (form.connectors ?? []).includes(connector);
                return <button key={connector} type="button" onClick={() => {
                  const current = form.connectors ?? [];
                  set({ connectors: active ? current.filter(item => item !== connector) : [...current, connector] });
                }} style={{ padding:'6px 9px', borderRadius:8, cursor:'pointer', fontSize:9, fontWeight:800, background: active ? 'rgba(56,189,248,0.24)' : 'rgba(0,0,0,0.3)', border: active ? '1px solid rgba(56,189,248,0.55)' : '1px solid rgba(255,255,255,0.07)', color: active ? '#7dd3fc' : '#64748b' }}>{connector}</button>;
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={SECT}>
        <p style={{ fontSize:10, fontWeight:900, color:'#a5b4fc', textTransform:'uppercase', letterSpacing:'0.2em', marginBottom:12 }}>Modificador de Dano</p>
        <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' as const }}>
          {(['none','cardType','element'] as const).map(t => (
            <button key={t} onClick={() => set({ damageModTarget: t })} style={{
              padding:'6px 14px', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer',
              background: form.damageModTarget === t ? 'rgba(139,92,246,0.3)' : 'rgba(0,0,0,0.3)',
              border: form.damageModTarget === t ? '1px solid rgba(139,92,246,0.6)' : '1px solid rgba(255,255,255,0.06)',
              color: form.damageModTarget === t ? '#c4b5fd' : 'rgba(148,163,184,0.7)',
            }}>
              {t === 'none' ? 'Nenhum' : t === 'cardType' ? 'Por Tipo de Carta' : 'Por Elemento'}
            </button>
          ))}
        </div>
        {form.damageModTarget === 'cardType' && (
          <div style={{ marginBottom:10 }}>
            <label style={LBL}>Tipo de Carta</label>
            <select style={INPUT} value={form.damageModCardType || ''} onChange={e => set({ damageModCardType: e.target.value })}>
              <option value="">-- Selecione --</option>
              {['ataque','reação','ação','reforço','vínculo','combinação','forma'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
        {form.damageModTarget === 'element' && (
          <div style={{ marginBottom:10 }}>
            <label style={LBL}>Elemento</label>
            <select style={INPUT} value={form.damageModElement || ''} onChange={e => set({ damageModElement: e.target.value })}>
              <option value="">-- Selecione --</option>
              {['fogo','água','terra','vento','raio'].map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        )}
        {form.damageModTarget !== 'none' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={LBL}>Valor Fixo (±)</label><input style={INPUT} type="number" value={form.damageModValue ?? 0} onChange={e => set({ damageModValue: +e.target.value })} /></div>
            <div><label style={LBL}>Percentual (±%)</label><input style={INPUT} type="number" value={form.damageModPercent ?? 0} onChange={e => set({ damageModPercent: +e.target.value })} /></div>
          </div>
        )}
      </div>

      {/* ── Execution Mode (multi-select) ── */}
      <div style={SECT}>
        <p style={{ fontSize:10, fontWeight:900, color:'#67e8f9', textTransform:'uppercase', letterSpacing:'0.2em', marginBottom:12 }}>Modos de Execução <span style={{color:'#475569',fontWeight:500,fontSize:9}}>(múltiplos permitidos)</span></p>
        <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' as const }}>
          {([['immediate','⚡ Imediato'],['preparation','⏳ Preparação'],['combo','🤝 Combinação']] as [SealExecutionMode,string][]).map(([v, lbl]) => {
            const modes = form.executionModes || (form.executionMode ? [form.executionMode] : ['immediate']);
            const active = modes.includes(v);
            return (
              <button key={v} onClick={() => {
                const cur = form.executionModes || (form.executionMode ? [form.executionMode] : ['immediate']);
                const next = active ? cur.filter(m => m !== v) : [...cur, v];
                const final = next.length === 0 ? [v] : next;
                set({ executionModes: final, executionMode: final[0] });
              }} style={{
                padding:'7px 16px', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer',
                background: active ? 'rgba(6,182,212,0.25)' : 'rgba(0,0,0,0.3)',
                border: active ? '1px solid rgba(6,182,212,0.5)' : '1px solid rgba(255,255,255,0.06)',
                color: active ? '#67e8f9' : 'rgba(148,163,184,0.7)',
              }}>{lbl}</button>
            );
          })}
        </div>
        {(form.executionModes || [form.executionMode]).includes('preparation') && (
          <div style={{ marginBottom:10 }}><label style={LBL}>Rodadas de Preparação</label><input style={INPUT} type="number" min={1} max={10} value={form.preparationRounds ?? 2} onChange={e => set({ preparationRounds: +e.target.value })} /></div>
        )}
        {(form.executionModes || [form.executionMode]).includes('combo') && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={LBL}>Mín. Participantes</label><input style={INPUT} type="number" min={2} value={form.comboMinUsers ?? 2} onChange={e => set({ comboMinUsers: +e.target.value })} /></div>
            <div><label style={LBL}>Máx. Participantes</label><input style={INPUT} type="number" min={2} value={form.comboMaxUsers ?? 4} onChange={e => set({ comboMaxUsers: +e.target.value })} /></div>
          </div>
        )}
      </div>

      {/* ── Symbol / Ritual ── */}
      <div style={SECT}>
        <p style={{ fontSize:10, fontWeight:900, color:'#fbbf24', textTransform:'uppercase', letterSpacing:'0.2em', marginBottom:12 }}>✦ Símbolo do Ritual</p>
        <p style={{ fontSize:9, color:'#475569', marginBottom:10, fontStyle:'italic' }}>Texto (ex: runa, emoji, kanji) ou URL de imagem — exibido em animação especial quando o selo for bem executado.</p>
        <div>
          <label style={LBL}>Símbolo (texto ou URL de imagem)</label>
          <input style={INPUT} value={form.symbol || ''} onChange={e => set({ symbol: e.target.value })} placeholder="Ex: ⚡ 🔯 火 ou https://..." />
        </div>
        {form.symbol && (
          <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:9, color:'#475569' }}>Preview:</span>
            {form.symbol.startsWith('http') || form.symbol.startsWith('data:')
              ? <img src={form.symbol} style={{ width:50, height:50, objectFit:'contain', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)' }} />
              : <span style={{ fontSize:36, filter:'drop-shadow(0 0 8px rgba(251,191,36,0.7))' }}>{form.symbol}</span>
            }
          </div>
        )}
      </div>

      {/* ── Costs ── */}
      <div style={SECT}>
        <p style={{ fontSize:10, fontWeight:900, color:'#f87171', textTransform:'uppercase', letterSpacing:'0.2em', marginBottom:12 }}>Custos de Ativação</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
          <div><label style={LBL}>HP</label><input style={INPUT} type="number" min={0} value={form.cost?.hp ?? 0} onChange={e => setCost({ hp: +e.target.value })} /></div>
          <div><label style={LBL}>Aura</label><input style={INPUT} type="number" min={0} value={form.cost?.aura ?? 0} onChange={e => setCost({ aura: +e.target.value })} /></div>
          <div><label style={LBL}>Munição</label><input style={INPUT} type="number" min={0} value={form.cost?.ammo ?? 0} onChange={e => setCost({ ammo: +e.target.value })} /></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div><label style={LBL}>Item necessário</label><input style={INPUT} value={form.cost?.itemName || ''} onChange={e => setCost({ itemName: e.target.value })} placeholder="Nome do item..." /></div>
          <div><label style={LBL}>Qtd. do Item</label><input style={INPUT} type="number" min={0} value={form.cost?.itemQuantity ?? 0} onChange={e => setCost({ itemQuantity: +e.target.value })} /></div>
        </div>
      </div>

      {/* ── Requirements ── */}
      <AdvancedEffectsEditor effects={effects} onChange={setEffects} />

      <div style={SECT}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <p style={{ fontSize:10, fontWeight:900, color:'#a5b4fc', textTransform:'uppercase', letterSpacing:'0.2em' }}>Requisitos</p>
          <button onClick={addRequirement} style={{ padding:'4px 12px', borderRadius:8, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.4)', color:'#a5b4fc' }}>+ Adicionar</button>
        </div>
        {(form.requirements || []).length === 0 && (
          <p style={{ fontSize:10, color:'rgba(148,163,184,0.4)', fontStyle:'italic', textAlign:'center', padding:'10px 0' }}>Nenhum requisito — qualquer personagem pode usar</p>
        )}
        {(form.requirements || []).map((req, i) => (
          <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:8 }}>
            <div style={{ flex:1 }}>
              <select style={INPUT} value={req.type} onChange={e => updateRequirement(i, { type: e.target.value })}>
                <option value="specificCharacter">Personagem específico</option>
                <option value="linkedCard">Carta vinculada</option>
                <option value="itemCount">Qtd. de item</option>
                <option value="minHp">HP mínimo (%)</option>
                <option value="minAura">Aura mínima (%)</option>
                <option value="hasVinculo">Tem vínculo</option>
              </select>
              <div style={{ marginTop:6 }}>
                {req.type === 'specificCharacter' && (
                  <select style={INPUT} value={req.characterId || ''} onChange={e => updateRequirement(i, { characterId: e.target.value })}>
                    <option value="">-- Selecione --</option>
                    {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                {req.type === 'linkedCard' && (
                  <select style={INPUT} value={req.cardId || ''} onChange={e => updateRequirement(i, { cardId: e.target.value })}>
                    <option value="">-- Selecione --</option>
                    {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                {req.type === 'itemCount' && (
                  <div style={{ display:'flex', gap:6 }}>
                    <input style={{...INPUT, flex:2}} value={req.itemName || ''} onChange={e => updateRequirement(i, { itemName: e.target.value })} placeholder="Nome do item" />
                    <input style={{...INPUT, flex:1}} type="number" min={1} value={req.itemQuantity ?? 1} onChange={e => updateRequirement(i, { itemQuantity: +e.target.value })} />
                  </div>
                )}
                {(req.type === 'minHp' || req.type === 'minAura') && (
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <input style={{...INPUT, flex:1}} type="number" min={0} max={100} value={req.value ?? 50} onChange={e => updateRequirement(i, { value: +e.target.value })} />
                    <span style={{ fontSize:10, color:'#64748b', whiteSpace:'nowrap' }}>%</span>
                  </div>
                )}
                {req.type === 'hasVinculo' && (
                  <input
                    style={INPUT}
                    value={req.vinculoName || ''}
                    onChange={e => updateRequirement(i, { vinculoName: e.target.value })}
                    placeholder="Nome exato do vínculo (ex: Pacto de Sangue)"
                  />
                )}
              </div>
            </div>
            <button onClick={() => removeRequirement(i)} style={{ padding:'6px 8px', borderRadius:8, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#f87171', cursor:'pointer', marginTop:2 }}>
              <Trash2 style={{ width:12, height:12 }} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Actions ── */}
      <div style={{ display:'flex', gap:10 }}>
        {initialData?.id && (
          <button onClick={() => onDelete(initialData.id)} style={{ padding:'10px 20px', borderRadius:12, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171', fontSize:10, fontWeight:700, cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.1em' }}>
            Excluir
          </button>
        )}
        <button onClick={() => form.name?.trim() && submitSeal()} disabled={!form.name?.trim()} style={{
          flex:1, padding:'10px', borderRadius:12, fontSize:11, fontWeight:900, cursor: form.name?.trim() ? 'pointer' : 'not-allowed',
          background: form.name?.trim() ? 'linear-gradient(135deg,rgba(234,88,12,0.7),rgba(249,115,22,0.8))' : 'rgba(20,15,10,0.5)',
          border: form.name?.trim() ? '1.5px solid rgba(234,88,12,0.6)' : '1px solid rgba(234,88,12,0.1)',
          color: form.name?.trim() ? 'white' : 'rgba(148,130,110,0.3)', textTransform:'uppercase', letterSpacing:'0.15em',
          boxShadow: form.name?.trim() ? '0 0 20px rgba(234,88,12,0.25)' : 'none',
        }}>
          {initialData?.id ? 'Salvar Alterações' : '✦ Criar Selo'}
        </button>
      </div>
    </div>
  );
};

// --- Seal Ritual Overlay ---
const SealRitualOverlay: React.FC<{
  seal: Seal;
  effects: string[];
  onDone: () => void;
}> = ({ seal, effects, onDone }) => {
  const isImageSymbol = seal.symbol && (seal.symbol.startsWith('http') || seal.symbol.startsWith('data:'));
  React.useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, []);

  return createPortal(
    <div style={{
      position:'fixed', inset:0, zIndex:999999,
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      background:'radial-gradient(ellipse at 50% 50%, rgba(120,60,0,0.35) 0%, rgba(5,3,12,0.97) 100%)',
      backdropFilter:'blur(20px)',
      animation:'ritual-bg-in 0.5s ease forwards',
    }} onClick={onDone}>
      <style>{`
        @keyframes ritual-bg-in { from { opacity:0 } to { opacity:1 } }
        @keyframes ritual-symbol-in {
          0% { transform:scale(0.2) rotate(-20deg); opacity:0; filter:blur(30px) brightness(3); }
          40% { transform:scale(1.15) rotate(4deg); opacity:1; filter:blur(0) brightness(1.5); }
          70% { transform:scale(0.95) rotate(-2deg); }
          100% { transform:scale(1) rotate(0deg); opacity:1; filter:brightness(1.2); }
        }
        @keyframes ritual-ring-1 {
          0% { transform:scale(0) rotate(0deg); opacity:0; }
          30% { opacity:1; }
          100% { transform:scale(3.5) rotate(180deg); opacity:0; }
        }
        @keyframes ritual-ring-2 {
          0% { transform:scale(0) rotate(0deg); opacity:0; }
          20% { opacity:0; }
          50% { opacity:0.8; }
          100% { transform:scale(4.5) rotate(-120deg); opacity:0; }
        }
        @keyframes ritual-glow-pulse {
          0%,100% { box-shadow: 0 0 40px 10px rgba(251,146,60,0.4), 0 0 80px 20px rgba(234,88,12,0.2); }
          50% { box-shadow: 0 0 80px 30px rgba(251,191,36,0.7), 0 0 150px 50px rgba(234,88,12,0.4); }
        }
        @keyframes ritual-particle {
          0% { transform:translateY(0) scale(1); opacity:1; }
          100% { transform:translateY(-120px) scale(0); opacity:0; }
        }
        @keyframes ritual-text-in {
          0% { transform:translateY(30px); opacity:0; }
          100% { transform:translateY(0); opacity:1; }
        }
        @keyframes ritual-effect-in {
          0% { transform:translateX(-20px); opacity:0; }
          100% { transform:translateX(0); opacity:1; }
        }
      `}</style>

      {/* Outer rings */}
      <div style={{
        position:'absolute', width:300, height:300, borderRadius:'50%',
        border:'2px solid rgba(251,146,60,0.6)',
        animation:'ritual-ring-1 3s ease-out forwards',
      }} />
      <div style={{
        position:'absolute', width:300, height:300, borderRadius:'50%',
        border:'1px solid rgba(251,191,36,0.4)',
        animation:'ritual-ring-2 3.5s ease-out 0.3s forwards',
      }} />

      {/* Particles */}
      {Array.from({length:12}).map((_,i) => (
        <div key={i} style={{
          position:'absolute',
          width: 4+Math.random()*6, height: 4+Math.random()*6,
          borderRadius:'50%',
          background:'rgba(251,191,36,0.8)',
          left:`calc(50% + ${Math.cos(i/12*Math.PI*2)*100}px)`,
          top:`calc(50% + ${Math.sin(i/12*Math.PI*2)*100}px)`,
          animation:`ritual-particle ${1.5+Math.random()}s ease-out ${0.3+i*0.1}s forwards`,
        }} />
      ))}

      {/* Main symbol */}
      <div style={{
        animation:'ritual-symbol-in 1s cubic-bezier(0.34,1.56,0.64,1) forwards',
        marginBottom:32,
      }}>
        {isImageSymbol ? (
          <img src={seal.symbol} style={{
            width:200, height:200, objectFit:'contain', borderRadius:24,
            filter:'drop-shadow(0 0 40px rgba(251,146,60,0.9)) drop-shadow(0 0 20px rgba(251,191,36,0.7))',
            animation:'ritual-glow-pulse 1.5s ease-in-out infinite',
          }} />
        ) : seal.symbol ? (
          <div style={{
            fontSize:160, lineHeight:1,
            filter:'drop-shadow(0 0 40px rgba(251,146,60,0.9)) drop-shadow(0 0 20px rgba(251,191,36,0.7))',
            animation:'ritual-glow-pulse 1.5s ease-in-out infinite',
          }}>{seal.symbol}</div>
        ) : (
          <div style={{
            fontSize:120, lineHeight:1,
            filter:'drop-shadow(0 0 40px rgba(251,146,60,0.9))',
          }}>🔯</div>
        )}
      </div>

      {/* Seal name */}
      <div style={{
        animation:'ritual-text-in 0.6s ease 0.8s both',
        textAlign:'center', marginBottom:16,
      }}>
        <h2 style={{
          fontSize:36, fontWeight:900, textTransform:'uppercase', fontStyle:'italic', letterSpacing:'0.15em',
          background:'linear-gradient(135deg,#fb923c,#fbbf24,#fb923c)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          textShadow:'none',
        }}>{seal.name}</h2>
        <p style={{ fontSize:11, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.3em', marginTop:4 }}>Selo Ativado</p>
      </div>

      {/* Effects list */}
      {effects.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'center', maxWidth:400 }}>
          {effects.map((e,i) => (
            <div key={i} style={{
              padding:'8px 20px', borderRadius:12,
              background:'rgba(0,0,0,0.5)', border:'1px solid rgba(251,146,60,0.3)',
              fontSize:13, color:'#fbbf24', fontWeight:700,
              animation:`ritual-effect-in 0.4s ease ${1.2 + i*0.15}s both`,
            }}>{e}</div>
          ))}
        </div>
      )}

      <p style={{ position:'absolute', bottom:40, fontSize:10, color:'rgba(148,163,184,0.4)', textTransform:'uppercase', letterSpacing:'0.2em' }}>
        Toque para fechar
      </p>
    </div>,
    document.body
  );
};

// --- Item Use Animation ---
const ItemUseAnimation: React.FC<{
  item: Item;
  onDone: () => void;
}> = ({ item, onDone }) => {
  React.useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, []);

  const cat = (item.category || '').toLowerCase();
  const isWeapon = cat.includes('arma') || cat === 'weapon';
  const isConsumable = cat.includes('consumí') || cat.includes('consumiv') || cat === 'potion' || cat === 'food';
  const isArmor = cat.includes('armadu');

  const getAnim = () => {
    if (isWeapon) return { emoji:'⚔️', color:'#ef4444', glow:'rgba(239,68,68,0.8)', anim:'weapon-slash' };
    if (isConsumable) return { emoji:'✨', color:'#4ade80', glow:'rgba(74,222,128,0.8)', anim:'consumable-sparkle' };
    if (isArmor) return { emoji:'🛡️', color:'#60a5fa', glow:'rgba(96,165,250,0.8)', anim:'armor-shield' };
    return { emoji:'🌟', color:'#fbbf24', glow:'rgba(251,191,36,0.8)', anim:'item-use' };
  };
  const { emoji, color, glow, anim } = getAnim();

  return createPortal(
    <div style={{
      position:'fixed', inset:0, zIndex:999998,
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(5,3,12,0.65)', backdropFilter:'blur(8px)',
      animation:'item-overlay-in 0.3s ease forwards',
      pointerEvents:'none',
    }}>
      <style>{`
        @keyframes item-overlay-in { from{opacity:0} to{opacity:1} }
        @keyframes weapon-slash {
          0% { transform:translateY(60px) rotate(-45deg) scale(0.5); opacity:0; }
          30% { transform:translateY(-10px) rotate(15deg) scale(1.3); opacity:1; }
          60% { transform:translateY(0) rotate(-5deg) scale(1.0); }
          80% { transform:scale(1.1) rotate(0deg); }
          100% { transform:scale(0.8) translateY(-30px); opacity:0; }
        }
        @keyframes consumable-sparkle {
          0% { transform:scale(0.2); opacity:0; filter:blur(10px); }
          40% { transform:scale(1.4); opacity:1; filter:blur(0); }
          70% { transform:scale(0.9); }
          100% { transform:scale(1.2) translateY(-20px); opacity:0; }
        }
        @keyframes armor-shield {
          0% { transform:scale(0.3) translateY(40px); opacity:0; }
          50% { transform:scale(1.15) translateY(-5px); opacity:1; }
          80% { transform:scale(1) translateY(0); }
          100% { transform:scale(0.7) translateY(-40px); opacity:0; }
        }
        @keyframes item-use {
          0% { transform:scale(0) rotate(-30deg); opacity:0; }
          50% { transform:scale(1.2) rotate(10deg); opacity:1; }
          100% { transform:scale(0.8) translateY(-30px); opacity:0; }
        }
        @keyframes item-ring-out {
          0% { transform:scale(0.5); opacity:0.8; }
          100% { transform:scale(2.5); opacity:0; }
        }
        @keyframes item-name-in {
          0% { transform:translateY(20px); opacity:0; }
          30% { opacity:1; transform:translateY(0); }
          80% { opacity:1; }
          100% { opacity:0; transform:translateY(-10px); }
        }
      `}</style>
      <div style={{ position:'relative', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
        {/* Ring */}
        <div style={{
          position:'absolute', width:160, height:160, borderRadius:'50%',
          border:`2px solid ${color}`,
          animation:'item-ring-out 1.5s ease-out 0.2s forwards',
          opacity:0,
        }} />
        {/* Main icon */}
        <div style={{
          fontSize:100, lineHeight:1,
          filter:`drop-shadow(0 0 30px ${glow}) drop-shadow(0 0 15px ${glow})`,
          animation:`${anim} 2s cubic-bezier(0.34,1.56,0.64,1) forwards`,
        }}>
          {item.image && !item.image.startsWith('data:') ? (
            <img src={item.image} style={{ width:100, height:100, objectFit:'contain', borderRadius:16, filter:`drop-shadow(0 0 20px ${glow})` }} />
          ) : emoji}
        </div>
        {/* Item name */}
        <div style={{
          padding:'8px 24px', borderRadius:999,
          background:'rgba(0,0,0,0.7)', border:`1px solid ${color}40`,
          fontSize:14, fontWeight:700, color:'white', textTransform:'uppercase', letterSpacing:'0.15em',
          animation:'item-name-in 2.5s ease forwards',
          opacity:0,
        }}>{item.name}</div>
      </div>
    </div>,
    document.body
  );
};

// ─────────────────────────────────────────────────────────────────
// CardFusionPanel extracted to components/combat/CardFusionPanel.tsx

// --- Aplicação Principal ---

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cena' | 'combat' | 'arsenal' | 'characters' | 'journey'>('cena');
  React.useEffect(() => {
    applySectionTheme(activeTab);
  }, [activeTab]);
  // Navegação por teclado: 1-5 vão direto às abas; setas ciclam. (Sem UI de navegação visível.)
  const kbNav = useKeyboardNav({ activeTab, onSelect: setActiveTab });
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      // não sequestrar teclas enquanto o usuário digita em campos
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      kbNav.handleKey(e);
    };
    window.addEventListener('keydown', down);
    return () => { window.removeEventListener('keydown', down); };
  }, [kbNav]);
  const [arsenalSubTab, setArsenalSubTab] = useState<'habilidades' | 'itens' | 'selos' | 'armas'>('habilidades');
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [editingWeapon, setEditingWeapon] = useState<Weapon | null>(null);
  const [weaponSearchTerm, setWeaponSearchTerm] = useState('');
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [editingCatalogItem, setEditingCatalogItem] = useState<Item | null>(null);
  const [giveItemTarget, setGiveItemTarget] = useState<Item | null>(null);
  const [giveItemQty, setGiveItemQty] = useState(1);

  const [cards, setCards] = useState<Card[]>([]);
  const [grimoire, setGrimoire] = useState<ArsenalCard[]>([]);
  const [abilityGraphs, setAbilityGraphs] = useState<AbilityGraph[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [seals, setSeals] = useState<Seal[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const latestCharactersRef = useRef<Character[]>([]);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const latestCombatRef = useRef<CombatState | null>(null);
  useEffect(() => { latestCombatRef.current = combat; }, [combat]);
  const [journey, setJourney] = useState<JourneyState | null>(null);
  const [cena, setCena] = useState<CenaState>(createDefaultCena());
  const latestCenaRef = useRef<CenaState>(createDefaultCena());
  useEffect(() => { latestCenaRef.current = cena; }, [cena]);
  const [isLoading, setIsLoading] = useState(true);

  // Journey UI State
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [craftResult, setCraftResult] = useState<{ recipe: Recipe; character: Character } | null>(null);
  // Upgrade shop UI state
  const [upgradePurchaseResult, setUpgradePurchaseResult] = useState<{ offer: UpgradeOffer; targetChar: Character } | null>(null);
  // Active card item boost: which item (par/trinca/quadra/reroll) to apply when using a card

  // Items UI State
  const [selectedInventoryCharId, setSelectedInventoryCharId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Combat UI State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  // Turn change animation key — increments each turn to re-trigger CSS animations
  // (mobile mode removed)
  const [placingPin, setPlacingPin] = useState<{label: string; color: string} | null>(null);
  const [cardAnim, setCardAnim] = useState<CardAnimPayload | null>(null);

  // Mass damage tool

  // Union state

  // Stat animation popups: { id, combatId, type, delta, key }

  // Estados de "Pasta Oculta"

  // Novo Estado de Filtro de Cartas
  const [cardTypeFilter, setCardTypeFilter] = useState<CardType | 'all'>('all');

  // ── Combination card state ──────────────────────────────────

  // ── Level selection state (for zoomed card) ────────────────

  // ── Acted combatants tracking ──────────────────────────────

  // ── Forma card state ────────────────────────────────────────

  // ── Card Fusion state ────────────────────────────────────────
  // ── NPC special card state ──────────────────────────────────


  // ── Pending item dice anim ───────────────────────────────────

  // ── Burn card state ──────────────────────────────────────────

  // ── Boot: inicializa DB, migra dados antigos, carrega tudo de uma vez ──
  useEffect(() => {
    let cancelled = false;

    DatabaseService.initialize().then(({ characters: chars, cards: cds, items: its, seals: sls, weapons: wps, grimoire: grim, abilityGraphs: graphs, combat: cbt, journey: jny, cena: cn }) => {
      if (cancelled) return;
      latestCharactersRef.current = chars;
      setCharacters(chars);
      setCards(cds);
      setItems(its);
      setSeals(sls);
      setWeapons(wps);
      setGrimoire(grim);
      setAbilityGraphs(graphs);
      setCombat(migrateCombatState(cbt));
      setJourney(jny);
      latestCenaRef.current=cn;
      setCena(cn);
      setIsLoading(false);
    }).catch(err => {
      console.error('[Boot] Erro ao carregar dados:', err);
      if (!cancelled) setIsLoading(false);
    });

    // Subscriptions para atualizações em tempo real (ex: outra aba). `emitInitial: false` porque
    // o initialize() acima já entregou o valor inicial de cada domínio — sem isso, cada assinatura
    // buscava tudo de novo no IndexedDB e disparava um segundo setState logo após o boot (double load).
    const unsubChars = DatabaseService.syncCharacters((data) => { if (!cancelled) { latestCharactersRef.current = data; setCharacters(data); } }, { emitInitial: false });
    const unsubCards = DatabaseService.syncCards((data) => { if (!cancelled) setCards(data); }, { emitInitial: false });
    const unsubItems = DatabaseService.syncItems((data) => { if (!cancelled) setItems(data); }, { emitInitial: false });
    const unsubSeals = DatabaseService.syncSeals((data) => { if (!cancelled) setSeals(data); }, { emitInitial: false });
    const unsubWeapons = DatabaseService.syncWeapons((data) => { if (!cancelled) setWeapons(data); }, { emitInitial: false });
    const unsubGrimoire = DatabaseService.syncGrimoire((data) => { if (!cancelled) setGrimoire(data); }, { emitInitial: false });
    const unsubAbilityGraphs = DatabaseService.syncAbilityGraphs((data) => { if (!cancelled) setAbilityGraphs(data); }, { emitInitial: false });
    const unsubCombat = DatabaseService.syncCombatState((data) => { if (!cancelled) setCombat(migrateCombatState(data)); }, { emitInitial: false });
    const unsubJourney = DatabaseService.syncJourneyState((data) => { if (!cancelled) setJourney(data); }, { emitInitial: false });
    const unsubCena = DatabaseService.syncCenaState((data) => { if (!cancelled) { latestCenaRef.current=data; setCena(data); } }, { emitInitial: false });

    // Responde a pedidos da janela de jogadores com o snapshot atual de combate
    const unsubReq = DatabaseService.onCombatRequest(() => {
      if (latestCombatRef.current) DatabaseService.publishCombat(latestCombatRef.current);
    });

    return () => {
      cancelled = true;
      unsubChars(); unsubCards(); unsubItems(); unsubSeals(); unsubWeapons(); unsubGrimoire(); unsubAbilityGraphs(); unsubCombat(); unsubJourney(); unsubCena(); unsubReq();
    };
  }, []);

  // Autosave unificado: Cena/Combate, Arsenal, Personagens.
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autosaveSnapshot = useMemo(() => combat && journey ? ({
    version: SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    characters, cards, items, seals, weapons, grimoire, abilityGraphs, combat, journey, cena,
  }) : null, [characters, cards, items, seals, weapons, grimoire, abilityGraphs, combat, journey, cena]);
  useUnifiedAutosave({
    enabled: !isLoading,
    snapshot: autosaveSnapshot,
    onStatus: setAutoSaveStatus,
  });

  // placeholder removido — lógica migrada para useEffect de boot acima

  const handleManualSaveRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (placingPin) setPlacingPin(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSaveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placingPin]);


  const [searchTerm, setSearchTerm] = useState('');
  const [sealSearchTerm, setSealSearchTerm] = useState('');
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editingSeal, setEditingSeal] = useState<Seal | null>(null);
  const [sealRitualAnim, setSealRitualAnim] = useState<{seal: Seal; effects: string[]} | null>(null);
  const [itemUseAnim, setItemUseAnim] = useState<Item | null>(null);
  const [openInventoryCharId, setOpenInventoryCharId] = useState<string | null>(null);
  const [assignCardModal, setAssignCardModal] = useState<Card | null>(null);
  const [assignWeaponModal, setAssignWeaponModal] = useState<Weapon | null>(null);
  const [assignSealModal, setAssignSealModal] = useState<Seal | null>(null);
  // Initiative drag-to-reorder
  const [diceAnimQueue, setDiceAnimQueue] = useState<Array<{ id: string; isVisible: boolean; result: number; finalTotal?: number; adjustments?: Array<{ label: string; value: number }>; defenderResult?: number; defenderRoll?: RollResult; defenderBase?: number; isSuccess: boolean; customLabel?: string; notation?: string; individualRolls?: number[]; numSides?: number; bonus?: number; dramatic?: boolean; actorLabel?: string; defenderLabel?: string; onReveal?: () => void; onComplete?: () => void }>>([]);
  const diceAnim = diceAnimQueue[0] ?? null;
  const diceAnimQueueRef = useRef(diceAnimQueue);
  diceAnimQueueRef.current = diceAnimQueue;
  const showDiceAnimation = (
    roll: RollResult | { total: number; notation?: string; individualRolls?: number[]; numSides?: number; bonus?: number },
    options: { isSuccess?: boolean; customLabel?: string; finalTotal?: number; adjustments?: Array<{ label: string; value: number }>; defenderResult?: number; defenderRoll?: RollResult; defenderBase?: number; dramatic?: boolean; actorLabel?: string; defenderLabel?: string; onReveal?: () => void; onComplete?: () => void } = {},
  ) => {
    setDiceAnimQueue(queue => [...queue, {
      id: `dice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      isVisible: true,
      result: roll.total,
      finalTotal: options.finalTotal,
      adjustments: options.adjustments,
      isSuccess: options.isSuccess ?? true,
      customLabel: options.customLabel,
      notation: roll.notation || '1d20',
      individualRolls: roll.individualRolls || [roll.total],
      numSides: roll.numSides || 20,
      bonus: roll.bonus || 0,
      defenderResult: options.defenderResult,
      defenderRoll: options.defenderRoll,
      defenderBase: options.defenderBase,
      dramatic: options.dramatic,
      actorLabel: options.actorLabel,
      defenderLabel: options.defenderLabel,
      onReveal: options.onReveal,
      onComplete: options.onComplete,
    }]);
  };
  const handleCardAnimComplete = useCallback(() => setCardAnim(null), []);
  const handleDiceAnimComplete = useCallback(() => {
    const completed = diceAnimQueueRef.current[0];
    completed?.onComplete?.();
    setDiceAnimQueue(queue => queue[0]?.id === completed?.id ? queue.slice(1) : queue);
  }, []);
  
  // Atualizado para suportar múltiplas reações
  
  // Area multi-target selection
  // Card zoom overlay state (when a card is clicked but before target is chosen)

  // Filtros de Cartas (Habilidades)
  const filteredCards = useMemo(() => cards.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
    (cardTypeFilter === 'all' || c.type === cardTypeFilter)
  ), [cards, searchTerm, cardTypeFilter]);

  const filteredSeals = useMemo(() => seals.filter(s =>
    s.name.toLowerCase().includes(sealSearchTerm.toLowerCase()) ||
    s.code?.toLowerCase().includes(sealSearchTerm.toLowerCase()) ||
    s.description?.toLowerCase().includes(sealSearchTerm.toLowerCase())
  ), [seals, sealSearchTerm]);

  const filteredWeapons = useMemo(() => weapons.filter(w =>
    w.name.toLowerCase().includes(weaponSearchTerm.toLowerCase())
  ), [weapons, weaponSearchTerm]);
  
  const selectedInventoryChar = useMemo(() => characters.find(c => c.id === selectedInventoryCharId), [characters, selectedInventoryCharId]);

  // Salvar manualmente agora (Ctrl+S ou botão): exporta o snapshot completo e
  // versionado. Esse mesmo arquivo pode restaurar o app local ou migrar a
  // campanha para a persistência online.
  const handleManualSave = async () => {
    if (isLoading) return;
    try {
      const current = await DatabaseService.initialize();
      const payload = {
        version: SNAPSHOT_VERSION,
        savedAt: new Date().toISOString(),
        ...current,
      };
      const json = JSON.stringify(payload, null, 2);
      const filename = `rpg-codex-backup-${new Date().toISOString().slice(0, 10)}.json`;

      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
      } else {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') {
        console.error('[ManualSave] Erro:', e);
      }
    }
  };
  // Keep ref in sync so Ctrl+S always uses latest closure
  handleManualSaveRef.current = handleManualSave;

  const saveCharacter = (char: Character) => {
    const finalChar = char.id ? char : { ...char, id: Math.random().toString(36).substr(2, 9) };
    const nextCharacters=latestCharactersRef.current.some(character=>character.id===finalChar.id)
      ? latestCharactersRef.current.map(character=>character.id===finalChar.id?finalChar:character)
      : [...latestCharactersRef.current,finalChar];
    latestCharactersRef.current=nextCharacters;setCharacters(nextCharacters);void DatabaseService.saveCharacter(finalChar);
    const liveCena=latestCenaRef.current;
    if(liveCena.npcRoster.some(npc=>npc.id===finalChar.id)){
      const nextCena={...liveCena,npcRoster:liveCena.npcRoster.map(npc=>npc.id===finalChar.id?syncNpcFromCharacter(npc,finalChar):npc)};
      latestCenaRef.current=nextCena;setCena(nextCena);void DatabaseService.updateCena(nextCena);
    }
    const liveCombat=latestCombatRef.current;
    if (liveCombat?.isActive) {
      const updatedCombatants = liveCombat.combatants.map(cb => 
        cb.id === finalChar.id ? { ...cb, ...finalChar, combatId: cb.combatId, initiativeResult: cb.initiativeResult, gridPos: cb.gridPos } : cb
      );
      const nextCombat={...liveCombat,combatants:updatedCombatants};latestCombatRef.current=nextCombat;setCombat(nextCombat);void DatabaseService.updateCombat(nextCombat);
    }
  };


  const handleSaveItem = (item: Item) => {
    if (!selectedInventoryChar) return;
    const id = item.id || Math.random().toString(36).substr(2, 9);
    const toSave: Item = { ...item, id };
    setItems(prev => {
      const exists = prev.some(entry => entry.id === id);
      return exists ? prev.map(entry => entry.id === id ? toSave : entry) : [...prev, toSave];
    });
    DatabaseService.saveItem(toSave); // grava o modelo no catálogo
    // garante que o personagem possui ao menos a quantidade informada (se ainda não possui)
    const alreadyOwned = (selectedInventoryChar.ownedItems ?? []).some(o => o.itemId === id);
    if (!alreadyOwned) {
      updateCharacterStats(selectedInventoryChar.id, { ownedItems: giveOwned(selectedInventoryChar, id, item.quantity ?? 1) });
    }
    setEditingItem(null);
  };

  const removeItemFromCharacter = (itemId: string) => {
    if (!selectedInventoryChar) return;
    setConfirmModal({
      message: "Deseja remover este item do inventário?",
      onConfirm: () => {
        updateCharacterStats(selectedInventoryChar.id, { ownedItems: removeOwned(selectedInventoryChar, itemId) });
        setEditingItem(null);
        setConfirmModal(null);
      }
    });
  };

  const deleteCharacter = async (id: string) => {
    setConfirmModal({
      message: "Deseja excluir este personagem permanentemente?",
      onConfirm: async () => {
        setCharacters(prev => prev.filter(c => c.id !== id));
        if (combat) {
          const updatedCombat = { ...combat, combatants: combat.combatants.filter(c => c.id !== id) };
          setCombat(updatedCombat);
          DatabaseService.updateCombat(updatedCombat);
        }
        setConfirmModal(null);
        try {
          await DatabaseService.deleteCharacter(id);
        } catch (err) {
          console.error("Erro ao deletar personagem:", err);
        }
      }
    });
  };

  const toggleJourneyCharacter = (char: Character) => {
    const updatedChar = { ...char, isInJourney: !char.isInJourney };
    saveCharacter(updatedChar);
  };


  const updateCena = (next: CenaState) => {
    latestCenaRef.current=next;
    setCena(next);
    DatabaseService.updateCena(next);
  };








  const updateCharacterStats = (charId: string, updates: Partial<Character>) => {
    const originalChar = latestCharactersRef.current.find(c => c.id === charId);
    if (!originalChar) return;
    const updatedChar = { ...originalChar, ...updates };
    const nextCharacters = latestCharactersRef.current.map(character => character.id === charId ? updatedChar : character);
    latestCharactersRef.current = nextCharacters;
    setCharacters(nextCharacters);
    void DatabaseService.saveCharacter(updatedChar);
    const liveCombat=latestCombatRef.current;
    if (liveCombat?.combatants.some(c=>c.id===charId)) {
        const updatedCombatants = liveCombat.combatants.map(c => 
            c.id === charId ? { ...c, ...updates } : c
        );
        const nextCombat={ ...liveCombat, combatants: updatedCombatants };
        latestCombatRef.current=nextCombat;setCombat(nextCombat);void DatabaseService.updateCombat(nextCombat);
    }
    const liveCena=latestCenaRef.current;
    if(liveCena.npcRoster.some(npc=>npc.id===charId)){
      const nextCena={...liveCena,npcRoster:liveCena.npcRoster.map(npc=>npc.id===charId?mergeNpcLiveUpdates(npc,updates,originalChar):npc)};
      latestCenaRef.current=nextCena;setCena(nextCena);void DatabaseService.updateCena(nextCena);
    }
  };






  const saveCard = (card: Card) => {
    const finalCard = card.id ? card : { ...card, id: Math.random().toString(36).substr(2, 9) };
    DatabaseService.saveCard(finalCard);
  };

  const saveSeal = (seal: Seal) => {
    const finalSeal = seal.id ? seal : { ...seal, id: Math.random().toString(36).substr(2, 9) };
    if (!finalSeal.code) finalSeal.code = finalSeal.id.slice(0, 6).toUpperCase();
    setSeals(prev => {
      const exists = prev.find(s => s.id === finalSeal.id);
      return exists ? prev.map(s => s.id === finalSeal.id ? finalSeal : s) : [...prev, finalSeal];
    });
    DatabaseService.saveSeal(finalSeal);
  };

  const deleteSeal = async (id: string) => {
    setConfirmModal({
      title: "Excluir Selo",
      message: "Tem certeza que deseja excluir este selo permanentemente?",
      onConfirm: async () => {
        setSeals(prev => prev.filter(s => s.id !== id));
        setEditingSeal(null);
        setConfirmModal(null);
        await DatabaseService.deleteSeal(id);
      }
    });
  };

  const itemFromArsenalCard = (card: ArsenalCard): Item => ({
    id: card.id,
    name: card.name,
    description: card.description,
    image: card.icon,
    category: typeof card.metadata?.legacyCategory === 'string' ? card.metadata.legacyCategory : 'Consumível',
    quantity: card.item?.quantity ?? 1,
    maxQuantity: typeof card.metadata?.maxQuantity === 'number' ? card.metadata.maxQuantity : undefined,
    durability: typeof card.metadata?.durability === 'number' ? card.metadata.durability : undefined,
    maxDurability: typeof card.metadata?.maxDurability === 'number' ? card.metadata.maxDurability : undefined,
    wearPerUse: typeof card.metadata?.wearPerUse === 'number' ? card.metadata.wearPerUse : undefined,
    usesPerActivation: card.item?.usesPerActivation ?? 1,
    usableInCombat: card.metadata?.usableInCombat === true || !!(card.damage || card.healing || card.auraRestored || card.effects.length),
    consumeOnUse: card.item?.consumable ?? card.item?.disappearsOnUse ?? false,
    combatTargeting: card.target.type === 'proprio_usuario' ? 'self' : card.target.type === 'todos_em_area' ? 'area' : 'other',
    combatDiceRoll: card.testDice ?? undefined,
    combatDamage: card.damage?.flat ?? undefined,
    combatDamageType: card.element ?? undefined,
    combatHeal: card.healing?.flat ?? undefined,
    combatAuraRecover: card.auraRestored?.flat ?? undefined,
    effects: card.effects,
  });

  const sealFromArsenalCard = (card: ArsenalCard): Seal => ({
    id: card.id,
    name: card.name,
    description: card.description,
    image: card.icon,
    code: typeof card.metadata?.legacyCode === 'string' ? card.metadata.legacyCode : card.id.slice(0, 6).toUpperCase(),
    symbol: card.icon,
    executionMode: card.preparation.timing.type === 'rodadas' ? 'preparation' : 'immediate',
    executionModes: Array.isArray(card.metadata?.executionModes) ? card.metadata.executionModes as SealExecutionMode[] : undefined,
    preparationRounds: card.preparation.timing.type === 'rodadas' ? card.preparation.timing.amount : 0,
    diceRoll: card.testDice ?? undefined,
    damage: card.damage?.flat ?? undefined,
    damageType: card.element ?? undefined,
    healHp: card.healing?.flat ?? undefined,
    healAura: card.auraRestored?.flat ?? undefined,
    duration: card.seal?.durationRounds ?? undefined,
    combatTargeting: card.target.type === 'proprio_usuario' ? 'self' : card.target.type === 'todos_em_area' ? 'area' : 'other',
    directionMode: typeof card.metadata?.directionMode === 'string' ? card.metadata.directionMode as Seal['directionMode'] : card.area?.shape === 'linha' ? 'line' : card.area?.shape === 'cone' ? 'cone' : 'source_to_target',
    range: typeof card.metadata?.range === 'number' ? card.metadata.range : card.area?.size,
    areaSize: card.area?.size,
    connectors: card.seal?.ritual?.connectors as Seal['connectors'],
    effects: card.effects,
  });

  const openArsenalItemEditor = (id: string) => {
    const existing = items.find(item => item.id === id);
    if (existing) {
      setEditingCatalogItem(existing);
      return;
    }
    const card = grimoire.find(entry => entry.id === id && entry.category === 'item');
    if (card) setEditingCatalogItem(itemFromArsenalCard(card));
  };

  const openArsenalSealEditor = (id: string) => {
    const existing = seals.find(seal => seal.id === id);
    if (existing) {
      setEditingSeal(existing);
      return;
    }
    const card = grimoire.find(entry => entry.id === id && entry.category === 'selo');
    if (card) setEditingSeal(sealFromArsenalCard(card));
  };

  const deleteCard = async (id: string) => {
    setConfirmModal({
      message: "Deseja excluir esta habilidade permanentemente?",
      onConfirm: async () => {
        setCards(prev => prev.filter(c => c.id !== id));
        setEditingCard(null);
        setConfirmModal(null);
        try {
          await DatabaseService.deleteCard(id);
        } catch (err) {
          console.error("Erro ao deletar habilidade:", err);
        }
      }
    });
  };
























  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-8" style={{ background: 'var(--bg-base)' }}>
        <div style={{ width:64, height:64, border:'3px solid var(--gold-mid)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.9s linear infinite', boxShadow:'0 0 40px rgba(201,152,58,0.4)' }} />
        <div className="flex flex-col items-center">
          <Database className="w-7 h-7 mb-3 animate-pulse" style={{ color:'var(--gold-mid)' }} />
          <h2 style={{ fontFamily:"'Cinzel', serif", fontSize:16, fontWeight:700, color:'var(--text-primary)', textTransform:'uppercase', letterSpacing:'0.4em' }}>Carregando dados</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col text-slate-100 overflow-x-hidden" style={{ background: 'var(--bg-base)', backgroundImage: 'radial-gradient(ellipse at 20% 10%, rgba(201,152,58,0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 90%, rgba(100,130,200,0.03) 0%, transparent 50%)', height: '100vh', overflow: 'hidden' }}>
      {/* Indicador de Autosave */}
      {autoSaveStatus !== 'idle' && (
        <div style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 99999,
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '7px 14px', borderRadius: 10,
          background: autoSaveStatus === 'error' ? 'rgba(40,10,10,0.97)' : autoSaveStatus === 'saving' ? 'rgba(22,27,38,0.95)' : 'rgba(14,24,18,0.95)',
          border: `1px solid ${autoSaveStatus === 'error' ? 'rgba(239,68,68,0.6)' : autoSaveStatus === 'saving' ? 'var(--border-gold)' : 'rgba(34,197,94,0.45)'}`,
          backdropFilter: 'blur(16px)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', transition: 'all 0.3s ease'
        }}>
          {autoSaveStatus === 'saving'
            ? <><div style={{ width: 9, height: 9, borderRadius: '50%', border: '2px solid var(--gold-mid)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /><span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold-mid)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Salvando…</span></>
            : autoSaveStatus === 'error'
            ? <><div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 7px #ef4444' }} /><span style={{ fontSize: 10, fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Erro ao salvar</span></>
            : <><div style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 7px #22c55e' }} /><span style={{ fontSize: 10, fontWeight: 700, color: '#86efac', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Salvo!</span></>
          }
        </div>
      )}

      <div aria-hidden className="mp-page-bg">
        <span className="mp-glaze" />
        <span className="mp-vignette" />
      </div>
      <React.Fragment key={activeTab}><TabSweep tabKey={activeTab as string} label={TAB_META[activeTab].label as string} /></React.Fragment>
      {/* Barra superior removida — navegação no Anel do Mestre; utilitários discretos no canto */}
      <div className="mp-utils" aria-label="Utilidades do Mestre">
        {/* Salvar agora */}
        <button
          onClick={handleManualSave}
          disabled={isLoading || autoSaveStatus === 'saving'}
          className="mp-utils__btn"
          style={{ opacity: isLoading ? 0.5 : 1 }}
          title="Exportar arsenal + elenco (JSON, Ctrl+S)"
        >
          <Save className="w-4 h-4" />
        </button>
      </div>

      <main className={activeTab === 'cena' ? 'flex-1 p-0 w-full max-w-none' : 'flex-1 p-5 md:p-8 max-w-[1920px] mx-auto w-full'} style={{ overflow: activeTab === 'cena' ? 'hidden' : 'auto', minHeight: 0, height: 0 }}>
        {/* ... (Previous tabs code omitted for brevity as they are unchanged) ... */}
        {/* Aba Cena */}
        {activeTab === 'cena' && (
          <CenaTab
            cena={cena}
            characters={characters}
            cards={cards}
            seals={seals}
            items={items}
            weapons={weapons}
            arsenal={grimoire}
            abilityGraphs={abilityGraphs}
            updateCena={updateCena}
            updateCharacterStats={updateCharacterStats}
            onDiceRoll={showDiceAnimation}
          />
        )}

        {/* Catálogo legado preservado temporariamente apenas como adaptador de dados; não é mais renderizado. */}
        {false && (
          <div className="flex flex-col mp-darktab" style={{ height:'100%' }}>
            <div className="flex gap-1 p-1 mb-4 rounded-2xl w-fit flex-shrink-0" style={{ background:'rgba(0,0,0,0.35)', border:'1px solid rgba(255,255,255,0.06)' }}>
              {([
                { id: 'habilidades', label: 'Habilidades', icon: <Layers className="w-3.5 h-3.5" /> },
                { id: 'itens',       label: 'Itens',       icon: <Backpack className="w-3.5 h-3.5" /> },
                { id: 'selos',       label: 'Selos',       icon: <Sparkles className="w-3.5 h-3.5" /> },
                { id: 'armas',       label: 'Armas',       icon: <Swords className="w-3.5 h-3.5" /> },
              ] as const).map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setArsenalSubTab(sub.id as any)}
                  className={`p5-subtab flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all ${arsenalSubTab === sub.id ? 'bg-amber-600 text-white shadow-[0_0_15px_rgba(201,152,58,0.4)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                  {sub.icon} {sub.label}
                </button>
              ))}
            </div>

            {arsenalSubTab === 'habilidades' && (
          <div className="space-y-8 anim-fade-up mp-darktab" style={{ height:'100%', overflowY:'auto' }}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 anim-fade-up">
                <div>
                  <h2 className="text-4xl font-black text-white uppercase italic tracking-tight">Grimório</h2>
                  <p className="text-slate-600 font-bold uppercase tracking-[0.3em] text-xs mt-1">Biblioteca de Habilidades</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto anim-fade-up-d1">
                  <div className="relative flex-1 md:flex-none">
                    <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Buscar..." 
                      className="w-full md:w-64 bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-5 py-3 text-sm text-white focus:border-amber-600 outline-none"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => setEditingCard({} as any)} 
                    className="flex items-center gap-2 px-7 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl text-white font-extrabold uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(201,152,58,0.35)] border border-amber-400/30"
                  >
                    <Plus className="w-4 h-4" /> Nova
                  </button>
                </div>
              </div>

              {/* Filter Buttons */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar snap-x anim-fade-up-d1">
                 <button
                    onClick={() => setCardTypeFilter('all')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-widest snap-start whitespace-nowrap ${cardTypeFilter === 'all' ? 'bg-amber-600 text-white border-amber-400/50 shadow-[0_0_15px_rgba(201,152,58,0.4)]' : 'bg-slate-900/70 text-slate-500 border-white/5 hover:text-slate-300 hover:bg-slate-800'}`}
                 >
                    <Layers className="w-3.5 h-3.5" /> Todos
                 </button>
                 {(['ataque', 'reação', 'ação', 'reforço', 'vínculo', 'combinação', 'forma'] as CardType[]).map(type => {
                    const colors = getCardColors(type);
                    const isActive = cardTypeFilter === type;
                    return (
                       <button
                          key={type}
                          onClick={() => setCardTypeFilter(type)}
                          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-[10px] font-extrabold uppercase tracking-widest snap-start whitespace-nowrap ${isActive ? `${colors.iconBg} text-white border-white/20 shadow-md` : 'bg-slate-900/70 text-slate-500 border-white/5 hover:bg-slate-800 hover:text-slate-300'}`}
                       >
                          {type === 'ataque' && <Swords className="w-3.5 h-3.5" />}
                          {type === 'reação' && <Shield className="w-3.5 h-3.5" />}
                          {type === 'ação' && <Zap className="w-3.5 h-3.5" />}
                          {type === 'reforço' && <Heart className="w-3.5 h-3.5" />}
                          {type === 'vínculo' && <LinkIcon className="w-3.5 h-3.5" />}
                          {type === 'combinação' && <Users className="w-3.5 h-3.5" />}
                          {type === 'forma' && <Star className="w-3.5 h-3.5" />}
                          {type}
                       </button>
                    );
                 })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-12">
              {filteredCards.map((card, idx) => {
                const colors = getCardColors(card.type);
                const typeClass = `card-${card.type.replace('ã','a').replace('ç','c').replace('í','i')}`;
                return (
                  <div
                    key={card.id}
                    className={`group relative border rounded-[2.5rem] overflow-hidden ${colors.border} ${typeClass} anim-fade-up`}
                    style={{ animationDelay: `${idx * 40}ms`, background: "#141014" }}
                  >
                    {/* Type color tint */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg} opacity-15 pointer-events-none transition-opacity duration-300 group-hover:opacity-30`} />
                    {/* Top edge glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px opacity-60 pointer-events-none" style={{ background: `linear-gradient(90deg, transparent, currentColor, transparent)` }} />

                    <div className="relative p-6 flex flex-col h-full">
                      <div className="flex justify-between items-center mb-5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className={`px-3 py-1 rounded-full ${colors.badge} text-white text-[10px] font-extrabold uppercase tracking-wider border border-white/10 shadow-md`}
                            style={card.type === 'forma' && card.formaColor ? { background: card.formaColor + '99', borderColor: card.formaColor + '66' } : {}}>
                            {card.type === 'combinação' ? '🔗 ' : card.type === 'forma' ? '✦ ' : ''}{card.type}
                          </div>
                          {card.levels && card.levels.length > 0 && (
                            <div className="px-2 py-1 rounded-full bg-amber-700/40 border border-amber-600/40 text-amber-300 text-[9px] font-extrabold uppercase tracking-widest">
                              {card.levels.length + 1} níveis
                            </div>
                          )}
                          {card.type === 'combinação' && (
                            <div className="px-2 py-1 rounded-full bg-purple-900/50 border border-purple-700/40 text-purple-300 text-[9px] font-extrabold">
                              {card.comboFixedUsers ? `${card.comboMinUsers ?? 2}👥` : `${card.comboMinUsers ?? 2}+👥`}
                            </div>
                          )}
                          {card.bonuses && card.bonuses.length > 0 && (
                            <div className="px-2 py-1 rounded-full bg-emerald-900/50 border border-emerald-700/40 text-emerald-300 text-[9px] font-extrabold">
                              🎁 {card.bonuses.length}
                            </div>
                          )}
                          {card.type === 'forma' && card.formaColor && (
                            <div className="w-4 h-4 rounded-full border border-white/20" style={{ background: card.formaColor }} title="Cor da forma" />
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button onClick={() => setEditingCard(card)} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteCard(card.id)} className="p-2 text-slate-400 hover:text-white hover:bg-rose-600/30 rounded-xl">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setAssignCardModal(card)} className="p-2 text-slate-400 hover:text-white hover:bg-emerald-600/30 rounded-xl" title="Atribuir a Personagem">
                            <UserPlus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="relative flex-shrink-0">
                            <img src={card.image || undefined} className={`w-16 h-16 rounded-2xl object-cover border-2 ${colors.border} shadow-xl group-hover:scale-105 transition-transform duration-300`} />
                            <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity ${colors.bg}`} />
                          </div>
                          <div>
                            <h3 className={`text-xl font-extrabold uppercase italic leading-none ${colors.text}`}>{card.name}</h3>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 bg-black/50 px-2 py-1 rounded-lg border border-white/5">
                                <Dices className="w-3 h-3" /> {card.diceRoll}
                              </span>
                              <span className="text-[11px] font-mono text-cyan-400 flex items-center gap-1 bg-cyan-950/30 px-2 py-1 rounded-lg border border-cyan-900/30">
                                <Zap className="w-3 h-3" /> {card.auraCost}
                              </span>
                              {card.type === 'combinação' && (
                                <span className="text-[10px] font-mono text-purple-400 flex items-center gap-1 bg-purple-950/30 px-2 py-1 rounded-lg border border-purple-900/30">
                                  {(card.comboDiceMode ?? 'sum') === 'sum' ? '➕soma' : '🏆maior'}
                                </span>
                              )}
                              {card.code && (
                                <span className="text-[10px] font-mono text-amber-500/80 flex items-center gap-1 bg-amber-950/30 px-2 py-1 rounded-lg border border-amber-900/30">
                                  <Hash className="w-3 h-3" /> {card.code}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 bg-black/30 p-4 rounded-2xl border border-white/4 italic">
                          {card.description || "Sem descrição."}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredCards.length === 0 && (
                <div className="col-span-full py-24 flex flex-col items-center justify-center gap-6 rounded-[3rem] anim-fade" style={{ border: '2px dashed rgba(180,140,40,0.15)' }}>
                  <div className="p-6 rounded-3xl" style={{ background: 'rgba(180,140,40,0.07)' }}>
                    <Layers className="w-14 h-14 text-amber-900" />
                  </div>
                  <div className="text-center">
                    <p className="font-extrabold uppercase tracking-widest text-slate-600 text-sm">Nenhuma habilidade encontrada</p>
                    <p className="text-xs text-slate-700 mt-1">Tente outro filtro ou crie uma nova</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

            {arsenalSubTab === 'itens' && (
          <div className="space-y-8 anim-fade-up mp-darktab" style={{ height:'100%', overflowY:'auto' }}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-4xl font-black text-white uppercase italic tracking-tight">Arsenal</h2>
                <p className="text-slate-600 font-bold uppercase tracking-[0.3em] text-xs mt-1">Catálogo de Itens</p>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:flex-none">
                  <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="Buscar..." className="w-full md:w-64 bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-5 py-3 text-sm text-white focus:border-amber-600 outline-none" value={itemSearchTerm} onChange={e => setItemSearchTerm(e.target.value)} />
                </div>
                <button onClick={() => { setEditingCatalogItem({} as Item); }} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                  <Plus className="w-4 h-4" /> Novo Item
                </button>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:14 }}>
              {items.filter(it => it.name.toLowerCase().includes(itemSearchTerm.toLowerCase())).map(it => (
                <div key={it.id} onClick={() => setEditingCatalogItem(it)} style={{ cursor:'pointer', borderRadius:4, overflow:'hidden', border:'1px solid var(--border-gold)', background:'linear-gradient(165deg, #1a1218, #100a0c)', position:'relative', clipPath:'polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)', transform:'rotate(-1deg)' }} className="hover:brightness-110 transition-all">
                  <div style={{ height:120, background: it.image ? `url(${it.image}) center/cover` : 'linear-gradient(145deg,#1e180e,#100e08)' }} />
                  <div style={{ padding:'10px 12px' }}>
                    <p style={{ fontSize:13, fontWeight:800, color:'var(--gold-pale)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it.name}</p>
                    {it.category && <p style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginTop:2 }}>{it.category}</p>}
                    {it.usableInCombat && (
                      <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                        {(it.combatHeal ?? 0) > 0 && <span style={{ fontSize:9, color:'#34d399' }}>+{it.combatHeal}♥</span>}
                        {(it.combatDamage ?? 0) > 0 && <span style={{ fontSize:9, color:'#f87171' }}>{it.combatDamage}⚔</span>}
                        {(it.combatAuraRecover ?? 0) > 0 && <span style={{ fontSize:9, color:'#a78bfa' }}>+{it.combatAuraRecover}⚡</span>}
                      </div>
                    )}
                  </div>
                  <button onClick={e => { e.stopPropagation(); setGiveItemTarget(it); }} title="Dar a personagem" style={{ position:'absolute', top:8, right:8, width:28, height:28, borderRadius:8, background:'rgba(22,27,38,0.92)', border:'1px solid var(--border-gold)', color:'var(--gold-mid)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                    <UserPlus style={{ width:13, height:13 }} />
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <p style={{ gridColumn:'1/-1', textAlign:'center', color:'var(--text-muted)', padding:'40px 0' }}>Nenhum item no catálogo. Clique em "Novo Item".</p>
              )}
            </div>
          </div>
        )}


            {arsenalSubTab === 'selos' && (
          <div className="space-y-8 anim-fade-up mp-darktab" style={{ height:'100%', overflowY:'auto' }}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 anim-fade-up">
                <div>
                  <h2 className="text-4xl font-black text-white uppercase italic tracking-tight" style={{ background:'linear-gradient(135deg,#fb923c,#f97316,#ea580c)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Selos</h2>
                  <p className="text-slate-600 font-bold uppercase tracking-[0.3em] text-xs mt-1">Poderes Arcanos Selados</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto anim-fade-up-d1">
                  <div className="relative flex-1 md:flex-none">
                    <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder="Buscar por nome, código..." className="w-full md:w-72 bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-5 py-3 text-sm text-white focus:border-orange-600 outline-none"
                      value={sealSearchTerm} onChange={e => setSealSearchTerm(e.target.value)} />
                  </div>
                  <button onClick={() => setEditingSeal({} as Seal)}
                    className="flex items-center gap-2 px-7 py-3 rounded-xl text-white font-extrabold uppercase tracking-widest text-xs border"
                    style={{ background:'linear-gradient(135deg,rgba(234,88,12,0.8),rgba(249,115,22,0.7))', border:'1px solid rgba(234,88,12,0.5)', boxShadow:'0 0 20px rgba(234,88,12,0.3)' }}>
                    <Plus className="w-4 h-4" /> Novo Selo
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-12">
              {filteredSeals.map((seal, idx) => (
                <div key={seal.id}
                  className="group relative border rounded-[2.5rem] overflow-hidden card-seal anim-fade-up"
                  style={{
                    background:'linear-gradient(145deg,#1a1218,#100a0c)',
                    border:'1.5px solid rgba(212,20,42,0.45)',
                    animationDelay: `${idx * 0.04}s`,
                  }}>
                  {/* Top accent */}
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,transparent,rgba(234,88,12,0.8),rgba(251,191,36,0.6),rgba(234,88,12,0.8),transparent)' }} />
                  {/* BG glow */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background:'radial-gradient(ellipse at 50% 0%,rgba(234,88,12,0.08),transparent 65%)' }} />

                  <div className="relative p-6 flex flex-col gap-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative flex-shrink-0">
                          {seal.image ? (
                            <img src={seal.image} className="w-16 h-16 rounded-2xl object-cover border-2 group-hover:scale-105 transition-transform duration-300"
                              style={{ borderColor:'rgba(234,88,12,0.5)' }} />
                          ) : seal.symbol && !seal.symbol.startsWith('http') && !seal.symbol.startsWith('data:') ? (
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                              style={{ background:'rgba(234,88,12,0.1)', border:'2px solid rgba(234,88,12,0.3)' }}>{seal.symbol}</div>
                          ) : (
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                              style={{ background:'rgba(234,88,12,0.1)', border:'2px solid rgba(234,88,12,0.3)' }}>🔯</div>
                          )}
                          {/* Rune ring on hover */}
                          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                            style={{ border:'2px solid rgba(234,88,12,0.6)', animation:'seal-orb-pulse 2s ease-in-out infinite' }} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xl font-extrabold uppercase italic leading-none text-white truncate">{seal.name}</h3>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <span className="text-[10px] font-mono px-2 py-1 rounded-lg font-extrabold tracking-widest"
                              style={{ background:'rgba(234,88,12,0.15)', border:'1px solid rgba(234,88,12,0.4)', color:'#fb923c' }}>
                              #{seal.code}
                            </span>
                            {seal.executionModes && seal.executionModes.filter(m => m !== 'immediate').map(m => (
                              <span key={m} className="text-[10px] font-mono px-2 py-1 rounded-lg"
                                style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)', color:'#a5b4fc' }}>
                                {m === 'preparation' ? `⏳ ${seal.preparationRounds}rds` : `🤝 ${seal.comboMinUsers ?? 2}+`}
                              </span>
                            ))}
                            {(!seal.executionModes || seal.executionModes.length === 0) && seal.executionMode && seal.executionMode !== 'immediate' && (
                              <span className="text-[10px] font-mono px-2 py-1 rounded-lg"
                                style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)', color:'#a5b4fc' }}>
                                {seal.executionMode === 'preparation' ? `⏳ ${seal.preparationRounds}rds` : `🤝 ${seal.comboMinUsers ?? 2}+`}
                              </span>
                            )}
                            {seal.diceRoll && (
                              <span className="text-[10px] font-mono px-2 py-1 rounded-lg" style={{ background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.06)', color:'#94a3b8' }}>
                                🎲 {seal.diceRoll}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                        <button onClick={() => setEditingSeal(seal)} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => deleteSeal(seal.id)} className="p-2 text-slate-400 hover:text-white hover:bg-rose-600/30 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                        <button onClick={() => setAssignSealModal(seal)} className="p-2 text-slate-400 hover:text-white hover:bg-emerald-600/30 rounded-xl" title="Atribuir a Personagem"><UserPlus className="w-4 h-4" /></button>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 italic" style={{ background:'rgba(0,0,0,0.3)', borderRadius:12, padding:'10px 14px', border:'1px solid rgba(255,255,255,0.04)' }}>
                      {seal.description || 'Sem descrição.'}
                    </p>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-2">
                      {(seal.damage ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171' }}>
                          ⚔ {seal.damage}
                        </div>
                      )}
                      {(seal.healHp ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)', color:'#4ade80' }}>
                          💚 +{seal.healHp}HP
                        </div>
                      )}
                      {(seal.healAura ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background:'rgba(6,182,212,0.1)', border:'1px solid rgba(6,182,212,0.2)', color:'#67e8f9' }}>
                          ⚡ +{seal.healAura}AU
                        </div>
                      )}
                      {seal.conditionEffect && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)', color:'#fbbf24' }}>
                          ✦ {seal.conditionEffect}
                        </div>
                      )}
                      {seal.damageModTarget && seal.damageModTarget !== 'none' && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)', color:'#c4b5fd' }}>
                          {(seal.damageModValue ?? 0) >= 0 ? '+' : ''}{seal.damageModValue ?? ''}{seal.damageModPercent ? `${seal.damageModPercent}%` : ''} dano
                        </div>
                      )}
                      {seal.requirements && seal.requirements.length > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', color:'#a5b4fc' }}>
                          🔒 {seal.requirements.length} req.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {filteredSeals.length === 0 && (
                <div className="col-span-full py-24 flex flex-col items-center justify-center gap-6 rounded-[3rem] anim-fade" style={{ border:'2px dashed rgba(234,88,12,0.15)' }}>
                  <div className="p-6 rounded-3xl text-5xl" style={{ background:'rgba(234,88,12,0.07)' }}>🔯</div>
                  <div className="text-center">
                    <p className="font-extrabold uppercase tracking-widest text-slate-600 text-sm">Nenhum selo encontrado</p>
                    <p className="text-xs text-slate-700 mt-1">Crie seu primeiro selo arcano</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
            {arsenalSubTab === 'armas' && (
              <div className="space-y-8 anim-fade-up mp-darktab" style={{ height:'100%', overflowY:'auto' }}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="text-4xl font-black text-white uppercase italic tracking-tight">Armaria</h2>
                    <p className="text-slate-600 font-bold uppercase tracking-[0.3em] text-xs mt-1">Catálogo de Armas</p>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                      <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input type="text" placeholder="Buscar..." className="w-full md:w-64 bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-5 py-3 text-sm text-white focus:border-amber-600 outline-none" value={weaponSearchTerm} onChange={e => setWeaponSearchTerm(e.target.value)} />
                    </div>
                    <button onClick={() => setEditingWeapon({} as Weapon)} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                      <Plus className="w-4 h-4" /> Nova Arma
                    </button>
                  </div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:14 }}>
                  {filteredWeapons.map(w => (
                    <div key={w.id} onClick={() => setEditingWeapon(w)} style={{ cursor:'pointer', borderRadius:4, overflow:'hidden', border:'1px solid var(--border-gold)', background:'linear-gradient(165deg, #1a1218, #100a0c)', position:'relative', clipPath:'polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)', transform:'rotate(-1deg)' }} className="group hover:brightness-110 transition-all">
                      <div style={{ height:120, background: w.image ? `url(${w.image}) center/cover` : 'linear-gradient(145deg,#1e180e,#100e08)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {!w.image && <Swords style={{ width:36, height:36, opacity:0.15 }} />}
                      </div>
                      <div style={{ padding:'10px 12px' }}>
                        <p style={{ fontSize:13, fontWeight:800, color:'var(--gold-pale)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.name}</p>
                        <div style={{ display:'flex', gap:6, marginTop:4, flexWrap:'wrap' }}>
                          {w.category && <span style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{w.category}</span>}
                          {(w.damage ?? 0) > 0 && <span style={{ fontSize:9, color:'#f87171' }}>{w.damage}⚔</span>}
                          {(w.bonus ?? 0) !== 0 && <span style={{ fontSize:9, color:'#86efac' }}>{(w.bonus ?? 0) >= 0 ? '+' : ''}{w.bonus}</span>}
                          {w.range && <span style={{ fontSize:9, color:'#94a3b8' }}>{w.range === 'melee' ? '⚔' : w.range === 'ranged' ? '🏹' : '🎯'}</span>}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setAssignWeaponModal(w); }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-emerald-900/70 hover:bg-emerald-700/80 text-emerald-300"
                        title="Atribuir a Personagem"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {weapons.length === 0 && (
                    <p style={{ gridColumn:'1/-1', textAlign:'center', color:'var(--text-muted)', padding:'40px 0' }}>Nenhuma arma no catálogo. Clique em "Nova Arma".</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </main>


      <style>{`
        @keyframes seal-orb-pulse {
          0%,100% { box-shadow: 0 0 10px rgba(234,88,12,0.45), inset 0 0 6px rgba(234,88,12,0.15); }
          50%     { box-shadow: 0 0 28px rgba(234,88,12,0.9), inset 0 0 14px rgba(234,88,12,0.35); }
        }
      `}</style>

      {/* ANIMACAO DE CARTA + DADO */}
      <CardRevealAnimation
        payload={cardAnim}
        onComplete={handleCardAnimComplete}
      />




      {/* ROLAGEM DE DADOS (fallback para ações sem carta) */}
      <DiceAnimation
        key={diceAnim?.id ?? 'dice-idle'}
        isVisible={!!diceAnim?.isVisible} 
        result={diceAnim?.result || 0} 
        finalTotal={diceAnim?.finalTotal}
        adjustments={diceAnim?.adjustments}
        defenderResult={diceAnim?.defenderResult} 
        defenderRoll={diceAnim?.defenderRoll}
        defenderBase={diceAnim?.defenderBase}
        isSuccess={!!diceAnim?.isSuccess} 
        customLabel={diceAnim?.customLabel} 
        notation={diceAnim?.notation || '1d20'}
        individualRolls={diceAnim?.individualRolls || [diceAnim?.result || 0]}
        numSides={diceAnim?.numSides || 20}
        bonus={diceAnim?.bonus || 0}
        dramatic={diceAnim?.dramatic}
        actorLabel={diceAnim?.actorLabel}
        defenderLabel={diceAnim?.defenderLabel}
        onReveal={diceAnim?.onReveal}
        onComplete={handleDiceAnimComplete}
      />


      {/* MODAL ADICIONAR ITEM */}
      {editingItem && (
        <Modal title={editingItem.id ? "Editar Item" : "Novo Item"} onClose={() => setEditingItem(null)}>
           <ItemForm
             initialData={editingItem}
             onSubmit={handleSaveItem}
             onDelete={(id) => removeItemFromCharacter(id)}
           />
        </Modal>
      )}

      {/* MODAL EDITAR MODELO DO CATÁLOGO */}
      {editingCatalogItem && (
        <Modal title={editingCatalogItem.id ? "Editar Item" : "Novo Item"} onClose={() => setEditingCatalogItem(null)}>
          <ItemForm
            initialData={editingCatalogItem.id ? editingCatalogItem : undefined}
            onSubmit={(item) => {
              const toSave: Item = item.id ? item : { ...item, id: Math.random().toString(36).substr(2, 9) };
              setItems(prev => {
                const exists = prev.some(entry => entry.id === toSave.id);
                return exists ? prev.map(entry => entry.id === toSave.id ? toSave : entry) : [...prev, toSave];
              });
              DatabaseService.saveItem(toSave);
              setEditingCatalogItem(null);
            }}
            onDelete={(id) => { setItems(prev => prev.filter(item => item.id !== id)); DatabaseService.deleteItem(id); setEditingCatalogItem(null); }}
          />
        </Modal>
      )}

      {/* MODAL EDITAR ARMA */}
      {editingWeapon !== null && (
        <Modal title={editingWeapon.id ? "Editar Arma" : "Nova Arma"} onClose={() => setEditingWeapon(null)}>
          <WeaponForm
            initialData={editingWeapon.id ? editingWeapon : undefined}
            onSubmit={(weapon) => {
              const toSave: Weapon = weapon.id ? weapon : { ...weapon, id: Math.random().toString(36).substr(2, 9) };
              DatabaseService.saveWeapon(toSave);
              setEditingWeapon(null);
            }}
            onDelete={(id) => { DatabaseService.deleteWeapon(id); setEditingWeapon(null); }}
          />
        </Modal>
      )}

      {/* MODAL DAR ITEM A PERSONAGEM */}
      {giveItemTarget && (
        <Modal title={`Dar "${giveItemTarget.name}"`} onClose={() => setGiveItemTarget(null)}>
          <div style={{ display:'flex', flexDirection:'column', gap:10, padding:4 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Quantidade</span>
              <input type="number" min={1} value={giveItemQty} onChange={e => setGiveItemQty(Math.max(1, parseInt(e.target.value) || 1))} style={{ width:80, background:'var(--bg-raised)', border:'1px solid var(--border-mid)', borderRadius:8, padding:'6px 10px', color:'var(--text-primary)' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:8, maxHeight:320, overflowY:'auto' }}>
              {characters.map(ch => (
                <button key={ch.id} onClick={() => {
                  updateCharacterStats(ch.id, { ownedItems: giveOwned(ch, giveItemTarget.id, giveItemQty) });
                  setGiveItemTarget(null);
                  setGiveItemQty(1);
                }} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'var(--bg-raised)', border:'1px solid var(--border-faint)', borderRadius:10, cursor:'pointer', textAlign:'left' }} className="hover:border-amber-700/50">
                  <div style={{ width:30, height:30, borderRadius:8, overflow:'hidden', flexShrink:0, background:'var(--bg-base)' }}>
                    {ch.icon && <img src={ch.icon} style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ch.name}</span>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL ATRIBUIR HABILIDADE A PERSONAGEM */}
      {assignCardModal && (
        <AssignCardModal
          card={assignCardModal}
          characters={characters}
          onAssign={(charId, add) => {
            const char = characters.find(c => c.id === charId);
            if (!char) return;
            const newCardIds = add
              ? (char.cardIds.includes(assignCardModal.id) ? char.cardIds : [...char.cardIds, assignCardModal.id])
              : char.cardIds.filter(id => id !== assignCardModal.id);
            DatabaseService.saveCharacter({ ...char, cardIds: newCardIds });
          }}
          onClose={() => setAssignCardModal(null)}
        />
      )}

      {/* MODAL ATRIBUIR ARMA A PERSONAGEM */}
      {assignWeaponModal && (
        <AssignWeaponModal
          weapon={assignWeaponModal}
          characters={characters}
          onAssign={(charId, add) => {
            const char = characters.find(c => c.id === charId);
            if (!char) return;
            const cur = char.weaponIds ?? [];
            const newWeaponIds = add
              ? (cur.includes(assignWeaponModal.id) ? cur : [...cur, assignWeaponModal.id])
              : cur.filter(id => id !== assignWeaponModal.id);
            DatabaseService.saveCharacter({ ...char, weaponIds: newWeaponIds });
          }}
          onClose={() => setAssignWeaponModal(null)}
        />
      )}

      {/* MODAL ATRIBUIR SELO A PERSONAGEM */}
      {assignSealModal && (
        <AssignSealModal
          seal={assignSealModal}
          characters={characters}
          onAssign={(charId, add) => {
            const char = characters.find(c => c.id === charId);
            if (!char) return;
            const cur = char.sealIds ?? [];
            const newSealIds = add
              ? (cur.includes(assignSealModal.id) ? cur : [...cur, assignSealModal.id])
              : cur.filter(id => id !== assignSealModal.id);
            DatabaseService.saveCharacter({ ...char, sealIds: newSealIds });
          }}
          onClose={() => setAssignSealModal(null)}
        />
      )}

      {/* MODAL HISTÓRICO DE COMBATE */}
      {showHistoryModal && (
        <Modal title="Registros de Combate" onClose={() => setShowHistoryModal(false)}>
           <div className="space-y-4">
              {combat?.history.map((entry) => (
                 <div key={entry.id} className="bg-slate-900/80 border border-slate-800 p-6 rounded-[2rem] flex items-start gap-6">
                    <div className={`p-3 rounded-xl border ${entry.isSuccess ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-400' : 'bg-rose-950/30 border-rose-500/50 text-rose-400'}`}>
                       {entry.isSuccess ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                       <div className="flex justify-between items-start mb-2">
                          <p className="text-white font-extrabold uppercase italic text-sm">
                             {entry.actor} <span className="text-slate-500 text-[10px] not-italic font-bold mx-2">usou</span> {entry.cardName}
                          </p>
                          <span className="text-[10px] font-mono text-slate-500">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                       </div>
                       
                       <p className="text-slate-400 text-xs mb-3">Alvo: <span className="text-white font-bold">{entry.target}</span></p>
                       
                       <div className="flex gap-4">
                          <div className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 text-[10px] font-mono">
                             Rolagem: <span className="text-amber-400 font-bold">{entry.roll}</span> {entry.dc ? `/ CD ${entry.dc}` : ''}
                          </div>
                          {entry.reactionRoll !== undefined && (
                             <div className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 text-[10px] font-mono">
                                Reação: <span className="text-blue-400 font-bold">{entry.reactionRoll}</span>
                             </div>
                          )}
                          {entry.damageDealt !== undefined && entry.damageDealt > 0 && (
                             <div className="bg-rose-950/30 px-3 py-1 rounded-lg border border-rose-900/50 text-[10px] font-mono text-rose-400">
                                Dano: {entry.damageDealt}
                             </div>
                          )}
                       </div>
                    </div>
                 </div>
              ))}
              {(!combat?.history || combat.history.length === 0) && (
                 <p className="text-center text-slate-500 font-extrabold uppercase py-10 opacity-50">Nenhum registro encontrado</p>
              )}
           </div>
        </Modal>
      )}

      {/* MODAL GENÉRICO DE CONFIRMAÇÃO - via Portal para escapar stacking context */}
      {confirmModal && (
        <ConfirmPortal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

            {/* MODAL GERENCIAR GRUPO JORNADA */}
      {isPartyModalOpen && (
        <Modal title="Gerenciar Grupo" onClose={() => setIsPartyModalOpen(false)}>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {characters.map(char => (
                <div key={char.id} className={`p-6 rounded-[2rem] border-2 cursor-pointer transition-all flex items-center gap-6 ${char.isInJourney ? 'bg-amber-950/60 border-amber-500 shadow-[0_0_30px_rgba(212,168,83,0.2)]' : 'bg-slate-900/50 border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-600'}`} onClick={() => toggleJourneyCharacter(char)}>
                   <img src={char.icon || undefined} className="w-16 h-16 rounded-[1.2rem] object-cover" />
                   <div className="flex-1">
                      <h4 className="font-extrabold uppercase text-white italic">{char.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{char.isInJourney ? 'No Grupo' : 'Na Reserva'}</p>
                   </div>
                   {char.isInJourney && <Check className="w-6 h-6 text-amber-400" />}
                </div>
              ))}
              {characters.length === 0 && <p className="text-slate-500 uppercase font-black text-center col-span-full py-10">Nenhum personagem criado.</p>}
           </div>
        </Modal>
      )}


      {/* MODAL RESULTADO DE CRAFTING */}
      {craftResult && (() => {
        const isCook = craftResult.recipe.type === 'cozinhar';
        return (
          <Modal title={isCook ? '🍳 Receita Preparada!' : '⚒️ Item Forjado!'} onClose={() => setCraftResult(null)}>
            <div style={{ textAlign:'center', padding:'20px 0' }}>
              {craftResult.recipe.resultImage && (
                <img src={craftResult.recipe.resultImage} style={{ width:80, height:80, borderRadius:16, objectFit:'cover', margin:'0 auto 16px', border:`2px solid ${isCook?'rgba(234,88,12,0.5)':'rgba(168,85,247,0.5)'}`, boxShadow:`0 0 24px ${isCook?'rgba(234,88,12,0.3)':'rgba(168,85,247,0.3)'}` }} />
              )}
              <div style={{ fontSize:40, marginBottom:8 }}>{isCook ? '🍳' : '⚔️'}</div>
              <h3 style={{ fontSize:18, fontWeight:800, color:'#fff', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{craftResult.recipe.resultQuantity}× {craftResult.recipe.resultItemName}</h3>
              <p style={{ fontSize:12, color: isCook ? '#fb923c' : '#c084fc', fontWeight:700, marginBottom:16 }}>{craftResult.recipe.name}</p>
              {craftResult.recipe.resultDescription && <p style={{ fontSize:11, color:'rgba(255,255,255,0.5)', lineHeight:1.6, marginBottom:16 }}>{craftResult.recipe.resultDescription}</p>}
              <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center', background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:12, padding:'10px 20px', marginBottom:20 }}>
                {craftResult.character.icon && <img src={craftResult.character.icon} style={{ width:28, height:28, borderRadius:8, objectFit:'cover' }} />}
                <span style={{ fontSize:12, fontWeight:700, color:'#86efac' }}>{craftResult.character.name} recebeu o item!</span>
              </div>
              <button onClick={() => setCraftResult(null)} style={{ padding:'10px 28px', background: isCook ? 'linear-gradient(135deg,rgba(234,88,12,0.7),rgba(180,60,5,0.9))' : 'linear-gradient(135deg,rgba(168,85,247,0.6),rgba(109,40,217,0.8))', border:'none', borderRadius:12, color:'#fff', fontWeight:700, fontSize:12, textTransform:'uppercase', letterSpacing:'0.1em', cursor:'pointer' }}>
                Ótimo!
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* UPGRADE PURCHASE RESULT MODAL */}
      {upgradePurchaseResult && (() => {
        const { offer, targetChar } = upgradePurchaseResult;
        const rarityConf2 = { common:'#94a3b8', uncommon:'#34d399', rare:'#818cf8', legendary:'#fbbf24' };
        const offerIcons2: Record<UpgradeOfferType, string> = { vitalidade:'❤', aura:'⚡', reroll:'🎲', par:'✌', trinca:'🔱', quadra:'♦', nova_carta:'🃏', desejo:'✨' };
        const rc = rarityConf2[offer.rarity];
        const isItem = ['par','trinca','quadra','reroll'].includes(offer.type);
        return (
          <Modal title="✦ Upgrade Adquirido!" onClose={() => setUpgradePurchaseResult(null)}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:'8px 0' }}>
              <div style={{ width:72, height:72, borderRadius:18, background:`${rc}18`, border:`2px solid ${rc}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, boxShadow:`0 0 30px ${rc}44` }}>
                {offerIcons2[offer.type]}
              </div>
              <div style={{ textAlign:'center' }}>
                <p style={{ fontSize:20, fontWeight:900, color:'#fff', textTransform:'uppercase', letterSpacing:'0.06em' }}>{offer.label}</p>
                <p style={{ fontSize:11, color: rc, marginTop:3 }}>{offer.description}</p>
              </div>
              <div style={{ background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:12, padding:'10px 20px', textAlign:'center' }}>
                {offer.type === 'nova_carta'
                  ? <span style={{ fontSize:13, fontWeight:700, color:'#818cf8' }}>🃏 Abrindo criação de habilidade para {targetChar.name}...</span>
                  : offer.type === 'desejo'
                  ? <span style={{ fontSize:13, fontWeight:700, color:'#fbbf24' }}>✨ O desejo de {targetChar.name} será cumprido pelo Mestre!</span>
                  : isItem
                  ? <span style={{ fontSize:13, fontWeight:700, color:'#86efac' }}>✓ Adicionado ao inventário de {targetChar.name}!</span>
                  : <span style={{ fontSize:13, fontWeight:700, color:'#86efac' }}>✓ {targetChar.name} recebeu o upgrade!</span>
                }
              </div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>Custo: {offer.finalPrice}🪙</div>
              <button onClick={() => setUpgradePurchaseResult(null)} style={{ padding:'10px 32px', background:'linear-gradient(135deg,rgba(16,185,129,0.5),rgba(5,150,105,0.7))', border:'1px solid rgba(16,185,129,0.4)', borderRadius:12, color:'#fff', fontWeight:700, fontSize:12, textTransform:'uppercase', letterSpacing:'0.1em', cursor:'pointer' }}>
                Excelente!
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* MODAIS E PROMPTS */}

      {editingCard && (
        <Modal title={editingCard.id ? "Editar Registro" : "Novo Registro"} onClose={() => setEditingCard(null)}>
           <CardForm initialData={editingCard} onSubmit={(card) => {
             // If card was opened from upgrade shop (nova_carta), assign to the character
             const assignId = (editingCard as any)._assignToCharId;
             // Generate ID for new card so we can assign it immediately
             const finalCard = card.id ? card : { ...card, id: Math.random().toString(36).substr(2, 9) };
             saveCard(finalCard);
             if (assignId && !editingCard.id) {
               const char = characters.find(c => c.id === assignId);
               if (char) {
                 saveCharacter({ ...char, cardIds: [...(char.cardIds||[]), finalCard.id] });
               }
             }
             setEditingCard(null);
           }} onDelete={deleteCard} />
        </Modal>
      )}

      {editingSeal && (
        <Modal title={editingSeal.id ? 'Editar Selo' : 'Novo Selo Arcano'} onClose={() => setEditingSeal(null)}>
          <SealForm
            initialData={editingSeal.id ? editingSeal : undefined}
            characters={characters}
            cards={cards}
            onSubmit={(seal) => { saveSeal(seal); setEditingSeal(null); }}
            onDelete={deleteSeal}
          />
        </Modal>
      )}

      {/* Seal Ritual Animation */}
      {sealRitualAnim && (
        <SealRitualOverlay
          seal={sealRitualAnim.seal}
          effects={sealRitualAnim.effects}
          onDone={() => setSealRitualAnim(null)}
        />
      )}

      {/* Item Use Animation */}
      {itemUseAnim && (
        <ItemUseAnimation item={itemUseAnim} onDone={() => setItemUseAnim(null)} />
      )}

      {/* Inventory Panel for Journey characters */}
      {openInventoryCharId && (() => {
        const char = characters.find(c => c.id === openInventoryCharId);
        if (!char) return null;
        const ownedResolved = resolveOwnedItems(char, items);
        return createPortal(
          <div style={{
            position:'fixed', inset:0, zIndex:99990,
            background:'rgba(5,8,20,0.92)', backdropFilter:'blur(20px)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:24,
          }} onClick={(e) => { if (e.target === e.currentTarget) setOpenInventoryCharId(null); }}>
            <div style={{
              background:'rgba(18,22,38,0.98)', border:'1px solid rgba(212,168,83,0.3)',
              borderRadius:32, overflow:'hidden', width:'100%', maxWidth:720, maxHeight:'85vh',
              display:'flex', flexDirection:'column',
              boxShadow:'0 40px 120px rgba(0,0,0,0.8), 0 0 60px rgba(212,168,83,0.1)',
            }}>
              {/* Header */}
              <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(24,20,12,0.9)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <img src={char.icon || undefined} style={{ width:48, height:48, borderRadius:16, objectFit:'cover', border:'2px solid rgba(212,168,83,0.5)' }} />
                  <div>
                    <h3 style={{ fontSize:18, fontWeight:700, color:'#fdf0cc', textTransform:'uppercase', fontStyle:'italic' }}>{char.name}</h3>
                    <div style={{ display:'flex', gap:10, marginTop:2 }}>
                      <span style={{ fontSize:9, color:'#f87171', fontFamily:"'JetBrains Mono',monospace" }}>❤ {char.currentHp}/{char.maxHp}</span>
                      <span style={{ fontSize:9, color:'#93c5fd', fontFamily:"'JetBrains Mono',monospace" }}>⚡ {char.currentAura}/{char.maxAura}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => { setSelectedInventoryCharId(char.id); setEditingItem({} as any); }}
                    style={{ padding:'8px 16px', background:'linear-gradient(135deg,#c9983a,#8a6520)', border:'none', borderRadius:10, color:'#120f08', fontWeight:700, fontSize:10, textTransform:'uppercase', letterSpacing:'0.12em', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                    <Plus style={{width:12,height:12}} /> Adicionar
                  </button>
                  <button onClick={() => setOpenInventoryCharId(null)}
                    style={{ width:36, height:36, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, color:'#94a3b8', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <X style={{width:16,height:16}} />
                  </button>
                </div>
              </div>
              {/* Items grid */}
              <div style={{ flex:1, overflowY:'auto', padding:20 }}>
                {(ownedResolved.length === 0) ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:200, opacity:0.3 }}>
                    <PackageOpen style={{ width:48, height:48, color:'#475569', marginBottom:12 }} />
                    <p style={{ color:'#475569', fontWeight:700, textTransform:'uppercase', fontSize:11 }}>Inventário vazio</p>
                  </div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
                    {ownedResolved.map((item: ResolvedItem) => (
                      <div key={item.id} className="group" style={{
                        background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.06)',
                        borderRadius:16, overflow:'hidden', position:'relative',
                      }}>
                        {/* Image */}
                        <div style={{ position:'relative', aspectRatio:'1', background:'rgba(0,0,0,0.5)', overflow:'hidden' }}>
                          {item.image ? (
                            <img src={item.image} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
                          ) : (
                            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:32 }}>
                              {(item.category||'').toLowerCase().includes('arma') ? '⚔️' : (item.category||'').toLowerCase().includes('consumí') ? '🧪' : '📦'}
                            </div>
                          )}
                          <div style={{ position:'absolute', inset:0, background:'linear-gradient(0deg,rgba(0,0,0,0.7) 0%,transparent 50%)' }} />
                          {/* Actions */}
                          <div className="group-hover:opacity-100" style={{ position:'absolute', top:6, right:6, display:'flex', gap:4, opacity:0, transition:'opacity 0.2s' }}>
                            <button onClick={() => { setSelectedInventoryCharId(char.id); setEditingItem(item); }}
                              style={{ width:26, height:26, background:'rgba(0,0,0,0.8)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', cursor:'pointer' }}>
                              <Edit3 style={{width:11,height:11}} />
                            </button>
                          </div>
                          {(item.quantity || 0) > 1 && (
                            <div style={{ position:'absolute', bottom:6, right:6, background:'rgba(180,140,40,0.9)', borderRadius:6, padding:'1px 6px', fontSize:10, fontWeight:700, color:'white' }}>×{item.quantity}</div>
                          )}
                          {/* Use button */}
                          {item.usableInCombat && (
                            <button onClick={() => {
                              setItemUseAnim(item);
                              if (item.consumeOnUse) {
                                updateCharacterStats(char.id, { ownedItems: consumeOwned(char, item.id, 1) });
                              }
                            }} style={{
                              position:'absolute', bottom:6, left:6,
                              padding:'3px 8px', background:'rgba(34,197,94,0.85)', border:'none',
                              borderRadius:6, fontSize:8, fontWeight:700, color:'white', cursor:'pointer',
                              textTransform:'uppercase', letterSpacing:'0.1em',
                            }}>Usar</button>
                          )}
                        </div>
                        {/* Info */}
                        <div style={{ padding:'8px 10px' }}>
                          <h4 style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', fontStyle:'italic', color:'#e2e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</h4>
                          {item.category && <p style={{ fontSize:8, color:'#475569', textTransform:'uppercase', marginTop:2 }}>{item.category}</p>}
                          {/* Qty controls */}
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:6 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:3, background:'rgba(0,0,0,0.4)', borderRadius:6, padding:'1px 3px' }}>
                              <button onClick={() => {
                                updateCharacterStats(char.id, { ownedItems: setOwnedQuantity(char, item.id, Math.max(1,(item.quantity||1)-1)) });
                              }} style={{ width:16,height:16,background:'rgba(255,255,255,0.05)',border:'none',borderRadius:4,color:'#64748b',cursor:'pointer',fontSize:11,fontWeight:700 }}>−</button>
                              <span style={{ fontSize:11, fontWeight:700, color:'#d4a853', fontFamily:"'JetBrains Mono',monospace", minWidth:18, textAlign:'center' }}>{item.quantity||1}</span>
                              <button onClick={() => {
                                updateCharacterStats(char.id, { ownedItems: setOwnedQuantity(char, item.id, (item.quantity||1)+1) });
                              }} style={{ width:16,height:16,background:'rgba(255,255,255,0.05)',border:'none',borderRadius:4,color:'#64748b',cursor:'pointer',fontSize:11,fontWeight:700 }}>+</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}


      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #5a4010; border-radius: 12px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #c9983a; }
        .glass-panel { background: rgba(24,28,40,0.85); backdrop-filter: blur(20px); }
        .nav-glow { box-shadow: 0 1px 0 rgba(180,140,40,0.15), 0 4px 40px rgba(0,0,0,0.6); }
        .no-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }
        .no-scrollbar::-webkit-scrollbar { display:none; }
        .snap-x { scroll-snap-type: x mandatory; }
        .grid-cell:hover { background: rgba(180,140,40,0.06) !important; }
        @keyframes defeated-pulse {
  0%,100% { opacity:1; }
  50% { opacity:0.55; }
}
@keyframes crit-explosion {
  0% { transform:scale(0.1); opacity:0; }
  40% { opacity:1; }
  100% { transform:scale(6); opacity:0; }
}
@keyframes fumble-spin {
  0% { transform:rotate(0) scale(1); }
  50% { transform:rotate(180deg) scale(0.3); opacity:0.4; }
  100% { transform:rotate(360deg) scale(1); opacity:0; }
}
@keyframes turnBannerSlide {
          0% { opacity:0; transform: translateY(-60px) scaleX(0.6); }
          12% { opacity:1; transform: translateY(0px) scaleX(1); }
          72% { opacity:1; transform: translateY(0px) scaleX(1); }
          100% { opacity:0; transform: translateY(40px) scaleX(0.8); }
        }
        @keyframes danger-pulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        .animate-danger { animation: danger-pulse 1.5s ease-in-out infinite; }
        .anim-fade { animation: fadeIn 0.3s ease; }
        .anim-fade-up { animation: fadeUp 0.4s ease forwards; }
        .anim-fade-up-d1 { animation: fadeUp 0.4s ease 0.08s forwards; opacity:0; }
        .anim-scale-in { animation: scaleIn 0.22s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }
        @keyframes turn-pulse { 0%,100%{transform:scale(1);opacity:0.7;} 50%{transform:scale(1.1);opacity:1;} }
        @keyframes bar-fill { from{width:0} }
        .animate-bar-fill { animation: bar-fill 0.8s ease; }
        .animate-impact { animation: impactAnim 0.5s cubic-bezier(0.1,0.9,0.2,1) both; }
        @keyframes impactAnim { 0%{transform:scale(1) rotate(0);filter:brightness(1) saturate(1);} 9%{transform:scale(1.2) rotate(2.5deg);filter:brightness(3.4) saturate(2) drop-shadow(0 0 16px rgba(249,115,22,0.9));} 24%{transform:scale(1.06) rotate(-1deg);filter:brightness(1.6);} 100%{transform:scale(1) rotate(0);filter:brightness(1) saturate(1);} }
        @keyframes statPopup { 0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1);} 60%{opacity:1;transform:translateX(-50%) translateY(-20px) scale(1.15);} 100%{opacity:0;transform:translateX(-50%) translateY(-36px) scale(0.9);} }
        input[type=range] { -webkit-appearance:none; width:100%; height:4px; background:rgba(180,140,40,0.2); border-radius:99px; outline:none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; background:linear-gradient(135deg,#c9983a,#f0c060); border-radius:50%; cursor:pointer; box-shadow:0 0 8px rgba(201,152,58,0.6); }
        @keyframes char-hp-danger {
          0%,100% { box-shadow: 0 0 8px rgba(239,68,68,0.55), 0 0 18px rgba(239,68,68,0.25); border-color: rgba(239,68,68,0.75); }
          50%     { box-shadow: 0 0 20px rgba(239,68,68,1),   0 0 40px rgba(239,68,68,0.55); border-color: rgba(239,68,68,1); }
        }
        @keyframes char-tremble {
          0%   { transform: translate(0,0) rotate(0deg); }
          10%  { transform: translate(-1.5px,1px) rotate(-0.5deg); }
          20%  { transform: translate(1.5px,-1px) rotate(0.5deg); }
          30%  { transform: translate(-1px,1.5px) rotate(-0.4deg); }
          40%  { transform: translate(1px,-1.5px) rotate(0.4deg); }
          50%  { transform: translate(-1.5px,0) rotate(-0.5deg); }
          60%  { transform: translate(1.5px,1px) rotate(0.3deg); }
          70%  { transform: translate(-1px,-1px) rotate(-0.4deg); }
          80%  { transform: translate(1px,1.5px) rotate(0.35deg); }
          90%  { transform: translate(-1.5px,-1.5px) rotate(-0.3deg); }
          100% { transform: translate(0,0) rotate(0deg); }
        }

        /* ── TURN SYSTEM ANIMATIONS ── */
        @keyframes turnFlashSweep {
          0%   { opacity:0; transform:translateX(-100%); }
          30%  { opacity:1; }
          70%  { opacity:1; }
          100% { opacity:0; transform:translateX(100%); }
        }
        @keyframes turnCardPop {
          0%   { opacity:0; transform:scale(0.82) translateY(-8px); }
          60%  { opacity:1; transform:scale(1.04) translateY(0); }
          100% { transform:scale(1) translateY(0); }
        }
        @keyframes roundBounceIn {
          0%   { opacity:0; transform:scale(0.6) translateY(-12px); }
          65%  { opacity:1; transform:scale(1.12) translateY(2px); }
          100% { transform:scale(1) translateY(0); }
        }
        @keyframes turnActorSlide {
          0%   { opacity:0; transform:translateX(24px); }
          60%  { opacity:1; transform:translateX(-2px); }
          100% { transform:translateX(0); }
        }
        @keyframes hudSlideIn {
          0%   { opacity:0; transform:translateY(20px); }
          100% { opacity:1; transform:translateY(0); }
        }
        @keyframes hudTokenIn {
          0%   { opacity:0; transform:scale(0.7) rotate(-8deg); }
          65%  { opacity:1; transform:scale(1.05) rotate(1deg); }
          100% { transform:scale(1) rotate(0deg); }
        }
        @keyframes hudNameIn {
          0%   { opacity:0; transform:translateX(-50%) translateY(-6px); }
          100% { opacity:1; transform:translateX(-50%) translateY(0); }
        }
        @keyframes hudStatsIn {
          0%   { opacity:0; transform:translateX(-16px); }
          100% { opacity:1; transform:translateX(0); }
        }
        @keyframes hudSideIn {
          0%   { opacity:0; transform:translateX(16px); }
          100% { opacity:1; transform:translateX(0); }
        }
        @keyframes condIn {
          0%   { opacity:0; transform:scale(0.7); }
          100% { opacity:1; transform:scale(1); }
        }
        @keyframes barShimmer {
          0%,100% { opacity:0; transform:translateX(-100%); }
          50% { opacity:1; transform:translateX(100%); }
        }
        .timer-urgent { animation: timer-urgent-pulse 0.6s ease-in-out infinite !important; }
        @keyframes timer-urgent-pulse {
          0%,100% { box-shadow:0 0 0 rgba(239,68,68,0); border-color:rgba(239,68,68,0.35); }
          50% { box-shadow:0 0 16px rgba(239,68,68,0.6); border-color:rgba(239,68,68,0.8); }
        }

        /* ── COMBAT MOBILE MODE ── */
        .combat-mobile-mode {
          --mobile-scale: 1.25;
        }
        /* Scale up the command list and combat grid area */
        .combat-mobile-mode .combatant-token { transform: scale(1.2); transform-origin: top center; }
        /* Make buttons and interactive elements larger */
        .combat-mobile-mode button { min-height: 34px; }
        /* Scale initiative strip text */
        .combat-mobile-mode [data-initiative-name] { font-size: 13px !important; }
        /* Larger HP/Aura values */
        .combat-mobile-mode .combat-stat-value { font-size: 18px !important; }
        /* Combat mobile: scale up the entire bottom action area */
        .combat-mobile-mode .combat-action-area {
          transform: scale(1.12);
          transform-origin: bottom center;
        }
      `}</style>

    </div>
  );
};

export default App;
