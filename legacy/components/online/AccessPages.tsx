import React from 'react';
import { OnlineAuth } from '../../online/authClient';

const shell: React.CSSProperties = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'radial-gradient(circle at top, #241c2b 0, #0a0d14 55%)', color: '#f8fafc' };
const card: React.CSSProperties = { width: 'min(440px, 100%)', padding: 32, borderRadius: 24, background: 'rgba(18,22,32,.96)', border: '1px solid rgba(201,152,58,.35)', boxShadow: '0 24px 80px rgba(0,0,0,.55)' };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '13px 15px', borderRadius: 12, border: '1px solid #374151', background: '#0b0f17', color: '#fff', fontSize: 15, outline: 'none' };
const label: React.CSSProperties = { display: 'grid', gap: 7, color: '#aab2c0', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' };
const submit: React.CSSProperties = { width: '100%', padding: '14px 18px', border: 0, borderRadius: 12, background: '#b7791f', color: '#fff', fontWeight: 900, cursor: 'pointer', letterSpacing: '.06em' };

function AccessCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <main style={shell}><section style={card}>
    <div style={{ color: '#d2a64c', fontSize: 11, fontWeight: 900, letterSpacing: '.22em', marginBottom: 8 }}>{eyebrow}</div>
    <h1 style={{ margin: '0 0 8px', fontFamily: 'Cinzel, serif', fontSize: 28 }}>{title}</h1>
    <p style={{ margin: '0 0 26px', color: '#8993a3', lineHeight: 1.55 }}>Acesso privado da sua mesa. Nenhum cadastro público é permitido.</p>
    {children}
  </section></main>;
}

export function LoginPage() {
  const [form, setForm] = React.useState({ campaign: '', username: '', password: '' });
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const { session } = await OnlineAuth.login(form);
      window.location.assign(session.role === 'gm' ? '/?view=gm-dashboard' : '/?view=player-online');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha no acesso.'); }
    finally { setBusy(false); }
  };
  return <AccessCard eyebrow="RPG CODEX" title="Entrar na mesa">
    <form onSubmit={submitLogin} style={{ display: 'grid', gap: 16 }}>
      <label style={label}>Mesa<input style={input} autoComplete="organization" value={form.campaign} onChange={e => setForm({ ...form, campaign: e.target.value })} placeholder="nome-da-mesa" required /></label>
      <label style={label}>Usuário<input style={input} autoComplete="username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required /></label>
      <label style={label}>Senha<input style={input} type="password" autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></label>
      {error && <p role="alert" style={{ margin: 0, color: '#fca5a5', fontSize: 13 }}>{error}</p>}
      <button style={{ ...submit, opacity: busy ? .6 : 1 }} disabled={busy}>{busy ? 'ENTRANDO…' : 'ENTRAR'}</button>
    </form>
  </AccessCard>;
}

export function SetupPage() {
  const [form, setForm] = React.useState({ setupSecret: '', campaignName: '', campaign: '', username: '', password: '' });
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const updateName = (campaignName: string) => setForm(current => ({ ...current, campaignName, campaign: campaignName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) }));
  const submitSetup = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/setup/bootstrap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Falha na instalação.');
      window.location.assign(`/?view=login&campaign=${encodeURIComponent(form.campaign)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha na instalação.'); }
    finally { setBusy(false); }
  };
  return <AccessCard eyebrow="CONFIGURAÇÃO INICIAL" title="Criar a mesa">
    <form onSubmit={submitSetup} style={{ display: 'grid', gap: 14 }}>
      <label style={label}>Chave de instalação<input style={input} type="password" value={form.setupSecret} onChange={e => setForm({ ...form, setupSecret: e.target.value })} required /></label>
      <label style={label}>Nome da mesa<input style={input} value={form.campaignName} onChange={e => updateName(e.target.value)} placeholder="Crônicas de Vatra" required /></label>
      <label style={label}>Código da mesa<input style={input} value={form.campaign} onChange={e => setForm({ ...form, campaign: e.target.value.toLowerCase() })} pattern="[a-z0-9][a-z0-9-]{2,48}" required /></label>
      <label style={label}>Usuário do mestre<input style={input} autoComplete="username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })} pattern="[a-z0-9][a-z0-9_-]{2,31}" required /></label>
      <label style={label}>Senha do mestre<input style={input} type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></label>
      {error && <p role="alert" style={{ margin: 0, color: '#fca5a5', fontSize: 13 }}>{error}</p>}
      <button style={{ ...submit, opacity: busy ? .6 : 1 }} disabled={busy}>{busy ? 'CRIANDO…' : 'CRIAR MESA'}</button>
    </form>
  </AccessCard>;
}

export function PlayerOnlinePage() {
  const [message, setMessage] = React.useState('Verificando acesso…');
  React.useEffect(() => { OnlineAuth.session().then(({ session }) => {
    if (!session) return window.location.assign('/?view=login');
    setMessage(`Conectado como ${session.username}. A visão do personagem será ativada na próxima etapa.`);
  }).catch(() => window.location.assign('/?view=login')); }, []);
  return <AccessCard eyebrow="ÁREA DO JOGADOR" title="Acesso confirmado"><p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>{message}</p></AccessCard>;
}
