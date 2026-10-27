# Visualizador de personagem — RPG Codex

Esta pasta é uma página independente para abrir os arquivos JSON gerados pelo botão **Exportar personagem e cartas** do RPG Codex.

Além da ficha, o botão **Construir ritual** abre uma matriz visual 9×9. O sistema adapta automaticamente as cartas já exportadas:

- cartas de categoria `selo` viram nós de selo;
- cartas de categoria `item` viram materiais, preservando a quantidade em `character.arsenal`;
- habilidades e armas são ignoradas pelo construtor.

Selos e itens novos carregam `seal.ritual` ou `item.ritual`, configurados no editor original: chave estável, conectores, rotação, papel, limites e regras de compatibilidade. Arquivos antigos continuam abrindo com quatro conectores cardinais como fallback.

É possível arrastar, mover, girar e remover peças, visualizar conexões válidas/inválidas, detectar a geometria, salvar modelos e confirmar rituais. A confirmação emite o evento `rpg-codex:ritual-confirmed`, que pode ser escutado por uma integração com o VTT.

## Uso simples

Compartilhe a pasta inteira e abra `index.html` em qualquer navegador moderno. Depois, use **Escolher arquivo** ou arraste o JSON exportado para a página.

Os dados são processados localmente no navegador. Não existe upload, banco de dados, login ou dependência do projeto principal.

## Uso como contêiner

Na raiz desta pasta:

```sh
docker build -t rpg-codex-personagem .
docker run --rm -p 8080:80 rpg-codex-personagem
```

Abra `http://localhost:8080`.

## Estrutura

- `index.html`: página isolada;
- `styles.css`: apresentação responsiva e impressão;
- `app.js`: importação, validação e exibição dos dados;
- `ritual-engine.js`: adaptação dos JSONs, conexões, geometria e validação;
- `ritual-builder.js` e `ritual.css`: interface do construtor;
- `ritual-combinations.json`: todas as combinações ativas, separado da interface e editável diretamente;
- `ritual-combinations.example.json`: exemplo de arquivo externo importável;
- `RITUAL_SCHEMA.md`: referência dos novos campos de selo/item e das receitas;
- `Dockerfile` e `nginx.conf`: contêiner web opcional.

## Combinações personalizadas

Edite `ritual-combinations.json` para alterar ou acrescentar receitas. Quando a página é servida pelo contêiner/servidor, esse arquivo é carregado automaticamente. Ao abrir `index.html` diretamente por `file://`, use **Importar regras** e escolha o mesmo arquivo manualmente. `ritual-combinations.example.json` documenta um modelo genérico.
