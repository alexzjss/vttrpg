import React from 'react';
import { RotateCw, Swords } from 'lucide-react';

interface FormaActivation { key: number; characterName: string; formName: string; color?: string; image?: string }
type RareKind = 'break' | 'defeat' | 'stagger' | 'critical' | 'fumble' | 'reaction' | 'massive-heal' | 'forma-expire';
interface RareCombatEvent { key: number; kind: RareKind; label: string; detail?: string; image?: string }
interface CombatCinematicsProps { combat: boolean; round: number; activeName?: string; activeImage?: string; formaActivation?: FormaActivation | null; rareEvent?: RareCombatEvent | null }
type EventKind = 'start' | 'end' | 'round' | 'turn' | 'forma' | RareKind;
interface CinematicEvent { key: number; kind: EventKind; label: string; detail?: string; color?: string; image?: string }

const TURN_EVENT_DURATION = 2200;

const CombatCinematics: React.FC<CombatCinematicsProps> = ({ combat, round, activeName, activeImage, formaActivation, rareEvent }) => {
  const previous = React.useRef({ combat, round, activeName });
  const eventSeq = React.useRef(0);
  const [queue, setQueue] = React.useState<CinematicEvent[]>([]);
  const event = queue[0] ?? null;

  const makeEvent = React.useCallback((item: Omit<CinematicEvent, 'key'>): CinematicEvent => {
    eventSeq.current += 1;
    return { ...item, key: Date.now() * 1000 + eventSeq.current };
  }, []);

  React.useLayoutEffect(() => {
    const before = previous.current;
    const next: Omit<CinematicEvent, 'key'>[] = [];
    if (before.combat !== combat) {
      next.push(combat
        ? { kind: 'start', label: 'CONFRONTO', detail: 'A batalha começou' }
        : { kind: 'end', label: 'FIM DO COMBATE', detail: 'O campo silencia' });
      if (combat && activeName) next.push({ kind: 'turn', label: activeName, detail: 'É a vez de agir', image: activeImage });
    } else if (combat) {
      if (before.round !== round) next.push({ kind: 'round', label: `RODADA ${round}`, detail: 'Uma nova volta se inicia' });
      if (before.activeName !== activeName && activeName) next.push({ kind: 'turn', label: activeName, detail: 'É a vez de agir', image: activeImage });
    }
    previous.current = { combat, round, activeName };
    if (!next.length) return;

    setQueue(current => {
      const created = next.map(makeEvent);
      if (created.some(item => item.kind === 'start' || item.kind === 'end')) {
        return [...created, ...current.filter(item => item.kind === 'forma')].slice(0, 3);
      }
      const latestTurn = [...created].reverse().find(item => item.kind === 'turn');

      if (latestTurn) {
        const newNonTurnEvents = created.filter(item => item.kind !== 'turn');
        const activeForma = current.filter(item => item.kind === 'forma');
        return [latestTurn, ...activeForma, ...newNonTurnEvents].slice(0, 3);
      }

      return [...current.filter(item => item.kind !== 'turn'), ...created].slice(0, 3);
    });
  }, [combat, round, activeName, activeImage, makeEvent]);

  React.useLayoutEffect(() => {
    if (!formaActivation) return;
    setQueue(current => [{
      key: formaActivation.key,
      kind: 'forma',
      label: formaActivation.formName,
      detail: `${formaActivation.characterName} despertou`,
      color: formaActivation.color,
      image: formaActivation.image,
    }, ...current.filter(item => item.kind !== 'forma')]);
  }, [formaActivation?.key]);

  React.useLayoutEffect(() => {
    if (!rareEvent) return;
    const rareKinds: EventKind[] = ['break', 'defeat', 'stagger', 'critical', 'fumble', 'reaction', 'massive-heal', 'forma-expire'];
    setQueue(current => [{
      key: rareEvent.key,
      kind: rareEvent.kind,
      label: rareEvent.label,
      detail: rareEvent.detail,
      image: rareEvent.image,
    }, ...current.filter(item => !rareKinds.includes(item.kind))]);
  }, [rareEvent?.key]);

  React.useEffect(() => {
    if (!event) return;
    const duration = event.kind === 'start' || event.kind === 'end'
      ? 1900
      : event.kind === 'turn' || event.kind === 'forma' || ['break', 'defeat', 'stagger', 'critical', 'fumble', 'reaction', 'massive-heal', 'forma-expire'].includes(event.kind)
        ? TURN_EVENT_DURATION
        : 1500;
    const timer = window.setTimeout(() => setQueue(current => current.slice(1)), duration);
    return () => window.clearTimeout(timer);
  }, [event]);

  return <div className={`cena-cinematics ${combat ? 'is-combat' : ''}`} aria-live="polite">
    <div className="cena-cinematics__vignette" />
    {event && <div key={event.key} className={`cena-cinematic-event is-${event.kind}`} style={{
      ...((event.kind === 'turn' || ['break', 'defeat', 'stagger', 'critical', 'fumble', 'reaction', 'massive-heal', 'forma-expire'].includes(event.kind)) && event.image ? { '--turn-image': `url(${event.image})` } : {}),
      ...(event.kind === 'forma' ? { '--forma-aura': event.color || '#a855f7', '--turn-image': event.image ? `url(${event.image})` : 'none' } : {}),
    } as React.CSSProperties}>
      {(((event.kind === 'turn' || ['break', 'defeat', 'stagger', 'critical', 'fumble', 'reaction', 'massive-heal', 'forma-expire'].includes(event.kind)) && event.image) || (event.kind === 'forma' && event.image)) && <div className="cena-cinematic-event__backdrop" />}
      <span className="cena-cinematic-event__line" />
      <div className="cena-cinematic-event__icon">{event.kind === 'round' ? <RotateCw size={19} /> : <Swords size={20} />}</div>
      <div><small>{event.detail}</small><strong>{event.label}</strong></div>
      <span className="cena-cinematic-event__line" />
    </div>}
  </div>;
};

export default CombatCinematics;
