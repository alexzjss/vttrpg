type Pos = { x: number; y: number };

/** Posição visual padrão pra um token que ainda não foi arrastado no mapa (sem entrada em
 *  `cena.tokens`) — mesma fórmula que `tabs/cena/MapBoard.tsx` usa só pra desenhar. */
export function fallbackTokenPosition(index: number): Pos {
  return { x: 20 + (index * 12) % 60, y: 50 };
}

/** Constrói um mapa de posições cobrindo todos os `orderedIds`: usa a posição persistida em `tokens`
 *  quando existe, ou o mesmo fallback visual do MapBoard pra quem ainda não foi arrastado — assim
 *  qualquer conta geométrica (área de efeito, movimento) sempre bate com o que o jogador vê na tela,
 *  mesmo pra personagens sem posição gravada. `orderedIds` deve ser a mesma ordem/lista usada pra
 *  renderizar os tokens (ex. `participants.map(p => p.id)`), pra o índice do fallback coincidir. */
export function effectiveTokens(tokens: Record<string, Pos>, orderedIds: string[]): Record<string, Pos> {
  const result: Record<string, Pos> = {};
  orderedIds.forEach((id, index) => { result[id] = tokens[id] ?? fallbackTokenPosition(index); });
  return result;
}
