import type { LucideIcon } from 'lucide-react';
import { Compass, Users, Shield, Swords } from 'lucide-react';
import type { TabId } from '../../utils/atmosphere';

export type NavKind = 'mode' | 'satellite';
export interface NavDest {
  id: TabId;
  label: string;
  kind: NavKind;
  icon: LucideIcon;
}

export const MODES: TabId[] = ['cena'];
export const SATELLITES: TabId[] = [];
// Ordem das teclas 1..
export const NAV_ORDER: TabId[] = ['cena'];

// NAV_DESTS mantém combat/journey/characters/arsenal (ainda são TabId até a
// limpeza de legado), mas eles não aparecem em NAV_ORDER/MODES/SATELLITES,
// portanto ficam inacessíveis pela navegação — characters/arsenal agora vivem
// como modais abertos a partir da Cena (RosterPanel), não como destinos de aba.
export const NAV_DESTS: Record<TabId, NavDest> = {
  cena:       { id: 'cena',       label: 'Cena',        kind: 'mode',      icon: Compass },
  combat:     { id: 'combat',     label: 'Combate',     kind: 'mode',      icon: Swords },
  journey:    { id: 'journey',    label: 'Jornada',     kind: 'mode',      icon: Compass },
  characters: { id: 'characters', label: 'Personagens', kind: 'satellite', icon: Users },
  arsenal:    { id: 'arsenal',    label: 'Arsenal',     kind: 'satellite', icon: Shield },
};
