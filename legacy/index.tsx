
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import PlayerMirror from './components/PlayerMirror';
import GmProtectedDashboard from './components/online/GmProtectedDashboard';
import GraphEditorDemo from './components/arsenal/graph/GraphEditorDemo';
import { LoginPage, PlayerOnlinePage, SetupPage } from './components/online/AccessPages';
import PlayerDashboard, { PlayerDashboardBoundary } from './components/online/PlayerDashboard';
import { injectThemeVars } from './utils/theme';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

injectThemeVars();

const view = new URLSearchParams(window.location.search).get('view');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {view === 'player' ? <PlayerMirror />
      : view === 'gm-dashboard' ? <GmProtectedDashboard />
      : view === 'graph-editor-demo' ? <GraphEditorDemo />
      : view === 'login' ? <LoginPage />
      : view === 'setup' ? <SetupPage />
      : view === 'player-online' ? <PlayerDashboardBoundary><PlayerDashboard /></PlayerDashboardBoundary>
      : <App />}
  </React.StrictMode>
);
