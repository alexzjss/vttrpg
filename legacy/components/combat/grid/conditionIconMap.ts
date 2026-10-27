import {
  Zap, Droplets, Skull, Flame, Snowflake, AlertOctagon,
  EyeOff, VolumeX, Timer, Ghost, Shield, BatteryLow,
  AlertCircle, Wind, Star,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const conditionIconMap: Record<string, LucideIcon> = {
  'atordoado': Zap,    'atordoada': Zap,
  'sangrando': Droplets, 'sangranda': Droplets,
  'envenenado': Skull,  'envenenada': Skull,
  'queimando': Flame,   'queimanda': Flame,
  'congelado': Snowflake, 'congelada': Snowflake,
  'paralisado': AlertOctagon, 'paralisada': AlertOctagon,
  'cego': EyeOff,       'cega': EyeOff,
  'mudo': VolumeX,      'muda': VolumeX,
  'lento': Timer,       'lenta': Timer,
  'amedrontado': Ghost, 'amedrontada': Ghost,
  'invisível': Ghost,   'invisivel': Ghost,
  'protegido': Shield,  'protegida': Shield,
  'exausto': BatteryLow, 'exausta': BatteryLow,
  'abençoado': Star,    'abençoada': Star,
  'fraco': Wind,        'fraca': Wind,
};

export function getConditionIcon(name: string): LucideIcon {
  return conditionIconMap[name.toLowerCase().trim()] ?? AlertCircle;
}
