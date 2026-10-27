# Fase 1 — Fundação: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Legado em `/legacy`, monorepo novo com `@vtt/core` (modelo, comandos, eventos, reducer, projeção, autoridade) e `apps/web` com `/login`, `/mestre`, `/mesa`, `/jogador` funcionando em modo local entre abas: grid e tokens em PixiJS, mestre cria personagens/tokens e edita HP/Aura/Munição, jogador vê a própria ficha, iniciativa e turnos.

**Architecture:** Comandos → `decide` → eventos → `applyEvent` (estado completo, só na autoridade). A autoridade (`Authority`, em `core`) envia a cada audiência um `ProjectedUpdate` (diferença entre projeções + cues). Em modo local a autoridade roda num `SharedWorker` compartilhado por todas as abas e persiste em IndexedDB; as páginas só conhecem a interface `Transport`.

**Tech Stack:** TypeScript 5.8, React 19.2, Vite 6, Vitest 2.1.9 + Testing Library + jsdom, react-router 7, zustand 5, pixi.js 8, idb-keyval 6, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-27-vtt-reconstrucao-design.md` (seções 4, 5, 6.1, 7, 11 fase 1, 11.1, 12.1)

**Modelos de execução (pedido do mestre):** tarefas marcadas **[haiku]** são mecânicas; **[sonnet]** envolvem lógica/UI. Revisões entre tarefas usam sonnet.

## Global Constraints

- `packages/core` não importa DOM, React, Pixi nem nada de `apps/`. Só TS puro.
- Nenhum arquivo de código novo passa de ~300 linhas; um componente/módulo por responsabilidade.
- Identificadores de código em inglês; **todo texto visível ao usuário em português**.
- Nenhuma chave secreta em variável `VITE_`.
- Nada de `/legacy` é importado pelo código novo (pode ser lido como referência).
- Desktop primeiro; nas páginas, layout não pode quebrar em 1280×720.
- Porta de dev continua `3177` (`.claude/launch.json` existente, `npm run dev`).
- Jogador **nunca** recebe: tokens ocultos, personagens NPC sem token visível, recursos de NPC com visibilidade `band`/`hidden`.
- Visibilidade entre PJs (spec 11.1): status exato dos outros PJs; inventário/ações deles não existem ainda nesta fase.

## Review Focus

1. Revelar um token oculto precisa fazer o NPC aparecer para os jogadores (personagem + token chegam juntos) — teste na Task 4.
2. Remover/excluir o personagem cujo token está no turno atual durante o combate — o turno passa para o próximo sem pular ninguém nem quebrar índice — teste na Task 2.
3. Duas abas movendo tokens para a mesma célula ao mesmo tempo — a segunda é rejeitada com `cell_occupied` — teste na Task 5.
4. Aba que perdeu atualizações (dormiu, recarregou o worker) — o cliente resincroniza em vez de aplicar diferença fora de ordem — teste na Task 6.
5. Reduzir o grid deixando tokens fora — comando rejeitado com `tokens_out_of_bounds`, nada muda — teste na Task 3.

---

### Task 1: Mover legado e montar o monorepo **[haiku]**

**Files:**
- Move (git mv): todo o conteúdo da raiz para `legacy/`, **exceto** `.git`, `.claude/`, `docs/`, `LICENSE`, `.gitignore`.
- Create: `package.json` (raiz), `tsconfig.base.json`, `vercel.json` (substitui), `README.md` (curto, novo)
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts`, `packages/core/src/index.test.ts`
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`

**Interfaces:**
- Produces: pacote `@vtt/core` (`"main"`/`"exports"` → `./src/index.ts`, sem build), app `@vtt/web` dependendo de `"@vtt/core": "*"`.
- Raiz `package.json`: `"private": true`, `"workspaces": ["packages/*", "apps/*"]`, scripts `dev` = `npm run dev -w @vtt/web --`, `build` = `npm run build -w @vtt/web`, `test` = `npm run test --workspaces --if-present`.
- `apps/web` script `dev` = `vite` (aceita `--port 3177 --strictPort` vindo do launch.json), `test` = `vitest run`.
- `vercel.json`: `buildCommand: "npm run build"`, `outputDirectory: "apps/web/dist"`, `framework: "vite"`, rewrite SPA `{ "source": "/(.*)", "destination": "/index.html" }`.

- [ ] **Step 1:** `git mv` cada item da raiz para `legacy/` (lista via `git ls-files` + pastas). Conferir que `legacy/package.json` e `legacy/App.tsx` existem e a raiz só tem `.claude docs legacy LICENSE .gitignore`.
- [ ] **Step 2:** Adicionar `legacy/node_modules`, `**/dist`, `node_modules` ao `.gitignore` se faltarem.
- [ ] **Step 3:** Criar os arquivos da raiz, de `packages/core` e de `apps/web` listados acima. Deps de `apps/web`: `react@^19.2.4 react-dom@^19.2.4 react-router@^7.6.0 zustand@^5.0.5 pixi.js@^8.9.0 idb-keyval@^6.2.1 lucide-react@^0.574.0`; dev: `@vitejs/plugin-react@^5.0.0 vite@^6.2.0 vitest@^2.1.9 jsdom@^25.0.1 @testing-library/react@^16.3.2 @testing-library/dom@^10.4.1 typescript@~5.8.2 @types/react @types/react-dom`. `packages/core` dev: `vitest@^2.1.9 typescript@~5.8.2`.
- [ ] **Step 4:** Testes-fumaça. `packages/core/src/index.test.ts`: `expect(CORE_VERSION).toBe('0.1.0')` (exportar `CORE_VERSION` de `index.ts`). `apps/web/src/App.test.tsx`: renderiza `<App />` e encontra o texto `VTT`.
- [ ] **Step 5:** Run: `npm install && npm test` → Expected: 2 arquivos de teste PASS. Run: `npm run build` → Expected: `apps/web/dist/index.html` gerado.
- [ ] **Step 6:** Commit `chore: move app antigo para /legacy e cria monorepo`.

---

### Task 2: Modelo de domínio e reducer **[sonnet]**

**Files:**
- Create: `packages/core/src/model.ts`, `packages/core/src/events.ts`, `packages/core/src/reducer.ts`, `packages/core/src/campaign.ts`
- Test: `packages/core/src/reducer.test.ts`, `packages/core/src/campaign.test.ts`
- Modify: `packages/core/src/index.ts` (re-exportar)

**Interfaces:**
- Produces (`model.ts`):
```ts
export type Id = string;
export interface Cell { col: number; row: number }
export interface Pool { current: number; max: number }
export type ResourceKey = 'hp' | 'aura' | 'ammo';
export type Resources = Record<ResourceKey, Pool>;
export type HpVisibility = 'exact' | 'band' | 'hidden';
export interface Character {
  id: Id; kind: 'pc' | 'npc'; name: string;
  portrait: string; fullBodyArt: string; tokenImage: string; // URLs ou data URLs; '' = sem imagem
  resources: Resources; speed: number;
  hpVisibility: HpVisibility; // só tem efeito em NPCs; PCs sempre 'exact'
}
export interface Token { id: Id; characterId: Id; cell: Cell; size: 1; hidden: boolean }
export interface Grid { cols: number; rows: number; cellSize: number; visible: boolean }
export interface Scene { id: Id; name: string; mode: 'tactical'; background: string; grid: Grid; tokens: Record<Id, Token> }
export interface InitiativeEntry { tokenId: Id; initiative: number }
export interface Encounter { active: boolean; round: number; turnIndex: number; order: InitiativeEntry[] }
export interface CampaignState {
  campaignId: Id; name: string; revision: number;
  characters: Record<Id, Character>; scene: Scene; encounter: Encounter;
}
export type Actor = { role: 'gm' } | { role: 'player'; characterId: Id };
```
- Produces (`events.ts`) — união discriminada por `type`:
  `characterCreated{character}`, `characterUpdated{characterId, patch: Partial<Omit<Character,'id'|'resources'>>}`, `characterDeleted{characterId}`, `resourceSet{characterId, resource: ResourceKey, pool: Pool}`, `tokenPlaced{token}`, `tokenMoved{tokenId, from: Cell, to: Cell}`, `tokenRemoved{tokenId}`, `tokenVisibilitySet{tokenId, hidden}`, `gridUpdated{grid, background}`, `encounterStarted{order: InitiativeEntry[]}`, `turnAdvanced{turnIndex, round}`, `initiativeReordered{order}`, `encounterEnded{}`. Tipo `GameEvent`.
- Produces: `applyEvent(state: CampaignState, event: GameEvent): CampaignState` (imutável, não altera `revision`); `applyEvents(state, events): CampaignState`.
- Produces (`campaign.ts`): `createCampaign(campaignId: Id, name: string): CampaignState` — cena `{ id: 'scene-1', name: 'Cena inicial', mode: 'tactical', background: '', grid: { cols: 20, rows: 12, cellSize: 64, visible: true }, tokens: {} }`, encontro `{ active: false, round: 0, turnIndex: 0, order: [] }`, `revision: 0`; `defaultResources(): Resources` = hp 20/20, aura 10/10, ammo 0/0.

- [ ] **Step 1: testes que falham** (`reducer.test.ts`), com um helper `pc('a')`/`npc('n')` e `withTokens(...)`:
  - `characterCreated` adiciona em `characters`; `characterDeleted` remove.
  - `resourceSet` troca só o pool indicado.
  - `tokenMoved` atualiza `cell`; `tokenVisibilitySet` atualiza `hidden`.
  - `encounterStarted` → `active: true, round: 1, turnIndex: 0, order` igual ao evento.
  - `turnAdvanced{turnIndex:0, round:2}` grava os dois valores.
  - **Review Focus 2:** com ordem `[t1,t2,t3]` e `turnIndex: 1` (t2), `tokenRemoved{t2}` → ordem `[t1,t3]`, `turnIndex: 1` (agora t3, ninguém pulado); com `turnIndex: 2` (t3, último), `tokenRemoved{t3}` → `turnIndex: 0`, `round` inalterado; com `turnIndex: 2`, `tokenRemoved{t1}` → `turnIndex: 1` (continua t3).
  - `encounterEnded` → `active: false, round: 0, turnIndex: 0, order: []`.
  - `applyEvent` não muta o estado de entrada (`Object.freeze` profundo no estado de teste).
  - `campaign.test.ts`: `createCampaign('c1','X')` bate com os valores acima.
- [ ] **Step 2:** Run `npm test -w @vtt/core` → FAIL (módulos inexistentes).
- [ ] **Step 3:** Implementar `model.ts`, `events.ts`, `campaign.ts`, `reducer.ts` (switch exaustivo com `never`). `tokenRemoved` também remove a entrada do `order`, com o ajuste de `turnIndex` acima.
- [ ] **Step 4:** Run `npm test -w @vtt/core` → PASS.
- [ ] **Step 5:** Commit `feat(core): modelo de domínio e reducer de eventos`.

---

### Task 3: Comandos e `decide` (validação e permissões) **[sonnet]**

**Files:**
- Create: `packages/core/src/commands.ts`, `packages/core/src/decide.ts`, `packages/core/src/initiative.ts`
- Test: `packages/core/src/decide.test.ts`, `packages/core/src/initiative.test.ts`

**Interfaces:**
- Consumes: Task 2 (`CampaignState`, `GameEvent`, `Actor`, `applyEvent`).
- Produces (`commands.ts`) — união por `type`:
  `createCharacter{ input: Omit<Character,'id'> }`, `updateCharacter{characterId, patch}`, `deleteCharacter{characterId}`, `setResource{characterId, resource, current?: number, max?: number}`, `placeToken{characterId, cell, hidden?: boolean}`, `moveToken{tokenId, to: Cell}`, `removeToken{tokenId}`, `setTokenHidden{tokenId, hidden}`, `updateGrid{grid: Grid, background: string}`, `startEncounter{entries: InitiativeEntry[]}`, `nextTurn{}`, `reorderInitiative{order: Id[]}` (tokenIds), `endEncounter{}`. Tipo `Command`.
- Produces: `type ErrorCode = 'not_gm' | 'not_found' | 'out_of_bounds' | 'cell_occupied' | 'not_your_token' | 'not_your_turn' | 'invalid_value' | 'no_encounter' | 'encounter_active' | 'tokens_out_of_bounds' | 'invalid_order'`.
- Produces: `interface DecideContext { actor: Actor; newId: () => Id }`; `type DecideResult = { ok: true; events: GameEvent[] } | { ok: false; error: ErrorCode }`; `decide(state: CampaignState, cmd: Command, ctx: DecideContext): DecideResult`.
- Produces (`initiative.ts`): `sortInitiative(entries: InitiativeEntry[], state: CampaignState): InitiativeEntry[]` — iniciativa desc, empate por `speed` desc, depois `name` asc (localeCompare 'pt-BR').

Regras que o `decide` aplica:
- Tudo é `not_gm` para jogador, **exceto** `moveToken` e `nextTurn`.
- `moveToken` de jogador: personagem do token tem que ser `actor.characterId`, senão `not_your_token`; com encontro ativo, o token tem que ser o do turno atual, senão `not_your_turn`. Fora de combate pode mover livremente.
- Células fora de `0..cols-1 / 0..rows-1` → `out_of_bounds`; célula com outro token → `cell_occupied` (vale para `placeToken` e `moveToken`). Mover para a própria célula → `ok` com zero eventos.
- `setResource`: valores inteiros ≥ 0; `max` de `hp` ≥ 1, senão `invalid_value`; `current` é limitado a `[0, max]` (clamp, não erro).
- `createCharacter`: `name.trim()` não vazio, senão `invalid_value`; id vem de `ctx.newId()`.
- `deleteCharacter`: emite `tokenRemoved` para cada token do personagem e depois `characterDeleted`.
- `updateGrid`: `cols`/`rows` entre 1 e 100, `cellSize` entre 16 e 256, senão `invalid_value`; se algum token ficaria fora → `tokens_out_of_bounds` (Review Focus 5).
- `startEncounter`: encontro ativo → `encounter_active`; lista vazia ou token inexistente → `invalid_order`; emite `encounterStarted` com `sortInitiative(entries)`.
- `nextTurn`: sem encontro → `no_encounter`; jogador só se o token atual for dele (`not_your_turn`). Próximo índice; ao passar do último, `turnIndex: 0, round + 1`.
- `reorderInitiative`: tem que ser uma permutação exata dos tokenIds do `order`, senão `invalid_order`; mantém o token atual como atual (recalcula `turnIndex`) e emite `initiativeReordered` + `turnAdvanced` com o índice novo e a mesma rodada.

- [ ] **Step 1: testes que falham** — um `it` por regra acima, com o código de erro exato. Inclua: jogador movendo o token de outro PJ → `not_your_token`; jogador movendo o próprio fora do turno em combate → `not_your_turn`; `setResource{hp, max: 0}` → `invalid_value`; `setResource{current: 999}` com max 20 → evento com `current: 20`; `updateGrid` encolhendo para 5×5 com token em `{col: 7, row: 2}` → `tokens_out_of_bounds`; `nextTurn` no último → `round` +1; `sortInitiative` com empate de iniciativa desempatado por speed e depois por nome.
- [ ] **Step 2:** Run `npm test -w @vtt/core` → FAIL.
- [ ] **Step 3:** Implementar `commands.ts`, `initiative.ts`, `decide.ts` (um handler por comando, num mapa `type → handler`; arquivo ≤ 300 linhas, se passar dividir em `decide/characters.ts`, `decide/tokens.ts`, `decide/encounter.ts`).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(core): comandos com validação e permissões`.

