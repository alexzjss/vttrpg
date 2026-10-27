export interface DiceControlSettings {
  enabled: boolean;
  min: number | null;
  max: number | null;
  allowedValues: number[];
  defaultAdjustment: number;
  forcedNext: number | null;
}

export const DICE_CONTROL_KEY = 'vat:gm-dice-control';
export const DICE_CONTROL_EVENT = 'vat:dice-control-change';

export const DEFAULT_DICE_CONTROL: DiceControlSettings = {
  enabled: false, min: null, max: null, allowedValues: [], defaultAdjustment: 0, forcedNext: null,
};

export function readDiceControl(): DiceControlSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_DICE_CONTROL;
  try {
    const raw = JSON.parse(localStorage.getItem(DICE_CONTROL_KEY) || '{}');
    return {
      ...DEFAULT_DICE_CONTROL, ...raw,
      min: Number.isFinite(raw.min) ? raw.min : null,
      max: Number.isFinite(raw.max) ? raw.max : null,
      allowedValues: Array.isArray(raw.allowedValues)
        ? [...new Set(raw.allowedValues.filter(Number.isFinite).map((n: number) => Math.trunc(n)))]
        : [],
      defaultAdjustment: Number.isFinite(raw.defaultAdjustment) ? Math.trunc(raw.defaultAdjustment) : 0,
      forcedNext: Number.isFinite(raw.forcedNext) ? Math.trunc(raw.forcedNext) : null,
    };
  } catch { return DEFAULT_DICE_CONTROL; }
}

export function writeDiceControl(settings: DiceControlSettings): void {
  localStorage.setItem(DICE_CONTROL_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(DICE_CONTROL_EVENT));
}

export function consumeForcedNext(): number | null {
  const settings = readDiceControl();
  if (!settings.enabled || settings.forcedNext == null) return null;
  writeDiceControl({ ...settings, forcedNext: null });
  return settings.forcedNext;
}
