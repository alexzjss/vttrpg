(function (global) {
  'use strict';

  const DIRECTIONS = {
    top: [-1, 0], right: [0, 1], bottom: [1, 0], left: [0, -1],
    topLeft: [-1, -1], topRight: [-1, 1], bottomLeft: [1, -1], bottomRight: [1, 1]
  };
  const OPPOSITE = { top: 'bottom', right: 'left', bottom: 'top', left: 'right', topLeft: 'bottomRight', topRight: 'bottomLeft', bottomLeft: 'topRight', bottomRight: 'topLeft' };
  const ROTATE = { top: 'right', right: 'bottom', bottom: 'left', left: 'top', topLeft: 'topRight', topRight: 'bottomRight', bottomRight: 'bottomLeft', bottomLeft: 'topLeft' };

  function normalize(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function amountValue(value) {
    if (typeof value === 'number') return value;
    if (!value || typeof value !== 'object') return 0;
    return Number(value.flat) || 0;
  }

  function explicitConnectors(card) {
    const candidates = [card.seal?.ritual?.connectors, card.item?.ritual?.connectors, card.connectors, card.ritual?.connectors, card.seal?.connectors, card.metadata?.ritual?.connectors];
    return candidates.find(value => Array.isArray(value) && value.length)?.filter(value => DIRECTIONS[value]);
  }

  function inferredConnectors(type, card) {
    const explicit = explicitConnectors(card);
    if (explicit) return explicit;
    if (type === 'material') return ['top', 'right', 'bottom', 'left'];
    if (type === 'seal') return card.seal?.kind === 'sustentado'
      ? ['top', 'bottom', 'left', 'right', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight']
      : ['top', 'right', 'bottom', 'left'];
    return ['top', 'right', 'bottom', 'left'];
  }

  function cardType(card) {
    if (card.type === 'seal' || card.category === 'selo') return 'seal';
    if (card.type === 'material' || card.category === 'item') return 'material';
    return null;
  }

  function adaptCharacterExport(payload) {
    const character = payload?.character || payload || {};
    const cards = Array.isArray(payload?.cards) ? payload.cards : [];
    const holdings = new Map((character.arsenal || []).map(item => [item.cardId, item]));
    const legacyOwned = new Set([...(character.cardIds || []), ...(character.sealIds || [])]);
    const pieces = cards.map(card => {
      const type = cardType(card);
      const holding = holdings.get(card.id);
      const ritual = type === 'seal' ? card.seal?.ritual : type === 'material' ? card.item?.ritual : null;
      if (!type || ritual?.enabled === false || (!holding && !legacyOwned.has(card.id))) return null;
      const tags = [...new Set([
        ...(Array.isArray(card.tags) ? card.tags : []), card.element, card.category, card.abilityType,
        card.seal?.kind, card.seal?.type, ritual?.key, ritual?.role, ...(ritual?.connectionTags || []), normalize(card.name)
      ].filter(Boolean).map(String))];
      const quantity = type === 'material' ? Math.max(0, Number(holding?.quantity ?? card.item?.quantity ?? 1) || 0) : 1;
      return {
        id: card.id, name: card.name || 'Peça sem nome', description: card.description || '', icon: card.icon || card.image || '', type,
        tags, quantity, connectors: inferredConnectors(type, card), rotationAllowed: ritual?.rotationAllowed ?? card.rotationAllowed ?? card.metadata?.ritual?.rotationAllowed ?? true,
        ritualKey: ritual?.key || normalize(card.name), role: ritual?.role || (type === 'seal' ? 'condutor' : 'material'),
        maxPerRitual: Number(ritual?.maxPerRitual) > 0 ? Number(ritual.maxPerRitual) : null,
        connectionTags: ritual?.connectionTags || [], forbiddenConnectionTags: ritual?.forbiddenConnectionTags || [],
        consumedOnConfirm: type === 'material' ? (ritual?.consumedOnConfirm ?? true) : false,
        source: card, holding: holding || null
      };
    }).filter(Boolean);
    return {
      characterId: character.id || payload?.characterId || '', characterName: character.name || 'Personagem',
      resources: { hp: Number(character.currentHp ?? payload?.resources?.hp ?? 0), aura: Number(character.currentAura ?? payload?.resources?.aura ?? 0) },
      pieces, seals: pieces.filter(piece => piece.type === 'seal'), materials: pieces.filter(piece => piece.type === 'material'),
      sourceCharacter: character
    };
  }

  function rotatedConnectors(node) {
    let connectors = [...(node.definition.connectors || [])];
    const turns = ((Number(node.rotation) || 0) / 90 % 4 + 4) % 4;
    for (let turn = 0; turn < turns; turn += 1) connectors = connectors.map(direction => ROTATE[direction]);
    return connectors;
  }

  function directionBetween(a, b) {
    const row = b.row - a.row; const col = b.col - a.col;
    return Object.entries(DIRECTIONS).find(([, delta]) => delta[0] === row && delta[1] === col)?.[0] || null;
  }

  function forbiddenPair(a, b) {
    const rulesA = a.definition.source?.ritual?.forbiddenConnections || a.definition.source?.metadata?.ritual?.forbiddenConnections || [];
    const rulesB = b.definition.source?.ritual?.forbiddenConnections || b.definition.source?.metadata?.ritual?.forbiddenConnections || [];
    const tokensA = tokens(a); const tokensB = tokens(b);
    const offeredA = new Set([...(a.definition.connectionTags || []), ...tokensA].map(normalize));
    const offeredB = new Set([...(b.definition.connectionTags || []), ...tokensB].map(normalize));
    const forbiddenA = [...rulesA, ...(a.definition.forbiddenConnectionTags || [])].map(normalize);
    const forbiddenB = [...rulesB, ...(b.definition.forbiddenConnectionTags || [])].map(normalize);
    return forbiddenA.some(rule => offeredB.has(rule)) || forbiddenB.some(rule => offeredA.has(rule));
  }

  function buildConnections(nodes) {
    const connections = [];
    for (let aIndex = 0; aIndex < nodes.length; aIndex += 1) {
      for (let bIndex = aIndex + 1; bIndex < nodes.length; bIndex += 1) {
        const a = nodes[aIndex]; const b = nodes[bIndex]; const direction = directionBetween(a, b);
        if (!direction) continue;
        const aHas = rotatedConnectors(a).includes(direction);
        const bHas = rotatedConnectors(b).includes(OPPOSITE[direction]);
        if (!aHas && !bHas) continue;
        const prohibited = forbiddenPair(a, b);
        const valid = aHas && bHas && !prohibited;
        connections.push({ id: `${a.instanceId}:${b.instanceId}`, from: a.instanceId, to: b.instanceId, direction, valid, status: prohibited ? 'forbidden' : valid ? 'valid' : 'invalid', reason: prohibited ? 'Ligação proibida pelas regras da peça.' : valid ? 'Conectores compatíveis.' : `Conector ${aHas ? OPPOSITE[direction] : direction} ausente em ${aHas ? b.definition.name : a.definition.name}.` });
      }
    }
    return connections;
  }

  function graphConnected(nodes, validConnections) {
    if (nodes.length < 2) return nodes.length === 1;
    const seen = new Set([nodes[0].instanceId]);
    let changed = true;
    while (changed) {
      changed = false;
      validConnections.forEach(connection => {
        if (seen.has(connection.from) && !seen.has(connection.to)) { seen.add(connection.to); changed = true; }
        if (seen.has(connection.to) && !seen.has(connection.from)) { seen.add(connection.from); changed = true; }
      });
    }
    return seen.size === nodes.length;
  }

  function detectGeometry(nodes, connections) {
    if (!nodes.length) return 'empty';
    if (nodes.length === 1) return 'cluster';
    const valid = connections.filter(connection => connection.valid);
    const rows = new Set(nodes.map(node => node.row)); const cols = new Set(nodes.map(node => node.col));
    if ((rows.size === 1 || cols.size === 1) && graphConnected(nodes, valid)) return 'line';
    const degrees = new Map(nodes.map(node => [node.instanceId, 0]));
    valid.forEach(connection => { degrees.set(connection.from, degrees.get(connection.from) + 1); degrees.set(connection.to, degrees.get(connection.to) + 1); });
    if (nodes.length === 3 && valid.length === 3) return 'triangle';
    if (nodes.length === 4 && rows.size === 2 && cols.size === 2 && valid.length >= 4) return 'square';
    if (nodes.length >= 5 && [...degrees.values()].some(value => value >= 4)) return 'cross';
    if (graphConnected(nodes, valid) && valid.length >= nodes.length && [...degrees.values()].every(value => value >= 2)) return 'circle';
    if (graphConnected(nodes, valid) && valid.length === nodes.length - 1 && [...degrees.values()].some(value => value >= 3)) return 'tree';
    if (graphConnected(nodes, valid)) return 'cluster';
    return 'unknown';
  }

  function tokens(node) {
    return new Set([node.definition.id, node.definition.name, ...(node.definition.tags || [])].map(normalize));
  }

  function matchRequiredNodes(required, nodes) {
    const available = nodes.map((node, index) => ({ node, index, used: false }));
    const matched = []; const missing = [];
    (required || []).forEach(requirement => {
      const normalized = normalize(typeof requirement === 'object' ? requirement.id || requirement.tag || requirement.name : requirement);
      const found = available.find(candidate => !candidate.used && tokens(candidate.node).has(normalized));
      if (found) { found.used = true; matched.push({ requirement, node: found.node }); } else missing.push(requirement);
    });
    return { matched, missing };
  }

  function materialCount(nodes, requirement) {
    const wanted = normalize(requirement.id || requirement.tag || requirement.name);
    return nodes.filter(node => node.definition.type === 'material' && tokens(node).has(wanted)).length;
  }

  function materialInventory(characterData, requirement) {
    const wanted = normalize(requirement.id || requirement.tag || requirement.name);
    return characterData.materials.filter(piece => new Set([piece.id, piece.name, ...(piece.tags || [])].map(normalize)).has(wanted)).reduce((sum, piece) => sum + piece.quantity, 0);
  }

  function orderedCorrect(requiredNodes, nodes) {
    const order = [...nodes].sort((a, b) => a.row - b.row || a.col - b.col);
    let cursor = 0;
    for (const requirement of requiredNodes || []) {
      const wanted = normalize(typeof requirement === 'object' ? requirement.id || requirement.tag || requirement.name : requirement);
      const index = order.findIndex((node, position) => position >= cursor && tokens(node).has(wanted));
      if (index < 0) return false;
      cursor = index + 1;
    }
    return true;
  }

  function normalizeCombinations(input) {
    const combinations = Array.isArray(input) ? input : input?.ritualCombinations;
    if (!Array.isArray(combinations)) throw new Error('O arquivo de combinações deve conter “ritualCombinations”.');
    return combinations.map((combination, index) => ({
      id: combination.id || `ritual-${index + 1}`, name: combination.name || `Ritual ${index + 1}`, description: combination.description || '',
      requiredNodes: combination.requiredNodes || [], optionalNodes: combination.optionalNodes || [], requiredMaterials: combination.requiredMaterials || [],
      validStructures: combination.validStructures || [], ordered: !!combination.ordered, minimumConnections: Number(combination.minimumConnections) || 0,
      forbiddenTags: combination.forbiddenTags || [], requiredTags: combination.requiredTags || [], cost: combination.cost || {}, result: combination.result || {}
    }));
  }

  function validateRitual(gridState, characterData, combinationData) {
    const nodes = Array.isArray(gridState?.nodes) ? gridState.nodes : [];
    const connections = buildConnections(nodes);
    const validConnections = connections.filter(connection => connection.valid);
    const invalidConnections = connections.filter(connection => !connection.valid);
    const structure = detectGeometry(nodes, connections);
    const combinations = Array.isArray(combinationData) ? combinationData : normalizeCombinations(combinationData || { ritualCombinations: [] });
    const base = { status: 'empty', matchedRitualId: null, ritualName: null, errors: [], warnings: [], cost: {}, consumedMaterials: [], result: {}, structure, nodes, connections };
    if (!nodes.length) return base;

    const evaluations = combinations.map(combination => {
      const nodeMatch = matchRequiredNodes(combination.requiredNodes, nodes);
      const allTags = new Set(nodes.flatMap(node => [...tokens(node)]));
      const missingTags = combination.requiredTags.filter(tag => !allTags.has(normalize(tag)));
      const forbiddenTags = combination.forbiddenTags.filter(tag => allTags.has(normalize(tag)));
      const missingMaterials = combination.requiredMaterials.map(requirement => {
        const needed = Math.max(1, Number(requirement.quantity) || 1);
        const placed = materialCount(nodes, requirement); const owned = materialInventory(characterData, requirement);
        return { ...requirement, needed, placed, owned, missingPlaced: Math.max(0, needed - placed), missingOwned: Math.max(0, needed - owned) };
      }).filter(item => item.missingPlaced || item.missingOwned);
      const structureValid = !combination.validStructures.length || combination.validStructures.includes(structure);
      const connectionValid = validConnections.length >= combination.minimumConnections;
      const orderValid = !combination.ordered || orderedCorrect(combination.requiredNodes, nodes);
      const resourceErrors = [];
      if ((Number(combination.cost.aura) || 0) > characterData.resources.aura) resourceErrors.push(`Aura insuficiente: exige ${combination.cost.aura}.`);
      if ((Number(combination.cost.hp) || 0) >= characterData.resources.hp) resourceErrors.push(`HP insuficiente: exige ${combination.cost.hp} sem derrubar o personagem.`);
      const complete = !nodeMatch.missing.length && !missingTags.length && !forbiddenTags.length && !missingMaterials.length && structureValid && connectionValid && orderValid && !invalidConnections.length && !resourceErrors.length;
      const score = nodeMatch.matched.length * 5 + combination.requiredMaterials.length - missingMaterials.length + (structureValid ? 2 : 0) + (connectionValid ? 1 : 0);
      return { combination, nodeMatch, missingTags, forbiddenTags, missingMaterials, structureValid, connectionValid, orderValid, resourceErrors, complete, score };
    }).sort((a, b) => Number(b.complete) - Number(a.complete) || b.score - a.score);

    if (!evaluations.length) return { ...base, status: invalidConnections.length ? 'unstable' : 'unknown', errors: invalidConnections.map(connection => connection.reason), warnings: ['Importe um arquivo de combinações para reconhecer o ritual.'] };
    const best = evaluations[0]; const errors = []; const warnings = [];
    invalidConnections.forEach(connection => errors.push(connection.reason));
    best.nodeMatch.missing.forEach(item => errors.push(`Falta o componente: ${typeof item === 'object' ? item.name || item.id || item.tag : item}.`));
    best.missingTags.forEach(tag => errors.push(`Falta a afinidade ou tag: ${tag}.`));
    best.forbiddenTags.forEach(tag => errors.push(`A tag “${tag}” é proibida neste ritual.`));
    best.missingMaterials.forEach(item => {
      const name = item.name || item.id || item.tag;
      if (item.missingOwned) errors.push(`Material insuficiente no inventário: ${name} (possui ${item.owned}/${item.needed}).`);
      else if (item.missingPlaced) errors.push(`Coloque ${item.missingPlaced}× ${name} no grid.`);
    });
    if (!best.structureValid) errors.push(`Geometria ${structure} não aceita; use ${best.combination.validStructures.join(', ')}.`);
    if (!best.connectionValid) errors.push(`São necessárias ${best.combination.minimumConnections} conexões válidas.`);
    if (!best.orderValid) errors.push('Os componentes corretos estão em uma ordem inválida.');
    errors.push(...best.resourceErrors);
    if (!best.complete && best.nodeMatch.matched.length) warnings.push(`Ressonância detectada: ${best.combination.name}.`);
    const status = best.complete ? 'valid' : best.forbiddenTags.length ? 'forbidden' : invalidConnections.length ? 'unstable' : best.nodeMatch.matched.length ? 'incomplete' : 'unknown';
    return {
      ...base, status, matchedRitualId: best.combination.id, ritualName: best.combination.name, errors, warnings,
      cost: best.combination.cost, consumedMaterials: best.combination.requiredMaterials, result: best.combination.result,
      matchedCombination: best.combination, score: best.score
    };
  }

  global.RitualEngine = { DIRECTIONS, OPPOSITE, normalize, amountValue, adaptCharacterExport, rotatedConnectors, buildConnections, detectGeometry, normalizeCombinations, validateRitual };
}(window));