---

### Task 4: Projeção por audiência, diferença e cues **[sonnet]**

**Files:**
- Create: `packages/core/src/projection.ts`, `packages/core/src/diff.ts`, `packages/core/src/cues.ts`
- Test: `packages/core/src/projection.test.ts`, `packages/core/src/diff.test.ts`, `packages/core/src/cues.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces:
```ts
export type Audience = { kind: 'gm' } | { kind: 'player'; characterId: Id };
export type HpBand = 'ileso' | 'ferido' | 'grave' | 'beira';
export interface ProjectedCharacter extends Omit<Character, 'resources'> { resources: Resources | null; hpBand: HpBand | null }
export interface ProjectedEncounter { active: boolean; round: number; order: InitiativeEntry[]; currentTokenId: Id | null }
export interface ProjectedState {
  audience: Audience; campaignId: Id; name: string; revision: number;
  characters: Record<Id, ProjectedCharacter>; scene: Scene; encounter: ProjectedEncounter;
}
export function hpBand(hp: Pool): HpBand; // ratio = current/max: >=1 'ileso', >0.5 'ferido', >0.25 'grave', senão 'beira'
export function project(state: CampaignState, audience: Audience): ProjectedState;
export function audienceKey(a: Audience): string; // 'gm' | `player:${id}`
export function actorAudience(actor: Actor): Audience;

