# VTT RPG

Mesa virtual para RPG de mesa: o mestre organiza a campanha, os jogadores acompanham a mesa em tempo real. Esta é a reconstrução do projeto, feita como monorepo.

## Estrutura

- `apps/web` — aplicação web (Vite + React).
- `packages/core` — regras e modelo de domínio (`@vtt/core`).
- `legacy/` — o app antigo, mantido apenas para referência.

## Como usar

```bash
npm install
npm run dev     # sobe o app web
npm test        # roda os testes de todos os pacotes
npm run build   # gera apps/web/dist
```

Para uma porta fixa: `npm run dev -- --port 3177 --strictPort`.

## Legado

O app anterior está em `/legacy` e não faz parte do workspace.
