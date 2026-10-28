import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { emailForUsername, type Actor } from '@vtt/core';
import { ApiError } from '../net/api';
import { createAuthedApi, type Me } from '../net/authedApi';
import { getSupabase } from '../net/supabase';
import { awaitPendingLogout } from '../session/logout';
import { clearSession, setSession } from '../session/session';

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
    clearSession(); // nunca herda a sessão de outro usuário
    try {
      await awaitPendingLogout();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailForUsername(username.trim().toLowerCase()),
        password,
      });
      if (authError) {
        const credential = authError.status === 400 || authError.code === 'invalid_credentials';
        return setError(credential ? 'Usuário ou senha incorretos.' : 'Não foi possível entrar agora. Tente de novo.');
      }

      let me: Me;
      try {
        me = await createAuthedApi().get<Me>('/api/me');
      } catch (err) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        return setError(
          err instanceof ApiError && err.status === 403
            ? 'Esta conta está desativada ou sem acesso.'
            : 'Não foi possível entrar agora. Tente novamente.',
        );
      }

      if (me.role === 'gm') return navigate('/campanhas');
      if (!me.campaignId || !me.characterId) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        return setError('Esta conta ainda não tem personagem em uma campanha.');
      }
      const actor: Actor = { role: 'player', characterId: me.characterId };
      if (!setSession({ mode: 'online', actor, campaignId: me.campaignId, username: me.username })) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
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
