import React from 'react';
import { DatabaseService, SNAPSHOT_VERSION, type AppSnapshot } from '../../utils/database';
import { OnlineCampaign } from '../../online/campaignClient';
import { OnlineAccounts, type CampaignAccount } from '../../online/accountClient';
import { compactSnapshotForUpload } from '../../online/compactSnapshot';
import { OnlineActionRequests, type PendingActionRequest } from '../../online/actionRequestClient';

export default function OnlineSyncPanel() {
  const [revision, setRevision] = React.useState(0);
  const [onlineDate, setOnlineDate] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState('Consultando armazenamento online…');
  const [busy, setBusy] = React.useState(false);
  const [accounts, setAccounts] = React.useState<CampaignAccount[]>([]);
  const [characters, setCharacters] = React.useState<{ id: string; name: string }[]>([]);
  const [accessForm, setAccessForm] = React.useState({ characterId: '', username: '', password: '' });
  const [accessStatus, setAccessStatus] = React.useState('');
  const [requests, setRequests] = React.useState<PendingActionRequest[]>([]);
  const refresh = React.useCallback(async () => {
    try {
      const stored = await OnlineCampaign.load();
      setRevision(stored?.revision ?? 0); setOnlineDate(stored?.updated_at ?? null);
      if (stored) setCharacters(stored.data.characters.filter(character => (character.role ?? 'npc') === 'cast').map(character => ({ id: character.id, name: character.name })));
      setStatus(stored ? `Campanha online encontrada: ${stored.data.characters?.length ?? 0} personagem(ns), ${stored.data.grimoire?.length ?? 0} entrada(s) de arsenal e ${stored.data.abilityGraphs?.length ?? 0} habilidade(s) em grafo.` : 'Ainda não há dados online. Importe um backup para iniciar.');
    }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Falha ao consultar dados online.'); }
  }, []);
  const refreshAccounts = React.useCallback(async () => {
    try {
      const { accounts: found } = await OnlineAccounts.list();
      setAccounts(found);
    } catch (error) { setAccessStatus(error instanceof Error ? error.message : 'Falha ao carregar acessos.'); }
  }, []);
  const refreshRequests = React.useCallback(async () => { try { setRequests(await OnlineActionRequests.list()); } catch { /* o status principal já cobre falhas de conexão */ } }, []);
  React.useEffect(() => { void refresh(); void refreshAccounts(); void refreshRequests(); const timer = window.setInterval(refreshRequests, 3000); return () => window.clearInterval(timer); }, [refresh, refreshAccounts, refreshRequests]);
  const decideRequest = async (id: string, decision: 'approved' | 'rejected') => { setBusy(true); try { const result = await OnlineActionRequests.decide(id, decision); await refreshRequests(); setStatus(decision === 'approved' ? `${result.execution?.summary ?? 'Ação executada.'} Campanha atualizada na revisão ${result.execution?.revision ?? 'mais recente'}.` : 'Ação rejeitada.'); } catch (error) { setStatus(error instanceof Error ? error.message : 'Falha ao decidir solicitação.'); } finally { setBusy(false); } };
  const uploadLocal = async () => {
    if (!window.confirm('Enviar o estado local atual para o Supabase? O cache local será preservado.')) return;
    setBusy(true); setStatus('Preparando dados locais…');
    try {
      const data = await DatabaseService.initialize();
      const snapshot: AppSnapshot = { version: SNAPSHOT_VERSION, savedAt: new Date().toISOString(), ...data };
      const result = await OnlineCampaign.save(snapshot, revision);
      setRevision(result.revision); setOnlineDate(result.updatedAt); setStatus('Dados locais enviados com sucesso.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Falha ao enviar dados.'); }
    finally { setBusy(false); }
  };
  const createAccess = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setAccessStatus('Criando acesso…');
    try {
      await OnlineAccounts.create(accessForm);
      setAccessForm({ characterId: '', username: '', password: '' });
      setAccessStatus('Acesso criado com sucesso.');
      await refreshAccounts();
    } catch (error) { setAccessStatus(error instanceof Error ? error.message : 'Falha ao criar acesso.'); }
    finally { setBusy(false); }
  };
  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setStatus('Validando backup…');
    try {
      const snapshot = JSON.parse(await file.text()) as AppSnapshot;
      if (!snapshot || !Number.isInteger(snapshot.version) || !Array.isArray(snapshot.characters) || !snapshot.cena) throw new Error('O arquivo não é um backup válido do RPG Codex.');
      const compacted = compactSnapshotForUpload(snapshot);
      const result = await OnlineCampaign.save(compacted.snapshot, revision);
      setRevision(result.revision); setOnlineDate(result.updatedAt);
      setCharacters(compacted.snapshot.characters.filter(character => (character.role ?? 'npc') === 'cast').map(character => ({ id: character.id, name: character.name })));
      setStatus(`Backup importado: ${snapshot.characters.length} personagem(ns), ${snapshot.grimoire?.length ?? 0} entrada(s) de arsenal e ${snapshot.abilityGraphs?.length ?? 0} habilidade(s) em grafo. ${compacted.removedImages} imagem(ns) embutida(s) ficaram no backup local e serão migradas ao Storage separadamente.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Falha ao importar backup.'); }
    finally { setBusy(false); }
  };
  const assignedIds = new Set(accounts.filter(account => account.role === 'player').map(account => account.character_id));
  return <div style={{ maxWidth: 720, padding: 24, border: '1px solid rgba(217,183,110,.22)', borderRadius: 18, background: 'rgba(12,15,22,.88)' }}>
    <h2 style={{ margin: 0, color: '#e8d19b' }}>Persistência online</h2>
    <p style={{ color: '#9ca3af', lineHeight: 1.6 }}>O Supabase recebe uma cópia versionada da campanha e o armazenamento local continua intacto.</p>
    <p><strong>Revisão:</strong> {revision || 'Nenhuma'} · <strong>Atualização:</strong> {onlineDate ? new Date(onlineDate).toLocaleString('pt-BR') : '—'}</p>
    <p role="status" style={{ color: '#cbd5e1', minHeight: 20 }}>{status}</p>
    <section style={{ margin: '18px 0 24px', padding: 16, border: requests.length ? '1px solid #b7791f' : '1px solid rgba(255,255,255,.08)', borderRadius: 12, background: 'rgba(0,0,0,.2)' }}><h3 style={{ margin: '0 0 10px', color: '#e8d19b' }}>Solicitações de ação {requests.length ? `(${requests.length})` : ''}</h3>{requests.length ? <div style={{ display: 'grid', gap: 9 }}>{requests.map(request => <div key={request.id} style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: 11, borderRadius: 9, background: '#111827' }}><span><strong>{request.actorName}</strong> quer usar <strong>{request.actionName}</strong>{request.targetNames?.length ? <small style={{ display: 'block', color: '#d1b879' }}>Alvo(s): {request.targetNames.join(', ')}</small> : null}<small style={{ display: 'block', color: '#9ca3af' }}>{new Date(request.created_at).toLocaleTimeString('pt-BR')}</small></span><span style={{ display: 'flex', gap: 6 }}><button disabled={busy} onClick={() => decideRequest(request.id, 'rejected')} style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #ef4444', background: 'transparent', color: '#fca5a5' }}>REJEITAR</button><button disabled={busy} onClick={() => decideRequest(request.id, 'approved')} style={{ padding: '8px 10px', borderRadius: 7, border: 0, background: '#15803d', color: '#fff' }}>APROVAR</button></span></div>)}</div> : <p style={{ margin: 0, color: '#9ca3af' }}>Nenhum pedido pendente.</p>}</section>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <label style={{ padding: '12px 18px', borderRadius: 10, background: busy ? '#4b5563' : '#2563eb', color: '#fff', fontWeight: 900, cursor: busy ? 'wait' : 'pointer' }}>IMPORTAR ARQUIVO DE BACKUP<input type="file" accept="application/json,.json" onChange={importBackup} disabled={busy} style={{ display: 'none' }} /></label>
      <button onClick={uploadLocal} disabled={busy} style={{ padding: '12px 18px', borderRadius: 10, border: '1px solid #d9b76e', background: 'transparent', color: '#d9b76e', fontWeight: 900 }}>{busy ? 'ENVIANDO…' : 'ENVIAR CACHE DESTE NAVEGADOR'}</button>
    </div>
    <hr style={{ margin: '28px 0', border: 0, borderTop: '1px solid rgba(217,183,110,.18)' }} />
    <h2 style={{ color: '#e8d19b' }}>Acessos dos jogadores</h2>
    <p style={{ color: '#9ca3af' }}>Cada personagem pode ter exatamente um login, criado e controlado pelo mestre.</p>
    <form onSubmit={createAccess} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
      <label style={{ display: 'grid', gap: 5, fontSize: 11, color: '#9ca3af' }}>PERSONAGEM<select value={accessForm.characterId} onChange={e => setAccessForm({ ...accessForm, characterId: e.target.value })} required style={{ padding: 10, background: '#090b10', color: '#fff', border: '1px solid #374151', borderRadius: 8 }}><option value="">Selecione…</option>{characters.filter(character => !assignedIds.has(character.id)).map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
      <label style={{ display: 'grid', gap: 5, fontSize: 11, color: '#9ca3af' }}>USUÁRIO<input value={accessForm.username} onChange={e => setAccessForm({ ...accessForm, username: e.target.value.toLowerCase() })} pattern="[a-z0-9][a-z0-9_-]{2,31}" required style={{ padding: 10, background: '#090b10', color: '#fff', border: '1px solid #374151', borderRadius: 8 }} /></label>
      <label style={{ display: 'grid', gap: 5, fontSize: 11, color: '#9ca3af' }}>SENHA<input type="password" minLength={8} value={accessForm.password} onChange={e => setAccessForm({ ...accessForm, password: e.target.value })} required style={{ padding: 10, background: '#090b10', color: '#fff', border: '1px solid #374151', borderRadius: 8 }} /></label>
      <button disabled={busy} style={{ padding: '11px 14px', borderRadius: 8, border: 0, background: '#2563eb', color: '#fff', fontWeight: 900 }}>CRIAR</button>
    </form>
    <p role="status" style={{ minHeight: 20, color: '#cbd5e1' }}>{accessStatus}</p>
    <div style={{ display: 'grid', gap: 8 }}>{accounts.filter(account => account.role === 'player').map(account => <div key={account.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, border: '1px solid rgba(255,255,255,.08)', borderRadius: 9 }}><span><strong>{characters.find(character => character.id === account.character_id)?.name ?? 'Personagem'}</strong> · {account.username}</span><span style={{ color: account.active ? '#86efac' : '#fca5a5' }}>{account.active ? 'ATIVO' : 'INATIVO'}</span></div>)}</div>
  </div>;
}
