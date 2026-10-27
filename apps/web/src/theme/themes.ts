export interface Theme {
  id: 'dark-fantasy' | 'neutral';
  name: string;
  colors: {
    bg: string;
    surface: string;
    surfaceAlt: string;
    text: string;
    textMuted: string;
    accent: string;
    danger: string;
    ok: string;
    pc: string;
    npc: string;
    grid: string;
  };
  fonts: { display: string; body: string };
}

/** Inspirado em legacy/utils/theme.ts (carmesim e ouro sobre fundo escuro). */
export const darkFantasy: Theme = {
  id: 'dark-fantasy',
  name: 'Fantasia sombria',
  colors: {
    bg: '#120c0e',
    surface: '#1d1417',
    surfaceAlt: '#2a1d22',
    text: '#f3ecdd',
    textMuted: '#9a8e82',
    accent: '#b3263a',
    danger: '#ef4444',
    ok: '#22c55e',
    pc: '#c9a227',
    npc: '#8f7fa6',
    grid: '#3a2a30',
  },
  fonts: {
    display: 'Georgia, "Times New Roman", serif',
    body: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
};

export const neutral: Theme = {
  id: 'neutral',
  name: 'Neutro',
  colors: {
    bg: '#16171a',
    surface: '#1f2024',
    surfaceAlt: '#2a2b30',
    text: '#e6e6e6',
    textMuted: '#9a9ca3',
    accent: '#4c8dff',
    danger: '#ef4444',
    ok: '#22c55e',
    pc: '#60a5fa',
    npc: '#f59e0b',
    grid: '#33353b',
  },
  fonts: {
    display: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    body: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
};

export const themes: Theme[] = [darkFantasy, neutral];
export const defaultTheme: Theme = darkFantasy;
