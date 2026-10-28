import type { ProjectedState } from '@vtt/core';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError, type Api } from '../net/api';
import { createAuthedApi } from '../net/authedApi';

interface Account {
  id: string;
  username: string;
  characterId: string;
  active: boolean;
}

interface Props {
  state: ProjectedState;
  campaignId: string;
  /** Injetável nos testes; por padrão usa o token da sessão do Supabase. */
  api?: Api;
}

const MIN_PASSWORD = 6;
const SHORT_PASSWORD = 'A senha precisa de pelo menos 6 caracteres.';
const LIST_FAILED = 'Não foi possível carregar as contas.';
const GENERIC = 'Não foi possível concluir. Tente de novo.';

const ERRORS: Record<string, string> = {
  username_taken: 'Esse usuário já existe.',
  character_taken: 'Esse personagem já tem conta.',
  weak_password: SHORT_PASSWORD,
  invalid_username: 'Usuário inválido: 3 a 32 letras minúsculas, números, _ ou -.',
  invalid_character: 'Personagem inválido.',
};

function messageFor(e: unknown): string {
  return e instanceof ApiError ? (ERRORS[e.code] ?? GENERIC) : GENERIC;
}

export function AccountsPanel({ state, campaignId, api }: Props) {
  const client = useMemo(() => api ?? createAuthedApi(), [api]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bytes, setBytes] = useState<number | null>(null);
  const [usageFailed, setUsageFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [busy, setBusy] = useState(false);
  const loadSeq = useRef(0);

  const q = `campaignId=${encodeURIComponent(campaignId)}`;
  /** Devolve false se a lista de contas falhou. Respostas fora de ordem são ignoradas. */
  const load = useCallback(async (): Promise<boolean> => {
    const seq = ++loadSeq.current;
    const [list, usage] = await Promise.allSettled([
      client.get<{ accounts: Account[] }>(`/api/accounts?${q}`),
      client.get<{ bytes: number }>(`/api/assets/usage?${q}`),
    ]);
    if (seq !== loadSeq.current) return true;
    if (usage.status === 'fulfilled') {
      setBytes(usage.value.bytes);
      setUsageFailed(false);
    } else {
      setBytes(null);
      setUsageFailed(true);
    }
    if (list.status === 'rejected') return false;
    setAccounts(list.value.accounts);
    return true;
  }, [client, q]);
  useEffect(() => {
    void load().then((ok) => { if (!ok) setError(LIST_FAILED); });
  }, [load]);

  const pcs = Object.values(state.characters).filter((c) => c.kind === 'pc');
  const nameOf = (id: string) => state.characters[id]?.name ?? 'Personagem removido';
  const taken = new Set(accounts.map((a) => a.characterId));
  const free = pcs.filter((c) => !taken.has(c.id));
  const selectedId = free.some((c) => c.id === characterId) ? characterId : (free[0]?.id ?? '');

  /** Roda a ação; falha do refetch depois de um sucesso não vira erro da ação. */
  const run = async (fn: () => Promise<unknown>, success?: string): Promise<boolean> => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(messageFor(e));
      setBusy(false);
      return false;
    }
    const refreshed = await load();
    setNotice(refreshed ? (success ?? null) : 'Feito, mas não foi possível atualizar a lista.');
    setBusy(false);
    return true;
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const name = username.trim().toLowerCase();
    if (!name || !selectedId) return;
    if (password.length < MIN_PASSWORD) {
      setNotice(null);
      return setError(SHORT_PASSWORD);
    }
    const ok = await run(() => client.post('/api/accounts', {
      campaignId, username: name, password, characterId: selectedId,
    }));
    setPassword('');
    if (ok) {
      setUsername('');
      setCharacterId('');
    }
  };

  const toggle = (a: Account) => run(() => client.patch('/api/accounts', { id: a.id, active: !a.active }));

  const resetPassword = async (a: Account) => {
    const next = window.prompt(`Nova senha para ${a.username}:`);
    if (!next) return;
    if (next.length < MIN_PASSWORD) {
      setNotice(null);
      return setError(SHORT_PASSWORD);
    }
    await run(() => client.patch('/api/accounts', { id: a.id, password: next }), 'Senha redefinida.');
  };

  return (
    <section className="accounts-panel">
      <h3>Contas dos jogadores</h3>
      {error && <p role="alert" className="form-error">{error}</p>}
      {notice && <p role="status" className="muted">{notice}</p>}
      {accounts.length === 0 && <p className="muted">Nenhuma conta ainda.</p>}
      <ul className="plain-list">
        {accounts.map((a) => (
          <li key={a.id} className="character-item">
            <strong>{a.username}</strong>
            <span className="muted"> {nameOf(a.characterId)} · {a.active ? 'ativa' : 'desativada'}</span>
            <div className="item-actions">
              <button type="button" disabled={busy} onClick={() => void toggle(a)}
                aria-label={`${a.active ? 'Desativar' : 'Reativar'} ${a.username}`}>
                {a.active ? 'Desativar' : 'Reativar'}
              </button>
              <button type="button" disabled={busy} onClick={() => void resetPassword(a)}
                aria-label={`Redefinir senha de ${a.username}`}>Redefinir senha</button>
            </div>
          </li>
        ))}
      </ul>

      <h3>Nova conta</h3>
      <form onSubmit={(e) => void create(e)}>
        <label>Usuário
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" required />
        </label>
        <label>Senha
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password" required />
        </label>
        <label>Personagem
          <select value={selectedId} onChange={(e) => setCharacterId(e.target.value)}
            disabled={free.length === 0}>
            {free.length === 0 && <option value="">Nenhum personagem livre</option>}
            {free.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <button type="submit" disabled={busy || free.length === 0}>Criar conta</button>
      </form>

      {bytes !== null && (
        <p className="muted">Armazenamento: {(bytes / 1024 / 1024).toFixed(1)} MB</p>
      )}
      {usageFailed && <p className="muted">Uso do armazenamento indisponível.</p>}
    </section>
  );
}
