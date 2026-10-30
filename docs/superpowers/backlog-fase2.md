# Backlog — Fase 2 (Online)

Itens que as revisões encontraram e que ficaram de fora, todos menores. Nenhum vaza dado de mestre para jogador.

## Sessão e conexão
- Na ressincronização após reconexão, o erro "sessão mudou em outra aba" é engolido: a tela fica velha até o próximo buraco de `seq`, sem ir para o login (`onlineTransport.ts`, `resyncAfterReconnect`).
- `send()` não confere `/api/me` de novo: no mesmo navegador, uma aba de jogador pode mandar comandos com o token de um mestre logado em outra aba. A leitura do estado é protegida pela checagem de audiência.
- `everSubscribed`/`connected` não são zerados: um `connect()` repetido na mesma instância conta a primeira inscrição como reconexão. Hoje isso não acontece.
- Um SUBSCRIBED que chega depois de `close()` ainda dispara um `fetchState` (só a emissão é suprimida).
- Não há estado "reconectando" visível.
- O buffer de updates do transporte não tem limite se nenhum listener for registrado; o transporte só serve para uma conexão; `close()` durante a inscrição pode deixar o `connect` pendente se o supabase-js nunca reportar CLOSED.
- Uma conta desativada continua recebendo o Realtime já aberto até o token expirar (~1 h). Isso está documentado no guia, Passo 10.
- `awaitPendingLogout`: o timer não é limpo e o limite de 3 s não tem teste.

## Servidor
- `imageGuard.ts` e `commands.test.ts` têm bytes de controle crus no código-fonte: o git os mostra como binários. Trocar por escapes `\x00-\x20`.
- `POST /api/assets/upload-url` carrega o snapshot inteiro só para checar se a campanha existe.
- O tipo `CommandResult` ainda promete `revision` em respostas de jogador.
- Validar o runtime da Vercel: corpo de POST, query string através da rota `/api`, fallback da SPA, e `shouldAddHelpers` no `.vc-config.json`.

## Web
- Uma falha HTTP em qualquer ação manda a página inteira para a tela de erro. As páginas fazem `await send` sem `catch`.
- Contas: um usuário só com espaços é recusado sem mensagem.
- Contas: uma corrida rara faz o painel dizer que a lista foi atualizada quando a nova carga falhou.
- Importador:
  - `hpVisibility` pc→npc sem teste.
  - Data URL sem vírgula não é recusada.
  - O campo de arquivo não fica desabilitado durante a importação.
  - `legacyId` repetido colide como chave React.
  - Escolher de novo o mesmo arquivo não dispara nada.
  - Texto "Importar 1 personagens".
- Importador no modo local: reduz as imagens para 1024 px.
- Guia: o `Ctrl+F` do DevTools talvez não busque dentro das mensagens WS.
