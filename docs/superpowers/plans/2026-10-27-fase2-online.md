# Fase 2 — Online: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mesa roda online: o mestre e os jogadores entram com usuário/senha, as três páginas recebem atualizações por audiência via Supabase Realtime, os comandos são decididos no servidor (Vercel), as imagens vão para o Storage, e o mestre cria contas e importa personagens do JSON do legado. O modo local (SharedWorker) continua funcionando quando o online não está configurado.

**Architecture:** O `core` continua sendo a única regra. Uma função serverless carrega o snapshot da campanha, roda `Authority.handle`, e grava tudo numa única função Postgres (`vtt_commit`): checa a revisão, salva o snapshot, anexa o evento e chama `realtime.send` com um `ProjectedUpdate` por audiência. Os tópicos são privados (`campaign:<id>:gm`, `campaign:<id>:player:<charId>`), autorizados por RLS lendo `app_metadata` do JWT do Supabase Auth. O cliente usa `OnlineTransport`, que implementa a mesma interface `Transport` da Fase 1.

**Tech Stack:** tudo da Fase 1 + `@supabase/supabase-js` 2.x (cliente e servidor), `esbuild` (empacotar as funções), Vercel Build Output API v3, Postgres/Realtime/Storage do Supabase.

**Spec:** `docs/superpowers/specs/2026-10-27-vtt-reconstrucao-design.md` (seções 4.2, 4.3, 10, 11 fase 2, 11.1, 12.1, 13). Backlog herdado: `docs/superpowers/backlog-fase1.md`.

**Decisões do mestre para esta fase:** Supabase **projeto novo e vazio**. O mestre aplica migrations e configura variáveis com o guia (Task 12); nenhum subagente recebe credenciais nem acessa o Supabase/Vercel reais. Deploy da `main` com o app novo está ok.

**Decisões técnicas desta fase (minhas):**
- **Auth = Supabase Auth com e-mail sintético** (o fallback da spec 12.1 vira o caminho principal). JWT customizado assinado com segredo exige o segredo HS256 legado, que projetos novos não usam por padrão. Com Supabase Auth, RLS, Realtime e refresh de token funcionam sem código próprio de criptografia. E-mail = `<usuario>@vtt.local`; usuários são únicos no sistema inteiro (o login fica só usuário + senha). `app_metadata = { account_role: 'gm' | 'player', campaign_id?, character_id? }`. Contas só são criadas pelo servidor (admin API); signup público desligado. Sem prazo de 30 dias: o time-box de sessão do Supabase é recurso pago, então a sessão dura até o logout.
- **Sequência por audiência** substitui a revisão global no cliente. Isso resolve o canal lateral (o jogador contava as ações ocultas) e o resync extra entre abas do backlog. `CampaignState.audienceSeq` é guardado junto do snapshot.
- **Sem canal `public`**: cada jogador já tem a sua projeção. Só existem os tópicos `gm` e `player:<id>`.
- **Funções via Build Output API**: o `esbuild` empacota cada handler (com o `core`) num único `.mjs`. Isso evita os problemas de ESM sem extensão e de TS em workspace no bundler da Vercel.
- **"Reiniciar campanha" fica só no modo local.** Online, apagar campanha é destrutivo e fica fora desta fase.
- **Importador** só leva os campos que o modelo já tem (nome, retrato, arte, token, HP/Aura/Munição, velocidade). Defesa/Stagger/afinidades entram quando a Fase 3 criar esses campos.

## Global Constraints

