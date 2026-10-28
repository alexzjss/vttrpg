import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createFakeTransport } from '../net/fakeTransport';
import type { ProjectedState } from '@vtt/core';
import { EncounterPanel } from './EncounterPanel';

const base = { portrait: '', fullBodyArt: '', tokenImage: '', speed: 3 };

async function setup() {
  const fake = createFakeTransport();
  const state = await fake.connect({ mode: 'local', actor: { role: 'gm' } });
  for (const name of ['Ana', 'Bruno']) {
    await fake.send({
      type: 'createCharacter',
      input: {
        kind: 'pc', name, hpVisibility: 'exact', ...base,
        resources: { hp: { current: 5, max: 5 }, aura: { current: 1, max: 1 }, ammo: { current: 0, max: 0 } },
      },
    });
  }
  const ids = Object.keys(fake.authority.getState().characters);
  for (const [i, id] of ids.entries()) {
    await fake.send({ type: 'placeToken', characterId: id, cell: { col: i, row: 0 } });
  }
  fake.sent.length = 0;
  return { fake, state: await fake.resync(), initial: state };
}

describe('EncounterPanel', () => {
  it('iniciar com dois tokens marcados envia startEncounter com as duas entradas', async () => {
    const { fake, state } = await setup();
    render(<EncounterPanel state={state} send={(c) => fake.send(c)} />);
    expect((screen.getByRole('button', { name: 'Iniciar combate' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Ana'));
    fireEvent.click(screen.getByLabelText('Bruno'));
    fireEvent.change(screen.getByLabelText('Iniciativa de Ana'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Iniciativa de Bruno'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar combate' }));
    await waitFor(() => expect(fake.sent).toHaveLength(1));
    const cmd = fake.sent[0];
    if (cmd.type !== 'startEncounter') throw new Error('comando errado');
    expect(cmd.entries).toHaveLength(2);
    expect(cmd.entries.map((e) => e.initiative).sort((a, b) => a - b)).toEqual([8, 15]);
  });

  it('Rolar preenche 1d20 + velocidade', async () => {
    const { fake, state } = await setup();
    render(<EncounterPanel state={state} send={(c) => fake.send(c)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rolar iniciativa de Ana' }));
    const v = Number((screen.getByLabelText('Iniciativa de Ana') as HTMLInputElement).value);
    expect(v).toBeGreaterThanOrEqual(4);
    expect(v).toBeLessThanOrEqual(23);
  });

  it('em combate, Próximo turno envia nextTurn e mostra o destaque', async () => {
    const { fake, state } = await setup();
    const ids = Object.keys(state.scene.tokens);
    await fake.send({ type: 'startEncounter', entries: ids.map((tokenId, i) => ({ tokenId, initiative: 10 - i })) });
    fake.sent.length = 0;
    const active: ProjectedState = await fake.resync();
    render(<EncounterPanel state={active} send={(c) => fake.send(c)} />);
    expect(screen.getByText(/Rodada 1/)).toBeTruthy();
    expect(document.querySelector('li.current')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo turno' }));
    await waitFor(() => expect(fake.sent).toEqual([{ type: 'nextTurn' }]));
    fireEvent.click(screen.getByRole('button', { name: 'Descer Ana' }));
    await waitFor(() => expect(fake.sent[1]?.type).toBe('reorderInitiative'));
  });
});
