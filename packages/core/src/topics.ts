import type { Audience } from './projection';

/** Nome do canal Realtime de uma audiência; igual no servidor (broadcast) e no navegador (assinatura). */
export function topicFor(campaignId: string, audience: Audience): string {
  return audience.kind === 'gm'
    ? `campaign:${campaignId}:gm`
    : `campaign:${campaignId}:player:${audience.characterId}`;
}
