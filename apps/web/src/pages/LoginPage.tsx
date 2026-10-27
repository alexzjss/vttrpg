import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { createTransport, type Transport } from '../net/transport';
import { setSession } from '../session/session';

interface Props {
  transportFactory?: () => Transport;
}

type Pc = [id: string, name: string];

export function LoginPage({ transportFactory = createTransport }: Props) {
  const navigate = useNavigate();
  const [pcs, setPcs] = useState<Pc[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let transport: Transport | null = null;
    // Modo local (fase 1): listar os PCs exige uma conexão temporária como gm.
    // Aceitável só porque a campanha é local; na fase 2 a lista vira endpoint autenticado.
    (async () => {
      try {
        transport = transportFactory();
        const state = await transport.connect({ role: 'gm' });
        const lista: Pc[] = Object.entries(state.characters)
          .filter(([, c]) => c.kind === 'pc')
          .map(([id, c]) => [id, c.name]);
        if (!cancelled) setPcs(lista);
      } catch {
        if (!cancelled) setErro('Não foi possível carregar os personagens.');
      } finally {
        transport?.close();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transportFactory]);

  const entrarMestre = () => {
    setSession({ role: 'gm' });
    navigate('/mestre');
  };

  const entrarJogador = (characterId: string) => {
    setSession({ role: 'player', characterId });
    navigate('/jogador');
  };

  return (
    <main>
      <h1>VTT</h1>
      <p>Mesa virtual, modo local.</p>

      <section>
        <h2>Mestre</h2>
        <button type="button" onClick={entrarMestre}>
          Entrar como Mestre
        </button>
      </section>

      <section>
        <h2>Entrar como jogador</h2>
        {erro && <p role="alert">{erro}</p>}
        {!erro && pcs === null && <p>Carregando personagens…</p>}
        {pcs?.length === 0 && <p>Nenhum personagem jogador criado ainda.</p>}
        {pcs?.map(([id, name]) => (
          <button key={id} type="button" onClick={() => entrarJogador(id)}>
            {name}
          </button>
        ))}
      </section>
    </main>
  );
}
