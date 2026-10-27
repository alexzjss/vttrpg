import type { Command } from '@vtt/core';

const isDataUrl = (v: unknown): boolean => typeof v === 'string' && v.trimStart().toLowerCase().startsWith('data:');

/** Imagens vão para o storage; data URLs não entram no estado salvo. */
export function containsDataUrl(cmd: Command): boolean {
  switch (cmd.type) {
    case 'createCharacter':
      return [cmd.input.portrait, cmd.input.fullBodyArt, cmd.input.tokenImage].some(isDataUrl);
    case 'updateCharacter':
      return [cmd.patch.portrait, cmd.patch.fullBodyArt, cmd.patch.tokenImage].some(isDataUrl);
    case 'updateGrid':
      return isDataUrl(cmd.background);
    default:
      return false;
  }
}
