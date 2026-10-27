# VTT RPG — Reconstrução do zero (design)

Data: 2026-10-27 · Autor: Alex (mestre) + Claude

## 1. Intenção

Um ecossistema para o mestre conduzir campanhas **100% remotas** do seu próprio sistema de RPG,
com três superfícies separadas que reagem ao mesmo estado em tempo real:

- **Mesa** (`/mesa`) — o tabletop: grid tático ou cena teatral, tokens, animações, transições, clima, cinemáticas.
- **Mestre** (`/mestre`) — "atrás das cortinas": controle total da mesa, dos personagens, das cenas e da narrativa.
- **Jogador** (`/jogador`) — a ficha viva do personagem: arte de corpo inteiro com áreas do corpo danificadas,
  status, inventário e as ações possíveis quando é o seu turno.

### Por que recomeçar

O app atual (movido para `/legacy`) provou as ideias, mas acumulou dívida que impede evoluir:

- `App.tsx` com ~4.300 linhas e 60+ `useState`; editores, regras e UI misturados.
- 4–5 modelos paralelos de "coisa que se usa" (`Card`, `Weapon`, `Item`, `Seal`, `Grimoire`, `Arsenal`, grafo)
  com camadas de migração e campos `@deprecated`.
- Sincronização online por **snapshot JSON inteiro**, o que impede animação/evento em tempo real nas três telas.
- As "páginas" são `?view=` dentro do mesmo app.
- Escopo espalhado (jornada, crafting, ritual 9×9, editor em grafo) antes do núcleo estar sólido.

### Como é o sucesso

Numa sessão real: o mestre abre `/mestre`, os jogadores abrem `/mesa` e `/jogador` em abas separadas no desktop.
O mestre troca de cena teatral para combate, todos veem a transição; um jogador, no seu turno, escolhe "Golpe
pesado" mirando o braço de um inimigo, o dado rola animado em todas as telas, o braço do alvo fica ferido na arte,
a defesa quebra com cinemática — e nada que o mestre escondeu vaza para os jogadores.

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos**
- Três páginas com rotas reais, sincronizadas por eventos em tempo real.
- Motor de regras próprio, puro e testado, independente de UI.
- Um **modelo único de Ação** cobrindo habilidades, ataques de arma e uso de item.
- Áreas do corpo com **mecânica real**.
- Entrega por **MVP vertical**: as três páginas funcionando cedo, profundidade em camadas.

**Não-objetivos (fora do escopo deste design)**
- Mesa presencial em TV / layout mobile-first (jogadores usam **desktop**; mobile apenas "não quebrar").
- Fog of war e linha de visão dinâmica.
- Editor de habilidades em grafo de nós (substituído por formulário por blocos).
- Jornada/mapa de viagem, crafting/receitas, ritual 9×9, fusões/combos multi-usuário.
- Suporte a outros sistemas de RPG (D&D etc.).
- Importar arsenal/habilidades/cenas antigas (só personagens).

**Anti-objetivos (seria fracasso mesmo funcionando)**
- Vazar informação oculta (HP de NPC, tokens escondidos, rolagens secretas, notas do mestre) para jogadores —
  inclusive via DevTools/rede.
- Arquivos-monólito; cada módulo deve ter uma responsabilidade clara.
- Dois modelos para o mesmo conceito.
- Animação bloqueando ou atrasando o estado (estado é imediato; animação é apresentação).
- Mestre precisar de cliques demais para operar durante a sessão.

## 3. Decisões tomadas pelo mestre

