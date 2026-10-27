import type { Audience } from '@vtt/core';

export function topicFor(campaignId: string, audience: Audience): string {
  return audience.kind === 'gm'
    ? `campaign:${campaignId}:gm`
    : `campaign:${campaignId}:player:${audience.characterId}`;
}
