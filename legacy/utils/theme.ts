import { CardType, DamageType } from '../types';

// ─────────────────────────────────────────────────────────────────
// PALETTE — fonte única dos tokens base (espelha o :root do index.html)
// ─────────────────────────────────────────────────────────────────
export const PALETTE = {
  bgBase:    '#13100b',
  bgSurface: '#161b26',
  bgRaised:  '#1c2234',
  bgOverlay: '#222840',
  goldDim:   '#7a5e1a',
  goldMid:   '#c9983a',
  goldBright:'#f0c060',
  goldPale:  '#fdf0cc',
  textPrimary:   '#f3ecdd',
  textSecondary: '#9aabcc',
  textMuted:     '#4e5f7a',
  textFaint:     '#2e3849',
  borderFaint: 'rgba(255,255,255,0.07)',
  borderMid:   'rgba(255,255,255,0.12)',
  borderGold:  'rgba(201,152,58,0.30)',
  // ── Metaphor UI tokens ────────────────────────────────
  teamCast:   '#c9983a',  // dourado — turno cast
  teamNpc:    '#dc2626',  // carmesim — turno npc
  hpHigh:     '#22c55e',  // verde HP > 60%
  hpMid:      '#eab308',  // amarelo HP 30–60%
  hpLow:      '#ef4444',  // vermelho HP < 30%
  apColor:    '#818cf8',  // azul/roxo para AP/Aura
  stateDown:  '#334155',  // cinza inconsciente
  stateAlert: '#f97316',  // laranja alerta
  // ── Fundação visual global (Etapa A) ──────────────────
  accentCrimson: '#dc2626',            // carmesim — alias semântico de team/npc
  accentPink:    '#ec4899',            // pink teatral (pinceladas/realces)
  accentCyan:    '#67e8f9',            // ciano frio (kickers/detalhes)
  paperWhite:    '#eef0f5',            // branco "pintado" (superfícies de detalhe)
  ink:           '#0a0c12',            // tinta escura (texto sobre paper)
  panelGlass:    'rgba(6,8,16,0.78)',  // fundo de painel escuro translúcido
  brushDark:     'rgba(4,6,14,0.86)',  // base de pincelada escura
  brushLight:    'rgba(238,240,245,0.92)', // base de pincelada clara
  danger:        '#ef4444',            // erro/perigo (alias semântico)
  success:       '#22c55e',            // sucesso (alias semântico)
  warning:       '#f59e0b',            // alerta/atenção (alias semântico)
  // ── Fase 0: paleta ardente + clima pergaminho ──────────
  ember:           '#f97316',
  emberDeep:       '#c2410c',
  auraPurple:      '#a855f7',
  parchmentBg:     '#e9dcbf',
  parchmentRaised: '#f1e7cf',
  parchmentInk:    '#221a0f',
  parchmentInkSoft:'#5a4a30',
  parchmentBorder: 'rgba(34,26,15,0.25)',
} as const;

// Mapa token -> CSS var name (mantém os nomes já usados no index.html)
const CSS_VAR_MAP: Record<keyof typeof PALETTE, string> = {
  bgBase: '--bg-base', bgSurface: '--bg-surface', bgRaised: '--bg-raised', bgOverlay: '--bg-overlay',
  goldDim: '--gold-dim', goldMid: '--gold-mid', goldBright: '--gold-bright', goldPale: '--gold-pale',
  textPrimary: '--text-primary', textSecondary: '--text-secondary', textMuted: '--text-muted', textFaint: '--text-faint',
  borderFaint: '--border-faint', borderMid: '--border-mid', borderGold: '--border-gold',
  teamCast: '--team-cast', teamNpc: '--team-npc',
  hpHigh: '--hp-high', hpMid: '--hp-mid', hpLow: '--hp-low',
  apColor: '--ap-color', stateDown: '--state-down', stateAlert: '--state-alert',
  accentCrimson: '--accent-crimson', accentPink: '--accent-pink', accentCyan: '--accent-cyan',
  paperWhite: '--paper-white', ink: '--ink', panelGlass: '--panel-glass',
  brushDark: '--brush-dark', brushLight: '--brush-light',
  danger: '--danger', success: '--success', warning: '--warning',
  ember: '--ember', emberDeep: '--ember-deep', auraPurple: '--aura-purple',
  parchmentBg: '--parchment-bg', parchmentRaised: '--parchment-raised',
  parchmentInk: '--parchment-ink', parchmentInkSoft: '--parchment-ink-soft',
  parchmentBorder: '--parchment-border',
};

/** Injeta as CSS vars no :root a partir do PALETTE (chamada no boot). */
export function injectThemeVars(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  (Object.keys(PALETTE) as (keyof typeof PALETTE)[]).forEach(k => {
    root.style.setProperty(CSS_VAR_MAP[k], PALETTE[k]);
  });
}