export type Change =
  | { kind: 'upsertCharacter'; character: ProjectedCharacter } | { kind: 'removeCharacter'; id: Id }
  | { kind: 'upsertToken'; token: Token } | { kind: 'removeToken'; id: Id }
  | { kind: 'setScene'; scene: Omit<Scene, 'tokens'> } | { kind: 'setEncounter'; encounter: ProjectedEncounter }
  | { kind: 'setName'; name: string };
export interface ProjectedUpdate { revision: number; changes: Change[]; cues: Cue[] }
export function diffProjection(before: ProjectedState, after: ProjectedState): Change[];
export function applyChanges(p: ProjectedState, changes: Change[], revision: number): ProjectedState;

export type Cue =
  | { type: 'token-moved'; tokenId: Id; from: Cell; to: Cell }
  | { type: 'turn-started'; tokenId: Id; round: number }
  | { type: 'resource-changed'; characterId: Id; resource: ResourceKey; delta: number };
export function cuesFor(events: GameEvent[], before: CampaignState, after: ProjectedState): Cue[];
```

Regras de `project` para jogador:
- Tokens com `hidden: true` somem; personagens só aparecem se forem `pc` **ou** tiverem pelo menos um token visível.
- NPC com `hpVisibility: 'exact'` → `resources` completos, `hpBand: null`; `'band'` → `resources: null`, `hpBand` calculado; `'hidden'` → `resources: null`, `hpBand: null`. PCs → sempre exatos.
- `encounter.order` sem os tokens ocultos; `currentTokenId` = token atual se visível, senão `null`.
- Para `gm`: tudo, `hpBand: null`, `currentTokenId` = `order[turnIndex]?.tokenId ?? null`.

`diffProjection`: compara personagens e tokens por id com igualdade estrutural (JSON estável); `setScene` se nome/modo/fundo/grid mudaram; `setEncounter` se mudou; ordem dos changes: removes antes de upserts, personagens antes de tokens.

`cuesFor`: `tokenMoved` → `token-moved` só se o token existe em `after`; `turnAdvanced`/`encounterStarted` → `turn-started` com o token atual de `after` (nenhum se `null`); `resourceSet` → `resource-changed` com `delta = novo.current − anterior.current` só se `after.characters[id].resources !== null`.

- [ ] **Step 1: testes que falham:**
  - `hpBand`: 20/20 → `ileso`; 11/20 → `ferido`; 10/20 → `grave`; 5/20 → `beira`; 0/20 → `beira`.
  - Jogador não vê token oculto nem o NPC dele; GM vê os dois.
  - NPC `band` com 8/20 → `resources: null, hpBand: 'grave'`; `JSON.stringify(project(...))` **não contém** `"current":8` (pega vazamento por acidente).
  - Outro PC aparece com recursos exatos para o jogador.
  - `currentTokenId` é `null` para o jogador quando o token atual está oculto.
  - **Review Focus 1:** estado com NPC só com token oculto → `setTokenHidden(false)` aplicado → `diffProjection(antes, depois)` para jogador contém `upsertCharacter` (o NPC) **e** `upsertToken`, nessa ordem.
  - Propriedade: para uma lista fixa de ~15 sequências de comandos (criar PC/NPC, posicionar, ocultar, revelar, mover, alterar HP, iniciar combate, avançar, excluir), para cada audiência (gm e cada PC), `applyChanges(project(s,a), diffProjection(project(s,a), project(s2,a)), s2.revision)` deep-equals `project(s2,a)`.
  - Cues: mover token oculto não gera cue para jogador; `resourceSet` de NPC `band` não gera `resource-changed` para jogador mas gera para GM.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implementar os três arquivos.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(core): projeção por audiência, diff e cues`.

