import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../net/api';
import { createAuthedApi, type Me } from '../net/authedApi';
import { setSession } from '../session/session';
import { logout } from '../session/logout';

interface CampaignItem {
  id: string;
  name: string;
}

export function CampaignPickerPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignItem[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const api = createAuthedApi();
    (async () => {
      try {
        const who = await api.get<Me>('/api/me');
        if (who.role !== 'gm') {
          if (!cancelled) navigate('/login', { replace: true });
          return;
        }
        const list = await api.get<{ campaigns: CampaignItem[] }>('/api/campaigns');
        if (!cancelled) {
          setMe(who);
          setCampaigns(list.campaigns);
        }
      } catch {
        // sem login válido (ou falha de rede): volta ao login
        if (!cancelled) navigate('/login', { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const enter = (campaignId: string) => {
    if (!me) return;
    if (!setSession({ mode: 'online', actor: { role: 'gm' }, campaignId, username: me.username })) {
      return setError('Não foi possível salvar a sessão neste navegador.');
    }
    navigate('/mestre');
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const { campaign } = await createAuthedApi().post<{ campaign: CampaignItem }>('/api/campaigns', {
        name: name.trim(),
      });
      enter(campaign.id);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 400
          ? 'Use um nome de 1 a 80 caracteres.'
          : 'Não foi possível criar a campanha agora.',
      );
    }
  };

  const leave = () => {
    void logout();
    navigate('/login');
  };

  if (!campaigns) return <main className="login-page"><p>Carregando campanhas…</p></main>;
  return (
    <main className="login-page">
      <h1>Campanhas</h1>
      {error && <p role="alert">{error}</p>}
      {campaigns.length === 0 && <p>Nenhuma campanha criada ainda.</p>}
      {campaigns.map((c) => (
        <button key={c.id} type="button" onClick={() => enter(c.id)}>{c.name}</button>
      ))}
      <form onSubmit={(e) => void create(e)}>
        <label>
          Nome da campanha
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </label>
        <button type="submit">Nova campanha</button>
      </form>
      <button type="button" onClick={leave}>Sair</button>
    </main>
  );
}