// ─────────────────────────────────────────────────────────────────
// CARD_TYPE_THEME — fonte única (substitui as 3 defs divergentes em App.tsx)
// ─────────────────────────────────────────────────────────────────
export interface CardTypeStyle {
  bg: string;
  border: string;
  glow: string;
  label: string;
  topColor: string;
  headerBg: string;
  nameShadow: string;
}

export const CARD_TYPE_THEME: Record<CardType, CardTypeStyle> = {
  'ataque':     { bg:'linear-gradient(165deg,rgba(45,15,15,0.97) 0%,rgba(55,18,18,0.95) 100%)', border:'rgba(239,68,68,0.7)',  glow:'rgba(239,68,68,0.85)',  label:'ATK', topColor:'#ef4444', headerBg:'rgba(239,68,68,0.15)',  nameShadow:'0 0 20px rgba(239,68,68,0.7)' },
  'ação':       { bg:'linear-gradient(165deg,rgba(40,30,5,0.97) 0%,rgba(60,45,5,0.95) 100%)',   border:'rgba(234,179,8,0.7)',  glow:'rgba(234,179,8,0.85)',  label:'AÇÃ', topColor:'#eab308', headerBg:'rgba(234,179,8,0.15)',  nameShadow:'0 0 20px rgba(234,179,8,0.7)' },
  'reação':     { bg:'linear-gradient(165deg,rgba(5,15,40,0.97) 0%,rgba(8,22,55,0.95) 100%)',   border:'rgba(59,130,246,0.7)', glow:'rgba(59,130,246,0.85)', label:'REA', topColor:'#3b82f6', headerBg:'rgba(59,130,246,0.15)', nameShadow:'0 0 20px rgba(59,130,246,0.7)' },
  'reforço':    { bg:'linear-gradient(165deg,rgba(5,30,12,0.97) 0%,rgba(8,45,18,0.95) 100%)',   border:'rgba(34,197,94,0.7)',  glow:'rgba(34,197,94,0.85)',  label:'REF', topColor:'#22c55e', headerBg:'rgba(34,197,94,0.15)',  nameShadow:'0 0 20px rgba(34,197,94,0.7)' },
  'vínculo':    { bg:'linear-gradient(165deg,rgba(20,22,28,0.97) 0%,rgba(30,32,40,0.95) 100%)', border:'rgba(148,163,184,0.7)',glow:'rgba(148,163,184,0.85)',label:'VÍN', topColor:'#94a3b8', headerBg:'rgba(148,163,184,0.15)',nameShadow:'0 0 20px rgba(148,163,184,0.7)' },
  'combinação': { bg:'linear-gradient(165deg,rgba(40,5,60,0.97) 0%,rgba(55,8,80,0.95) 100%)',   border:'rgba(168,85,247,0.9)', glow:'rgba(168,85,247,1)',    label:'CMB', topColor:'#c084fc', headerBg:'rgba(192,132,252,0.18)',nameShadow:'0 0 20px rgba(192,132,252,0.9)' },
  'forma':      { bg:'linear-gradient(165deg,rgba(40,25,0,0.97) 0%,rgba(60,38,0,0.95) 100%)',   border:'rgba(245,158,11,0.8)', glow:'rgba(245,158,11,0.9)',  label:'FRM', topColor:'#f59e0b', headerBg:'rgba(245,158,11,0.15)', nameShadow:'0 0 20px rgba(245,158,11,0.8)' },
};

// ─────────────────────────────────────────────────────────────────
// DAMAGE_TYPES — movido de App.tsx (fonte única)
// ─────────────────────────────────────────────────────────────────
export const DAMAGE_TYPES: { value: DamageType; label: string; color: string; emoji: string }[] = [
  { value: 'fisico',    label: 'Físico',    color: '#94a3b8', emoji: '⚔️' },
  { value: 'fogo',      label: 'Fogo',      color: '#ef4444', emoji: '🔥' },
  { value: 'raio',      label: 'Raio',      color: '#facc15', emoji: '⚡' },
  { value: 'água',      label: 'Água',      color: '#38bdf8', emoji: '💧' },
  { value: 'terra',     label: 'Terra',     color: '#92400e', emoji: '🪨' },
  { value: 'vento',     label: 'Vento',     color: '#86efac', emoji: '🍃' },
  { value: 'escuridão', label: 'Escuridão', color: '#7c3aed', emoji: '🌑' },
  { value: 'luminoso',  label: 'Luminoso',  color: '#fde68a', emoji: '✨' },
  { value: 'sangue',    label: 'Sangue',    color: '#dc2626', emoji: '🩸' },
  { value: 'aura',      label: 'Aura',      color: '#67e8f9', emoji: '💠' },
];

// ─────────────────────────────────────────────────────────────────
// PIN_COLORS — movido de App.tsx
// ─────────────────────────────────────────────────────────────────
export const PIN_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#a855f7','#ec4899','#ffffff'];
