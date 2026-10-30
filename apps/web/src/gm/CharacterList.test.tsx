import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultResources, type Character } from '@vtt/core';
import { createFakeTransport } from '../net/fakeTransport';
import { v2Fields } from '../../../../packages/core/src/testing';
import { CharacterList } from './CharacterList';

const mk = (kind: 'pc' | 'npc', name: string): Omit<Character, 'id'> => ({
  kind, name, portrait: '', fullBodyArt: '', tokenImage: '', speed: 5,
  hpVisibility: kind === 'pc' ? 'exact' : 'hidden', resources: defaultResources(), ...v2Fields(),
});

describe('CharacterList', () => {
  it('"Colocar na cena" põe NPC oculto e PC visível', async () => {
    const fake = createFakeTransport();
    await fake.connect({ mode: 'local', actor: { role: 'gm' } });
    await fake.send({ type: 'createCharacter', input: mk('pc', 'Ana') });
    await fake.send({ type: 'createCharacter', input: mk('npc', 'Orc') });
    fake.sent.length = 0;
    const state = await fake.resync();
    render(<CharacterList state={state} send={(c) => fake.send(c)} onNew={() => {}} onImport={() => {}} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Colocar Orc na cena' }));
    fireEvent.click(screen.getByRole('button', { name: 'Colocar Ana na cena' }));
    await waitFor(() => expect(fake.sent).toHaveLength(2));
    expect(fake.sent[0]).toMatchObject({ type: 'placeToken', hidden: true });
    expect(fake.sent[1]).toMatchObject({ type: 'placeToken', hidden: false });
  });
});