---

### Task 5: Autoridade **[sonnet]**

**Files:**
- Create: `packages/core/src/authority.ts`
- Test: `packages/core/src/authority.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:
```ts
export type CommandResult = { ok: true; revision: number } | { ok: false; error: ErrorCode };
export interface AudienceUpdate { audience: Audience; update: ProjectedUpdate }
export interface HandleOutput { result: CommandResult; updates: AudienceUpdate[] }
export class Authority {
  constructor(state: CampaignState, deps: { newId: () => Id });
  getState(): CampaignState;
  snapshotFor(audience: Audience): ProjectedState;
  handle(actor: Actor, cmd: Command): HandleOutput;
}
```
- `handle`: roda `decide`; se erro → `{ result: {ok:false}, updates: [] }` e estado intacto. Se ok e com eventos → aplica, `revision + 1`, calcula para **cada audiência conhecida** (gm + cada personagem `pc` existente antes **ou** depois do comando) a diferença e os cues; omite audiências com `changes` e `cues` vazios. Comando ok sem eventos → revisão não muda, sem updates.
- A autoridade é síncrona e processa um comando por vez (a serialização garante consistência).

- [ ] **Step 1: testes que falham:**
  - Comando inválido não altera `getState()` nem a revisão.
  - `createCharacter` de PC gera update para `gm` e para `player:<novoId>`.
  - `setResource` em NPC `hidden` gera update para gm e **nenhum** para jogadores.
  - **Review Focus 3:** dois `moveToken` seguidos de tokens diferentes para a mesma célula → o primeiro `ok`, o segundo `{ ok: false, error: 'cell_occupied' }`.
  - `update.revision` igual a `getState().revision` após cada comando aceito.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(core): autoridade com updates por audiência`.

