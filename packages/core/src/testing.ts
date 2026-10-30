import { defaultResources } from './campaign';
import type { Character } from './model';
import { defaultDefense, defaultStagger } from './rules/defense';

/** Só os campos da v2 com valores padrão, para literais de teste que ainda montam o Character à mão. */
export function v2Fields(): Pick<Character, 'defense' | 'stagger' | 'affinities' | 'conditions' | 'actions' | 'cooldowns'> {
  return { defense: defaultDefense(), stagger: defaultStagger(), affinities: {}, conditions: [], actions: [], cooldowns: {} };
}

/** Só para testes (não exportado por index.ts): Character completo com padrões v2; `patch` sobrescreve. */
export function makeCharacter(patch: Partial<Character> = {}): Character {
  return {
    id: 'c1', kind: 'pc', name: 'Teste', portrait: '', fullBodyArt: '', tokenImage: '',
    resources: defaultResources(), speed: 5, hpVisibility: 'exact',
    ...v2Fields(),
    ...patch,
  };
}
