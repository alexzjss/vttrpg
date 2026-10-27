import React from 'react';
import { Check, Clock3, LogOut, RefreshCw, ScrollText, Shield, Sparkles, Wifi, X } from 'lucide-react';
import type { Character } from '../../types';
import { OnlineAuth } from '../../online/authClient';
import { PlayerOnline } from '../../online/playerClient';
import type { PlayerActionView, PlayerCampaignView, PublicParticipant } from '../../online/playerView';
import SceneBackdrop from '../../tabs/cena/SceneBackdrop';
import PauseCurtain from '../../tabs/cena/PauseCurtain';
import MapBoard from '../../tabs/cena/MapBoard';
import RosterPanel from '../../tabs/cena/RosterPanel';
import ActionMenu from '../../tabs/cena/ActionMenu';
import LogPanel from '../../tabs/cena/LogPanel';
import FieldEffectsBar from '../../tabs/cena/FieldEffectsBar';
import { actorActions, type ActionCategory, type ResolvedAction } from '../../utils/actions';
import { resolveCards, resolveOwnedItems, resolveSeals, resolveWeapons } from '../../utils/items';
import { isReactionCard } from '../../utils/arsenalState';
import './PlayerDashboard.css';

type RequestItem = { id: string; action_id: string; status: string; created_at: string };

const needsTarget = (action: PlayerActionView) => action.requiresAim || action.target.type === 'um_alvo' || action.target.type === 'multiplos_alvos';
const actionTags = (action: PlayerActionView) => Array.isArray(action.tags) ? action.tags : [];
const isReaction = (action: PlayerActionView) => actionTags(action).some(tag => /rea[cç][aã]o/i.test(tag));
const resolvedIsReaction = (action: ResolvedAction) => !!action.arsenalCard && isReactionCard(action.arsenalCard)
  || !!action.abilityGraph?.header?.tags?.some(tag => /rea[cç][aã]o/i.test(String(tag)));
const playerActionOf = (action: ResolvedAction): PlayerActionView => {
  const graph = action.abilityGraph;
  const nodes = Array.isArray(graph?.nodes) ? graph!.nodes : [];
  return {
    id: action.id, name: action.name, description: action.description ?? '', image: action.image,
    icon: action.image ?? '', category: action.category, tags: [...(action.arsenalCard?.tags?.map(String) ?? graph?.header?.tags?.map(String) ?? []), ...(resolvedIsReaction(action) ? ['reação'] : [])],
    target: action.arsenalCard?.target ?? graph?.header?.target ?? { type: action.targeting === 'self' ? 'proprio_usuario' : 'um_alvo' },
    requiresAim: nodes.some(node => node.type === 'alvo' && ['linha', 'cone'].includes(String((node.props as any)?.scope))),
    requiresSecondaryTarget: nodes.some(node => node.type === 'alvo' && (node.props as any)?.scope === 'escolha'),
    requiresDestination: nodes.some(node => node.type === 'mover' && (node.props as any)?.kind === 'teleportar'),
  } as PlayerActionView;
};

function asMapCharacter(person: PublicParticipant, masked = false): Character {
  const resource = person as any;
  return {
    ...person,
    currentHp: masked ? 1 : resource.currentHp ?? 1,
    maxHp: masked ? 1 : resource.maxHp ?? 1,
    currentAura: resource.currentAura ?? 0,
    maxAura: resource.maxAura ?? 0,
    currentAmmo: resource.currentAmmo ?? 0,
    maxAmmo: resource.maxAmmo ?? 0,
    baseInitiative: resource.baseInitiative ?? 0,
  } as Character;
}