---

### Task 6: Transporte local (SharedWorker) e store do cliente **[sonnet]**

**Files:**
- Create: `apps/web/src/net/transport.ts`, `apps/web/src/net/protocol.ts`, `apps/web/src/net/localWorker.ts`, `apps/web/src/net/localTransport.ts`, `apps/web/src/net/fakeTransport.ts`
- Create: `apps/web/src/store/gameStore.ts`
- Test: `apps/web/src/net/workerHost.test.ts`, `apps/web/src/store/gameStore.test.ts`
- Create: `apps/web/src/net/workerHost.ts` (lógica do worker sem APIs de worker, testável)

**Interfaces:**
- Consumes: `Authority`, `createCampaign`, `Command`, `CommandResult`, `ProjectedState`, `ProjectedUpdate`, `Actor`, `actorAudience`, `audienceKey`, `applyChanges` de `@vtt/core`.
- Produces (`transport.ts`):
```ts
export type Session = Actor; // fase 2 troca por sessão autenticada
export interface Transport {
  connect(session: Session): Promise<ProjectedState>;
  onUpdate(listener: (u: ProjectedUpdate) => void): () => void;
  send(cmd: Command): Promise<CommandResult>;
  resync(): Promise<ProjectedState>;
  close(): void;
}
export function createTransport(): Transport; // fase 1: sempre local
```
- `protocol.ts`: mensagens cliente→worker `{t:'connect', session}`, `{t:'command', reqId, cmd}`, `{t:'resync'}`, `{t:'reset'}`; worker→cliente `{t:'snapshot', state}`, `{t:'result', reqId, result}`, `{t:'update', update}`.
- `workerHost.ts`: `createWorkerHost(store: { load(): Promise<CampaignState | undefined>; save(s: CampaignState): Promise<void> })` → `{ attach(port: { postMessage(m): void }): (msg) => void }`. Cada porta guarda sua `Audience` após `connect`; updates vão só para portas com o mesmo `audienceKey`. Salva após cada comando aceito. Sem estado salvo → `createCampaign('local', 'Campanha local')`. `reset` recria a campanha e manda `snapshot` para todas as portas.
- `localWorker.ts`: `onconnect` do SharedWorker liga `createWorkerHost` com `idb-keyval` (`get/set('vtt-local-campaign')`). Instanciado em `localTransport.ts` com `new SharedWorker(new URL('./localWorker.ts', import.meta.url), { type: 'module', name: 'vtt-authority' })`.
- `fakeTransport.ts`: `createFakeTransport(initial?: CampaignState)` usando `Authority` em memória (para testes de UI), com `sent: Command[]`.
- `gameStore.ts` (zustand):
```ts
interface GameStore {
  status: 'idle' | 'connecting' | 'ready' | 'error';
  state: ProjectedState | null;
  cues: Array<{ id: number; cue: Cue }>;
  lastError: ErrorCode | null;
  connect(t: Transport, s: Session): Promise<void>;
  send(cmd: Command): Promise<CommandResult>; // grava lastError se falhar
  takeCues(): Cue[]; // devolve e limpa a fila
}
export const useGame: UseBoundStore<StoreApi<GameStore>>;
export function createGameStore(): typeof useGame; // para testes isolados
```
- **Review Focus 4:** ao receber update com `revision !== state.revision + 1`, o store chama `transport.resync()` e substitui o estado (e descarta os cues desse update).

