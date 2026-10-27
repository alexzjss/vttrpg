import type { CampaignState, Id, Resources } from './model';

export function defaultResources(): Resources {
  return {
    hp: { current: 20, max: 20 },
    aura: { current: 10, max: 10 },
    ammo: { current: 0, max: 0 },
  };
}

export function createCampaign(campaignId: Id, name: string): CampaignState {
  return {
    campaignId,
    name,
    revision: 0,
    audienceSeq: {},
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
  };
}
