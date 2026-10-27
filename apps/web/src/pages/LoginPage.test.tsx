import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { Character } from '@vtt/core';
import { createFakeTransport } from '../net/fakeTransport';
import { getSession } from '../session/session';
import { LoginPage } from './LoginPage';

const GM = { role: 'gm' } as const;
const mkChar = (kind: 'pc' | 'npc', name: string): Omit<Character, 'id'> => ({
  kind, name, portrait: '', fullBodyArt: '', tokenImage: '', speed: 6,
  hpVisibility: kind === 'pc' ? 'exact' : 'hidden',
  resources: { hp: { current: 10, max: 10 }, aura: { current: 5, max: 5 }, ammo: { current: 0, max: 0 } },
});

function renderLogin(t: ReturnType<typeof createFakeTransport>) {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage transportFactory={() => t} />} />
        <Route path="/jogador" element={<p>Tela do jogador</p>} />
        <Route path="/mestre" element={<p>Tela do mestre</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('lista os PCs e, ao escolher um, grava a sessão de jogador', async () => {
    const t = createFakeTransport();
    t.authority.handle(GM, { type: 'createCharacter', input: mkChar('pc', 'Lia') });
    const lia = Object.values(t.authority.getState().characters)[0]!;
    renderLogin(t);
    fireEvent.click(await screen.findByRole('button', { name: 'Lia' }));
    expect(getSession()).toEqual({ role: 'player', characterId: lia.id });
    expect(await screen.findByText('Tela do jogador')).toBeTruthy();
  });

  it('sem PCs mostra a mensagem de vazio', async () => {
    const t = createFakeTransport();
    t.authority.handle(GM, { type: 'createCharacter', input: mkChar('npc', 'Orc') });
    renderLogin(t);
    expect(await screen.findByText('Nenhum personagem jogador criado ainda.')).toBeTruthy();
  });

  it('Entrar como Mestre grava a sessão de gm', async () => {
    renderLogin(createFakeTransport());
    fireEvent.click(screen.getByRole('button', { name: 'Entrar como Mestre' }));
    expect(getSession()).toEqual({ role: 'gm' });
    expect(await screen.findByText('Tela do mestre')).toBeTruthy();
  });
});
