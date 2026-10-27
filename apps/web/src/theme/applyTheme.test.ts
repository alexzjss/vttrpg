import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme } from './applyTheme';
import { defaultTheme, themes } from './themes';

const root = () => document.documentElement;

describe('applyTheme', () => {
  beforeEach(() => {
    root().removeAttribute('style');
  });

  it('define --color-accent no :root', () => {
    applyTheme(defaultTheme);
    expect(root().style.getPropertyValue('--color-accent')).toBe('#b3263a');
  });

  it('define as fontes no :root', () => {
    applyTheme(defaultTheme);
    expect(root().style.getPropertyValue('--font-body')).not.toBe('');
    expect(root().style.getPropertyValue('--font-display')).not.toBe('');
  });

  it('trocar de tema sobrescreve as variáveis', () => {
    const neutral = themes.find((t) => t.id === 'neutral')!;
    applyTheme(defaultTheme);
    applyTheme(neutral);
    expect(root().style.getPropertyValue('--color-accent')).toBe(neutral.colors.accent);
  });

  it('o tema padrão é dark-fantasy', () => {
    expect(defaultTheme.id).toBe('dark-fantasy');
  });
});
