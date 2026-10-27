import { describe, it, expect } from 'vitest';
import { PALETTE, injectThemeVars } from './theme';

describe('PALETTE — tokens ardentes', () => {
  it('expõe os metais e tons quentes novos', () => {
    expect(PALETTE.ember).toBe('#f97316');
    expect(PALETTE.auraPurple).toBe('#a855f7');
    expect(PALETTE.parchmentBg).toBe('#e9dcbf');
    expect(PALETTE.parchmentInk).toBe('#221a0f');
  });
  it('aquece o fundo e o texto base', () => {
    expect(PALETTE.bgBase).toBe('#13100b');
    expect(PALETTE.textPrimary).toBe('#f3ecdd');
  });
});

describe('injectThemeVars', () => {
  it('escreve os tokens novos como CSS vars no :root', () => {
    injectThemeVars();
    const s = document.documentElement.style;
    expect(s.getPropertyValue('--ember')).toBe('#f97316');
    expect(s.getPropertyValue('--parchment-bg')).toBe('#e9dcbf');
  });
});