| Tema | Decisão |
|---|---|
| Regras | Sistema **próprio**, como o atual (HP/Aura/Munição/Defesa/Stagger/Elementos), refinado |
| Uso | **Só online remoto** |
| Infra | **Supabase** (Postgres + Realtime + Storage) |
| Render da mesa | **PixiJS (WebGL)** |
| Áreas do corpo | **Mecânica real**; atacante **mira com penalidade**, sem mira = aleatório |
| Ações do jogador | **Configurável por ação** (resolve direto ou exige aprovação do mestre) |
| Dados | **Ambos**: rolagem no app ou digitar resultado de dado físico |
| Sistemas mantidos | Inventário/arsenal, condições automáticas, Defesa/Stagger, editor de habilidades |
| Editor de habilidades | **Formulário por blocos** |
| Visual | **Tema por campanha** |
| Cenas | **Grid tático + modo teatral** |
| Câmera | **Livre + "seguir mestre"** |
| Layout do jogador | `/mesa` e `/jogador` em **abas separadas** |
| Dispositivo | **Desktop primeiro** |
| Imersão | Música/áudio, cinemáticas de combate, clima/iluminação, handouts |
| Acesso | **Login por jogador** (usuário/senha criados pelo mestre, 1 personagem por conta) |
| Dados antigos | **Importar só personagens** do JSON de backup |
| Repositório | Mesmo repo, app antigo em **`/legacy`** |
| Entrega | **MVP vertical** |
| Implementação | Planejamento/revisão com Opus; **implementação com subagentes Sonnet e Haiku** |

## 4. Arquitetura

### 4.1 Princípio: comandos → eventos → estado

Toda mudança no jogo é um **comando** (intenção: `MoverToken`, `UsarAcao`, `TrocarCena`…).
Uma **autoridade** valida o comando com o motor de regras e produz **eventos** (fatos: `TokenMovido`,
`DadoRolado`, `DanoAplicado`, `DefesaQuebrada`, `CenaTrocada`…). Um **reducer puro** aplica eventos ao estado.

- As três páginas mantêm o estado aplicando os mesmos eventos → consistência.
- **Animações, sons e cinemáticas são disparados por eventos** (`DefesaQuebrada` → cinemática), sem lógica na UI.
- O log de combate é a lista de eventos formatada.
- Desfazer (mestre) e replay ficam baratos.

### 4.2 Onde roda a autoridade

**Funções serverless na Vercel** (`/api/command`), usando o mesmo pacote `core` que o cliente:

1. Cliente envia `POST /api/command { campaignId, expectedRevision, command }` com o token de sessão.
2. Servidor carrega o estado atual (snapshot + revisão), verifica permissão do autor, roda `core.decide(state, command, rng)`.
3. Persiste os eventos na tabela `events` (append-only, com `revision` sequencial) e atualiza o snapshot.
4. Publica cada evento no Supabase Realtime **por audiência** (ver 4.3).
5. Conflito de revisão → re-tenta com estado novo (comandos são intenções, não diffs).

Aleatoriedade (dados do app) é gerada **no servidor**; o evento já carrega o resultado e os clientes só animam até ele.

*(Minha decisão)* Serverless em vez de "cliente do mestre como autoridade": funciona sem a aba do mestre aberta
(ex.: jogador editando inventário entre sessões), protege contra trapaça e mantém o segredo no servidor.

### 4.3 Visibilidade (nada oculto chega ao jogador)

Cada evento tem `visibility`: `public` | `gm` | `player:<characterId>` e, quando necessário, uma **versão
redigida** para o público (ex.: `DanoAplicado` em NPC oculto-HP vira `NpcFerido { faixa: "gravemente" }`).

- Canais Realtime privados: `campaign:<id>:public`, `campaign:<id>:gm`, `campaign:<id>:player:<charId>`.
- Autorização dos canais via RLS do Supabase Realtime. *(Minha decisão)* O login próprio (usuário/senha do mestre)
  emite um **JWT assinado com o segredo JWT do Supabase**, com claims `campaign_id`, `role`, `character_id`,
  para que RLS e Realtime funcionem sem Supabase Auth por e-mail.
- Ao abrir uma página, o cliente busca `GET /api/state` que devolve a **projeção** do estado para aquela audiência
  (`core.project(state, audience)`) + revisão; depois aplica eventos dos canais a partir dessa revisão.
