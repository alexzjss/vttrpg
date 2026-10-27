import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router';
import { RequireSession } from './components/RequireSession';
import { GameProvider } from './components/GameProvider';
import { LoginPage } from './pages/LoginPage';
import { MestrePage } from './pages/MestrePage';
import { JogadorPage } from './pages/JogadorPage';
import { MesaPage } from './pages/MesaPage';
import { getSession } from './session/session';
import type { Transport } from './net/transport';

function HomeRedirect() {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={session.role === 'gm' ? '/mestre' : '/jogador'} replace />;
}

interface Props {
  /** Só para testes: troca o transporte padrão (SharedWorker). */
  transportFactory?: () => Transport;
}

export function AppRoutes({ transportFactory }: Props) {
  // O papel é checado antes do GameProvider, para que um jogador em /mestre
  // seja redirecionado sem nunca conectar como gm.
  const game = (children: ReactNode) => (
    <GameProvider transportFactory={transportFactory}>{children}</GameProvider>
  );
  return (
    <Routes>
      <Route path="/login" element={<LoginPage transportFactory={transportFactory} />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route
        element={<RequireSession role="gm">{game(<Outlet />)}</RequireSession>}
      >
        <Route path="/mestre" element={<MestrePage />} />
      </Route>
      <Route
        element={<RequireSession role="player">{game(<Outlet />)}</RequireSession>}
      >
        <Route path="/jogador" element={<JogadorPage />} />
      </Route>
      <Route
        element={<RequireSession>{game(<Outlet />)}</RequireSession>}
      >
        <Route path="/mesa" element={<MesaPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
