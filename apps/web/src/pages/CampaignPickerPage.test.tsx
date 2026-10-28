import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { getSession } from '../session/session';

const auth = {
  signOut: vi.fn(),
  getSession: vi.fn(),
};
vi.mock('../net/supabase', () => ({ getSupabase: () => ({ auth }) }));

import { CampaignPickerPage } from './CampaignPickerPage';

const ME = { username: 'mestre', role: 'gm', campaignId: null, characterId: null };
let calls: Array<{ method: string; path: string; body?: unknown }>;

function mockApi(campaigns: Array<{ id: string; name: string }>) {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (path: string, init: { method: string; body?: string }) => {
    calls.push({ method: init.method, path, body: init.body ? JSON.parse(init.body) : undefined });
    if (path === '/api/me') return { ok: true, status: 200, json: async () => ME };
    if (path === '/api/campaigns' && init.method === 'GET') {
      return { ok: true, status: 200, json: async () => ({ campaigns }) };
    }
    return { ok: true, status: 200, json: async () => ({ campaign: { id: 'nova-1', name: 'Nova', slug: 'nova' } }) };
  }));
}

function renderPicker() {
  return render(
    <MemoryRouter initialEntries={['/campanhas']}>
      <Routes>
        <Route path="/campanhas" element={<CampaignPickerPage />} />
        <Route path="/mestre" element={<p>Tela do mestre</p>} />
        <Route path="/login" element={<p>Tela de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CampaignPickerPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    auth.signOut.mockReset().mockResolvedValue({ error: null });
    auth.getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'tok-fake' } } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('escolher uma campanha grava a sessão de GM e vai para /mestre', async () => {
    mockApi([{ id: 'c-1', name: 'Eldoria' }]);
    renderPicker();
    fireEvent.click(await screen.findByRole('button', { name: 'Eldoria' }));
    expect(await screen.findByText('Tela do mestre')).toBeTruthy();
    expect(getSession()).toEqual({ mode: 'online', actor: { role: 'gm' }, campaignId: 'c-1', username: 'mestre' });
  });

  it('criar campanha chama POST /api/campaigns e entra nela', async () => {
    mockApi([]);
    renderPicker();
    fireEvent.change(await screen.findByLabelText('Nome da campanha'), { target: { value: ' Nova ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Nova campanha' }));
    expect(await screen.findByText('Tela do mestre')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'POST', path: '/api/campaigns', body: { name: 'Nova' } });
    expect(getSession()).toMatchObject({ mode: 'online', campaignId: 'nova-1' });
  });

  it('Sair encerra a sessão do Supabase e volta ao login', async () => {
    mockApi([]);
    renderPicker();
    fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    expect(await screen.findByText('Tela de login')).toBeTruthy();
    await waitFor(() => expect(auth.signOut).toHaveBeenCalled());
  });
});
