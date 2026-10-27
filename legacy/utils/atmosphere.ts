export type TabId = 'cena' | 'combat' | 'arsenal' | 'characters' | 'journey';
export type Atmosphere = 'dark' | 'parchment' | 'dusk' | 'noir';

const TAB_ATMOSPHERE: Record<TabId, Atmosphere> = {
  cena: 'noir',
  combat: 'dark', arsenal: 'dark',
  characters: 'dark', journey: 'dusk',
};

export function atmosphereForTab(tab: TabId): Atmosphere {
  return TAB_ATMOSPHERE[tab];
}

export const ATMOSPHERE_VARS: Record<Atmosphere, Record<string, string>> = {
  dark: {
    '--bg-base': '#13100b',
    '--bg-surface': '#1b1710',
    '--bg-raised': '#241e14',
    '--bg-overlay': '#2c2417',
    '--text-primary': '#f3ecdd',
    '--text-secondary': '#c9b896',
    '--text-muted': '#8a7a5c',
    '--border-faint': 'rgba(240,224,180,0.08)',
    '--border-mid': 'rgba(240,224,180,0.16)',
    '--surface-ink': '#f3ecdd',
  },
  parchment: {
    '--bg-base': '#e0d2b0',
    '--bg-surface': '#e9dcbf',
    '--bg-raised': '#f1e7cf',
    '--bg-overlay': '#f6eed9',
    '--text-primary': '#221a0f',
    '--text-secondary': '#5a4a30',
    '--text-muted': '#897459',
    '--border-faint': 'rgba(34,26,15,0.12)',
    '--border-mid': 'rgba(34,26,15,0.24)',
    '--surface-ink': '#221a0f',
  },
  dusk: {
    '--bg-base': '#150f2c',
    '--bg-surface': '#1d1640',
    '--bg-raised': '#2a1f55',
    '--bg-overlay': '#342861',
    '--text-primary': '#ece3ff',
    '--text-secondary': '#c4b3e8',
    '--text-muted': '#8f7fc0',
    '--border-faint': 'rgba(200,180,255,0.10)',
    '--border-mid': 'rgba(200,180,255,0.20)',
    '--surface-ink': '#ece3ff',
  },
  noir: {
    '--bg-base': '#0a0a0c',
    '--bg-surface': '#101013',
    '--bg-raised': '#15151a',
    '--bg-overlay': '#1b1b21',
    '--text-primary': '#ececef',
    '--text-secondary': '#9a9aa1',
    '--text-muted': '#7d7d85',
    '--border-faint': '#1e1e24',
    '--border-mid': '#26262c',
    '--surface-ink': '#ececef',
  },
};

/** Atualiza apenas as vars de atmosfera (não mexe em data-section). Para troca de aba use applySectionTheme, que também atualiza data-section e a paleta da seção. */
export function applyAtmosphere(atmo: Atmosphere, root: HTMLElement = document.documentElement): void {
  root.dataset.atmosphere = atmo;
  const vars = ATMOSPHERE_VARS[atmo];
  for (const k of Object.keys(vars)) root.style.setProperty(k, vars[k]);
}
