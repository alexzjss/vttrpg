import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { createTransport, type Session, type Transport } from '../net/transport';
import { setSession } from '../session/session';

interface Props {
  transportFactory?: (session: Session) => Transport;
}

type Pc = [id: string, name: string];

export function LoginPage({ transportFactory = createTransport }: Props) {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Pc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let transport: Transport | null = null;
    // Modo local (fase 1): listar os PCs exige uma conexão temporária como gm.
    // Aceitável só porque a campanha é local; na fase 2 a lista vira endpoint autenticado.
    (async () => {
      try {
        const probe: Session = { mode: 'local', actor: { role: 'gm' } };
        transport = transportFactory(probe);
        const state = await transport.connect(probe);
        const list: Pc[] = Object.entries(state.characters)
          .filter(([, c]) => c.kind === 'pc')
          .map(([id, c]) => [id, c.name]);
        if (!cancelled) setCharacters(list);
      } catch {
        if (!cancelled) setError('Não foi possível carregar os personagens.');
      } finally {
        transport?.close();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transportFactory]);

  const enterAsGm = () => {
    if (!setSession({ mode: 'local', actor: { role: 'gm' } })) return setSaveFailed(true);
    navigate('/mestre');
  };

  const enterAsPlayer = (characterId: string) => {
    if (!setSession({ mode: 'local', actor: { role: 'player', characterId } })) return setSaveFailed(true);
    navigate('/jogador');
  };

  return (
    <main className="login-page">
      <h1>VTT</h1>
      <p>Mesa virtual, modo local.</p>
      {saveFailed && <p role="alert">Não foi possível salvar a sessão neste navegador.</p>}

      <section>
        <h2>Mestre</h2>
        <button type="button" onClick={enterAsGm}>
          Entrar como Mestre
        </button>
      </section>

      <section>
        <h2>Entrar como jogador</h2>
        {error && <p role="alert">{error}</p>}
        {!error && characters === null && <p>Carregando personagens…</p>}
        {characters?.length === 0 && <p>Nenhum personagem jogador criado ainda.</p>}
        {characters?.map(([id, name]) => (
          <button key={id} type="button" onClick={() => enterAsPlayer(id)}>
            {name}
          </button>
        ))}
      </section>
    </main>
  );
}
