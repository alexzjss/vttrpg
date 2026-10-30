import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { getSession, setSession } from '../session/session';
import { logout } from '../session/logout';

const auth = {
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
};
let configured = true;
vi.mock('../net/supabase', () => ({ getSupabase: () => (configured ? { auth } : null) }));

import { LoginPage } from './LoginPage';

function mockMe(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: status < 400, status, json: async () => body })));
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage transportFactory={() => { throw new Error('não deve conectar'); }} />} />
        <Route path="/jogador" element={<p>Tela do jogador</p>} />
        <Route path="/campanhas" element={<p>Tela de campanhas</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: '  Lia ' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo-fake' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('OnlineLoginPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    configured = true;
    auth.signInWithPassword.mockReset().mockResolvedValue({ error: null });
    auth.signOut.mockReset().mockResolvedValue({ error: null });
    auth.getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'tok-fake' } } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('login de player grava a sessão online e vai para /jogador', async () => {
    mockMe(200, { username: 'lia', role: 'player', campaignId: 'camp-1', characterId: 'char-1' });
    renderLogin();
    fillAndSubmit();
    expect(await screen.findByText('Tela do jogador')).toBeTruthy();
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'lia@vtt.local', password: 'segredo-fake' });
    expect(getSession()).toEqual({
      mode: 'online',
      actor: { role: 'player', characterId: 'char-1' },
      campaignId: 'camp-1',
      username: 'lia',
    });
  });

  it('login de GM vai para /campanhas sem gravar sessão ainda', async () => {
    mockMe(200, { username: 'mestre', role: 'gm', campaignId: null, characterId: null });
    renderLogin();
    fillAndSubmit();
    expect(await screen.findByText('Tela de campanhas')).toBeTruthy();
    expect(getSession()).toBeNull();
  });

  it('credencial errada mostra a mensagem', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { status: 400, message: 'Invalid login credentials' } });
    renderLogin();
    fillAndSubmit();
    expect((await screen.findByRole('alert')).textContent).toBe('Usuário ou senha incorretos.');
    expect(getSession()).toBeNull();
  });

  it('conta desativada (403 em /api/me) desfaz o login', async () => {
    mockMe(403, { error: 'forbidden' });
    renderLogin();
    fillAndSubmit();
    expect((await screen.findByRole('alert')).textContent).toBe('Esta conta está desativada ou sem acesso.');
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' }));
    expect(getSession()).toBeNull();
  });

  it('limpa a sessão antiga ao logar, mesmo se o login falhar', async () => {
    const old = { mode: 'online', actor: { role: 'gm' }, campaignId: 'X', username: 'mestre' } as const;
    setSession(old);
    auth.signInWithPassword.mockResolvedValue({ error: { status: 400, message: 'Invalid login credentials' } });
    renderLogin();
    fillAndSubmit();
    await screen.findByRole('alert');
    expect(getSession()).toBeNull();

    setSession(old);
    auth.signInWithPassword.mockResolvedValue({ error: null });
    mockMe(200, { username: 'lia', role: 'player', campaignId: 'camp-1', characterId: 'char-1' });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByText('Tela do jogador');
    expect(getSession()).toMatchObject({ campaignId: 'camp-1', username: 'lia' });
  });

  it('erro de rede no login não é tratado como senha errada', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { status: 500, message: 'boom' } });
    renderLogin();
    fillAndSubmit();
    expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível entrar agora. Tente de novo.');
  });

  it('espera um logout pendente antes de chamar signInWithPassword', async () => {
    let finish!: () => void;
    auth.signOut.mockReturnValue(new Promise<void>((r) => { finish = r; }));
    void logout();
    mockMe(200, { username: 'mestre', role: 'gm', campaignId: null, characterId: null });
    renderLogin();
    fillAndSubmit();
    await new Promise((r) => setTimeout(r, 30));
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    finish();
    expect(await screen.findByText('Tela de campanhas')).toBeTruthy();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(auth.signInWithPassword).toHaveBeenCalled();
  });

  it('se o player não puder salvar a sessão, desfaz o login local', async () => {
    mockMe(200, { username: 'lia', role: 'player', campaignId: 'camp-1', characterId: 'char-1' });
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('cheio'); });
    renderLogin();
    fillAndSubmit();
    expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível salvar a sessão neste navegador.');
    spy.mockRestore();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('sem Supabase configurado mostra o login local', async () => {
    configured = false;
    const { createFakeTransport } = await import('../net/fakeTransport');
    const t = createFakeTransport();
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage transportFactory={() => t} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Entrar como Mestre' })).toBeTruthy();
    expect(screen.queryByLabelText('Senha')).toBeNull();
    await screen.findByText('Nenhum personagem jogador criado ainda.');
  });
});
