import { describe, expect, it } from 'vitest';
import type { ErrorCode } from '@vtt/core';
import { errorMessage } from './errors';

const codes: ErrorCode[] = [
  'not_gm', 'not_found', 'out_of_bounds', 'cell_occupied', 'not_your_token', 'not_your_turn',
  'invalid_value', 'no_encounter', 'encounter_active', 'tokens_out_of_bounds', 'invalid_order',
];

describe('errorMessage', () => {
  it.each(codes)('%s tem mensagem', (code) => {
    expect(errorMessage(code).length).toBeGreaterThan(0);
  });
  it('mensagens conhecidas', () => {
    expect(errorMessage('cell_occupied')).toBe('Essa célula já está ocupada.');
    expect(errorMessage('not_your_turn')).toBe('Não é o seu turno.');
    expect(errorMessage('tokens_out_of_bounds')).toBe('Há tokens fora do novo tamanho do grid. Mova-os antes.');
  });
});
