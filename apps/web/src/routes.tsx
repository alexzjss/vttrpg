import { Navigate, Outlet, Route, Routes } from 'react-router';
import { RequireSession } from './components/RequireSession';
import { GameProvider } from './components/GameProvider';
import { LoginPage } from './pages/LoginPage';
import { MestrePage } from './pages/MestrePage';
import { JogadorPage } from './pages/JogadorPage';
import { MesaPage } from './pages/MesaPage';
import { getSession } from './session/session';

function HomeRedirect() {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={session.role === 'gm' ? '/mestre' : '/jogador'} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomeRedirect />} />
      {/* Uma conexão por aba: este layout fica montado entre /mestre, /jogador e /mesa. */}
      <Route
        element={
          <RequireSession>
            <GameProvider>
              <Outlet />
            </GameProvider>
          </RequireSession>
        }
      >
        <Route path="/mestre" element={<RequireSession role="gm"><MestrePage /></RequireSession>} />
        <Route path="/jogador" element={<RequireSession role="player"><JogadorPage /></RequireSession>} />
        <Route path="/mesa" element={<MesaPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
