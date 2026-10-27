import React from 'react';
import GmDashboardWindow from '../gmDashboard/GmDashboardWindow';
import { OnlineAuth } from '../../online/authClient';
import { OnlineCampaign } from '../../online/campaignClient';
import { DatabaseService, SNAPSHOT_VERSION, type AppSnapshot } from '../../utils/database';

function installOnlineSync(initialRevision: number, onStatus: (value: string) => void) {
  let revision = initialRevision, applyingRemote = false, saving = false, dirty = false;
  let saveTimer: number | undefined;
  const makeSnapshot = async (): Promise<AppSnapshot> => ({ version: SNAPSHOT_VERSION, savedAt: new Date().toISOString(), ...(await DatabaseService.initialize()) });
  const schedule = () => { if (applyingRemote) return; dirty = true; window.clearTimeout(saveTimer); saveTimer = window.setTimeout(flush, 800); };
  const flush = async () => {
    if (applyingRemote || saving || !dirty) return;
    saving = true; dirty = false; onStatus('Salvando alterações…');
    try { const result = await OnlineCampaign.save(await makeSnapshot(), revision); revision = Number(result.revision); onStatus('Campanha sincronizada'); }
    catch (error) {
      try {
        const latest = await OnlineCampaign.load();
        if (latest) {
          applyingRemote = true;
          await DatabaseService.saveFullSnapshot(latest.data);
          revision = Number(latest.revision);
          applyingRemote = false;
          onStatus('Estado mais recente recebido');
        }
      } catch {
        applyingRemote = false;
        onStatus(error instanceof Error ? error.message : 'Falha na sincronização');
      }
    }
    finally { saving = false; if (dirty) schedule(); }
  };
  const options = { emitInitial: false };
  const unsubscribers = [
    DatabaseService.syncCharacters(schedule, options), DatabaseService.syncCards(schedule, options), DatabaseService.syncItems(schedule, options),
    DatabaseService.syncSeals(schedule, options), DatabaseService.syncWeapons(schedule, options), DatabaseService.syncGrimoire(schedule, options),
    DatabaseService.syncAbilityGraphs(schedule, options), DatabaseService.syncCombatState(schedule, options), DatabaseService.syncJourneyState(schedule, options), DatabaseService.syncCenaState(schedule, options),
  ];
  const poll = window.setInterval(async () => {
    if (saving || dirty || applyingRemote || document.visibilityState !== 'visible') return;
    try {
      const stored = await OnlineCampaign.load();
      if (stored && Number(stored.revision) > revision) {
        applyingRemote = true;
        await DatabaseService.saveFullSnapshot(stored.data);
        revision = Number(stored.revision);
        applyingRemote = false;
        onStatus('Alterações dos jogadores recebidas');
      }
    } catch { /* tenta novamente na próxima consulta */ }
  }, 2000);
  return () => { window.clearInterval(poll); window.clearTimeout(saveTimer); unsubscribers.forEach(unsubscribe => unsubscribe()); };
}

export default function GmProtectedDashboard() {
  const [allowed, setAllowed] = React.useState<boolean | null>(null);
  const [message, setMessage] = React.useState('Verificando acesso do mestre…');
  const [syncStatus, setSyncStatus] = React.useState('');
  React.useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') { setAllowed(true); return; }
    OnlineAuth.session().then(async ({ session }) => {
      if (session?.role !== 'gm') return location.assign('/?view=login');
      setMessage('Sincronizando a campanha…');
      const stored = await OnlineCampaign.load();
      if (stored?.data) await DatabaseService.saveFullSnapshot(stored.data);
      if (cancelled) return;
      stop = installOnlineSync(Number(stored?.revision ?? 0), setSyncStatus);
      setAllowed(true);
    }).catch(error => { console.error(error); setMessage('Não foi possível sincronizar a campanha. Recarregue a página.'); });
    return () => { cancelled = true; stop?.(); };
  }, []);
  if (allowed !== true) return <div role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#090b10', color: '#aab2c0' }}>{message}</div>;
  return <><GmDashboardWindow /><div title="Estado da sincronização online" style={{ position: 'fixed', right: 14, bottom: 12, zIndex: 9999, padding: '6px 9px', borderRadius: 8, background: 'rgba(8,11,18,.88)', border: '1px solid rgba(217,183,110,.25)', color: '#aeb8c7', fontSize: 10 }}>{syncStatus || 'Online'}</div></>;
}
