import type { Theme } from './themes';

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Escreve as variáveis --color-* e --font-* do tema no :root. */
export function applyTheme(theme: Theme): void {
  const style = document.documentElement.style;
  for (const [key, value] of Object.entries(theme.colors)) {
    style.setProperty(`--color-${kebab(key)}`, value);
  }
  for (const [key, value] of Object.entries(theme.fonts)) {
    style.setProperty(`--font-${kebab(key)}`, value);
  }
}