- Tudo da Fase 1 continua valendo (core sem DOM; arquivos ≤ ~300 linhas; código em inglês, texto da UI em português; 1280×720 sem quebrar; porta 3177).
- **Nenhuma chave secreta em variável `VITE_`.** O cliente só conhece `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. `SUPABASE_SECRET_KEY` e `SETUP_TOKEN` existem só no servidor (funções e middleware do Vite em dev).
- Nunca commitar `.env`, `.env.local` nem `.superpowers/`. O `.gitignore` precisa cobrir `.env*` exceto `.env.example`.
- Arquivos em UTF-8 sem Latin-1.
- Jogador **nunca** recebe, nem por HTTP nem por Realtime: tokens ocultos, NPC sem token visível, recursos de NPC `band`/`hidden`, a projeção do GM, dados de outra campanha.
- Sem credencial real em teste: todo teste usa fakes de `CampaignStore`, de `AuthAdmin` e do cliente Supabase.
- Modo local continua sendo o padrão quando `VITE_SUPABASE_URL` está vazio; os 213 testes da Fase 1 continuam passando (ajustados só onde a Task 1 muda o contrato).
- Rodapé de todo commit: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Token de jogador pedindo o que não é dele:** `GET /api/state?campaignId=<outra>` ou um comando de GM com token de jogador deve devolver 403 / `not_gm`, nunca a projeção de GM. Testes na Task 6.
2. **Dois comandos ao mesmo tempo:** os dois jogadores agem no mesmo instante. Um dos commits perde a corrida, refaz com o estado novo e os dois são aplicados, com a `seq` de cada audiência contígua. Teste na Task 4 (store em memória que força conflito).
3. **Data URL / payload gigante online:** uma imagem `data:` em comando online é rejeitada com `invalid_value`. O broadcast do Realtime tem limite de tamanho, e a imagem tem que ir pelo Storage. Teste na Task 4.
4. **Token de acesso expira no meio da sessão (1 h):** o `supabase-js` renova a sessão; o `OnlineTransport` passa o token novo ao Realtime (`realtime.setAuth`) e às chamadas HTTP, e a página continua recebendo updates. Teste na Task 8.
5. **Conta desativada:** a próxima chamada HTTP devolve 403 e a política RLS do Realtime deixa de autorizar o tópico. Testes na Task 6 (HTTP) e checagem manual no guia (Task 12).

---

### Task 1: Sequência por audiência no core e no modo local [sonnet]

**Files:**
- Modify: `packages/core/src/model.ts`, `campaign.ts`, `projection.ts`, `diff.ts`, `authority.ts` (e testes correspondentes)
- Modify: `apps/web/src/store/gameStore.ts`, `apps/web/src/net/workerHost.ts`, `apps/web/src/net/localTransport.ts` (e testes)

**Interfaces:**
- Produces: `CampaignState.audienceSeq: Record<string, number>` (chave = `audienceKey`); `ProjectedState.seq: number` (substitui `revision`; a projeção **não expõe** mais `revision`); `ProjectedUpdate = { seq: number; changes: Change[]; cues: Cue[] }` (sai `revision` e `baseRevision`). `Authority` não tem mais `lastDelivered`.

- [ ] **Step 1: testes de core que falham**
  - `authority.test.ts` `seq is contiguous per audience`: o GM move um token oculto 2× e depois avança o turno. O player recebe um único update com `seq === 1`; o GM recebe `seq` 1, 2, 3.
  - `projection.test.ts` `projection exposes audience seq, not global revision`: `project(state,{kind:'player',...})` tem `seq === state.audienceSeq['player:<id>'] ?? 0` e `!('revision' in projected)`.
  - `authority.test.ts` `snapshot does not change seq`: `snapshotFor` duas vezes e depois `handle` dá `seq` = anterior + 1 (não há reset por snapshot).
  - `campaign.test.ts`: `createCampaign(...).audienceSeq` é `{}`.
- [ ] **Step 2:** `npm test -w @vtt/core`, os testes novos FALHAM.
- [ ] **Step 3: implementar.** Em `handle`: para cada audiência com `changes` ou `cues`, `seq = (before.audienceSeq[key] ?? 0) + 1` e `after.audienceSeq[key] = seq`. `diffProjection` continua comparando só entidades (ignora `seq`). `applyChanges(state, changes, seq)` atualiza `seq`.
- [ ] **Step 4: web.** `gameStore`: ignora `u.seq <= state.seq`; aplica se `u.seq === state.seq + 1`; senão faz resync (as cues desse update se perdem, como hoje). `workerHost`: o estado carregado sem `audienceSeq` é aceito e recebe `{}` (validação de forma). Ajustar os testes da Fase 1 que usavam `revision`/`baseRevision`.
- [ ] **Step 5: bfcache (backlog).** Em `localTransport`, o listener de `pagehide` só manda `disconnect` quando `!event.persisted`. Teste: `pagehide` com `persisted: true` não envia `disconnect`.
- [ ] **Step 6:** `npm test` e `npm run build` passam. Commit: `refactor(core): sequência por audiência no lugar da revisão global`.

### Task 2: Importador de personagens do legado (puro) [sonnet]

**Files:**
- Create: `packages/core/src/importLegacy.ts`, `packages/core/src/importLegacy.test.ts`, `packages/core/src/fixtures/legacy-backup.json`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `parseLegacyBackup(json: unknown): { ok: true; characters: LegacyCharacterDraft[] } | { ok: false; error: 'invalid_file' | 'unsupported_version' }`; `interface LegacyCharacterDraft { legacyId: string; input: Omit<Character,'id'>; images: { portrait?: string; fullBodyArt?: string; tokenImage?: string } }`. `images` traz as strings originais (data URL ou URL) para a camada web subir ao Storage. `input` já vem com as imagens copiadas (o modo local usa direto).

- [ ] **Step 1: fixture.** Gerar `legacy-backup.json` a partir do formato `AppSnapshot` em `legacy/utils/database.ts` e `Character` em `legacy/types.ts`. Mínimo de 3 personagens: um completo (`icon` data URL curta, `bannerImage`, recursos, `speed`), um só com campos obrigatórios e um com `role: 'npc'`. Sem dados reais.
- [ ] **Step 2: testes que falham.**
  - Mapeamento de nome e recursos: `maxHp/currentHp → hp`, `maxAura/currentAura → aura`, `maxAmmo/currentAmmo → ammo`.
  - `speed` ausente → 5.
  - `icon → portrait` e `tokenImage`; `bannerImage → fullBodyArt`.
  - `kind` → `'npc'` quando `role === 'npc'`, senão `'pc'`.
  - `hpVisibility` → `'exact'` para PC e `'band'` para NPC.
  - `current > max` é limitado ao max; números não finitos → valores de `defaultResources()`.
  - JSON sem `characters` array → `invalid_file`; `version` maior que o maior suportado pelo legado → `unsupported_version`.
- [ ] **Step 3:** implementar. Sem importar nada de `/legacy`: tipar o que lê com um tipo local mínimo.
- [ ] **Step 4:** `npm test -w @vtt/core` passa. Commit: `feat(core): importador de personagens do backup do legado`.

### Task 3: Pacote do servidor, adaptadores e deploy das funções [sonnet]

**Files:**
- Create: `packages/server/package.json` (`@vtt/server`, depende de `@vtt/core` e `@supabase/supabase-js`), `tsconfig.json`, `vitest.config.ts`
- Create: `packages/server/src/http.ts`, `http.test.ts`, `router.ts`, `nodeAdapter.ts`, `vercelEntry.ts`, `handlers/health.ts`
- Create: `scripts/build-functions.mjs`
- Create: `apps/web/vite/apiDevPlugin.ts`
- Modify: `apps/web/vite.config.ts`, root `package.json` (script `build` = build web + `node scripts/build-functions.mjs`), `vercel.json`, `.gitignore`

**Interfaces:**
- Produces:
  - `interface ApiRequest { method: string; path: string; query: Record<string,string>; headers: Record<string,string>; body: unknown }`
  - `interface ApiResponse { status: number; body: unknown }`
  - `type Handler = (req: ApiRequest, deps: ServerDeps) => Promise<ApiResponse>`
  - `route(req, deps): Promise<ApiResponse>`, que roteia por `method + path` e devolve 404 `{ error: 'not_found' }`.
  - `toNodeHandler(getDeps: () => ServerDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void>`, que lê JSON até 1 MB (acima disso → 413 `{ error: 'too_large' }`).
  - `ServerDeps`: começa com `{ env: ServerEnv }` e as Tasks 4–7 adicionam campos.
- `GET /api/health` → `200 { ok: true, core: CORE_VERSION }`.

- [ ] **Step 1: testes que falham** (`http.test.ts`): rota desconhecida dá 404; health dá 200 com `core`; corpo JSON inválido dá 400 `{ error: 'bad_json' }`; corpo > 1 MB dá 413.
- [ ] **Step 2:** implementar `http.ts`, `router.ts`, `nodeAdapter.ts` e `health.ts`.
- [ ] **Step 3: build das funções.** `scripts/build-functions.mjs` gera `.vercel/output/` (Build Output API v3):
  - `static/` = cópia de `apps/web/dist`.
  - `functions/api.func/index.mjs` = esbuild de `packages/server/src/vercelEntry.ts` (bundle, `platform: 'node'`, `format: 'esm'`, `target: 'node22'`).
  - `functions/api.func/.vc-config.json` = `{ "runtime": "nodejs22.x", "handler": "index.mjs", "launcherType": "Nodejs" }`.
  - `config.json` = `{ "version": 3, "routes": [ { "src": "/api/(.*)", "dest": "/api" }, { "handle": "filesystem" }, { "src": "/(.*)", "dest": "/index.html" } ] }`.
  - `vercelEntry.ts` exporta `default toNodeHandler(...)`, com `ServerDeps` montadas a partir de `process.env`.
  - `vercel.json` passa a ter só `buildCommand: "npm run build"` (sem `outputDirectory`/`rewrites`, que agora vêm do Build Output).
- [ ] **Step 4: dev.** `apiDevPlugin.ts` monta o mesmo `route` como middleware do Vite em `/api/*`. Ele carrega `packages/server` via `server.ssrLoadModule` e lê `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `SETUP_TOKEN` com `loadEnv(mode, root, '')` só no processo do dev server. Sem `.env.local`, só `/api/health` funciona; o resto responde 503 `{ error: 'online_not_configured' }`.
- [ ] **Step 5:** `npm test` e `npm run build` passam. `.vercel/output/functions/api.func/index.mjs` existe e `node -e "import('./.vercel/output/functions/api.func/index.mjs')"` não lança erro. `.vercel/` fica no `.gitignore`. Commit: `feat(server): pacote do servidor, roteador e build das funções`.
- [ ] **Step 6 (controlador):** depois do push, abrir `<preview>/api/health` no deploy de preview da Vercel e confirmar `{ ok: true }`. Se falhar, a decisão de empacotamento é revista antes da Task 4.

### Task 4: Pipeline de comandos no servidor e testes de não-vazamento [sonnet]

**Files:**
- Create: `packages/server/src/store.ts` (interface), `memoryStore.ts`, `commands.ts`, `commands.test.ts`, `leak.test.ts`, `imageGuard.ts`, `topics.ts`

**Interfaces:**
- Consumes: `Authority`, `audienceKey`, `project`, `ProjectedUpdate` (Task 1).
- Produces:
  - `interface CampaignStore { load(campaignId): Promise<CampaignState | null>; commit(c: CommitInput): Promise<'ok' | 'conflict'>; }`
  - `interface CommitInput { campaignId; expectedRevision: number; state: CampaignState; actor: Actor; command: Command; events: GameEvent[]; broadcasts: { topic: string; payload: ProjectedUpdate }[] }`
  - `topicFor(campaignId, audience): string` → `campaign:<id>:gm` | `campaign:<id>:player:<charId>`.
  - `processCommand(store, campaignId, actor, cmd, newId): Promise<CommandResult>`: carrega, roda `Authority.handle` e faz commit. Em `'conflict'` recarrega e tenta de novo, até 3 tentativas no total; depois disso devolve `{ ok: false, error: 'conflict' }` (novo `ErrorCode` `'conflict'` no core, com mensagem PT-BR "A mesa mudou ao mesmo tempo; tente de novo." em `i18n/errors.ts`).
  - `readState(store, campaignId, actor): Promise<ProjectedState | null>`.
  - `containsDataUrl(cmd: Command): boolean`: olha `portrait`, `fullBodyArt`, `tokenImage` e `background`. `processCommand` rejeita com `invalid_value` sem carregar estado.
  - `Authority.handle` precisa expor os eventos decididos: adicionar `events: GameEvent[]` a `HandleOutput`.
- [ ] **Step 1: testes que falham** (`commands.test.ts`, com `memoryStore`):
  - Um comando aplicado gera os broadcasts para os tópicos certos.
  - `memoryStore` configurado para devolver `conflict` uma vez: os dois comandos aplicados, com `seq` contígua (Review Focus 2).
  - 3 conflitos seguidos → `conflict`.
  - `createCharacter` com `portrait: 'data:image/png;base64,...'` → `invalid_value` (Review Focus 3).
  - `readState` de player traz a projeção de player (sem `revision`, sem NPC oculto).
- [ ] **Step 2: `leak.test.ts`.** Roda o roteiro de comandos da Task 5 da Fase 1 (NPC oculto, faixa de HP, mover oculto, revelar, remover) por `processCommand`. Para todo broadcast cujo tópico é `:player:`, serializa o payload e afirma que não contém ids de token/personagem ocultos nem `resources` de NPC `band`/`hidden`.
- [ ] **Step 3:** implementar. `npm test -w @vtt/server` passa. Commit: `feat(server): pipeline de comandos com retry e testes de não-vazamento`.

### Task 5: Schema do Supabase e store real [sonnet]

**Files:**
- Create: `supabase/migrations/0001_vtt_online.sql`
- Create: `packages/server/src/supabaseStore.ts`, `supabaseStore.test.ts`, `supabaseClient.ts`

**Interfaces:**
- Produces: `createSupabaseStore(client: SupabaseClient): CampaignStore`, `createServiceClient(env): SupabaseClient` (chave secreta, `auth: { persistSession: false }`).

- [ ] **Step 1: migration.** Conteúdo obrigatório:
  - **Tabelas:**
    - `campaigns(id uuid pk default gen_random_uuid(), slug text unique, name text not null, created_at timestamptz default now())`
    - `accounts(id uuid pk references auth.users on delete cascade, username text unique not null check (username ~ '^[a-z0-9][a-z0-9_-]{2,31}$'), role text not null check (role in ('gm','player')), campaign_id uuid references campaigns on delete cascade, character_id text, active boolean not null default true, created_at timestamptz default now(), check (role='gm' or (campaign_id is not null and character_id is not null)))`, com índice único `(campaign_id, character_id) where role='player'`.
    - `snapshots(campaign_id uuid pk references campaigns on delete cascade, revision int not null, state jsonb not null, updated_at timestamptz default now())`
    - `events(id bigserial pk, campaign_id uuid references campaigns on delete cascade, revision int not null, actor jsonb, command jsonb, events jsonb, created_at timestamptz default now(), unique(campaign_id, revision))`
    - `assets(id uuid pk, campaign_id uuid references campaigns on delete cascade, path text not null, kind text check (kind in ('image','audio')), bytes int not null, created_at timestamptz default now())`
  - **RLS:** ligado em todas as tabelas públicas, sem políticas (só o servidor, com a chave secreta, acessa).
  - **`vtt_commit`:** `public.vtt_commit(p_campaign uuid, p_expected int, p_state jsonb, p_actor jsonb, p_command jsonb, p_events jsonb, p_broadcasts jsonb) returns boolean`, `security definer`, `set search_path = public`.
    - Faz `update snapshots set state=p_state, revision=p_expected+1, updated_at=now() where campaign_id=p_campaign and revision=p_expected`. Sem linha afetada → `return false`.
    - Senão: `insert into events`; para cada elemento de `p_broadcasts`, `perform realtime.send(elem->'payload', 'update', elem->>'topic', true)`; `return true`.
    - `revoke execute ... from public, anon, authenticated; grant execute ... to service_role`.
  - **Policy em `realtime.messages`:** `for select to authenticated` com `extension = 'broadcast'`, a conta ativa (`exists(select 1 from public.accounts a where a.id = auth.uid() and a.active)`) e uma destas condições:
    - `(auth.jwt()->'app_metadata'->>'account_role') = 'gm' and realtime.topic() like 'campaign:%:gm'`
    - `realtime.topic() = 'campaign:' || (auth.jwt()->'app_metadata'->>'campaign_id') || ':player:' || (auth.jwt()->'app_metadata'->>'character_id')`
  - Nenhuma policy de insert (clientes não publicam).
  - **Bucket:** `insert into storage.buckets (id, name, public) values ('assets','assets', true) on conflict do nothing`. Sem policy de escrita para `anon`/`authenticated`; uploads só por URL assinada emitida pelo servidor.
- [ ] **Step 2: testes que falham** (`supabaseStore.test.ts`, com client fake que grava chamadas):
  - `load` faz select em `snapshots` por `campaign_id` e devolve `state` (com `revision` da coluna).
  - `commit` chama `rpc('vtt_commit', {...})` com os nomes de parâmetro exatos acima e mapeia `false` → `'conflict'`.
  - Erro do client → lança `Error('store_failed')`.
- [ ] **Step 3:** implementar. Testes passam. Commit: `feat(server): schema do Supabase e store real`.

### Task 6: Identidade, autorização e endpoints de jogo/admin [sonnet]

**Files:**
- Create: `packages/server/src/auth.ts`, `auth.test.ts`, `authAdmin.ts`
- Create: `packages/server/src/handlers/me.ts`, `state.ts`, `command.ts`, `campaigns.ts`, `accounts.ts`, `setup.ts`, mais um `handlers.test.ts` para todos
- Modify: `router.ts`, `vercelEntry.ts`, `ServerDeps`

**Interfaces:**
- Produces:
  - `interface Identity { userId: string; username: string; role: 'gm' | 'player'; campaignId: string | null; characterId: string | null; active: boolean }`
  - `identify(req, deps): Promise<Identity | null>`: Bearer token → `client.auth.getClaims(token)` (ou `getUser` se `getClaims` não existir na versão instalada) → linha de `accounts`. Inativa ou sem linha → `null`.
  - `actorFor(identity, campaignId): Actor | null`: GM → `{role:'gm'}` para qualquer campanha. Player → `{role:'player', characterId}` só se `campaignId === identity.campaignId`; senão `null`.
  - `emailFor(username) = `${username}@vtt.local``.
  - `interface AuthAdmin { createUser(email, password, appMetadata): Promise<string>; updatePassword(userId, password); setBanned(userId, banned: boolean) }`: wrapper fino sobre `client.auth.admin`; os testes usam fake.
  - `ServerDeps = { env, store: CampaignStore, identify, admin: AuthAdmin, db: AccountsRepo & CampaignsRepo, newId }`.
- **Endpoints** (todos exigem Bearer exceto `setup`). Sem identidade → 401 `{error:'unauthorized'}`; ator nulo → 403 `{error:'forbidden'}`.
  - `GET /api/me` → `{ username, role, campaignId, characterId }`.
  - `GET /api/state?campaignId=` → `{ state: ProjectedState }`; campanha inexistente → 404.
  - `POST /api/command {campaignId, command}` → `CommandResult` (200 mesmo com `ok:false`). `command` com `type` fora da lista de comandos → 400 `{error:'bad_command'}`.
  - `GET /api/campaigns` (gm) → `{ campaigns: {id,name,slug}[] }`.
  - `POST /api/campaigns {name}` (gm) → cria a linha e o snapshot `createCampaign(id, name)` com revisão 0 → `{ campaign }`.
  - `GET /api/accounts?campaignId=` (gm) → `{ accounts: {id,username,characterId,active}[] }` (sem senha).
  - `POST /api/accounts {campaignId, username, password, characterId}` (gm). Regras: senha com 6+ caracteres; `characterId` deve ser PC da campanha; usuário em uso → 409 `{error:'username_taken'}`; PC já com conta → 409 `{error:'character_taken'}`.
  - `PATCH /api/accounts {id, active?, password?}` (gm): `active:false` → `setBanned(true)` + `accounts.active=false`.
  - `POST /api/setup {token, username, password}`: `token` igual a `env.SETUP_TOKEN` (comparação em tempo constante) e nenhuma conta `gm` existente → cria o GM (`app_metadata {account_role:'gm'}`). Já existe → 409 `{error:'already_setup'}`. Token errado → 403.
- [ ] **Step 1: testes que falham** (com fakes):
  - Cada regra de status acima.
  - Player pedindo `state` de outra campanha → 403 (Review Focus 1).
  - Player mandando `startEncounter` → 200 `{ok:false,error:'not_gm'}`.
  - Conta inativa → 401 (Review Focus 5).
  - `accounts` nunca devolve campos de senha.
  - `setup` não roda duas vezes.
- [ ] **Step 2:** implementar. `npm test` passa. Commit: `feat(server): autenticação, autorização e endpoints`.

### Task 7: Upload de imagens para o Storage [sonnet]

**Files:**
- Create: `packages/server/src/handlers/assets.ts` (+ teste)
- Create: `apps/web/src/net/compressImage.ts` (+ teste), `apps/web/src/net/uploadImage.ts` (+ teste)
- Modify: `apps/web/src/gm/imageInput.ts`

**Interfaces:**
- Produces:
  - `POST /api/assets/upload-url {campaignId, contentType, bytes}` (gm). Aceita só `image/webp|png|jpeg` e `bytes <= 1_500_000` (senão 400 `{error:'bad_asset'}`). Path = `<campaignId>/<uuid>.<ext>`. Cria a linha em `assets` e devolve `{ path, token, publicUrl }` (via `storage.from('assets').createSignedUploadUrl(path)`).
  - `GET /api/assets/usage?campaignId=` (gm) → `{ bytes }`.
  - Web: `fitWithin(w, h, max = 2560): {w, h}` (puro, mantém a proporção, não aumenta). `compressImage(file): Promise<Blob>` (canvas → `image/webp`, qualidade 0.85, reduz para 0.7 se passar de 1 MB). `uploadImage(file, campaignId, api): Promise<string>` (comprime, pede a URL, `uploadToSignedUrl`, devolve `publicUrl`).
  - `imageInput` passa a receber um `ImageSink`: no modo local continua gerando data URL; no online usa `uploadImage`.
- [ ] **Step 1: testes que falham:**
  - `fitWithin(5000, 2500)` → `{w:2560, h:1280}`; `fitWithin(800, 600)` → igual.
  - O handler rejeita `image/gif` e 2 MB; player → 403.
  - `uploadImage` com api fake chama a sequência certa e devolve `publicUrl`.
- [ ] **Step 2:** implementar. Testes passam. Commit: `feat: upload de imagens para o Storage`.

### Task 8: OnlineTransport e seleção de modo [sonnet]

**Files:**
- Create: `apps/web/src/net/supabase.ts` (`getSupabase(): SupabaseClient | null`, null sem env), `apps/web/src/net/api.ts` (`createApi(getToken)`: `get/post/patch` JSON em `/api/*` com Bearer), `apps/web/src/net/onlineTransport.ts`, `onlineTransport.test.ts`
- Modify: `apps/web/src/net/transport.ts`, `apps/web/src/session/session.ts`, `apps/web/src/components/GameProvider.tsx`

**Interfaces:**
- Produces:
  - `type Session = { mode: 'local'; actor: Actor } | { mode: 'online'; actor: Actor; campaignId: string; username: string }`. Sessão local continua em `sessionStorage`. A sessão online é guardada em `sessionStorage` (actor/campaignId/username), mas o token fica com o `supabase-js` (localStorage, padrão dele).
  - `createTransport(session): Transport` → `LocalTransport` ou `OnlineTransport`.
  - `OnlineTransport.connect(session)`:
    1. `realtime.setAuth(accessToken)`.
    2. Assina o canal `topicFor(campaignId, audience)` com `{ config: { private: true } }` e espera `SUBSCRIBED` (timeout 10 s → rejeita com "Não foi possível conectar à mesa.").
    3. Só então faz `GET /api/state`.
    4. Broadcast `update` → `onUpdate`. `send` → `POST /api/command`. `resync` → `GET /api/state`. `reset` → no-op. `close` → `removeChannel` e cancela a inscrição do `onAuthStateChange`.
  - Em `TOKEN_REFRESHED`, chama `realtime.setAuth(novoToken)` (Review Focus 4).
- [ ] **Step 1: testes que falham** (`onlineTransport.test.ts`, com fake de `SupabaseClient` + fake `api`):
  - Assina antes de buscar o estado.
  - Repassa broadcasts.
  - `send` posta `{campaignId, command}`.
  - `TOKEN_REFRESHED` chama `setAuth` com o token novo.
  - Timeout de assinatura rejeita.
  - `close` remove o canal.
- [ ] **Step 2:** implementar; `GameProvider` usa `createTransport(session)`. Ajustar os testes da Fase 1 para o novo formato de `Session` (local). Testes e build passam. Commit: `feat(web): transporte online por Supabase Realtime`.

### Task 9: Login online, escolha de campanha e logout [sonnet]

**Files:**
- Create: `apps/web/src/pages/OnlineLoginPage.tsx` (+ teste), `apps/web/src/pages/CampaignPickerPage.tsx` (+ teste)
- Modify: `apps/web/src/routes.tsx`, `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/components/RequireSession.tsx`, logout nas três páginas

**Interfaces:**
- Consumes: `getSupabase`, `createApi`, `Session` (Task 8).
- Comportamento:
  - Com `getSupabase() !== null`, `/login` mostra o formulário online (Usuário, Senha, "Entrar").
  - `signInWithPassword({ email: emailFor(usuario), password })`, depois `GET /api/me`.
  - Player → grava a sessão online e vai para `/jogador`.
  - GM → `/campanhas`: lista + "Nova campanha" (nome) → escolher grava a sessão com `campaignId` e vai para `/mestre`.
  - Erro de credencial → "Usuário ou senha incorretos."
  - "Sair" chama `supabase.auth.signOut()` + `clearSession()`.
  - Sem Supabase configurado, `/login` continua o da Fase 1.
  - `/mesa` aberta pelo GM ou pelo player reaproveita a sessão (`openTableWindow` copia o `sessionStorage`; o token vem do localStorage do supabase-js).
- [ ] **Step 1: testes que falham:**
  - Login de player navega para `/jogador`.
  - Login de GM navega para `/campanhas`.
  - Credencial errada mostra a mensagem.
  - Criar campanha chama `POST /api/campaigns` e entra nela.
  - Sem env mostra o login local.
- [ ] **Step 2:** implementar. Testes e build passam. Commit: `feat(web): login online e escolha de campanha`.

### Task 10: Painel de contas no /mestre [sonnet]

**Files:**
- Create: `apps/web/src/gm/AccountsPanel.tsx` (+ teste)
- Modify: `apps/web/src/pages/MestrePage.tsx` (nova aba "Contas" só no modo online; "Reiniciar campanha" escondido no online), `apps/web/src/gm/gm.css`

**Interfaces:**
- Consumes: endpoints `accounts` e `assets/usage` (Tasks 6 e 7).
- Comportamento:
  - Lista as contas (usuário, personagem, ativa).
  - "Nova conta": usuário, senha e um select dos PCs sem conta.
  - "Desativar"/"Reativar".
  - "Redefinir senha" com prompt.
  - Mensagens de erro PT-BR: `username_taken` → "Esse usuário já existe."; `character_taken` → "Esse personagem já tem conta."; senha curta → "A senha precisa de pelo menos 6 caracteres."
  - Rodapé com o uso do Storage em MB (1 casa decimal).
- [ ] **Step 1: testes que falham** (api fake): criar envia o corpo certo; o select exclui os PCs com conta; desativar manda `PATCH {active:false}`; mostra os erros mapeados; a aba não aparece no modo local.
- [ ] **Step 2:** implementar. Testes passam. Commit: `feat(web): painel de contas do mestre`.

### Task 11: Importador no /mestre [sonnet]

**Files:**
- Create: `apps/web/src/gm/ImportPanel.tsx` (+ teste), `apps/web/src/gm/importCharacters.ts` (+ teste)

**Interfaces:**
- Consumes: `parseLegacyBackup` (Task 2), `ImageSink`/`uploadImage` (Task 7), `send` do store.
- Produces: `importCharacters(drafts, opts: { sink: ImageSink; send }): Promise<{ imported: number; failed: { name: string; reason: string }[] }>`. Para cada draft: sobe cada imagem `data:` pelo `sink` (online) ou mantém (local), troca no `input` e manda `createCharacter`. Uma falha não interrompe os outros.
- Comportamento: botão "Importar do legado" na aba Personagens → escolher o `.json` → pré-visualização (nome, tipo editável PC/NPC, HP), com todos marcados → "Importar N personagens" → resumo "N importados; M falharam" com motivos. Arquivo inválido → "Arquivo não reconhecido como backup do app antigo." Versão não suportada → "Versão do backup não suportada."
- [ ] **Step 1: testes que falham:**
  - `importCharacters` com sink fake troca as data URLs pelas URLs devolvidas.
  - Uma imagem que falha conta como `failed` e o resto segue.
  - O painel mostra a pré-visualização da fixture e importa só os marcados.
  - Trocar o tipo na pré-visualização muda o `kind` enviado.
- [ ] **Step 2:** implementar. Testes passam. Commit: `feat(web): importador de personagens no painel do mestre`.

### Task 12: Guia de configuração online [haiku]

**Files:**
- Create: `docs/online-setup.md`, `.env.example`
- Modify: `README.md` (seção "Modo online" apontando o guia), `.gitignore` (`.env*`, `!.env.example`, `.vercel/`)

- [ ] **Step 1:** escrever o guia, em português, passo a passo para quem não é técnico:
  1. Criar projeto no Supabase (região mais próxima, plano gratuito).
  2. SQL Editor → colar `supabase/migrations/0001_vtt_online.sql` → Run.
  3. Authentication → desligar "Allow new users to sign up".
  4. Copiar Project URL, a publishable key e a secret key (onde ficam no painel).
  5. Criar `.env.local` na raiz com `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `SETUP_TOKEN` (texto longo aleatório). Explicar que esse arquivo nunca vai para o git.
  6. Na Vercel (projeto `vat`) → Settings → Environment Variables: as mesmas 5 variáveis em Production e Preview.
  7. Criar o mestre: `curl -X POST <url>/api/setup` com `{token, username, password}` (ou PowerShell `Invoke-RestMethod`, mostrar os dois).
  8. Smoke test: login de mestre → criar campanha → criar PC → criar conta do jogador → em janela anônima logar como jogador → mover token → ver nas duas.
  9. Teste de vazamento manual: no DevTools do jogador (aba Network/WS) não aparecem NPCs ocultos. Assinar `campaign:<id>:gm` no console com o token do jogador é recusado.
  10. Desativar a conta do jogador → a próxima ação dele falha.
- [ ] **Step 2:** `.env.example` com as 5 chaves e valores vazios, comentário "Nunca prefixe chaves secretas com VITE_". Commit: `docs: guia de configuração do modo online`.

### Task 13: Verificação de ponta a ponta (mestre + controlador)

Não é tarefa de subagente.
- Depois das Tasks 1–12 revisadas, o controlador pede ao mestre que siga `docs/online-setup.md` passos 1–7.
- Com o `.env.local` criado pelo mestre, o controlador roda o dev server e faz o smoke test (passos 8–10) no navegador interno: GM numa aba, jogador numa janela/perfil separado, porque as sessões do Supabase ficam no localStorage por origem.
- Mede a latência clique → update na tela em 10 movimentos de token; o alvo é p95 < 500 ms (spec 12.1).
- Registra os resultados. Se a latência passar do alvo, abre item no backlog (alternativa da spec: Edge Function).
