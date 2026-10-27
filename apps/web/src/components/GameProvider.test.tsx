import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { createFakeTransport, type FakeTransport } from '../net/fakeTransport';
import { getSession, setSession } from '../session/session';
import { useGame } from '../store/gameStore';
import { GameProvider } from './GameProvider';

const renderProvider = (factory: () => FakeTransport) =>
  render(
    <MemoryRouter initialEntries={['/mestre']}>
      <Routes>
        <Route
          path="/mestre"
          element={
            <GameProvider transportFactory={factory}>
              <p>Conteúdo</p>
            </GameProvider>
          }
        />
        <Route path="/login" element={<p>Tela de login</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('GameProvider', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useGame.getState().disconnect();
    setSession({ role: 'gm' });
  });

  it('mostra Conectando… e depois o conteúdo quando pronto', async () => {
    renderProvider(() => createFakeTransport());
    expect(screen.getByText('Conectando…')).toBeTruthy();
    expect(await screen.findByText('Conteúdo')).toBeTruthy();
  });

  it('mostra o erro com botão para voltar ao login quando a conexão falha', async () => {
    const t = createFakeTransport();
    t.connect = async () => { throw new Error('falha'); };
    renderProvider(() => t);
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível conectar');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao login' }));
    expect(screen.getByText('Tela de login')).toBeTruthy();
    expect(getSession()).toBeNull();
  });

  it('fecha o transporte ao desmontar e zera a store', async () => {
    const t = createFakeTransport();
    const close = vi.spyOn(t, 'close');
    const { unmount } = renderProvider(() => t);
    await screen.findByText('Conteúdo');
    unmount();
    expect(close).toHaveBeenCalled();
    expect(useGame.getState().status).toBe('idle');
    expect(useGame.getState().state).toBeNull();
  });

  it('remontar com outra sessão nunca mostra o estado anterior', async () => {
    const first = createFakeTransport();
    const { unmount } = renderProvider(() => first);
    await screen.findByText('Conteúdo');
    unmount();

    // segunda montagem: a conexão só conclui quando liberada
    const second = createFakeTransport();
    const realConnect = second.connect;
    let release!: () => void;
    second.connect = (s) =>
      new Promise((resolve) => {
        release = () => resolve(realConnect(s));
      });
    setSession({ role: 'player', characterId: 'x' });
    renderProvider(() => second);

    expect(screen.queryByText('Conteúdo')).toBeNull();
    expect(screen.getByText('Conectando…')).toBeTruthy();

    await act(async () => release());
    expect(await screen.findByText('Conteúdo')).toBeTruthy();
  });
});
