# Contrato de integração ritualística

O construtor usa somente cartas canônicas com `category: "selo"` ou `category: "item"`.

## Propriedades da peça

Selos armazenam a configuração em `seal.ritual`; itens, em `item.ritual`:

```json
{
  "enabled": true,
  "key": "selo-do-fogo",
  "role": "nucleo",
  "connectors": ["top", "right", "bottom", "left"],
  "rotationAllowed": true,
  "maxPerRitual": 1,
  "connectionTags": ["fogo", "arcano"],
  "forbiddenConnectionTags": ["agua"],
  "consumedOnConfirm": false
}
```

- `key`: identificador estável usado nas receitas; não precisa ser o UUID da carta.
- `role`: `nucleo`, `condutor`, `modificador`, `catalisador` ou `material`.
- `connectors`: `top`, `right`, `bottom`, `left` e, opcionalmente, as quatro diagonais.
- `maxPerRitual`: omita ou use `0` para não impor limite estrutural.
- `connectionTags`: canais oferecidos pela peça.
- `forbiddenConnectionTags`: canais com os quais ela não pode se ligar.
- `consumedOnConfirm`: relevante para itens; consome uma unidade colocada no grid.

## Receitas

Todas as receitas ativas ficam em `ritual-combinations.json`. Para criar outra, duplique um objeto dentro de `ritualCombinations`, altere o `id` e use as chaves `ritual.key` das peças:

```json
{
  "id": "ritual-exemplo",
  "name": "Ritual Exemplo",
  "requiredNodes": ["selo-a", "selo-b"],
  "optionalNodes": ["selo-estabilizador"],
  "requiredMaterials": [
    { "id": "po-lunar", "name": "Pó Lunar", "quantity": 1 }
  ],
  "validStructures": ["line", "triangle"],
  "ordered": false,
  "minimumConnections": 2,
  "forbiddenTags": [],
  "requiredTags": [],
  "cost": { "aura": 3, "hp": 0 },
  "result": { "effectType": "custom", "name": "Efeito Exemplo" }
}
```

O arquivo é carregado automaticamente quando a página roda pelo contêiner/servidor. Em abertura direta por `file://`, importe o mesmo JSON pelo botão **Importar regras**.
