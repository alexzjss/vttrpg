import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultResources, type Character } from '@vtt/core';
import { MemoryRouter } from 'react-router';
import { ApiError, type Api } from '../net/api';
import { createFakeTransport } from '../net/fakeTransport';
import { setSession } from '../session/session';
import { useGame } from '../store/gameStore';

vi.mock('../net/supabase', () => ({ getSupabase: () => null }));
vi.mock('../tabletop/Tabletop', () => ({ Tabletop: () => null }));

import { MestrePage } from '../pages/MestrePage';
import { AccountsPanel } from './AccountsPanel';

const mk = (kind: 'pc' | 'npc', name: string): Omit<Character, 'id'> => ({
  kind, name, portrait: '', fullBodyArt: '', tokenImage: '', speed: 5,
  hpVisibility: kind === 'pc' ? 'exact' : 'hidden', resources: defaultResources(),
});

async function setup() {
  const fake = createFakeTransport();
  await fake.connect({ mode: 'local', actor: { role: 'gm' } });
  await fake.send({ type: 'createCharacter', input: mk('pc', 'Ana') });
  await fake.send({ type: 'createCharacter', input: mk('pc', 'Beto') });
  await fake.send({ type: 'createCharacter', input: mk('npc', 'Orc') });
  const state = await fake.resync();
  const byName = (n: string) => Object.values(state.characters).find((c) => c.name === n)!;
  return { state, ana: byName('Ana'), beto: byName('Beto') };
}

function fakeApi(accounts: unknown[] = []) {
  const api = {
    get: vi.fn(async (path: string) =>
      path.startsWith('/api/accounts') ? { accounts } : { bytes: 3 * 1024 * 1024 + 200000 }),
    post: vi.fn(async () => ({ account: {} })),
    patch: vi.fn(async () => ({ ok: true })),
  };
  return api as typeof api & Api;
}

const fill = (user: string, pass: string) => {
  fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: user } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: pass } });
};

