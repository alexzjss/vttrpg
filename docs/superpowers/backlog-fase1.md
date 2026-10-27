# Backlog técnico deixado pela Fase 1

Itens que as revisões encontraram e ficaram para depois. Nenhum perde dados nem vaza informação oculta.

## Prioridade (resolver no início da Fase 2)
- `localTransport`: o `pagehide` desconecta sempre; uma aba restaurada pelo bfcache (botão Voltar) fica sem atualizações até recarregar. Só desconectar quando `!event.persisted`, ou reconectar no `pageshow`.
- Revisão global: jogadores ainda conseguem deduzir quantas ações ocultas o mestre fez (o número de revisão salta). Na Fase 2, usar sequência por audiência.
- Depois que o mestre reinicia uma campanha com falha de carga, as abas de jogador ficam na tela de erro até clicar em tentar de novo.
- Várias abas da mesma audiência: o snapshot de uma aba nova faz as antigas ressincronizarem uma vez (perdem as animações dessa atualização).

## Desempenho e robustez
- Diffs e saves mandam imagens data-URL inteiras a cada comando; excluir imagens não alteradas do diff e fazer debounce do save.
- Sem timeout/`onerror` quando o SharedWorker não sobe: "Conectando…" fica para sempre.
- Bundle principal de ~617 kB: carregar `Tabletop` (Pixi) com `React.lazy`.
- Falhas de save só aparecem no console.
- Fila de cues limitada a 50; só consumida pelo Tabletop.

## Regras e validação
- Jogador pode parar o token em cima de um token oculto (decisão I1: o mestre resolve a sobreposição).
- `speed` não é validado (NaN/negativo) em criar/editar personagem.
- Patch de `characterUpdated` com `undefined` explícito sobrescreve campos.
- `Authority.handle` converte exceção em `invalid_value` (não há código de erro interno).

## Interface
- Lista de PCs no login é um snapshot único (PCs criados depois só aparecem ao recarregar).
- ResourceEditor: Enter + blur envia duas vezes; cliques rápidos usam valor velho; envia passo sem efeito.
- ScenePanel: NaN não validado.
- Tabletop: tween briga com arrasto; textura que falhou fica em cache para sempre.
- Página em branco enquanto conecta em /jogador; `Silhouette` repete "Sem imagem".
- Seletor CSS morto `.mesa-page > .tabletop`; `.gitignore` com entradas antigas do legado.

## Testes faltando
- `canDrag` (extrair função pura), `firstFreeCell`, confirmação/toast/cabeçalho do mestre, munição > 0, arte ausente, mirror do leak-scan com mais de uma audiência de jogador.
