import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./tabletop/Tabletop', () => ({ Tabletop: () => null }));
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Character } from '@vtt/core';
import { createFakeTransport } from './net/fakeTransport';
import { AppRoutes } from './routes';
import { setSession } from './session/session';
import { useGame } from './store/gameStore';

const GM = { role: 'gm' } as const;
const mkPc = (name: string): Omit<Character, 'id'> => ({
  kind: 'pc', name, portrait: '', fullBodyArt: '', tokenImage: '', speed: 6, hpVisibility: 'exact',
  resources: { hp: { current: 10, max: 10 }, aura: { current: 5, max: 5 }, ammo: { current: 0, max: 0 } },
});

const renderAt = (path: string, factory: () => ReturnType<typeof createFakeTransport>) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes transportFactory={factory} />
    </MemoryRouter>,
  );

describe('rotas', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useGame.getState().disconnect();
  });

  it('jogador em /mestre é mandado para o login', () => {
    setSession({ mode: 'local', actor: { role: 'player', characterId: 'x' } });
    renderAt('/mestre', () => createFakeTransport());
    expect(screen.getByRole('button', { name: 'Entrar como Mestre' })).toBeTruthy();
  });

  it('/ com sessão de gm vai para /mestre', async () => {
    setSession({ mode: 'local', actor: { role: 'gm' } });
    renderAt('/', () => createFakeTransport());
    expect(await screen.findByRole('button', { name: 'Abrir a mesa' })).toBeTruthy();
  });

  it('/ com sessão de jogador vai para /jogador', async () => {
    const t = createFakeTransport();
    t.authority.handle(GM, { type: 'createCharacter', input: mkPc('Lia') });
    const lia = Object.values(t.authority.getState().characters)[0]!;
    setSession({ mode: 'local', actor: { role: 'player', characterId: lia.id } });
    renderAt('/', () => t);
    expect(await screen.findByRole('heading', { level: 1, name: 'Lia' })).toBeTruthy();
  });
});
