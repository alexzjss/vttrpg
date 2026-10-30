import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { createFakeTransport } from '../net/fakeTransport';
import { setSession } from '../session/session';
import { useGame } from '../store/gameStore';

const auth = { signOut: vi.fn() };
vi.mock('../net/supabase', () => ({ getSupabase: () => ({ auth }) }));
vi.mock('../tabletop/Tabletop', () => ({ Tabletop: () => null }));

import { MesaPage } from './MesaPage';

describe('MesaPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    auth.signOut.mockReset().mockResolvedValue({ error: null });
  });
  afterEach(() => useGame.getState().disconnect());

  it('Sair limpa só a sessão da janela e não encerra o login do Supabase', async () => {
    const session = { mode: 'online', actor: { role: 'gm' }, campaignId: 'c-1', username: 'mestre' } as const;
    setSession(session);
    await useGame.getState().connect(createFakeTransport(), { mode: 'local', actor: { role: 'gm' } });
    render(
      <MemoryRouter initialEntries={['/mesa']}>
        <Routes>
          <Route path="/mesa" element={<MesaPage />} />
          <Route path="/login" element={<p>Tela de login</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(screen.getByText('Tela de login')).toBeTruthy();
    expect(sessionStorage.getItem('vtt.session')).toBeNull();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
