import { describe, it, expect, beforeEach } from 'vitest';
import { SECTION_THEMES, ALL_SEC_VAR_KEYS, applySectionTheme } from './sectionTheme';
import { atmosphereForTab } from './atmosphere';
import type { TabId } from './atmosphere';

const ALL_TABS: TabId[] = ['cena', 'combat', 'journey', 'characters', 'arsenal'];

describe('SECTION_THEMES', () => {
  it('tem entrada para toda TabId', () => {
    for (const t of ALL_TABS) expect(SECTION_THEMES[t]).toBeDefined();
  });
  it('combat usa a tríade Metaphor', () => {
    expect(SECTION_THEMES.combat.vars['--sec-accent']).toBe('#d11f3f');
    expect(SECTION_THEMES.combat.vars['--sec-accent-2']).toBe('#2fd4c4');
    expect(SECTION_THEMES.combat.vars['--sec-accent-3']).toBe('#e6336e');
  });
  it('journey usa atmosfera dusk e acento lavanda', () => {
    expect(SECTION_THEMES.journey.atmosphere).toBe('dusk');
    expect(SECTION_THEMES.journey.vars['--sec-accent']).toBe('#b9a3e8');
  });
  it('arsenal usa acento carmesim e override de ember', () => {
    expect(SECTION_THEMES.arsenal.vars['--sec-accent']).toBe('#d4142a');
    expect(SECTION_THEMES.arsenal.vars['--ember']).toBe('#d4142a');
  });
  it('characters usa acento azul FF e override de ember', () => {
    expect(SECTION_THEMES.characters.vars['--sec-accent']).toBe('#5a9ae8');
    expect(SECTION_THEMES.characters.vars['--ember']).toBe('#5a9ae8');
  });
  it('cena usa atmosfera noir e acento crimson', () => {
    expect(SECTION_THEMES.cena.atmosphere).toBe('noir');
    expect(SECTION_THEMES.cena.vars['--sec-accent']).toBe('#E0102B');
    expect(SECTION_THEMES.cena.vars['--ember']).toBe('#E0102B');
  });
  it('ALL_SEC_VAR_KEYS cobre todas as chaves usadas por qualquer seção', () => {
    for (const t of ALL_TABS) {
      for (const k of Object.keys(SECTION_THEMES[t].vars)) {
        expect(ALL_SEC_VAR_KEYS).toContain(k);
      }
    }
  });
});

describe('applySectionTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-section');
    document.documentElement.removeAttribute('data-atmosphere');
    for (const k of ALL_SEC_VAR_KEYS) document.documentElement.style.removeProperty(k);
  });
  it('marca data-section e aplica a atmosfera correta da aba', () => {
    applySectionTheme('combat');
    expect(document.documentElement.dataset.section).toBe('combat');
    expect(document.documentElement.dataset.atmosphere).toBe(atmosphereForTab('combat'));
  });
  it('remove as vars de combat ao trocar para arsenal e aplica overrides de arsenal', () => {
    applySectionTheme('combat');
    expect(document.documentElement.style.getPropertyValue('--sec-accent')).toBe('#d11f3f');
    expect(document.documentElement.style.getPropertyValue('--gold-mid')).toBe('#2fd4c4');
    applySectionTheme('arsenal');
    expect(document.documentElement.dataset.section).toBe('arsenal');
    expect(document.documentElement.style.getPropertyValue('--sec-accent')).toBe('#d4142a');
    expect(document.documentElement.style.getPropertyValue('--gold-mid')).toBe('#d4142a');
  });
});
