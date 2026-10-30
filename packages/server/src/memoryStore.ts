import { migrateState, type CampaignState } from '@vtt/core';
import type { Broadcast, CampaignStore, CommitInput } from './store';

/** Store em memória para testes: guarda estados e registra os broadcasts. */
export class MemoryStore implements CampaignStore {
  readonly broadcasts: Broadcast[] = [];
  readonly commits: CommitInput[] = [];
  private readonly states = new Map<string, CampaignState>();
  private forcedConflicts = 0;

  /** Teste: os próximos `n` commits devolvem 'conflict' sem gravar. */
  forceConflicts(n: number): void {
    this.forcedConflicts = n;
  }

  seed(state: CampaignState): void {
    this.states.set(state.campaignId, state);
  }

  async load(campaignId: string): Promise<CampaignState | null> {
    const raw = this.states.get(campaignId);
    if (raw === undefined) return null;
    const state = migrateState(raw);
    if (!state) throw new Error('store_failed');
    return state;
  }

  async commit(input: CommitInput): Promise<'ok' | 'conflict'> {
    if (this.forcedConflicts > 0) {
      this.forcedConflicts -= 1;
      return 'conflict';
    }
    const stored = this.states.get(input.campaignId);
    if (!stored || stored.revision !== input.expectedRevision) return 'conflict';
    this.states.set(input.campaignId, input.state);
    this.commits.push(input);
    this.broadcasts.push(...input.broadcasts);
    return 'ok';
  }
}
