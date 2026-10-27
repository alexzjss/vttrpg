(function (global) {
  'use strict';

  const Engine = global.RitualEngine;
  const GRID_SIZE = 9;
  const COLORS = { seal: '#b487f3', material: '#d5a34f' };
  const STATUS = {
    empty: ['Círculo vazio', '#687181'], incomplete: ['Ritual incompleto', '#e2b654'], unstable: ['Fluxo instável', '#ef9b4a'],
    valid: ['Ritual válido', '#f2d98f'], forbidden: ['Ritual proibido', '#e35d76'], unknown: ['Ressonância desconhecida', '#8f86b9']
  };
  let state = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function button(text, className, onClick) {
    const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', onClick); return node;
  }

  function safeImage(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    return /^(data:image\/(png|jpe?g|gif|webp|svg\+xml);|https?:\/\/|blob:)/i.test(value.trim()) ? value.trim() : '';
  }

  function instanceId() {
    return global.crypto?.randomUUID?.() || `node-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function usedCount(pieceId) {
    return state.nodes.filter(node => node.definition.id === pieceId).length;
  }

  function available(piece) {
    const used=usedCount(piece.id);
    if (piece.maxPerRitual && used >= piece.maxPerRitual) return false;
    return piece.type !== 'material' || used < piece.quantity;
  }

  function findPiece(id) { return state.data.pieces.find(piece => piece.id === id); }
  function findNode(id) { return state.nodes.find(node => node.instanceId === id); }
  function occupied(row, col, exceptId) { return state.nodes.some(node => node.row === row && node.col === col && node.instanceId !== exceptId); }

  function placePiece(pieceId, row, col) {
    const piece = findPiece(pieceId);
    if (!piece || !available(piece) || occupied(row, col)) return;
    const node = { instanceId: instanceId(), definition: piece, row, col, rotation: 0 };
    state.nodes.push(node); state.selectedNodeId = node.instanceId; state.selectedPieceId = null; render();
  }

  function moveNode(nodeId, row, col) {
    const node = findNode(nodeId); if (!node || occupied(row, col, nodeId)) return;
    node.row = row; node.col = col; state.selectedNodeId = nodeId; render();
  }

  function removeSelected() {
    if (!state.selectedNodeId) return;
    state.nodes = state.nodes.filter(node => node.instanceId !== state.selectedNodeId); state.selectedNodeId = null; render();
  }

  function rotateSelected() {
    const node = findNode(state.selectedNodeId);
    if (!node || !node.definition.rotationAllowed) return;
    node.rotation = (node.rotation + 90) % 360; render();
  }

  function duplicateSelected() {
    const node = findNode(state.selectedNodeId); if (!node || !available(node.definition)) return;
    const candidates = Object.values(Engine.DIRECTIONS).map(([dr, dc]) => [node.row + dr, node.col + dc]).filter(([row, col]) => row >= 0 && col >= 0 && row < GRID_SIZE && col < GRID_SIZE && !occupied(row, col));
    if (!candidates.length) return;
    const [row, col] = candidates[0]; placePiece(node.definition.id, row, col);
  }

  function imageOrGlyph(piece, className) {
    const src = safeImage(piece.icon);
    if (src) { const image = el('img', className); image.src = src; image.alt = ''; image.loading = 'lazy'; return image; }
    return el('span', `${className} ritual-node__glyph`, piece.name.slice(0, 2).toUpperCase());
  }

  function topbar() {
    const bar = el('header', 'ritual-topbar');
    bar.append(el('div', 'ritual-topbar__sigil', '⌘'));
    const title = el('div', 'ritual-topbar__title'); title.append(el('strong', '', 'Círculo de Selos'), el('span', '', `${state.data.characterName} · matriz ritual 9×9`)); bar.append(title);
    [['HP', state.data.resources.hp, '#65d49a'], ['Aura', state.data.resources.aura, '#72aef1']].forEach(([name, value, color]) => {
      const resource = el('div', 'ritual-resource'); resource.style.setProperty('--resource', color); resource.append(el('span', '', name), el('strong', '', value)); bar.append(resource);
    });
    bar.append(button('×', 'ritual-icon-button', close)); return bar;
  }

  function libraryPiece(piece) {
    const depleted = !available(piece); const selected = state.selectedPieceId === piece.id;
    const item = el('div', `ritual-piece${selected ? ' is-selected' : ''}${depleted ? ' is-depleted' : ''}`);
    item.style.setProperty('--piece-color', COLORS[piece.type]); item.draggable = !depleted; item.title = piece.description || piece.name;
    item.append(imageOrGlyph(piece, 'ritual-piece__icon'));
    const copy = el('div'); copy.append(el('strong', '', piece.name), el('small', '', piece.type === 'seal' ? `Selo · ${piece.role}` : `Item · ${piece.role}`)); item.append(copy);
    item.append(el('span', 'ritual-piece__qty', piece.type === 'material' ? `${Math.max(0, piece.quantity - usedCount(piece.id))}/${piece.quantity}` : piece.connectors.length));
    item.addEventListener('click', () => { if (!depleted) { state.selectedPieceId = selected ? null : piece.id; state.selectedNodeId = null; render(); } });
    item.addEventListener('dragstart', event => { event.dataTransfer.setData('text/plain', `piece:${piece.id}`); event.dataTransfer.effectAllowed = 'copy'; });
    return item;
  }

  function library() {
    const panel = el('aside', 'ritual-panel ritual-panel--library');
    const head = el('div', 'ritual-panel__head'); head.append(el('h3', '', 'Biblioteca do personagem'), el('p', '', 'Arraste uma peça até a matriz ou selecione-a e toque em uma célula.'));
    const search = el('input', 'ritual-search'); search.type = 'search'; search.placeholder = 'Buscar componente…'; search.value = state.query; search.addEventListener('input', event => { state.query = event.target.value; render(); }); head.append(search); panel.append(head);
    const tabs = el('div', 'ritual-tabs');
    [['all','Todos'],['seal','Selos'],['material','Itens']].forEach(([value, label]) => tabs.append(button(label, `ritual-tab${state.tab === value ? ' is-active' : ''}`, () => { state.tab = value; render(); })));
    panel.append(tabs);
    const list = el('div', 'ritual-library-list');
    const query = Engine.normalize(state.query);
    const pieces = state.data.pieces.filter(piece => (state.tab === 'all' || piece.type === state.tab) && (!query || Engine.normalize(`${piece.name} ${piece.tags.join(' ')}`).includes(query)));
    pieces.forEach(piece => list.append(libraryPiece(piece)));
    if (!pieces.length) list.append(el('div', 'ritual-empty', 'Nenhum componente encontrado.'));
    panel.append(list, el('div', 'ritual-library-help', 'A biblioteca usa somente selos e itens possuídos. Conectores antigos recebem quatro lados por compatibilidade; cartas novas usam exatamente a configuração do editor.'));
    return panel;
  }

  function svgLinks(validation) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'ritual-links'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
    validation.connections.forEach(connection => {
      const from = findNode(connection.from); const to = findNode(connection.to); if (!from || !to) return;
      const x1 = (from.col + .5) / GRID_SIZE * 100; const y1 = (from.row + .5) / GRID_SIZE * 100; const x2 = (to.col + .5) / GRID_SIZE * 100; const y2 = (to.row + .5) / GRID_SIZE * 100;
      const line = document.createElementNS(svg.namespaceURI, 'line');
      [['x1',x1],['y1',y1],['x2',x2],['y2',y2]].forEach(([key,value]) => line.setAttribute(key, value)); line.setAttribute('class', `ritual-link ritual-link--${connection.status}`);
      const title = document.createElementNS(svg.namespaceURI, 'title'); title.textContent = connection.reason; line.append(title); svg.append(line);
    });
    return svg;
  }

  function gridNode(node) {
    const piece = node.definition; const box = el('div', `ritual-node${state.selectedNodeId === node.instanceId ? ' is-selected' : ''}`);
    box.style.setProperty('--piece-color', COLORS[piece.type]); box.draggable = true; box.title = `${piece.name} · ${node.rotation}°`;
    box.append(imageOrGlyph(piece, ''));
    Engine.rotatedConnectors(node).forEach(direction => box.append(el('span', `ritual-connector ritual-connector--${direction}`)));
    box.append(el('span', 'ritual-node__name', piece.name));
    box.addEventListener('click', event => { event.stopPropagation(); state.selectedNodeId = node.instanceId; state.selectedPieceId = null; render(); });
    box.addEventListener('dblclick', event => { event.stopPropagation(); state.selectedNodeId = node.instanceId; rotateSelected(); });
    box.addEventListener('contextmenu', event => { event.preventDefault(); state.selectedNodeId = node.instanceId; state.selectedPieceId = null; render(); });
    box.addEventListener('dragstart', event => { event.stopPropagation(); event.dataTransfer.setData('text/plain', `node:${node.instanceId}`); event.dataTransfer.effectAllowed = 'move'; });
    return box;
  }

  function stage(validation) {
    const stage = el('main', 'ritual-stage');
    const stageHead = el('div', 'ritual-stage__header'); const copy = el('div'); copy.append(el('span', '', 'Matriz ritualística'), el('strong', '', `${state.nodes.length} peças · ${validation.connections.filter(item => item.valid).length} fluxos · geometria ${validation.structure}`)); stageHead.append(copy);
    const actions = el('div', 'ritual-stage__actions');
    actions.append(button('Girar', 'ritual-mini-button', rotateSelected), button('Remover', 'ritual-mini-button', removeSelected), button('Limpar', 'ritual-mini-button', () => { state.nodes = []; state.selectedNodeId = null; render(); })); stageHead.append(actions); stage.append(stageHead);
    const frame = el('div', 'ritual-grid-frame'); frame.append(svgLinks(validation));
    const cells = el('div', 'ritual-grid-cells');
    for (let row = 0; row < GRID_SIZE; row += 1) for (let col = 0; col < GRID_SIZE; col += 1) {
      const cell = el('div', 'ritual-cell'); cell.dataset.row = row; cell.dataset.col = col;
      const node = state.nodes.find(item => item.row === row && item.col === col); if (node) cell.append(gridNode(node));
      cell.addEventListener('click', () => { if (!node && state.selectedPieceId) placePiece(state.selectedPieceId, row, col); else if (!node) { state.selectedNodeId = null; render(); } });
      cell.addEventListener('dragover', event => { event.preventDefault(); cell.classList.add('is-drop-target'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('is-drop-target'));
      cell.addEventListener('drop', event => { event.preventDefault(); cell.classList.remove('is-drop-target'); const [kind, id] = event.dataTransfer.getData('text/plain').split(':'); if (kind === 'piece') placePiece(id, row, col); if (kind === 'node') moveNode(id, row, col); });
      cells.append(cell);
    }
    frame.append(cells); stage.append(frame, el('div', 'ritual-stage__hint', 'Duplo clique gira uma peça. Clique direito seleciona e abre suas ações no inspetor.'));
    return stage;
  }

  function detail(name, value) { const box = el('div', 'ritual-detail'); box.append(el('span', '', name), el('strong', '', value === undefined || value === null || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : value)); return box; }

  function infoCard(title, children) { const card = el('section', 'ritual-info-card'); card.append(el('h5', '', title)); children.forEach(child => card.append(child)); return card; }

  function selectedInspector() {
    const node = findNode(state.selectedNodeId); if (!node) return null;
    const piece = node.definition; const card = el('section', 'ritual-info-card ritual-node-inspector'); card.append(el('h5', '', 'Peça selecionada'));
    const src = safeImage(piece.icon); if (src) { const image = el('img'); image.src = src; image.alt = ''; card.append(image); }
    card.append(el('strong', '', piece.name), el('p', '', piece.description || 'Sem descrição.'));
    const tags = el('div', 'ritual-tags'); piece.tags.slice(0, 8).forEach(tag => tags.append(el('span', 'ritual-tag', tag))); card.append(tags);
    const actions = el('div', 'ritual-node-actions'); actions.append(button(`Girar ${node.rotation}°`, 'ritual-mini-button', rotateSelected), button('Duplicar', 'ritual-mini-button', duplicateSelected), button('Remover', 'ritual-mini-button', removeSelected)); card.append(actions); return card;
  }

  function loadPresets() {
    try { return JSON.parse(localStorage.getItem('rpg-codex-ritual-presets') || '[]'); } catch { return []; }
  }

  function savePreset() {
    const suggested = state.validation.ritualName || 'Modelo ritual'; const name = global.prompt('Nome do modelo:', suggested); if (!name?.trim()) return;
    const presets = loadPresets(); presets.push({ id: instanceId(), name: name.trim(), characterId: state.data.characterId, createdAt: new Date().toISOString(), matchedRitualId: state.validation.matchedRitualId, nodes: state.nodes.map(node => ({ definitionId: node.definition.id, row: node.row, col: node.col, rotation: node.rotation })) });
    try { localStorage.setItem('rpg-codex-ritual-presets', JSON.stringify(presets)); state.ruleMessage = `Modelo “${name.trim()}” salvo neste navegador.`; } catch { state.ruleMessage = 'O navegador não permitiu salvar o modelo.'; }
    render();
  }

  function loadPreset(id) {
    const preset = loadPresets().find(item => item.id === id); if (!preset) return;
    state.nodes = preset.nodes.map(item => ({ instanceId: instanceId(), definition: findPiece(item.definitionId), row: item.row, col: item.col, rotation: item.rotation || 0 })).filter(item => item.definition);
    state.selectedNodeId = null; render();
  }

  function rulesAndPresets() {
    const card = el('section', 'ritual-info-card'); card.append(el('h5', '', 'Regras e modelos'));
    const input = el('input', 'ritual-file'); input.type = 'file'; input.accept = 'application/json,.json';
    input.addEventListener('change', async event => {
      try { const parsed = JSON.parse(await event.target.files[0].text()); state.combinations = Engine.normalizeCombinations(parsed); state.ruleMessage = `${state.combinations.length} combinação(ões) importada(s).`; render(); }
      catch (error) { state.ruleMessage = error.message || 'Arquivo de combinações inválido.'; render(); }
    });
    const row = el('div', 'ritual-rules-row'); row.append(button(`Importar regras (${state.combinations.length})`, 'ritual-mini-button', () => input.click()), button('Salvar modelo', 'ritual-mini-button', savePreset)); card.append(input, row);
    const presets = loadPresets(); if (presets.length) {
      const select = el('select', 'ritual-preset-select'); select.append(new Option('Carregar modelo salvo…', '')); presets.forEach(preset => select.append(new Option(preset.name, preset.id))); select.addEventListener('change', event => loadPreset(event.target.value)); card.append(select);
    }
    if (state.ruleMessage) card.append(el('p', '', state.ruleMessage)); return card;
  }

  function inspector(validation) {
    const panel = el('aside', 'ritual-panel ritual-panel--inspector');
    const head = el('div', 'ritual-panel__head'); head.append(el('h3', '', 'Leitura da ressonância'), el('p', '', 'Validação em tempo real contra as combinações carregadas.')); panel.append(head);
    const scroll = el('div', 'ritual-inspector-scroll');
    const statusData = STATUS[validation.status] || STATUS.unknown; const status = el('section', 'ritual-status'); status.dataset.status = validation.status; status.style.setProperty('--status-color', statusData[1]);
    status.append(el('div', 'ritual-status__label', statusData[0]), el('h4', '', validation.ritualName || 'Nenhum ritual detectado'));
    const description = validation.matchedCombination?.description || (validation.status === 'empty' ? 'Posicione componentes para iniciar o traçado.' : 'A estrutura ainda não corresponde a uma combinação conhecida.'); status.append(el('p', '', description));
    const progress = el('div', 'ritual-progress'); const fill = el('span'); fill.style.setProperty('--progress', validation.status === 'valid' ? '100%' : validation.status === 'empty' ? '0%' : validation.status === 'unknown' ? '30%' : '68%'); progress.append(fill); status.append(progress); scroll.append(status);
    const grid = el('div', 'ritual-detail-grid'); grid.append(detail('Geometria', validation.structure), detail('Fluxos válidos', validation.connections.filter(item => item.valid).length), detail('Custo de aura', validation.cost?.aura ?? 0), detail('Custo de HP', validation.cost?.hp ?? 0)); scroll.append(infoCard('Estrutura e custo', [grid]));
    if (validation.result && Object.keys(validation.result).length) {
      const resultGrid = el('div', 'ritual-detail-grid'); Object.entries(validation.result).slice(0, 8).forEach(([key, value]) => resultGrid.append(detail(key, Array.isArray(value) ? value.join(', ') : value))); scroll.append(infoCard('Efeito resultante', [resultGrid]));
    }
    if (validation.errors.length || validation.warnings.length) {
      const alerts = el('div', 'ritual-alert-list'); validation.errors.forEach(message => { const alert = el('div', 'ritual-alert', message); alert.style.setProperty('--alert-color', '#e86666'); alerts.append(alert); }); validation.warnings.forEach(message => { const alert = el('div', 'ritual-alert', message); alert.style.setProperty('--alert-color', '#e2b654'); alerts.append(alert); }); scroll.append(infoCard('Diagnóstico', [alerts]));
    }
    const selected = selectedInspector(); if (selected) scroll.append(selected); scroll.append(rulesAndPresets());
    if (state.logs.length) { const log = el('div', 'ritual-log'); state.logs.forEach(entry => log.append(el('div', 'ritual-log-entry', entry))); scroll.append(infoCard('Log da sessão', [log])); }
    panel.append(scroll);
    const footer = el('div', 'ritual-footer-actions'); footer.append(button('Confirmar ritual', 'ritual-confirm', confirmRitual)); footer.querySelector('button').disabled = validation.status !== 'valid'; footer.append(button('Limpar grid', 'ritual-mini-button', () => { state.nodes = []; state.selectedNodeId = null; render(); })); panel.append(footer); return panel;
  }

  function confirmRitual() {
    const current = Engine.validateRitual({ nodes: state.nodes }, state.data, state.combinations); if (current.status !== 'valid') { render(); return; }
    const combination = current.matchedCombination;
    const consumedById=new Map();
    state.nodes.filter(node=>node.definition.type==='material'&&node.definition.consumedOnConfirm).forEach(node=>{
      const piece=node.definition; piece.quantity=Math.max(0,piece.quantity-1); consumedById.set(piece.id,{id:piece.id,name:piece.name,quantity:(consumedById.get(piece.id)?.quantity||0)+1});
    });
    state.data.resources.aura = Math.max(0, state.data.resources.aura - (Number(current.cost.aura) || 0)); state.data.resources.hp = Math.max(0, state.data.resources.hp - (Number(current.cost.hp) || 0));
    const components = state.nodes.map(node => ({ id: node.definition.id, name: node.definition.name, type: node.definition.type, row: node.row, col: node.col, rotation: node.rotation }));
    const consumedMaterials=[...consumedById.values()];
    const result = { type: 'ritual-result', version: 1, createdAt: new Date().toISOString(), characterId: state.data.characterId, characterName: state.data.characterName, ritualId: current.matchedRitualId, ritualName: current.ritualName, structure: current.structure, components, consumedMaterials, cost: current.cost, result: current.result };
    const materialText = consumedMaterials.map(item => `${item.quantity} ${item.name}`).join(', ');
    const log = `${state.data.characterName} completou o ritual ${current.ritualName}${materialText ? `, consumindo ${materialText}` : ''}${current.cost.aura ? ` e ${current.cost.aura} de Aura` : ''}. ${combination.description || ''}`;
    state.logs.unshift(log); state.lastResult = result; state.nodes = []; state.selectedNodeId = null; state.ruleMessage = 'Ritual confirmado. O resultado foi emitido para integração com o VTT.';
    global.dispatchEvent(new CustomEvent('rpg-codex:ritual-confirmed', { detail: result })); render();
  }

  function render() {
    if (!state?.root) return;
    state.validation = Engine.validateRitual({ nodes: state.nodes }, state.data, state.combinations);
    const shell = el('div', 'ritual-shell'); shell.append(topbar());
    const workspace = el('div', 'ritual-workspace'); workspace.append(library(), stage(state.validation), inspector(state.validation)); shell.append(workspace);
    state.root.replaceChildren(shell);
  }

  async function loadDefaultRules(targetState) {
    if (global.location.protocol === 'file:' || typeof global.fetch !== 'function') {
      targetState.ruleMessage = 'Abra pelo contêiner/servidor ou importe ritual-combinations.json manualmente para carregar as receitas.';
      if (state === targetState) render();
      return;
    }
    try {
      const response = await global.fetch('./ritual-combinations.json', { cache:'no-store' });
      if (!response.ok) throw new Error(`Falha ao carregar receitas (${response.status}).`);
      targetState.combinations = Engine.normalizeCombinations(await response.json());
      targetState.ruleMessage = `${targetState.combinations.length} combinação(ões) carregada(s) de ritual-combinations.json.`;
    } catch (error) {
      targetState.ruleMessage = `${error.message || 'Não foi possível carregar o arquivo de combinações'} Importe-o manualmente.`;
    }
    if (state === targetState) render();
  }

  function open(payload) {
    close();
    const data = Engine.adaptCharacterExport(payload);
    const root = el('div'); root.id = 'ritual-builder-root'; document.body.append(root); document.body.classList.add('ritual-open');
    state = { root, payload, data, nodes: [], selectedNodeId: null, selectedPieceId: null, tab: 'all', query: '', combinations: [], logs: [], ruleMessage: 'Carregando ritual-combinations.json…', validation: null, lastResult: null };
    const openedState=state;
    const escape = event => { if (event.key === 'Escape') close(); }; state.escape = escape; document.addEventListener('keydown', escape); render(); void loadDefaultRules(openedState);
  }

  function close() {
    if (state?.escape) document.removeEventListener('keydown', state.escape);
    document.querySelector('#ritual-builder-root')?.remove(); document.body.classList.remove('ritual-open'); state = null;
  }

  global.SealRitualBuilder = { open, close, getState: () => state, validateRitual: Engine.validateRitual };
}(window));