- [ ] **Step 1: testes que falham** (`workerHost.test.ts`, portas falsas que acumulam mensagens): connect devolve snapshot da audiência; comando do gm gera `result` para quem enviou e `update` só para portas da audiência afetada; jogador não recebe update de NPC oculto; `save` chamado após comando aceito e não após rejeitado. (`gameStore.test.ts`, com `createFakeTransport`): `connect` → `status: 'ready'`; update em sequência aplicado; update com revisão pulada → `resync` chamado uma vez e estado igual ao do transporte; `send` rejeitado → `lastError` com o código.
- [ ] **Step 2:** Run `npm test -w @vtt/web` → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(web): transporte local em SharedWorker e store do jogo`.

---

### Task 7: Rotas, sessão, login local e tema **[haiku]**

**Files:**
- Create: `apps/web/src/session/session.ts`, `apps/web/src/routes.tsx`, `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/components/RequireSession.tsx`, `apps/web/src/components/GameProvider.tsx`
- Create: `apps/web/src/theme/themes.ts`, `apps/web/src/theme/applyTheme.ts`, `apps/web/src/theme/base.css`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/main.tsx`
- Test: `apps/web/src/pages/LoginPage.test.tsx`, `apps/web/src/theme/applyTheme.test.ts`

**Interfaces:**
- Consumes: `Session`, `createTransport`, `useGame`.
- Produces: `getSession(): Session | null`, `setSession(s: Session): void`, `clearSession(): void` — em **sessionStorage** chave `vtt.session` (cada aba tem sua sessão; GM e jogador podem coexistir no mesmo navegador).
- Rotas: `/login`, `/mestre` (exige `role: 'gm'`), `/jogador` (exige `role: 'player'`), `/mesa` (qualquer sessão; a audiência é a da sessão — sessão gm vê a visão de mestre), `/` → redireciona conforme sessão.
- Abrir `/mesa` a partir de `/jogador` ou `/mestre` usa `window.open('/mesa', '_blank')` **sem** `noopener`, para que o navegador copie o `sessionStorage` para a aba nova (um `<a target="_blank">` comum não copia). `RequireSession({ role?, children })` redireciona para `/login`.
- `GameProvider` conecta `useGame` uma vez por aba com `createTransport()` e a sessão, e mostra "Conectando…" até `status === 'ready'`.
- `LoginPage` (modo local): botão **"Entrar como Mestre"**; seção **"Entrar como jogador"** que lista os PCs (conecta temporariamente como gm só para listar — aceitável apenas no modo local, comentar no código) com botão por personagem; texto "Nenhum personagem jogador criado ainda." se vazio. Após escolher, vai para `/mestre` ou `/jogador`.
- `themes.ts`: `interface Theme { id: 'dark-fantasy' | 'neutral'; name: string; colors: { bg; surface; surfaceAlt; text; textMuted; accent; danger; ok; pc; npc; grid } ; fonts: { display; body } }` com os dois temas (dark-fantasy: fundo `#120c0e`, acento carmesim `#b3263a`, ouro `#c9a227`, inspirado em `legacy/utils/theme.ts`; neutral: cinzas). `applyTheme(theme)` escreve `--color-*` e `--font-*` em `document.documentElement`. Padrão: dark-fantasy.

