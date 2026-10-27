import { describe, it, expect } from 'vitest';
import { NAV_DESTS, MODES, SATELLITES, NAV_ORDER } from './navModel';

describe('navModel', () => {
  it('tem exatamente 1 modo (cena) e nenhum satélite navegável', () => {
    expect(MODES).toEqual(['cena']);
    expect(SATELLITES).toEqual([]);
  });

  it('NAV_ORDER cobre só a Cena', () => {
    expect(NAV_ORDER).toEqual(['cena']);
    expect(new Set(NAV_ORDER).size).toBe(1);
  });

  it('cada destino navegável tem label, ícone e tipo coerente', () => {
    for (const id of NAV_ORDER) {
      const d = NAV_DESTS[id];
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.icon).toBeTruthy();
      expect(d.kind).toBe(MODES.includes(id) ? 'mode' : 'satellite');
    }
  });
});