- Projeção e redação são funções puras do `core`, com testes que garantem que nenhum campo oculto sai.

### 4.4 Canal efêmero (sem persistência)

Coisas de alta frequência ou passageiras vão por **Realtime Broadcast/Presence**, não por eventos:
arrastar token em andamento (preview), ping/ponteiro no mapa, "seguir mestre" (câmera), quem está online.
O resultado final (soltar o token) vira comando normal.

### 4.5 Modo local de desenvolvimento

Uma interface `Transport` com duas implementações: `SupabaseTransport` (produção) e `LocalTransport`
(autoridade em memória + `BroadcastChannel` entre abas). Permite rodar e testar as três páginas sem Supabase.

## 5. Stack e estrutura

- **TypeScript + React 19 + Vite**, `react-router` para `/mesa`, `/mestre`, `/jogador`, `/login`.
- **PixiJS v8** para a mesa (imperativo dentro de um componente React; sem `@pixi/react` *(minha decisão)*).
- **Zustand** para o store do cliente (estado projetado + UI local).
- **Supabase** (Postgres, Realtime, Storage para imagens/áudio) + **Vercel Functions** (`/api`).
- **Howler.js** para áudio.
- **Vitest** + Testing Library; `core` com cobertura alta.

```
/legacy            app antigo intocado (referência; fora do build e do tsconfig)
/packages/core     regras, modelos, comandos, eventos, reducer, projeção — TS puro, sem DOM
/apps/web          React: rotas, páginas, componentes, tabletop Pixi, temas
/api               Vercel functions: auth, command, state, admin, upload
/supabase          migrations SQL
/docs              specs e planos
```

npm workspaces. *(Minha decisão)* `legacy/` mantém seu próprio `package.json` e pode ser rodado à parte para consulta.

## 6. Modelo de domínio

### 6.1 Entidades

- **Campaign** — nome, tema, configurações (ex.: "exigir aprovação de tudo").
- **Character** (ficha) — identidade, arte de corpo inteiro, retrato, token, recursos, atributos de defesa/stagger,
  afinidades elementais, layout de zonas do corpo, inventário, ações conhecidas, condições. PJs e NPCs usam a mesma
  entidade (`kind: 'pc' | 'npc'`); NPCs podem ser **modelos** instanciados várias vezes.
- **Scene** — `mode: 'tactical' | 'theatrical'`, fundo, grid (colunas, linhas, tamanho da célula, visível),
  tokens, iluminação/clima, trilha sonora, elenco teatral.
- **Token** — instância de um Character na cena: posição em célula, tamanho, visível para jogadores, luz.
- **Encounter** — iniciativa, ordem, rodada, turno atual, participantes; existe dentro de uma cena tática.
- **Action** — modelo único (ver 6.3).
- **ItemDef / ItemStack** — catálogo e posse; equipável em slots; pode conceder ações.
- **ConditionDef** — definição de condição com efeitos por rodada e modificadores.
- **Handout** — imagem e/ou texto, destinatários, revelado em.
- **Asset** — arquivo no Storage (imagem/áudio) referenciado por id.
- **Theme** — tokens visuais da campanha.

### 6.2 Recursos e defesa (portar do legado)

Mantém o sistema atual: HP, Aura, Munição, Velocidade/Iniciativa, Stacks nomeados, Defesa com
quebra/regeneração/limiar de ativação, Stagger com multiplicador de dano e duração, elementos
(físico, fogo, raio, água, terra, vento, escuridão, luminoso, sangue, aura) e afinidades
(fraco ×1.5, resistente ×0.5, imune ×0). Os algoritmos de `legacy/utils/defense.ts`, `elements.ts`,
`resolve.ts` e `dice.ts` são **portados com seus testes** como ponto de partida, limpando o que for legado.

### 6.3 Ação (modelo único) e editor por blocos

Uma Ação é uma sequência fixa de blocos, editada num **formulário guiado** (sem grafo):

