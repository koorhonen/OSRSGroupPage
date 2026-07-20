// Group Ironman item tracker — talks to groupiron.men through /api/gim.

const REFRESH_MS = 10_000;
const EPOCH = '2020-01-01T00:00:00.000Z';
const ICON_URL = (id) => `https://static.runelite.net/cache/item/icon/${id}.png`;
const NAMES_URL = 'https://static.runelite.net/cache/item/names.json';

// Equipment array slot order used by the API (id,qty pairs). Null = unused slot.
const EQUIP_SLOTS = [
  'head', 'cape', 'neck', 'weapon', 'body', 'shield', null,
  'legs', null, 'hands', 'feet', null, 'ring', 'ammo',
];

const state = {
  group: localStorage.getItem('gim.group') || '',
  token: localStorage.getItem('gim.token') || '',
  members: new Map(),      // name -> merged member data
  activeTab: null,
  lastSyncAt: null,        // Date of last successful fetch
  nextFromTime: EPOCH,     // from_time for the next incremental fetch
  online: true,
  itemNames: {},
  pollTimer: null,
  tickTimer: null,
};

const $ = (sel) => document.querySelector(sel);

// ---------- API ----------

async function api(endpoint, params = {}) {
  const qs = new URLSearchParams({ group: state.group, endpoint, ...params });
  const res = await fetch(`/api/gim?${qs}`, {
    headers: { Authorization: state.token },
  });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

class AuthError extends Error {}

async function loadItemNames() {
  try {
    const res = await fetch(NAMES_URL);
    state.itemNames = await res.json();
  } catch {
    state.itemNames = {}; // icons still work; tooltips just show ids
  }
}

// ---------- Data ----------

function mergeMembers(list) {
  for (const incoming of list) {
    const current = state.members.get(incoming.name) || { name: incoming.name };
    Object.assign(current, incoming);
    state.members.set(incoming.name, current);
  }
}

async function refresh({ full = false } = {}) {
  const requestedAt = new Date(Date.now() - 5000); // small overlap so nothing is missed
  try {
    const data = await api('get-group-data', {
      from_time: full ? EPOCH : state.nextFromTime,
    });
    mergeMembers(data);
    state.nextFromTime = requestedAt.toISOString();
    state.lastSyncAt = new Date();
    state.online = true;
    renderAll();
  } catch (err) {
    if (err instanceof AuthError) return logout('Session rejected — check your group name and token.');
    state.online = false;
    renderSyncStatus();
  }
}

function itemPairs(arr) {
  const items = [];
  if (!arr) return items;
  for (let i = 0; i + 1 < arr.length; i += 2) {
    if (arr[i] > 0 && arr[i + 1] > 0) items.push({ id: arr[i], qty: arr[i + 1] });
  }
  return items;
}

function itemName(id) {
  return state.itemNames[id] || `Item ${id}`;
}

function fmtQty(q) {
  if (q >= 10_000_000) return Math.floor(q / 1_000_000) + 'M';
  if (q >= 100_000) return Math.floor(q / 1_000) + 'K';
  if (q >= 10_000) return (q / 1000).toFixed(1).replace('.0', '') + 'K';
  return q.toLocaleString();
}

function timeAgo(dateLike) {
  if (!dateLike) return 'never';
  const s = Math.max(0, Math.floor((Date.now() - new Date(dateLike)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function displayName(name) {
  return name === '@SHARED' ? 'Shared storage' : name;
}

function sortedMembers() {
  return [...state.members.values()].sort((a, b) => {
    const rank = (m) => (m.name === '@SHARED' ? 2 : m.last_updated ? 0 : 1);
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });
}

// ---------- Rendering ----------

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function itemCell(item, extraClass = '') {
  const cell = el('div', `item ${extraClass}`.trim());
  if (!item) {
    cell.classList.add('empty');
    return cell;
  }
  const img = el('img');
  img.src = ICON_URL(item.id);
  img.alt = '';
  img.loading = 'lazy';
  cell.appendChild(img);
  if (item.qty > 1) cell.appendChild(el('span', 'qty', fmtQty(item.qty)));
  cell.title = `${itemName(item.id)} × ${item.qty.toLocaleString()}`;
  return cell;
}

function renderTabs() {
  const nav = $('#member-tabs');
  nav.replaceChildren();
  for (const m of sortedMembers()) {
    const btn = el('button');
    btn.appendChild(el('span', null, displayName(m.name)));
    btn.appendChild(el('span', 'sub', m.last_updated ? `updated ${timeAgo(m.last_updated)}` : 'no data yet'));
    if (m.name === state.activeTab) btn.classList.add('active');
    btn.addEventListener('click', () => {
      state.activeTab = m.name;
      $('#global-search').value = '';
      renderAll();
    });
    nav.appendChild(btn);
  }
}

function renderMember() {
  const main = $('#member-content');
  main.replaceChildren();
  const m = state.members.get(state.activeTab);
  if (!m) return;

  if (!m.last_updated && !m.bank) {
    main.appendChild(el('p', 'empty-note',
      `${displayName(m.name)} has no synced data yet. They need to install the Group Ironmen Tracker RuneLite plugin and log in.`));
    return;
  }

  // Meta line
  const meta = el('div', 'member-meta');
  const stats = m.stats || [];
  const metaBits = [];
  if (stats.length >= 7) metaBits.push(['World', stats[6]]);
  metaBits.push(['Last updated', timeAgo(m.last_updated)]);
  if (m.interacting?.name) metaBits.push(['Last activity', `fighting ${m.interacting.name} (${timeAgo(m.interacting.last_updated)})`]);
  for (const [label, value] of metaBits) {
    const span = el('span');
    span.append(`${label}: `);
    span.appendChild(el('strong', null, String(value)));
    meta.appendChild(span);
  }
  main.appendChild(meta);

  const row = el('div', 'panel-row');

  // Equipment
  if (m.equipment) {
    const panel = el('section', 'panel');
    panel.appendChild(el('h2', null, 'Equipment'));
    const grid = el('div', 'grid-equip');
    const eq = m.equipment;
    EQUIP_SLOTS.forEach((slot, i) => {
      if (!slot) return;
      const id = eq[i * 2], qty = eq[i * 2 + 1];
      grid.appendChild(itemCell(id > 0 ? { id, qty } : null, `eq-${slot}`));
    });
    panel.appendChild(grid);
    row.appendChild(panel);
  }

  // Inventory
  if (m.inventory) {
    const panel = el('section', 'panel');
    const items = itemPairs(m.inventory);
    const h = el('h2', null, 'Inventory ');
    h.appendChild(el('span', 'count', `${items.length}/28`));
    panel.appendChild(h);
    const grid = el('div', 'grid-inv');
    for (let i = 0; i + 1 < m.inventory.length; i += 2) {
      const id = m.inventory[i], qty = m.inventory[i + 1];
      grid.appendChild(itemCell(id > 0 ? { id, qty } : null));
    }
    panel.appendChild(grid);
    row.appendChild(panel);
  }

  // Rune pouch
  const pouch = itemPairs(m.rune_pouch);
  if (pouch.length) {
    const panel = el('section', 'panel');
    panel.appendChild(el('h2', null, 'Rune pouch'));
    const grid = el('div', 'grid-pouch');
    pouch.forEach((it) => grid.appendChild(itemCell(it)));
    panel.appendChild(grid);
    row.appendChild(panel);
  }

  if (row.children.length) main.appendChild(row);

  // Bank
  const bankItems = itemPairs(m.bank);
  const panel = el('section', 'panel bank-panel');
  const h = el('h2', null, m.name === '@SHARED' ? 'Shared bank ' : 'Bank ');
  h.appendChild(el('span', 'count', `${bankItems.length.toLocaleString()} items`));
  panel.appendChild(h);

  if (!bankItems.length) {
    panel.appendChild(el('p', 'empty-note', 'Nothing stored here yet.'));
  } else {
    const tools = el('div', 'bank-tools');
    const input = el('input');
    input.type = 'search';
    input.placeholder = 'Filter bank…';
    tools.appendChild(input);
    panel.appendChild(tools);

    const grid = el('div', 'grid-bank');
    const cells = bankItems.map((it) => {
      const cell = itemCell(it);
      grid.appendChild(cell);
      return { cell, name: itemName(it.id).toLowerCase() };
    });
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      cells.forEach(({ cell, name }) => {
        cell.style.display = !q || name.includes(q) ? '' : 'none';
      });
    });
    panel.appendChild(grid);
  }
  main.appendChild(panel);
}

function renderSearch() {
  const query = $('#global-search').value.trim().toLowerCase();
  const searchMain = $('#search-content');
  const memberMain = $('#member-content');
  if (!query) {
    searchMain.classList.add('hidden');
    memberMain.classList.remove('hidden');
    return;
  }
  memberMain.classList.add('hidden');
  searchMain.classList.remove('hidden');
  searchMain.replaceChildren();

  let total = 0;
  for (const m of sortedMembers()) {
    const containers = [
      ['Bank', m.bank], ['Inventory', m.inventory],
      ['Equipment', m.equipment], ['Rune pouch', m.rune_pouch],
    ];
    const hits = [];
    for (const [label, arr] of containers) {
      for (const it of itemPairs(arr)) {
        if (itemName(it.id).toLowerCase().includes(query)) hits.push({ ...it, where: label });
      }
    }
    if (!hits.length) continue;
    total += hits.length;
    const group = el('div', 'search-group');
    group.appendChild(el('h3', null, displayName(m.name)));
    for (const hit of hits.slice(0, 50)) {
      const rowEl = el('div', 'search-hit');
      rowEl.appendChild(itemCell(hit));
      rowEl.appendChild(el('span', null, `${itemName(hit.id)} × ${hit.qty.toLocaleString()}`));
      rowEl.appendChild(el('span', 'where', hit.where));
      group.appendChild(rowEl);
    }
    searchMain.appendChild(group);
  }
  if (!total) searchMain.appendChild(el('p', 'empty-note', `No items matching “${query}” anywhere in the group.`));
}

function renderSyncStatus() {
  const box = $('#sync-status');
  box.classList.toggle('offline', !state.online);
  $('#sync-text').textContent = state.online
    ? `live · updated ${timeAgo(state.lastSyncAt)}`
    : 'connection lost — retrying…';
}

function renderAll() {
  renderTabs();
  renderMember();
  renderSearch();
  renderSyncStatus();
}

// ---------- Views / session ----------

function showApp() {
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  $('#group-title').textContent = state.group;
  state.pollTimer = setInterval(refresh, REFRESH_MS);
  state.tickTimer = setInterval(renderSyncStatus, 1000);
}

function logout(message) {
  clearInterval(state.pollTimer);
  clearInterval(state.tickTimer);
  localStorage.removeItem('gim.group');
  localStorage.removeItem('gim.token');
  state.members.clear();
  state.activeTab = null;
  state.nextFromTime = EPOCH;
  $('#app-view').classList.add('hidden');
  $('#login-view').classList.remove('hidden');
  const errEl = $('#login-error');
  errEl.textContent = message || '';
  errEl.classList.toggle('hidden', !message);
}

async function login(group, token) {
  const btn = $('#login-btn');
  const errEl = $('#login-error');
  btn.disabled = true;
  btn.textContent = 'Connecting…';
  errEl.classList.add('hidden');
  try {
    state.group = group;
    state.token = token;
    const data = await api('get-group-data', { from_time: EPOCH });
    localStorage.setItem('gim.group', group);
    localStorage.setItem('gim.token', token);
    mergeMembers(data);
    state.lastSyncAt = new Date();
    state.nextFromTime = new Date(Date.now() - 5000).toISOString();
    state.activeTab = sortedMembers()[0]?.name || null;
    showApp();
    renderAll();
  } catch (err) {
    errEl.textContent = err instanceof AuthError
      ? 'Invalid group name or token.'
      : 'Could not reach the server. Try again in a moment.';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Connect';
  }
}

// ---------- Wiring ----------

$('#login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  login($('#login-group').value.trim(), $('#login-token').value.trim());
});

$('#logout-btn').addEventListener('click', () => logout());

$('#global-search').addEventListener('input', renderSearch);

(async function init() {
  await loadItemNames();
  if (state.group && state.token) {
    await login(state.group, state.token);
    // login() shows the error on the login view if the stored session is stale
    $('#login-group').value = state.group;
  }
})();
