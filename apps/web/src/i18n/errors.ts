import type { ErrorCode } from '@vtt/core';

const messages: Record<ErrorCode, string> = {
  not_gm: 'Só o mestre pode fazer isso.',
  not_found: 'Não encontrado.',
  out_of_bounds: 'Essa posição está fora do grid.',
  cell_occupied: 'Essa célula já está ocupada.',
  not_your_token: 'Esse token não é seu.',
  not_your_turn: 'Não é o seu turno.',
  invalid_value: 'Valor inválido.',
  no_encounter: 'Não há combate em andamento.',
  encounter_active: 'Já há um combate em andamento.',
  tokens_out_of_bounds: 'Há tokens fora do novo tamanho do grid. Mova-os antes.',
  invalid_order: 'A ordem de iniciativa é inválida.',
  conflict: 'A mesa mudou ao mesmo tempo; tente de novo.',
};

export const LOAD_FAILED_MESSAGE = 'Falha ao carregar a campanha salva.';

export function errorMessage(code: ErrorCode): string {
  return messages[code];
}