1. **Identidade** — nome, ícone/arte, descrição, categoria (habilidade / ataque de arma / item / reação / movimento).
2. **Requisitos** — custos (HP/Aura/Munição/Stack), cooldown ou cargas, zonas do corpo necessárias
   (ex.: "precisa de 1 braço funcional"), condições exigidas/impeditivas, item equipado.
3. **Alvo** — si mesmo / 1 alvo / N alvos / área (círculo, cone, linha, quadrado) com alcance em células.
4. **Teste** — ataque (rolagem + bônus vs Defesa do alvo), salvaguarda (alvo rola vs CD), ou acerto automático.
   **Mira de zona**: permitida ou não; zona fixa opcional.
5. **Efeitos** (lista ordenada, cada um com condição "em acerto / em falha / sempre") — dano (valor ou fórmula de
   dado, elemento), cura, alterar recurso, aplicar/remover condição (com duração), buff/debuff de atributo,
   empurrar/puxar/teleportar, dano de stagger extra.
6. **Aprovação** — `auto` (resolve direto) ou `mestre` (vira pedido pendente). A campanha pode forçar "mestre" para tudo.
7. **Apresentação** — animação/cinemática e som associados (escolhidos de uma biblioteca).

O motor resolve qualquer Ação com um único pipeline:
**requisitos/custos → alvo → teste (com penalidade de mira) → zona → efeitos (afinidade, defesa/stagger) → condições → eventos.**

*(Minha decisão)* O "nível" de habilidades do legado vira variantes simples (o editor permite duplicar uma ação
como "nível 2"); não há sistema de níveis dedicado no MVP.

### 6.4 Áreas do corpo (mecânica real)

- Cada Character tem um **layout de zonas**. Padrão humanoide: cabeça, torso, braço E, braço D, perna E, perna D.
  O mestre pode criar layouts próprios para criaturas (asas, cauda, cabeças múltiplas).
- Cada zona tem: `hpMax`, **penalidade de mira** no teste, **peso** na rolagem aleatória, **multiplicador de dano**
  (ex.: cabeça ×1.5), **tags** (ex.: `manipula`, `locomove`, `vital`) e a **região desenhada sobre a arte**
  (polígono em coordenadas relativas, editado pelo mestre sobre a imagem de corpo inteiro).
- Estados: **intacta → ferida (≤50%) → incapacitada (0)**.
- Dano num acerto vai **para o HP global e para o HP da zona** atingida (após multiplicador da zona).
  *(Minha decisão; os limiares e a regra de dano duplo ficam como configurações da campanha.)*
- Consequências por tag ao incapacitar: `manipula` → ações que exigem braço ficam indisponíveis e item da mão cai;
  `locomove` → movimento reduzido à metade (uma perna) ou a 1 célula (duas); `vital` → condição configurável
  (ex.: "Atordoado"). Ferida → penalidade configurável em testes que usam aquela zona.
- Sem mira, a zona é sorteada pelos pesos. Com mira, aplica a penalidade da zona ao teste.
- Cura pode mirar zona; condições podem afetar zona.

### 6.5 Turnos e condições

- Iniciativa (rolada no app ou digitada), ordem editável pelo mestre, rodada e turno.
- **Início de turno**: regenera defesa, reduz stagger, aplica efeitos de condição por rodada (dano/cura/drenos/bônus),
  decrementa durações, cooldowns.
- **Turno pulado** por stagger, como no legado.
- Jogador só age no próprio turno (reações fora do turno quando a ação é do tipo reação).

### 6.6 Inventário/arsenal

- Catálogo de itens da campanha + posse por personagem (quantidade, durabilidade opcional).
- Slots de equipamento ligados às zonas (mãos ↔ braços); equipar concede as ações do item.
- Consumíveis consomem quantidade ao usar.

## 7. As três páginas

### 7.1 `/mesa` — tabletop (PixiJS)