export default function PlayerDashboard() {
  const [view, setView] = React.useState<PlayerCampaignView | null>(null);
  const [requests, setRequests] = React.useState<RequestItem[]>([]);
  const [notice, setNotice] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [moving, setMoving] = React.useState(false);
  const [requesting, setRequesting] = React.useState(false);
  const [armed, setArmed] = React.useState<PlayerActionView | null>(null);
  const [targets, setTargets] = React.useState<string[]>([]);
  const [secondary, setSecondary] = React.useState('');
  const [destination, setDestination] = React.useState({ x: 50, y: 50 });
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [logOpen, setLogOpen] = React.useState(false);

  const load = React.useCallback(async (quiet = false) => {
    try {
      const [state, history] = await Promise.all([PlayerOnline.state(), PlayerOnline.actionRequests()]);
      setView(state); setRequests(history);
      if (!quiet) setNotice('');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao carregar a mesa.'); }
  }, []);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => document.visibilityState === 'visible' && void load(true), 2500);
    return () => window.clearInterval(timer);
  }, [load]);

  if (!view) return <main className="pd-loading"><span className="pd-loader" /><h1>Preparando sua mesa</h1><p>{notice || 'Sincronizando personagem e cena…'}</p></main>;

  const publicPeople: PublicParticipant[] = [{ ...view.character, position: view.position }, ...view.allies, ...view.enemies];
  const enemyIds = view.enemies.map(person => person.id);
  const participants = publicPeople.map(person => asMapCharacter(person, enemyIds.includes(person.id)));
  const tokens = Object.fromEntries(publicPeople.filter(person => person.position).map(person => [person.id, person.position! ]));
  const actionAllowed = (action: PlayerActionView) => view.permissions.canAct || (isReaction(action) && view.permissions.canReact && !view.encounter.isPaused);
  const targetableIds = armed && actionAllowed(armed) && needsTarget(armed) ? publicPeople.map(person => person.id) : [];
  const pending = requests.filter(item => item.status === 'pending').length;
  const actions = (Array.isArray(view.actions) ? view.actions : []).filter(action => !search || `${action.name} ${actionTags(action).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const resolvedActions = actorActions({
    cards: resolveCards(view.character as Character, view.arsenalData.cards),
    seals: resolveSeals(view.character as Character, view.arsenalData.seals),
    weapons: resolveWeapons(view.character as Character, view.arsenalData.weapons),
    items: resolveOwnedItems(view.character as Character, view.arsenalData.items),
    arsenalCards: view.arsenalData.arsenalCards,
    abilityGraphs: view.arsenalData.abilityGraphs.map(graph => ({ graph, level: view.arsenalData.holdings.find(holding => holding.cardId === graph.id)?.maxLevel ?? 1 })),
  });
  const menuActions = (Object.keys(resolvedActions) as ActionCategory[]).reduce<Record<ActionCategory, ResolvedAction[]>>((out, category) => {
    out[category] = resolvedActions[category].filter(action => view.permissions.canAct || (view.permissions.canReact && resolvedIsReaction(action)));
    return out;
  }, { atacar: [], habilidade: [], item: [] });

  const selectToken = (id: string) => {
    if (!armed || !needsTarget(armed) || !actionAllowed(armed)) return;
    if (armed.target.type === 'multiplos_alvos' && !armed.requiresAim) {
      setTargets(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id].slice(0, armed.target.maxTargets));
    } else setTargets([id]);
  };
  const moveToken = async (id: string, pos: { x: number; y: number }) => {
    if (id !== view.character.id || !view.permissions.canMove || moving) return;
    setMoving(true);
    try { await PlayerOnline.move(pos.x, pos.y, view.revision); await load(true); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível mover o token.'); }
    finally { setMoving(false); }
  };
  const arm = (action: PlayerActionView) => {
    if (!actionAllowed(action)) return;
    setArmed(current => current?.id === action.id ? null : action); setTargets([]); setSecondary('');
  };
  const sendAction = async () => {
    if (!armed || requesting || !actionAllowed(armed) || (needsTarget(armed) && !targets.length)) return;
    setRequesting(true);
    try {
      await PlayerOnline.requestAction(armed.id, targets, secondary || undefined, armed.requiresDestination ? destination : undefined);
      setNotice(`${armed.name} foi enviada ao mestre.`); setArmed(null); setTargets([]); await load(true);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível solicitar a ação.'); }
    finally { setRequesting(false); }
  };

  const turnText = !view.encounter.isActive ? 'EXPLORAÇÃO LIVRE' : view.permissions.isOwnTurn ? 'SEU TURNO' : 'AGUARDANDO TURNO';
  return <main className={`cena-shell player-scene is-combat ${view.scene.isNight ? 'is-night' : ''}`} style={{ height: '100dvh', minHeight: '100dvh' }}>
    <SceneBackdrop image={view.scene.image} imagePosition={view.scene.imagePosition} combat={view.encounter.isActive} />
    <PauseCurtain isPaused={view.encounter.isPaused} image={view.scene.pausedImage || view.scene.image} imagePosition={view.scene.pausedImagePosition || view.scene.imagePosition} participants={participants} display={view.scene.pausedDisplay} />

    <header className="player-scene__bar">
      <div><Sparkles size={16}/><span><small>{view.scene.subtitle || 'CENA ATUAL'}</small><strong>{view.scene.locationName}</strong></span></div>
      <b className={view.permissions.isOwnTurn ? 'is-own' : ''}>{turnText}{view.encounter.isActive && ` · RODADA ${view.encounter.round}`}</b>
      <nav><span><Wifi size={13}/> AO VIVO</span><button title="Atualizar" onClick={() => load()}><RefreshCw size={16}/></button><button title="Sair" onClick={() => OnlineAuth.logout().finally(() => window.location.assign('/?view=login'))}><LogOut size={16}/></button></nav>
    </header>

    {notice && <div className="player-scene__notice">{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div>}
    {armed && <div className="player-scene__aim"><CrosshairIcon/><span><small>AÇÃO PREPARADA</small><strong>{armed.name}</strong><em>{needsTarget(armed) ? targets.length ? `${targets.length} alvo(s) marcado(s)` : 'Selecione no mapa' : 'Pronta para enviar'}</em></span></div>}

    <button className={`cena-journal-tab ${logOpen ? 'is-open' : ''}`} onClick={() => setLogOpen(value => !value)} aria-label={logOpen ? 'Fechar diário de combate' : 'Abrir diário de combate'}><ScrollText size={18}/><span>DIÁRIO</span></button>
    <div className={`cena-journal-drawer ${logOpen ? 'is-open' : ''}`} aria-hidden={!logOpen}><LogPanel log={view.encounter.log} notes="" onNotesChange={() => {}} streamingMode readOnly /></div>

    <section className="cena-arena-column player-scene__arena">
      <FieldEffectsBar effects={view.encounter.fieldEffects} />
      <div className="cena-arena-stage">
        <MapBoard image={view.scene.image} imagePosition={view.scene.imagePosition} participants={participants} tokens={tokens} activeId={view.encounter.currentTurnId} combat={view.encounter.isActive} enemyIds={enemyIds} movableIds={view.permissions.canMove ? [view.character.id] : []} maskEnemyResources targetableIds={targetableIds} selectedTargetId={targets[0] ?? null} areaPreviewIds={targets.slice(1)} onMoveToken={moveToken} onSelect={selectToken}/>
      </div>
    </section>

    <aside className="cena-command-deck player-deck">
      <section className="cena-deck-roster"><RosterPanel party={[asMapCharacter({ ...view.character, position: view.position }), ...view.allies.map(ally => asMapCharacter(ally))]} npcRoster={view.enemies.map(enemy => ({ ...asMapCharacter(enemy, true), present: true, hidden: false })) as any} active={{ id: view.character.id, side: 'party' }} currentTurnId={view.encounter.currentTurnId} round={view.encounter.isActive ? view.encounter.round : undefined} orderIds={view.encounter.order.map(entry => entry.refId)} onSelectActive={ref => selectToken(ref.id)} onToggleHidden={() => {}} onTogglePresent={() => {}} onRemoveNpc={() => {}} turnControlsDisabled={view.encounter.isPaused} streamingMode playerMode /></section>
      <section className="cena-deck-actions"><ActionMenu actions={menuActions} onSelectAction={action => arm(playerActionOf(action))} arsenalWeapons={view.arsenalData.arsenalCards.filter(card => card.category === 'arma')} equippedWeaponId={view.arsenalData.holdings.find(holding => holding.equipped)?.cardId ?? null} holdings={view.arsenalData.holdings} preparations={view.arsenalData.preparations} /></section>
      {armed && <section className="player-deck__confirm">
        <p>{armed.description || 'Sem descrição.'}</p>
        {armed.requiresSecondaryTarget && <label>SEGUNDO ALVO<select value={secondary} onChange={e => setSecondary(e.target.value)}><option value="">Selecione…</option>{publicPeople.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>}
        {armed.requiresDestination && <label>DESTINO<div><input type="number" min="0" max="100" value={destination.x} onChange={e => setDestination({...destination,x:Number(e.target.value)})}/><input type="number" min="0" max="100" value={destination.y} onChange={e => setDestination({...destination,y:Number(e.target.value)})}/></div></label>}
        <button disabled={requesting || (needsTarget(armed) && !targets.length) || (armed.requiresSecondaryTarget && !secondary)} onClick={sendAction}><Check size={16}/>{requesting ? 'ENVIANDO…' : 'SOLICITAR AO MESTRE'}</button>
      </section>}
      <button className="player-deck__history" onClick={() => setHistoryOpen(value => !value)}><Clock3 size={15}/> HISTÓRICO {pending > 0 && <b>{pending}</b>}</button>
      {historyOpen && <section className="player-deck__history-list">{requests.slice(0,8).map(item => <div key={item.id} className={`is-${item.status}`}><span>{view.actions.find(action => action.id === item.action_id)?.name || 'Ação'}</span><b>{item.status === 'approved' ? 'APROVADA' : item.status === 'rejected' ? 'RECUSADA' : 'PENDENTE'}</b></div>)}</section>}
    </aside>
  </main>;
}

function CrosshairIcon(){ return <span className="player-scene__crosshair">＋</span>; }

export class PlayerDashboardBoundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('PlayerDashboard render failed', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="pd-loading"><h1>Não foi possível montar a Cena</h1><p>Os dados foram preservados. Atualize a página; se continuar, envie ao mestre a mensagem abaixo.</p><code>{this.state.error.message}</code><button onClick={() => window.location.reload()}>ATUALIZAR</button></main>;
  }
}
