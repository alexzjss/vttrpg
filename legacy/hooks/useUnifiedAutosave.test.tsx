import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppSnapshot } from '../utils/database';
import { DatabaseService } from '../utils/database';
import { useUnifiedAutosave } from './useUnifiedAutosave';

const snapshot = (marker: string) => ({
  version: 7, savedAt: '',
  characters: [{ id: `character-${marker}` }], cards: [],
  items: [{ id: `item-${marker}` }], seals: [], weapons: [{ id: `weapon-${marker}` }], grimoire: [{ id: `arsenal-${marker}` }],
  combat: { marker }, journey: { marker }, cena: { marker },
} as unknown as AppSnapshot);

function Harness({ value }: { value: AppSnapshot }) {
  useUnifiedAutosave({ enabled: true, snapshot: value, onStatus: () => {}, debounceMs: 50, safetyIntervalMs: 10_000 });
  return null;
}

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('useUnifiedAutosave', () => {
  it('salva o snapshot mais recente incluindo cena, arsenal, itens e armas', async () => {
    vi.useFakeTimers();
    const save = vi.spyOn(DatabaseService, 'saveFullSnapshot').mockResolvedValue();
    const view = render(<Harness value={snapshot('antes')} />);
    view.rerender(<Harness value={snapshot('depois')} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toMatchObject({
      characters: [{ id: 'character-depois' }], items: [{ id: 'item-depois' }],
      weapons: [{ id: 'weapon-depois' }], grimoire: [{ id: 'arsenal-depois' }],
      combat: { marker: 'depois' }, cena: { marker: 'depois' },
    });
    expect(save.mock.calls[0][1]).toEqual({ notify: false });
  });
});