- **Modo tático**: fundo + grid configurável, tokens com anel de status (HP, defesa, condições como ícones),
  destaque do turno atual, prévia de área/alcance, números flutuantes de dano/cura.
- **Modo teatral**: fundo em tela cheia, retratos/artes de corpo inteiro posicionados, caixa de diálogo/narração,
  título de cena.
- **Transições** entre cenas e entre modos (fade, wipe, corte com título).
- **Cinemáticas** disparadas por evento: início de combate, início de turno/rodada, crítico, quebra de defesa,
  stagger, derrota, vitória, splash de habilidade.
- **Clima e iluminação**: chuva, neve, neblina, cinzas; dia/noite/tint global; luzes pontuais em tokens ou no mapa.
- **Câmera**: livre (zoom/pan); o mestre pode **"puxar todos"** para um ponto/zoom ou travar temporariamente.
- **Dados**: animação de rolagem sincronizada para todos (o resultado já vem no evento).
- Jogador pode **arrastar o próprio token** no seu turno (dentro do movimento permitido); o resto é só leitura.
- Mesma página com `?as=gm` (ou embutida no `/mestre`) mostra o que está oculto, marcado visualmente.

### 7.2 `/jogador` — ficha viva

- **Arte de corpo inteiro** com as zonas sobrepostas, coloridas pelo estado (intacta/ferida/incapacitada) e
  tooltips com efeitos.
- Recursos (HP, Aura, Munição, Defesa, Stagger, Stacks), condições ativas com duração.
- **Inventário e equipamento**.
- **Painel de turno**: quando é a sua vez, lista as ações disponíveis (indisponíveis aparecem com o motivo:
  "braço direito incapacitado", "Aura insuficiente"). Fluxo: escolher ação → escolher alvo(s) na lista ou
  clicando na aba da mesa *(ver 11)* → escolher zona (se mirável) → rolar no app **ou** digitar o dado físico →
  enviar. Ações `mestre` mostram "aguardando aprovação".
- **Handouts** recebidos (caixa de entrada) e log resumido do que o afeta.
- Desktop primeiro.

### 7.3 `/mestre` — cockpit

- **Visão da mesa com tudo visível** + painéis laterais.
- **Elenco**: criar/editar/duplicar/remover personagens e NPCs (inclui editor de zonas sobre a arte), colocar e
  retirar da cena, ocultar/revelar tokens, editar qualquer recurso/condição/zona na hora.
- **Agir por qualquer personagem** usando o mesmo painel de ações do jogador.
- **Fila de aprovações** de ações dos jogadores (aprovar / rejeitar com nota / ajustar alvo ou valor).
- **Encontro**: iniciar/encerrar combate, iniciativa, reordenar, avançar turno, pausar.
- **Cenas**: biblioteca de cenas, trocar cena, alternar tático/teatral, editar grid, clima, luz, música.
- **Disparar cinemáticas/animações/sons** manualmente.
- **Dados ocultos** do mestre.
- **Handouts**: criar e enviar a jogadores específicos (opcionalmente exibir na mesa).
- **Editor de Ações** (formulário por blocos) e **catálogo de itens/condições**.
- **Desfazer** o último evento (ou o último comando).
- **Contas**: criar/desativar logins de jogadores, vinculados a um personagem.
- **Tema** da campanha.

## 8. Tema por campanha

`Theme` = tokens (cores, fontes, raios, molduras, estilo de painel, paleta da mesa para Pixi, estilo das
cinemáticas). Aplicado via CSS variables na UI e via objeto de paleta no Pixi. Entram dois temas prontos:
**dark fantasy** (herdado do visual atual, `legacy/utils/theme.ts`) e **neutro**. Imagens das cinemáticas e
molduras são assets por tema.

## 9. Áudio