- [ ] **Step 1: testes que falham:** `applyTheme` define `--color-accent`; `LoginPage` com fake transport contendo 1 PC "Lia" mostra botão "Lia" e, ao clicar, `getSession()` vira `{ role: 'player', characterId }`; sem PCs mostra a mensagem de vazio.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar (`LoginPage` recebe `transportFactory` por prop opcional para teste). **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(web): rotas, sessão local, login e temas`.

---

### Task 8: Tabletop em PixiJS **[sonnet]**

**Files:**
- Create: `apps/web/src/tabletop/geometry.ts`, `apps/web/src/tabletop/camera.ts`, `apps/web/src/tabletop/TabletopApp.ts`, `apps/web/src/tabletop/tokenSprite.ts`, `apps/web/src/tabletop/Tabletop.tsx`
- Test: `apps/web/src/tabletop/geometry.test.ts`, `apps/web/src/tabletop/camera.test.ts`

**Interfaces:**
- Consumes: `ProjectedState`, `Cue`, `Cell`, `Theme`.
- Produces (`geometry.ts`): `cellToPx(cell: Cell, cellSize: number): { x: number; y: number }` (centro da célula), `pxToCell(p: {x,y}, cellSize): Cell` (floor), `clampCell(cell, grid): Cell`, `isInside(cell, grid): boolean`.
- Produces (`camera.ts`): `interface Camera { x: number; y: number; zoom: number }`; `zoomAt(cam, factor, screenPoint): Camera` (mantém o ponto sob o cursor fixo; zoom limitado a `[0.25, 4]`); `pan(cam, dx, dy): Camera`; `screenToWorld(cam, p)`, `worldToScreen(cam, p)`; `fitGrid(grid, viewport: {w,h}): Camera`.
- Produces (`TabletopApp.ts`):
```ts
export interface TabletopOptions {
  theme: Theme; gmView: boolean;
  canDrag(tokenId: Id): boolean;
  onTokenDrop(tokenId: Id, cell: Cell): void;
  onTokenSelect?(tokenId: Id | null): void;
}
export class TabletopApp {
  static create(host: HTMLElement, opts: TabletopOptions): Promise<TabletopApp>;
  render(state: ProjectedState): void;   // reconcilia sprites por id
  playCues(cues: Cue[]): void;           // token-moved: tween 250ms ease-out; turn-started: pulso no token
  setOptions(opts: Partial<TabletopOptions>): void;
  destroy(): void;
}
```
- Visual: fundo (imagem da cena ou cor `bg`), linhas do grid na cor `grid` com alpha 0.35 quando `grid.visible`; token = círculo com imagem `tokenImage` (fallback: iniciais do nome), anel `pc`/`npc`; arco de HP ao redor quando `resources` existe; brilho dourado no `currentTokenId`; token oculto (só na visão gm) com alpha 0.45 e ícone de olho riscado; nome abaixo.
- Interação: roda do mouse = `zoomAt`; arrastar área vazia = `pan`; arrastar token (se `canDrag`) mostra a célula de destino destacada e ao soltar chama `onTokenDrop` com `clampCell(pxToCell(...))`; o token volta para a posição do estado até chegar o update (sem movimento otimista na fase 1). Clique em token → `onTokenSelect`.
- `Tabletop.tsx`: componente React que cria/destrói `TabletopApp`, chama `render` a cada mudança de `state` e passa `useGame.getState().takeCues()` para `playCues` após cada render.

- [ ] **Step 1: testes que falham** (só os helpers puros): `cellToPx({col:2,row:1},64)` → `{x:160,y:96}`; `pxToCell({x:127,y:64},64)` → `{col:1,row:1}`; `clampCell({col:-1,row:99},{cols:20,rows:12,...})` → `{col:0,row:11}`; `zoomAt` mantém o ponto mundial sob o cursor (tolerância 1e-9) e respeita os limites; `fitGrid` centraliza um grid 20×12×64 num viewport 1280×720.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar helpers, depois `TabletopApp`, `tokenSprite` e `Tabletop.tsx` (Pixi não é testado em jsdom; validação visual na Task 11). **Step 4:** Run → PASS e `npm run build` sem erro de tipo.
- [ ] **Step 5:** Commit `feat(web): tabletop PixiJS com grid, tokens, câmera e arrasto`.

---

### Task 9: Página do Mestre **[sonnet]**

**Files:**
- Create: `apps/web/src/pages/MestrePage.tsx`, `apps/web/src/gm/CharacterList.tsx`, `apps/web/src/gm/CharacterForm.tsx`, `apps/web/src/gm/ResourceEditor.tsx`, `apps/web/src/gm/ScenePanel.tsx`, `apps/web/src/gm/EncounterPanel.tsx`, `apps/web/src/gm/imageInput.ts`, `apps/web/src/components/ErrorToast.tsx`, `apps/web/src/i18n/errors.ts`
- Test: `apps/web/src/gm/CharacterForm.test.tsx`, `apps/web/src/gm/ResourceEditor.test.tsx`, `apps/web/src/gm/EncounterPanel.test.tsx`, `apps/web/src/i18n/errors.test.ts`

**Interfaces:**
- Consumes: `useGame`, `Tabletop`, `Command`, `ErrorCode`, `createFakeTransport`.
- Produces: `errorMessage(code: ErrorCode): string` com todas as chaves (ex.: `cell_occupied` → "Essa célula já está ocupada.", `not_your_turn` → "Não é o seu turno.", `tokens_out_of_bounds` → "Há tokens fora do novo tamanho do grid. Mova-os antes.").
- `imageInput.ts`: `readImageFile(file: File, maxSide = 1024): Promise<string>` — redimensiona via canvas e devolve data URL WebP (fase 2 troca por upload no Storage).

Layout `/mestre` (grid CSS em 3 colunas: 320px | 1fr | 320px):
- **Esquerda, abas "Personagens" / "Cena" / "Encontro".**
  - Personagens: `CharacterList` (PJs e NPCs separados, botão "Novo personagem", ações por item: "Colocar na cena" (primeira célula livre a partir de 0,0), "Editar", "Excluir" com confirmação).
  - `CharacterForm`: nome, tipo (Jogador/NPC), retrato, arte de corpo inteiro, imagem do token, velocidade, HP/Aura/Munição máximos, visibilidade de HP (só NPC: "Exato", "Faixa", "Oculto"). Salvar → `createCharacter` ou `updateCharacter` + `setResource` para máximos alterados.
  - Cena: colunas, linhas, tamanho da célula, mostrar grid, imagem de fundo → `updateGrid`.
  - Encontro: sem combate → lista de tokens na cena com checkbox e campo de iniciativa (botão "Rolar" usa `1d20 + speed` localmente com `Math.random`, provisório até a fase 3) → "Iniciar combate" (`startEncounter`). Com combate: rodada, ordem com destaque do atual, botões ↑/↓ (`reorderInitiative`), "Próximo turno" (`nextTurn`), "Encerrar combate" (`endEncounter`).
- **Centro:** `Tabletop` com `gmView: true`, `canDrag` sempre true, drop → `moveToken`.
- **Direita:** personagem do token selecionado: `ResourceEditor` por recurso (atual/máx com botões −1/+1, −5/+5 e campo numérico → `setResource`), botão "Ocultar/Revelar token" (`setTokenHidden`), "Remover da cena" (`removeToken`).
- `ErrorToast` mostra `errorMessage(lastError)` por 4 s.

- [ ] **Step 1: testes que falham:** `CharacterForm` submetendo nome "Goblin", NPC, HP máx 12 envia `createCharacter` com `kind: 'npc'`, `resources.hp = {current:12,max:12}` (verificar em `fake.sent`); nome vazio desabilita "Salvar". `ResourceEditor` com HP 10/20: clicar "−5" envia `setResource{resource:'hp', current:5}`. `EncounterPanel`: iniciar com dois tokens marcados envia `startEncounter` com as duas entradas; em combate, "Próximo turno" envia `nextTurn`. `errorMessage` cobre todos os `ErrorCode` (teste itera uma lista literal com os 11 códigos e espera string não vazia).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(web): página do mestre com elenco, cena, encontro e recursos`.

