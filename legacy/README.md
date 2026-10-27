# RPG Codex VTT

VTT de RPG focado em **mesa tática narrativa** com uma Cena central, gerenciamento de elenco, arsenal avançado (incluindo editor em grafo), combate por turnos, dashboard dedicado do mestre, sincronização online com Supabase e painel de jogador.

---

## O que este app cobre

- Controle de sessão em tempo real para mestre e jogadores.
- Gestão completa de personagens, NPCs, ações, condições, efeitos e recursos (HP, Aura, munição, defesa/stagger).
- Fluxo de combate com iniciativa, ordem dinâmica, log automático e resolução de ações.
- Catálogo e atribuição de arsenal (habilidades, selos, itens e armas).
- Criação de habilidades em **grafo visual** com simulação e validação.
- Persistência local robusta (IndexedDB + autosave) com backup/restauração em JSON.
- Modo online com autenticação, revisão de ações dos jogadores e sincronização versionada da campanha.

---

## Funcionalidades detalhadas

### 1) Cena (núcleo do VTT)

A Cena é o cockpit principal da sessão.

- **Mapa/cenário** com imagem customizável e posicionamento de tokens.
- **Controle de participantes** (party e NPCs), incluindo presença/ocultação.
- **Combate por turnos** com:
  - rolagem de iniciativa,
  - avanço/reordenação da ordem,
  - rodada atual,
  - pausa de combate.
- **Barra de efeitos de campo** ativos.
- **Menu de ações** do combatente ativo (ataques, habilidades e itens).
- **Prévia de alvo e impacto** no grid antes da resolução.
- **Condições/efeitos canônicos** (incluindo efeitos contínuos por rodada).
- **Editor rápido de combatente** durante a cena.
- **Log de resolução automático** com busca e notas do mestre.
- **Modo streaming** para ocultar informações sensíveis na tela.
- **Cinemáticas/eventos visuais** (turno, rodada, críticos, quebra de defesa, stagger etc.).

### 2) Dashboard do Mestre (`?view=gm-dashboard`)

Janela separada para operar a sessão sem poluir a tela principal.

Seções:

- **Geral**: visão da sessão e controles rápidos.
- **Elenco**:
  - criar/editar/excluir personagens,
  - clonar personagem para NPC de cena,
  - colocar/retirar da cena,
  - exportar personagem.
- **Arsenal**:
  - editar catálogo,
  - atribuir cartas/entradas aos personagens.
- **Sessão** (subáreas):
  - **Comando**: pausar, rerolar iniciativa, resetar status, limpar log, encerrar/reiniciar combate, vitrine da pausa, efeito em massa.
  - **Dados**: controle de rolagens ocultas.
  - **Cenário**: ajustes rápidos da cena.
  - **Biblioteca**: salvar/aplicar templates de cena.
- **Online**: sincronização com Supabase e administração de acessos de jogadores.

### 3) Arsenal unificado

- Categorias: **habilidade**, **selo**, **item**, **arma**.
- Visualização em grade/lista, busca e filtro por personagem.
- Atribuição de cartas/entradas para um ou mais personagens.
- Exportação do arsenal completo ou arsenal por personagem.
- Edição detalhada de itens e selos (custos, alvo, área, cooldown/cargas, efeitos avançados, ritual).

### 4) Editor de Habilidades em Grafo

- Construção visual por nós (triggers, alvo, controle, modificadores, forma, condições etc.).
- Templates e wizard para geração inicial.
- Overrides por nível.
- Simulador e preview integrados.
- Validação estrutural do grafo antes de salvar.

### 5) Personagens e NPCs

- Ficha completa com stats de combate, recursos e vínculos.
- Equipamento/arsenal por personagem.
- Gerenciamento de elenco ativo e banco de NPCs da cena.
- Exportação para arquivo de personagem (usado também no visualizador externo).

### 6) Modo online (mestre e jogador)

Fluxo de produção com APIs serverless em `/api` + Supabase.

- **Setup inicial** da mesa (`/api/setup/bootstrap`).
- **Login/sessão** com perfis GM e Player.
- **Sincronização de snapshot da campanha** com controle de revisão.
- **Contas de jogador por personagem** (criadas pelo mestre).
- **Solicitações de ação de jogador**:
  - jogador envia,
  - mestre aprova/rejeita,
  - execução atualiza snapshot online.
- **Movimento online de token** com validação de turno/revisão.
- **Painel do jogador** (`?view=player-online`) com visão filtrada da Cena e envio de ações.

---

## Persistência e backup

### Local (padrão)

- Persistência primária em **IndexedDB** (`utils/database.ts`).
- Snapshot versionado (`SNAPSHOT_VERSION`) cobrindo todo o estado do app.
- Autosave unificado com debounce + flush em eventos de visibilidade/saída.

### Backup manual

- **Ctrl/Cmd + S** exporta backup JSON completo.
- O arquivo exportado pode ser:
  - usado para restauração local,
  - usado como base para envio ao modo online.

---

## Estrutura principal do repositório

- `/tabs/cena` — UI e fluxo de combate/cena.
- `/components/gmDashboard` — dashboard separado do mestre.
- `/components/arsenal` — workspace de arsenal e editor em grafo.
- `/components/characters` — gestão de personagens/NPCs.
- `/components/online` — telas e painéis de modo online.
- `/online` — clients e contratos do modo online.
- `/api` — endpoints serverless (auth, campaign, player, admin, setup).
- `/utils` — regras de domínio (ações, encounter, efeitos, defesa, persistência etc.).
- `/supabase/migrations` — schema e evolução do banco online.
- `/docs/online-setup.md` — guia de configuração do modo online.
- `/visualizador-personagem` — app isolado para abrir export de personagem e montar ritual 9x9.

---

## Como rodar localmente

Pré-requisito: Node.js.

```bash
npm install
npm run dev
```

Scripts úteis:

```bash
npm run test
npm run build
npm run preview
```

---

## Configuração do modo online

1. Configure variáveis de ambiente com base em `.env.example`.
2. Execute as migrations em `/supabase/migrations`.
3. Faça o bootstrap inicial da mesa.
4. Use o painel Online do dashboard do mestre para sincronizar dados e criar acessos.

Detalhes completos: `/home/runner/work/rpg/rpg/docs/online-setup.md`.

---

## Atalhos relevantes

- **Ctrl/Cmd + S**: exportar snapshot JSON da campanha.
- **Cena**:
  - **Esc**: abrir/fechar dashboard do mestre.
  - **M**: pausar/despausar combate.
- **Dashboard do mestre**:
  - **Esc**: fechar janela.
  - **M**: pausar/despausar combate.
  - **1..5**: trocar seção do dashboard.

---

## Visualizador de personagem (subapp)

A pasta `/visualizador-personagem` contém uma página independente para abrir exportações de personagem, incluindo construtor de ritual visual 9x9 com validação de conexões e evento de confirmação para integração externa.

README específico: `/home/runner/work/rpg/rpg/visualizador-personagem/README.md`.
