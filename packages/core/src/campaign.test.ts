import { describe, expect, it } from 'vitest';
import { createCampaign, defaultResources } from './campaign';

describe('createCampaign', () => {
  it('cria a campanha com a cena e o encontro iniciais', () => {
    expect(createCampaign('c1', 'X')).toEqual({
      campaignId: 'c1',
      name: 'X',
      revision: 0,
      characters: {},
      scene: {
        id: 'scene-1',
        name: 'Cena inicial',
        mode: 'tactical',
        background: '',
        grid: { cols: 20, rows: 12, cellSize: 64, visible: true },
        tokens: {},
      },
      encounter: { active: false, round: 0, turnIndex: 0, order: [] },
    });
  });

  it('defaultResources', () => {
    expect(defaultResources()).toEqual({
      hp: { current: 20, max: 20 },
      aura: { current: 10, max: 10 },
      ammo: { current: 0, max: 0 },
    });
  });
});
