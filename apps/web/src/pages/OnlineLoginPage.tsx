import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { emailForUsername, type Actor } from '@vtt/core';
import { ApiError } from '../net/api';
import { createAuthedApi } from '../net/authedApi';
import { getSupabase } from '../net/supabase';
import { setSession } from '../session/session';

export interface Me {
  username: string;
  role: 'gm' | 'player';
  campaignId: string | null;
  characterId: string | null;
}

export function OnlineLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailForUsername(username.trim().toLowerCase()),
        password,
      });
      if (authError) return setError('Usuário ou senha incorretos.');

      let me: Me;
      try {
        me = await createAuthedApi().get<Me>('/api/me');
      } catch (err) {
        await supabase.auth.signOut().catch(() => undefined);
        return setError(
          err instanceof ApiError && err.status === 403
            ? 'Esta conta está desativada ou sem acesso.'
            : 'Não foi possível entrar agora. Tente novamente.',
        );
      }

      if (me.role === 'gm') return navigate('/campanhas');
      if (!me.campaignId || !me.characterId) {
        await supabase.auth.signOut().catch(() => undefined);
        return setError('Esta conta ainda não tem personagem em uma campanha.');
      }
      const actor: Actor = { role: 'player', characterId: me.characterId };
      if (!setSession({ mode: 'online', actor, campaignId: me.campaignId, username: me.username })) {
        return setError('Não foi possível salvar a sessão neste navegador.');
      }
      navigate('/jogador');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <h1>VTT</h1>
      <form onSubmit={(e) => void submit(e)}>
        <label>
          Usuário
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Senha
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy}>Entrar</button>
      </form>
    </main>
  );
}