Biblioteca de faixas (upload no Storage). Trilha por cena com crossfade; **efeitos sonoros por tipo de evento**
(rolagem, acerto, crítico, quebra de defesa…), configuráveis por campanha e por ação. Volume mestre/música/efeitos
por usuário (local). *(Minha decisão)* Sem YouTube no MVP: problemas de autoplay e sincronização.

## 10. Persistência e importação

Tabelas (Supabase, RLS ligado): `campaigns`, `accounts`, `sessions`, `events` (append-only), `snapshots`
(estado completo + revisão; checkpoint a cada N eventos), `assets`. Pedidos pendentes de aprovação vivem no
próprio estado (evento `AcaoSolicitada`), não em tabela à parte. Senhas com hash só no servidor (reaproveitar
`legacy/api/_lib/security.ts`).

**Importador de personagens**: lê o JSON de backup do legado (`Ctrl+S`) e cria Characters com nome, retrato,
banner, recursos, defesa/stagger, afinidades e velocidade; zonas recebem o layout humanoide padrão. Arsenal,
cenas e logs não são importados.

## 11. Ordem de entrega (MVP vertical)

Cada fase termina com as três páginas utilizáveis.

1. **Fundação** — mover legado para `/legacy`, workspaces, `core` (modelo, comandos, eventos, reducer, projeção),
   `LocalTransport`, rotas, login. Mesa tática com grid e tokens, mestre move/cria tokens e edita HP,
   jogador vê a ficha básica. Iniciativa e turnos.
2. **Online** — Supabase (schema, auth JWT, `/api/command`, `/api/state`, canais por audiência), testes de
   não-vazamento, importador de personagens, upload de imagens.
3. **Ações e regras** — modelo de Ação, pipeline de resolução, dados (app/físico) com animação, aprovação
   configurável, condições automáticas, Defesa/Stagger, elementos, log.
4. **Corpo** — zonas, editor de zonas sobre a arte, mira com penalidade, consequências por tag, arte do jogador.
5. **Arsenal e editor** — catálogo de itens, equipamento por zona, editor de Ações por blocos, editor de condições.
6. **Cena e imersão** — modo teatral, transições, cinemáticas, clima/luz, áudio, handouts, câmera "seguir mestre",
   temas.

Seleção de alvo clicando na aba `/mesa` enquanto se usa `/jogador`: no MVP, alvo é escolhido **na lista** do
`/jogador`; clicar no token na `/mesa` como atalho de alvo fica para a fase 6 (via canal efêmero).

## 12. O que fica para quem constrói

- Formato exato dos tipos, nomes de comandos/eventos e organização interna dos módulos.
- Estratégia de checkpoint de snapshots e implementação de desfazer (evento compensatório ou replay).
- Bibliotecas auxiliares (ex.: partículas, easing), desde que leves.
- Visual detalhado das cinemáticas e dos temas, dentro das intenções acima.
- Política de reconexão/re-sincronização dos clientes.

## 11.1 Respostas do mestre após a revisão

- **Visibilidade entre jogadores**: cada jogador vê **status exato** dos outros PJs (HP, Aura, Munição, Defesa,
  Stagger, zonas, condições), mas **não** inventário, ações nem a ficha completa. NPCs: o mestre escolhe por NPC
  entre exato / faixa (ileso, ferido, grave, à beira da morte) / oculto. Rolagens do mestre podem ser públicas ou
  ocultas, escolhido a cada rolagem (padrão oculto).
- **Primeiro marco jogável**: **fim da fase 3** (online + ações, dados, aprovação, condições, Defesa/Stagger).
  É o corte de prioridade: tudo das fases 1–3 vem antes de qualquer item das fases 4–6.
- **Testes fora de combate**: não existem atributos/perícias. O mestre (e o jogador) fazem **rolagens livres**
  (`1d20+2`, pública ou oculta) que aparecem no log e animam na mesa. O modelo de Teste fica: ataque vs Defesa,
  salvaguarda vs CD, acerto automático.
