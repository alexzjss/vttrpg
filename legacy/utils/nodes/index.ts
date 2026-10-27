import { registerCoreNodes } from './coreNodes';
import { registerDefenseNodes } from './defenseNodes';
import { registerControlNodes } from './controlNodes';
import { registerConditionNodes } from './conditionNodes';
import { registerFormaNodes } from './formaNodes';
import { registerTestNodes } from './testNodes';
import { registerModifierNodes } from './modifierNodes';

/** Registra todos os nós da paleta. Cada registerXNodes() é idempotente (sobrescreve por type),
 * então é seguro chamar de novo após um _resetRegistry() em testes. */
export function ensureNodesRegistered(): void {
  registerCoreNodes();
  registerDefenseNodes();
  registerControlNodes();
  registerConditionNodes();
  registerFormaNodes();
  registerTestNodes();
  registerModifierNodes();
}