describe('AccountsPanel', () => {
  afterEach(cleanup);

  it('lista contas com o nome do personagem, o select exclui PCs com conta e mostra MB', async () => {
    const { state, ana } = await setup();
    const api = fakeApi([{ id: 'a1', username: 'ana', characterId: ana.id, active: true }]);
    render(<AccountsPanel state={state} campaignId="c-1" api={api} />);
    await screen.findByText('ana');
    expect(screen.getByText(/Ana · ativa/)).toBeTruthy();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Beto']);
    expect(screen.getByText('Armazenamento: 3.2 MB')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/accounts?campaignId=c-1');
    expect(api.get).toHaveBeenCalledWith('/api/assets/usage?campaignId=c-1');
  });

  it('criar envia o corpo certo', async () => {
    const { state, beto } = await setup();
    const api = fakeApi();
    render(<AccountsPanel state={state} campaignId="c-1" api={api} />);
    await screen.findByText('Nenhuma conta ainda.');
    fill('beto', 'segredo1');
    fireEvent.change(screen.getByLabelText('Personagem'), { target: { value: beto.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/api/accounts', {
      campaignId: 'c-1', username: 'beto', password: 'segredo1', characterId: beto.id,
    });
  });

  it('senha curta não chega ao servidor', async () => {
    const { state } = await setup();
    const api = fakeApi();
    render(<AccountsPanel state={state} campaignId="c-1" api={api} />);
    await screen.findByText('Nenhuma conta ainda.');
    fill('beto', '123');
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect((await screen.findByRole('alert')).textContent).toBe('A senha precisa de pelo menos 6 caracteres.');
    expect(api.post).not.toHaveBeenCalled();
  });

  it.each([
    ['username_taken', 'Esse usuário já existe.'],
    ['character_taken', 'Esse personagem já tem conta.'],
    ['weak_password', 'A senha precisa de pelo menos 6 caracteres.'],
    ['invalid_username', 'Usuário inválido: 3 a 32 letras minúsculas, números, _ ou -.'],
    ['boom_secreto', 'Não foi possível concluir. Tente de novo.'],
  ])('mapeia o erro %s', async (code, text) => {
    const { state } = await setup();
    const api = fakeApi();
    api.post.mockRejectedValueOnce(new ApiError(409, code));
    render(<AccountsPanel state={state} campaignId="c-1" api={api} />);
    await screen.findByText('Nenhuma conta ainda.');
    fill('beto', 'segredo1');
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect((await screen.findByRole('alert')).textContent).toBe(text);
  });

  it('desativar manda PATCH com active false', async () => {
    const { state, ana } = await setup();
    const api = fakeApi([{ id: 'a1', username: 'ana', characterId: ana.id, active: true }]);
    render(<AccountsPanel state={state} campaignId="c-1" api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar ana' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/accounts', { id: 'a1', active: false }));
  });

  it('redefinir senha usa formulário com campo de senha; cancelar não faz nada; curta mostra erro', async () => {
    const { state, ana } = await setup();
    const api = fakeApi([{ id: 'a1', username: 'ana', characterId: ana.id, active: true }]);
    const prompt = vi.spyOn(window, 'prompt');
    render(<AccountsPanel state={state} campaignId="c-1" api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Redefinir senha de ana' }));
    const field = screen.getByLabelText('Nova senha para ana') as HTMLInputElement;
    expect(field.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Nova senha para ana')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha de ana' }));
    fireEvent.change(screen.getByLabelText('Nova senha para ana'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar senha' }));
    expect((await screen.findByRole('alert')).textContent).toBe('A senha precisa de pelo menos 6 caracteres.');
    expect(api.patch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Nova senha para ana'), { target: { value: 'novasenha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar senha' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/accounts', { id: 'a1', password: 'novasenha' }));
    expect(prompt).not.toHaveBeenCalled();
    prompt.mockRestore();
  });
});

describe('AccountsPanel: robustez', () => {
  afterEach(cleanup);

  it('falha no uso não esvazia a lista nem dispara alerta', async () => {
    const { state, ana } = await setup();
    const api = fakeApi();
    api.get.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/assets/usage')) throw new ApiError(500, 'boom');
      return { accounts: [{ id: 'a1', username: 'ana', characterId: ana.id, active: true }] };
    });
    render(<AccountsPanel state={state} campaignId="c-1" api={api} />);
    await screen.findByText('ana');
    expect(await screen.findByText('Uso do armazenamento indisponível.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('conta desativada continua excluindo o seu PC do select', async () => {
    const { state, ana } = await setup();
    const api = fakeApi([{ id: 'a1', username: 'ana', characterId: ana.id, active: false }]);
    render(<AccountsPanel state={state} campaignId="c-1" api={api} />);
    await screen.findByText('ana');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Beto']);
  });

  it('falha ao atualizar a lista após ação bem-sucedida não vira alerta de erro', async () => {
    const { state, ana } = await setup();
    const api = fakeApi([{ id: 'a1', username: 'ana', characterId: ana.id, active: true }]);
    render(<AccountsPanel state={state} campaignId="c-1" api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar ana' }));
    api.get.mockImplementation(async () => { throw new ApiError(500, 'x'); });
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect((await screen.findByRole('status')).textContent).toBe('Feito, mas não foi possível atualizar a lista.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('normaliza o usuário, recusa vazio e limpa a senha após enviar', async () => {
    const { state, ana } = await setup();
    const api = fakeApi();
    render(<AccountsPanel state={state} campaignId="c-1" api={api} />);
    await screen.findByText('Nenhuma conta ainda.');
    fill('   ', 'segredo1');
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(api.post).not.toHaveBeenCalled();
    fill('  Ana  ', 'segredo1');
    api.post.mockRejectedValueOnce(new ApiError(409, 'username_taken'));
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    await screen.findByRole('alert');
    expect(api.post).toHaveBeenCalledWith('/api/accounts', {
      campaignId: 'c-1', username: 'ana', password: 'segredo1', characterId: ana.id,
    });
    expect((screen.getByLabelText('Senha') as HTMLInputElement).value).toBe('');
  });

  it('redefinir senha com sucesso mostra confirmação', async () => {
    const { state, ana } = await setup();
    const api = fakeApi([{ id: 'a1', username: 'ana', characterId: ana.id, active: true }]);
    render(<AccountsPanel state={state} campaignId="c-1" api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Redefinir senha de ana' }));
    fireEvent.change(screen.getByLabelText('Nova senha para ana'), { target: { value: 'novasenha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar senha' }));
    expect((await screen.findByRole('status')).textContent).toBe('Senha redefinida.');
  });

  it('ignora resposta antiga que chega depois da mais nova', async () => {
    const { state, ana } = await setup();
    const acc = { id: 'a1', username: 'ana', characterId: ana.id, active: true };
    const api = fakeApi();
    let releaseFirst!: () => void;
    let calls = 0;
    api.get.mockImplementation(async (path: string) => {
      if (!path.startsWith('/api/accounts')) return { bytes: 0 };
      if (++calls === 1) {
        await new Promise<void>((r) => { releaseFirst = r; });
        return { accounts: [] };
      }
      return { accounts: [acc] };
    });
    render(<AccountsPanel state={state} campaignId="c-1" api={api} />);
    await waitFor(() => expect(releaseFirst).toBeTypeOf('function'));
    fill('ana', 'segredo1');
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    await screen.findByText('ana');
    releaseFirst();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText('ana')).toBeTruthy();
    expect(screen.queryByText('Nenhuma conta ainda.')).toBeNull();
  });
});

describe('MestrePage: aba Contas', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => { cleanup(); useGame.getState().disconnect(); });

  const renderPage = async () => {
    await useGame.getState().connect(createFakeTransport(), { mode: 'local', actor: { role: 'gm' } });
    render(<MemoryRouter><MestrePage /></MemoryRouter>);
  };

  it('não aparece no modo local e mantém Reiniciar campanha', async () => {
    setSession({ mode: 'local', actor: { role: 'gm' } });
    await renderPage();
    expect(screen.queryByRole('tab', { name: 'Contas' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reiniciar campanha' })).toBeTruthy();
  });

  it('aparece no modo online e esconde Reiniciar campanha', async () => {
    setSession({ mode: 'online', actor: { role: 'gm' }, campaignId: 'c-1', username: 'mestre' });
    await renderPage();
    expect(screen.getByRole('tab', { name: 'Contas' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reiniciar campanha' })).toBeNull();
  });
});