---

### Task 10: Página do Jogador **[haiku]**

**Files:**
- Create: `apps/web/src/pages/JogadorPage.tsx`, `apps/web/src/player/CharacterSheet.tsx`, `apps/web/src/player/ResourceBar.tsx`, `apps/web/src/player/AlliesPanel.tsx`, `apps/web/src/player/TurnBanner.tsx`
- Test: `apps/web/src/player/JogadorPage.test.tsx`

**Interfaces:**
- Consumes: `useGame`, `getSession`, `ProjectedState`, `createFakeTransport`.
- Layout: coluna esquerda larga com **arte de corpo inteiro** (`fullBodyArt`; fallback `portrait`; fallback silhueta CSS) e nome; coluna direita com `ResourceBar` para HP, Aura, Munição (barra + "atual / máx"; Munição some se máx 0), `TurnBanner` e `AlliesPanel` (outros PJs: retrato pequeno, nome, barras de HP/Aura exatas).
- `TurnBanner`: sem combate → "Fora de combate"; em combate e `currentTokenId` é um token do jogador → **"Seu turno!"** + botão **"Encerrar turno"** (`nextTurn`); senão → "Turno de <nome>" ou "Turno de alguém oculto" quando `currentTokenId` é `null`; mostra "Rodada N".
- Botão "Abrir a mesa" → `window.open('/mesa', '_blank')` (ver Task 7).

- [ ] **Step 1: testes que falham:** com fake transport (PC "Lia" 15/20 HP, PC "Bran", combate com token da Lia atual): renderiza "Lia", "15 / 20", "Seu turno!"; clicar "Encerrar turno" envia `nextTurn`; aliado "Bran" aparece; quando o turno é de um NPC oculto mostra "Turno de alguém oculto".
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(web): página do jogador com ficha, aliados e turno`.

---

### Task 11: Página da Mesa e verificação ponta a ponta **[sonnet]**

**Files:**
- Create: `apps/web/src/pages/MesaPage.tsx`, `apps/web/src/mesa/TurnStrip.tsx`
- Test: `apps/web/src/mesa/TurnStrip.test.tsx`

**Interfaces:**
- Consumes: `Tabletop`, `useGame`, `getSession`.
- `/mesa`: `Tabletop` em tela cheia; `gmView` = sessão gm; `canDrag(tokenId)` = gm, ou jogador e token dele e (sem combate ou é o token atual). Drop → `moveToken`; erros via `ErrorToast`.
- `TurnStrip` (faixa no topo, sobreposta): em combate mostra "Rodada N" e os retratos da ordem visível com o atual destacado; fora de combate, o nome da cena.

- [ ] **Step 1: teste que falha:** `TurnStrip` com combate de 3 tokens visíveis mostra "Rodada 2" e marca o atual com `aria-current="true"`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementar. **Step 4:** Run `npm test` (todos os workspaces) → PASS; `npm run build` → sucesso.
- [ ] **Step 5: verificação manual no navegador** (preview `dev`, porta 3177), em abas separadas:
  1. Aba A `/login` → Mestre. Criar PC "Lia" (HP 20) e NPC "Goblin" (HP 12, visibilidade "Faixa"). Colocar os dois na cena; ocultar o token do Goblin.
  2. Aba B `/login` → jogador Lia → `/jogador` mostra Lia 20/20. Aba C `/mesa` (mesma sessão da B, aberta pelo link) não mostra o Goblin.
  3. Na A, revelar o Goblin → aparece na C sem recarregar, com anel de NPC e **sem** arco numérico (faixa).
  4. Na A, HP do Goblin −5 → C não mostra número; A mostra 7/12.
  5. Iniciar combate com Lia primeiro → B mostra "Seu turno!"; arrastar Lia na C funciona; arrastar para a célula do Goblin mostra "Essa célula já está ocupada."; "Encerrar turno" na B → turno do Goblin, arrastar Lia na C passa a ser bloqueado.
  6. Recarregar todas as abas → estado persiste (IndexedDB).
  7. Console sem erros nas três abas.
- [ ] **Step 6:** Commit `feat(web): página da mesa com faixa de turnos`.

---

## Depois desta fase

Planos seguintes (um por fase do spec, escritos ao fim da anterior): **Fase 2 Online** (Supabase, spike de JWT/Realtime, `/api/command`, `/api/state`, login real com conta de mestre e várias campanhas, importador de personagens com fixtures geradas a partir de `legacy/`, upload de imagens), **Fase 3 Ações e regras** (marco jogável).
