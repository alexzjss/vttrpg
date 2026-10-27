(function () {
  'use strict';

  const importView = document.querySelector('#import-view');
  const characterView = document.querySelector('#character-view');
  const content = document.querySelector('#character-content');
  const fileInput = document.querySelector('#file-input');
  const pickFile = document.querySelector('#pick-file');
  const changeFile = document.querySelector('#change-file');
  const dropZone = document.querySelector('#drop-zone');
  const errorBox = document.querySelector('#import-error');

  const labels = {
    id: 'ID', name: 'Nome', icon: 'Ícone', bannerImage: 'Imagem de capa', code: 'Código', role: 'Papel',
    maxHp: 'HP máximo', currentHp: 'HP atual', maxAura: 'Aura máxima', currentAura: 'Aura atual',
    maxAmmo: 'Munição máxima', currentAmmo: 'Munição atual', baseInitiative: 'Iniciativa base', defense: 'Defesa', speed: 'Velocidade',
    cardIds: 'IDs de cartas clássicas', pinnedCardIds: 'Cartas fixadas', weaponIds: 'IDs de armas', sealIds: 'IDs de selos',
    conditions: 'Condições', isInJourney: 'Em jornada', items: 'Itens legados', isHidden: 'Oculto', bonds: 'Vínculos', stacks: 'Marcadores',
    ownedItems: 'Itens possuídos', grimoire: 'Grimório legado', arsenal: 'Arsenal', activeEffects: 'Efeitos ativos', affinities: 'Afinidades',
    schemaVersion: 'Versão do esquema', description: 'Descrição', category: 'Categoria', tags: 'Marcadores', element: 'Elemento',
    testDice: 'Dado de teste', extraDamageDice: 'Dado extra', damage: 'Dano', healing: 'Cura', auraConsumed: 'Aura consumida',
    auraRestored: 'Aura restaurada', target: 'Alvo', area: 'Área', preparation: 'Preparação', triggers: 'Gatilhos', effects: 'Efeitos',
    cooldown: 'Recarga', charges: 'Cargas', visibility: 'Visibilidade', weaponLinks: 'Vínculos de arma', formLinks: 'Vínculos de forma',
    abilityType: 'Tipo de habilidade', weapon: 'Arma', form: 'Forma', item: 'Item', seal: 'Selo', combo: 'Combo', levels: 'Níveis', metadata: 'Metadados',
    cardId: 'ID da carta', quantity: 'Quantidade', equipped: 'Equipado', active: 'Ativo', currentCharges: 'Cargas atuais', cooldownRemaining: 'Recarga restante'
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function safeImage(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    const source = value.trim();
    if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(source)) return source;
    if (/^https?:\/\//i.test(source) || /^blob:/i.test(source)) return source;
    return '';
  }

  function label(key) {
    return labels[key] || String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
  }

  function printable(value) {
    if (value === null) return 'Nulo';
    if (value === undefined) return 'Não informado';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (value === '') return 'Vazio';
    return String(value);
  }

  function dataTree(value) {
    const root = el('div', 'data-tree');
    if (value === null || typeof value !== 'object') {
      root.append(el('span', 'data-value', printable(value)));
      return root;
    }
    const entries = Array.isArray(value) ? value.map((item, index) => [String(index + 1), item]) : Object.entries(value);
    if (!entries.length) root.append(el('div', 'empty', Array.isArray(value) ? 'Lista vazia' : 'Objeto vazio'));
    entries.forEach(([key, item]) => {
      if (item !== null && typeof item === 'object') {
        const details = el('details', 'data-branch');
        details.open = true;
        const suffix = Array.isArray(item) ? ` (${item.length})` : '';
        details.append(el('summary', 'data-key', `${Array.isArray(value) ? 'Item ' : ''}${label(key)}${suffix}`), dataTree(item));
        root.append(details);
      } else {
        const row = el('div', 'data-row');
        row.append(el('span', 'data-key', Array.isArray(value) ? `Item ${key}` : label(key)), el('span', 'data-value', printable(item)));
        root.append(row);
      }
    });
    return root;
  }

  function validate(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('O arquivo não contém um objeto JSON válido.');
    const character = payload.character && typeof payload.character === 'object' ? payload.character : payload;
    if (!character.name || typeof character.name !== 'string') throw new Error('Não encontrei um personagem neste arquivo (campo “name”).');
    const cards = Array.isArray(payload.cards) ? payload.cards : [];
    return {
      payload,
      character,
      cards,
      format: payload.format || 'arquivo de personagem',
      version: payload.version,
      exportedAt: payload.exportedAt,
      missingCardIds: Array.isArray(payload.missingCardIds) ? payload.missingCardIds : []
    };
  }

  function resource(name, current, maximum, color) {
    const max = Number(maximum) || 0;
    const now = Number(current) || 0;
    const percent = max > 0 ? Math.max(0, Math.min(100, now / max * 100)) : 0;
    const box = el('div', 'resource');
    const head = el('div', 'resource__head');
    head.append(el('span', '', name), el('strong', '', `${now} / ${max}`));
    const track = el('div', 'resource__track');
    const fill = el('div', 'resource__fill');
    fill.style.width = `${percent}%`;
    fill.style.setProperty('--resource-color', color);
    track.append(fill); box.append(head, track);
    return box;
  }

  function panel(title, body, count) {
    const box = el('section', 'panel');
    const head = el('div', 'panel__header');
    head.append(el('h3', '', title));
    if (count !== undefined) head.append(el('span', 'count', count));
    const inner = el('div', 'panel__body'); inner.append(body);
    box.append(head, inner);
    return box;
  }

  function factGrid(facts) {
    const grid = el('div', 'fact-grid');
    facts.forEach(([name, value]) => {
      const item = el('div', 'fact');
      item.append(el('span', '', name), el('strong', '', printable(value)));
      grid.append(item);
    });
    return grid;
  }

  function list(items, renderer) {
    if (!items || !items.length) return el('div', 'empty', 'Nenhum registro');
    const box = el('div', 'list');
    items.forEach((item, index) => box.append(renderer(item, index)));
    return box;
  }

  function simpleList(items, emptyText) {
    if (!items || !items.length) return el('div', 'empty', emptyText || 'Nenhum registro');
    return list(items, item => el('div', 'list-item', typeof item === 'string' ? item : JSON.stringify(item)));
  }

  function amount(value) {
    if (value === null || value === undefined) return '';
    if (typeof value !== 'object') return String(value);
    const parts = [];
    if (value.dice) parts.push(value.dice);
    if (value.flat !== undefined && value.flat !== 0) parts.push(`${value.flat > 0 && parts.length ? '+' : ''}${value.flat}`);
    if (value.perStack) parts.push(`${value.perStack}/stack`);
    return parts.join(' ') || 'Configurado';
  }

  function cardMetric(name, value) {
    if (value === '' || value === null || value === undefined || value === false) return null;
    return el('span', 'metric', `${name}: ${printable(value)}`);
  }

  function makeCard(card, holding) {
    const article = el('article', 'card');
    const imageUrl = safeImage(card.icon || card.image);
    if (imageUrl) {
      const image = el('img', 'card__art'); image.src = imageUrl; image.alt = ''; image.loading = 'lazy'; article.append(image);
    } else {
      article.append(el('div', 'card__art card__art--fallback', (card.name || '?').slice(0, 2).toUpperCase()));
    }
    const body = el('div', 'card__body');
    const badges = el('div', 'card__badges');
    [card.category || card.type, card.abilityType, card.element, ...(Array.isArray(card.tags) ? card.tags : [])].filter(Boolean).slice(0, 7)
      .forEach(value => badges.append(el('span', 'badge', value)));
    if (holding?.equipped) badges.append(el('span', 'badge badge--state', 'Equipado'));
    if (holding?.active) badges.append(el('span', 'badge badge--state', 'Ativo'));
    if ((holding?.quantity || 0) > 1) badges.append(el('span', 'badge badge--state', `×${holding.quantity}`));
    body.append(badges, el('h4', '', card.name || 'Carta sem nome'));
    if (card.description) body.append(el('p', '', card.description));
    const metrics = el('div', 'metrics');
    [
      cardMetric('Teste', card.testDice || card.diceRoll), cardMetric('Dano', amount(card.damage)), cardMetric('Cura', amount(card.healing)),
      cardMetric('Aura', amount(card.auraConsumed) || card.auraCost), cardMetric('Dado extra', card.extraDamageDice),
      cardMetric('Cargas', holding?.currentCharges ?? card.charges?.current), cardMetric('Recarga', holding?.cooldownRemaining),
      cardMetric('Níveis', Array.isArray(card.levels) ? Math.max(1, ...card.levels.map(level => Number(level.level) || 1)) : '')
    ].filter(Boolean).forEach(metric => metrics.append(metric));
    if (metrics.childElementCount) body.append(metrics);
    article.append(body);
    const details = el('details');
    details.append(el('summary', '', 'Todos os dados da carta'), dataTree(card));
    if (holding) {
      const holdingDetails = el('details');
      holdingDetails.append(el('summary', '', 'Estado no inventário'), dataTree(holding));
      details.append(holdingDetails);
    }
    article.append(details);
    return article;
  }

  function renderCards(data) {
    const wrap = el('section', 'panel');
    const head = el('div', 'panel__header');
    head.append(el('h3', '', 'Cartas do personagem'), el('span', 'count', data.cards.length));
    wrap.append(head);
    if (data.missingCardIds.length) wrap.append(el('div', 'warning', `O arquivo cita ${data.missingCardIds.length} carta(s) que não estavam no catálogo exportado: ${data.missingCardIds.join(', ')}`));
    if (!data.cards.length) {
      wrap.append(el('div', 'panel__body empty', 'Nenhuma carta foi incluída neste arquivo.'));
      return wrap;
    }
    const tools = el('div', 'card-tools');
    const search = el('input', 'search'); search.type = 'search'; search.placeholder = 'Buscar carta por nome, texto ou marcador…'; search.setAttribute('aria-label', 'Buscar cartas');
    const select = el('select', 'select'); select.setAttribute('aria-label', 'Filtrar por categoria');
    select.append(new Option('Todas as categorias', ''));
    const categories = [...new Set(data.cards.map(card => card.category || card.type).filter(Boolean))].sort();
    categories.forEach(category => select.append(new Option(category, category)));
    tools.append(search, select); wrap.append(tools);
    const grid = el('div', 'cards'); wrap.append(grid);
    const holdingMap = new Map((data.character.arsenal || []).map(item => [item.cardId, item]));
    function draw() {
      const query = search.value.trim().toLocaleLowerCase('pt-BR');
      const category = select.value;
      const visible = data.cards.filter(card => {
        const haystack = `${card.name || ''} ${card.description || ''} ${(card.tags || []).join(' ')}`.toLocaleLowerCase('pt-BR');
        return (!query || haystack.includes(query)) && (!category || (card.category || card.type) === category);
      });
      grid.replaceChildren(...visible.map(card => makeCard(card, holdingMap.get(card.id))));
      if (!visible.length) grid.append(el('div', 'empty', 'Nenhuma carta corresponde ao filtro.'));
    }
    search.addEventListener('input', draw); select.addEventListener('change', draw); draw();
    return wrap;
  }

  function render(data) {
    const character = data.character;
    const fragment = document.createDocumentFragment();
    const hero = el('section', 'hero');
    const banner = safeImage(character.bannerImage || character.icon);
    if (banner) { const image = el('img', 'hero__banner'); image.src = banner; image.alt = ''; hero.append(image); }
    hero.append(el('div', 'hero__shade'));
    const heroContent = el('div', 'hero__content');
    const portraitSource = safeImage(character.icon);
    if (portraitSource) { const image = el('img', 'portrait'); image.src = portraitSource; image.alt = `Retrato de ${character.name}`; heroContent.append(image); }
    else heroContent.append(el('div', 'portrait portrait--fallback', character.name.slice(0,2).toUpperCase()));
    const identity = el('div');
    identity.append(el('div', 'eyebrow', character.role === 'npc' ? 'PERSONAGEM NÃO JOGADOR' : 'PERSONAGEM'));
    identity.append(el('h2', '', character.name));
    const meta = [character.code && `#${character.code}`, character.id && `ID ${character.id}`].filter(Boolean).join('  ·  ');
    identity.append(el('div', 'hero__meta', meta || 'RPG CODEX'));
    const resources = el('div', 'resource-grid');
    resources.append(resource('Vida', character.currentHp, character.maxHp, '#65d49a'));
    resources.append(resource('Aura', character.currentAura, character.maxAura, '#72aef1'));
    resources.append(resource('Munição', character.currentAmmo, character.maxAmmo, '#67d8e8'));
    identity.append(resources);
    const ritualButton = el('button', 'button button--ritual', 'Construir ritual');
    ritualButton.type = 'button';
    ritualButton.addEventListener('click', () => window.SealRitualBuilder?.open(data.payload));
    identity.append(ritualButton);
    const exported = data.exportedAt ? new Date(data.exportedAt).toLocaleString('pt-BR') : 'data não informada';
    identity.append(el('div', 'format-meta', `${data.format}${data.version !== undefined ? ` · versão ${data.version}` : ''} · exportado em ${exported}`));
    heroContent.append(identity); hero.append(heroContent); fragment.append(hero);

    const layout = el('div', 'content-grid'); const main = el('div', 'main-column'); const side = el('aside', 'side-column');
    main.append(renderCards(data));

    const raw = el('section', 'panel');
    const rawHead = el('div', 'panel__header'); rawHead.append(el('h3', '', 'Dados completos do personagem'));
    const rawDetails = el('details', 'raw-details'); rawDetails.append(el('summary', '', 'Abrir todos os campos'), dataTree(character));
    raw.append(rawHead, rawDetails); main.append(raw);

    side.append(panel('Atributos', factGrid([
      ['Iniciativa', character.baseInitiative], ['Defesa', character.defense], ['Velocidade', character.speed],
      ['Na jornada', character.isInJourney], ['Oculto', character.isHidden], ['Papel', character.role || 'personagem']
    ])));

    const bonds = character.bonds || [];
    side.append(panel('Vínculos', simpleList(bonds, 'Nenhum vínculo registrado'), bonds.length));

    const conditions = character.conditions || [];
    side.append(panel('Condições', list(conditions, condition => {
      const item = el('div', 'list-item');
      const name = typeof condition === 'string' ? condition : condition.name || condition.type || 'Condição';
      item.append(el('span', 'dot'), el('span', '', name));
      if (typeof condition === 'object' && condition.duration !== undefined) item.append(el('small', '', `${condition.duration} rodada(s)`));
      return item;
    }), conditions.length));

    const stacks = character.stacks || [];
    side.append(panel('Marcadores', list(stacks, stack => {
      const item = el('div', 'list-item');
      const dot = el('span', 'dot'); if (stack.color) dot.style.setProperty('--dot', stack.color);
      item.append(dot, el('span', '', stack.name || 'Marcador'), el('small', '', `${stack.current ?? 0} / ${stack.max ?? 0}`)); return item;
    }), stacks.length));

    const affinities = Object.entries(character.affinities || {});
    side.append(panel('Afinidades', list(affinities, ([element, affinity]) => {
      const item = el('div', 'list-item'); item.append(el('span', '', label(element)), el('small', '', printable(affinity))); return item;
    }), affinities.length));

    const effects = character.activeEffects || [];
    side.append(panel('Efeitos ativos', effects.length ? dataTree(effects) : el('div', 'empty', 'Nenhum efeito ativo'), effects.length));
    layout.append(main, side); fragment.append(layout);
    content.replaceChildren(fragment);
    importView.classList.add('is-hidden'); characterView.classList.remove('is-hidden'); changeFile.classList.remove('is-hidden');
    document.title = `${character.name} — RPG Codex`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadFile(file) {
    errorBox.classList.add('is-hidden');
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return showError('O arquivo excede o limite de 25 MB.');
    try {
      const text = await file.text();
      render(validate(JSON.parse(text)));
    } catch (error) {
      showError(error instanceof SyntaxError ? 'Não foi possível ler o JSON. Verifique se o arquivo não está corrompido.' : error.message);
    } finally {
      fileInput.value = '';
    }
  }

  function showError(message) { errorBox.textContent = message; errorBox.classList.remove('is-hidden'); }
  function choose(event) { event?.stopPropagation(); fileInput.click(); }
  pickFile.addEventListener('click', choose);
  dropZone.addEventListener('click', choose);
  dropZone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') choose(event); });
  fileInput.addEventListener('change', event => loadFile(event.target.files[0]));
  ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.remove('is-dragging'); }));
  dropZone.addEventListener('drop', event => loadFile(event.dataTransfer.files[0]));
  changeFile.addEventListener('click', () => { characterView.classList.add('is-hidden'); importView.classList.remove('is-hidden'); changeFile.classList.add('is-hidden'); document.title = 'RPG Codex — Ficha do Personagem'; choose(); });

  // API mínima para incorporação e testes, sem criar dependência com o Codex principal.
  window.RpgCodexCharacterViewer = { validate, loadPayload: payload => render(validate(payload)) };
}());