- **Campanhas**: **várias campanhas, um mestre**. Existe uma única conta de mestre (criada no bootstrap) que cria e
  alterna campanhas; contas de jogador pertencem a uma campanha e a um personagem. JWT com `campaign_id` da campanha
  ativa. Sessão dura 30 dias; sem recuperação de senha (o mestre redefine a senha do jogador).
- **Backup real**: não existe. Fixtures do importador são geradas a partir do formato de
  `legacy/utils/database.ts` (snapshot versionado) e `legacy/types.ts`.

## 12.1 Decisões técnicas fixadas na revisão *(minhas decisões)*

- **Auth/Realtime**: validar o JWT customizado (claims `role: authenticated`, `campaign_id`, `account_role`,
  `character_id`) com Realtime Authorization num **spike no início da fase 2**. **Fallback**: usar Supabase Auth
  com e-mail sintético (`<usuario>@<campanha>.vtt.local`) e senha definida pelo mestre — mesma experiência de
  login, claims em `app_metadata`. O segredo JWT só existe nas funções do servidor.
- **Projeção/redação**: existe **um tipo de estado completo** (servidor) e **um tipo de estado projetado**
  (cliente). `core.decide` emite eventos completos que só o servidor aplica. Para cada audiência o servidor envia
  um `ProjectedUpdate` = **diferença por entidade** entre `project(antes, a)` e `project(depois, a)` + **cues**
  de apresentação (para animações) derivados dos eventos e filtrados pela projeção. Assim nenhum dado oculto sai
  por construção. Teste de propriedade: `applyChanges(project(s, a), diffProjection(project(s, a),
  project(s', a)))` é igual a `project(s', a)`.
- **Latência**: alvo < 500 ms do clique ao evento na tela (p95). Comandos são serializados por campanha com
  `expectedRevision` + até 3 retries. Se Vercel Functions não atingir o alvo, a mesma função roda como
  Supabase Edge Function (o `core` é TS puro e portável).
- **Regras numéricas padrão**: extraídas do legado (`defense.ts`, `elements.ts`, `resolve.ts`) e escritas como
  constantes padrão da campanha. Zona: ferida ≤ 50% do HP da zona, incapacitada = 0, HP de zona padrão =
  `maxHp × {cabeça 0.25, torso 0.5, braços 0.3, pernas 0.35}`; penalidade de mira padrão cabeça −4, braços/pernas −2,
  torso 0; multiplicador cabeça ×1.5, demais ×1. **Ordem do dano**: base → afinidade elemental → multiplicador da zona
  → multiplicador de stagger → redução de Defesa → aplica no HP global e no HP da zona (mesmo valor final).
- **Dados**: notação `NdX(+/-M)`, múltiplos termos (`2d6+1d4+3`), `kh`/`kl` (vantagem/desvantagem), sem explosão
  no MVP. Resultado físico: o jogador digita o **total** ou cada dado.
- **Assets**: imagens comprimidas no cliente para WebP (máx. 2560 px do lado maior, ~1 MB); áudio aceito até 10 MB
  (mp3/ogg). Painel do mestre mostra uso do Storage.
- **Desfazer**: gera evento compensatório `EventoDesfeito { eventId, inverso }` visível às mesmas audiências do
  original; o log mostra a ação como riscada.
- **Testes de não-vazamento** rodam em CI contra a autoridade em memória (`LocalTransport` usa as mesmas
  `decide`/`redact`/`project` do servidor). Teste contra Supabase real é manual/opcional.

## 13. Restrições

- Plano gratuito do Supabase/Vercel deve bastar para 1 mestre + ~6 jogadores.
- Nenhuma chave secreta em variável `VITE_`.
- `core` sem dependência de DOM/React; tudo que é regra tem teste.
- Arquivos pequenos e com uma responsabilidade; nada de componente com milhares de linhas.
- Implementação feita por subagentes Sonnet (lógica, UI, Pixi) e Haiku (tarefas mecânicas, testes, estilos),
  com revisão antes de integrar.
