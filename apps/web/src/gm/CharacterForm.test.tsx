import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultResources, type ProjectedCharacter } from '@vtt/core';
import { createFakeTransport } from '../net/fakeTransport';
import { CharacterForm } from './CharacterForm';

const existing: ProjectedCharacter = {
  id: 'c1', kind: 'npc', name: 'Orc', portrait: '', fullBodyArt: '', tokenImage: '', speed: 4,
  hpVisibility: 'band', resources: defaultResources(), hpBand: null,
};

describe('CharacterForm', () => {
  it('criar NPC envia createCharacter com recursos cheios', async () => {
    const fake = createFakeTransport();
    const onDone = vi.fn();
    render(<CharacterForm send={(c) => fake.send(c)} onDone={onDone} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Goblin' } });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'npc' } });
    fireEvent.change(screen.getByLabelText('HP máximo'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(fake.sent).toHaveLength(1));
    const cmd = fake.sent[0];
    expect(cmd.type).toBe('createCharacter');
    if (cmd.type !== 'createCharacter') return;
    expect(cmd.input.kind).toBe('npc');
    expect(cmd.input.name).toBe('Goblin');
    expect(cmd.input.resources.hp).toEqual({ current: 12, max: 12 });
  });

  it('ao editar, o controle de tipo fica desabilitado', () => {
    const fake = createFakeTransport();
    render(<CharacterForm character={existing} send={(c) => fake.send(c)} onDone={() => {}} />);
    expect((screen.getByLabelText('Tipo') as HTMLSelectElement).disabled).toBe(true);
  });

  it('nome vazio desabilita Salvar', () => {
    const fake = createFakeTransport();
    render(<CharacterForm send={(c) => fake.send(c)} onDone={() => {}} />);
    expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: '  ' } });
    expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('editar envia só o que mudou', async () => {
    const fake = createFakeTransport();
    await fake.connect({ role: 'gm' });
    const { id: _id, ...input } = existing;
    await fake.send({ type: 'createCharacter', input: { ...input, resources: defaultResources() } });
    const characterId = Object.keys(fake.authority.getState().characters)[0]!;
    fake.sent.length = 0;
    render(<CharacterForm character={{ ...existing, id: characterId }} send={(c) => fake.send(c)} onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Orc chefe' } });
    fireEvent.change(screen.getByLabelText('HP máximo'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(fake.sent).toHaveLength(2));
    expect(fake.sent[0]).toEqual({ type: 'updateCharacter', characterId, patch: { name: 'Orc chefe' } });
    expect(fake.sent[1]).toEqual({ type: 'setResource', characterId, resource: 'hp', max: 30 });
  });
});
