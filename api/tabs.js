// CRUD for bank tabs — per-player item tabs inside the bank window,
// shared with the whole group through the database.
//
//   GET    /api/tabs?group=X&player=P   -> [{ id, name, icon, items }]
//   POST   /api/tabs?group=X&player=P   body { name, icon }
//   PATCH  /api/tabs?group=X&id=N       body { name?, icon?, items? }
//   DELETE /api/tabs?group=X&id=N
//
// Storage is the Neon Postgres database (DATABASE_URL). When none is
// configured — local development — tabs persist to bank-tabs.json instead.
// All requests require the group's token, verified against groupiron.men.
import { readFile, writeFile } from 'node:fs/promises';

const UPSTREAM = 'https://groupiron.men/api/group';
const ICONS = ['star', 'sword', 'shield', 'flask', 'coin', 'book'];
const MAX_TABS_PER_PLAYER = 10;
const MAX_ITEMS = 200;
const MAX_NAME_LENGTH = 30;

// ---------- auth ----------

const validTokenCache = new Map(); // "group|token" -> expiry timestamp

async function isValidToken(group, token) {
  const key = `${group}|${token}`;
  const expiry = validTokenCache.get(key);
  if (expiry && expiry > Date.now()) return true;
  const res = await fetch(
    `${UPSTREAM}/${encodeURIComponent(group)}/get-group-data?from_time=${new Date().toISOString()}`,
    { headers: { Authorization: token } },
  );
  if (!res.ok) return false;
  validTokenCache.set(key, Date.now() + 10 * 60_000);
  return true;
}

// ---------- validation ----------

function cleanName(name) {
  const s = String(name ?? '').trim().slice(0, MAX_NAME_LENGTH);
  return s.length ? s : null;
}

function cleanIcon(icon) {
  return ICONS.includes(icon) ? icon : 'star';
}

function cleanItems(items) {
  if (!Array.isArray(items)) return [];
  return [...new Set(items.filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_ITEMS);
}

// ---------- database store ----------

let sqlPromise = null;

function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  if (!sqlPromise) {
    sqlPromise = (async () => {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(url);
      await sql`CREATE TABLE IF NOT EXISTS bank_tabs (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        group_name text NOT NULL,
        player text NOT NULL,
        name text NOT NULL,
        icon text NOT NULL DEFAULT 'star',
        items jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS bank_tabs_lookup
        ON bank_tabs (group_name, player, id)`;
      return sql;
    })();
  }
  return sqlPromise;
}

function rowToTab(row) {
  return { id: Number(row.id), name: row.name, icon: row.icon, items: row.items };
}

function dbStore(sql) {
  return {
    async list(group, player) {
      const rows = await sql`SELECT id, name, icon, items FROM bank_tabs
        WHERE group_name = ${group} AND player = ${player} ORDER BY id`;
      return rows.map(rowToTab);
    },
    async create(group, player, { name, icon }) {
      const [{ count }] = await sql`SELECT count(*)::int AS count FROM bank_tabs
        WHERE group_name = ${group} AND player = ${player}`;
      if (count >= MAX_TABS_PER_PLAYER) throw new Error('Tab limit reached');
      const [row] = await sql`INSERT INTO bank_tabs (group_name, player, name, icon)
        VALUES (${group}, ${player}, ${name}, ${icon})
        RETURNING id, name, icon, items`;
      return rowToTab(row);
    },
    async update(group, id, patch) {
      const [row] = await sql`SELECT id, name, icon, items FROM bank_tabs
        WHERE group_name = ${group} AND id = ${id}`;
      if (!row) throw new Error('Tab not found');
      const next = { ...rowToTab(row), ...patch };
      await sql`UPDATE bank_tabs
        SET name = ${next.name}, icon = ${next.icon}, items = ${JSON.stringify(next.items)}::jsonb
        WHERE group_name = ${group} AND id = ${id}`;
      return next;
    },
    async remove(group, id) {
      await sql`DELETE FROM bank_tabs WHERE group_name = ${group} AND id = ${id}`;
    },
  };
}

// ---------- file store (local development fallback) ----------

const FILE = new URL('../bank-tabs.json', import.meta.url);

async function fileLoad() {
  try {
    return JSON.parse(await readFile(FILE, 'utf8'));
  } catch {
    return { nextId: 1, groups: {} };
  }
}

async function fileSave(data) {
  await writeFile(FILE, JSON.stringify(data, null, 2));
}

function fileTabs(data, group, player) {
  const g = (data.groups[group] ||= {});
  return (g[player] ||= []);
}

const fileStore = {
  async list(group, player) {
    return fileTabs(await fileLoad(), group, player);
  },
  async create(group, player, { name, icon }) {
    const data = await fileLoad();
    const tabs = fileTabs(data, group, player);
    if (tabs.length >= MAX_TABS_PER_PLAYER) throw new Error('Tab limit reached');
    const tab = { id: data.nextId++, name, icon, items: [] };
    tabs.push(tab);
    await fileSave(data);
    return tab;
  },
  async update(group, id, patch) {
    const data = await fileLoad();
    for (const player of Object.values(data.groups[group] || {})) {
      const tab = player.find((t) => t.id === id);
      if (tab) {
        Object.assign(tab, patch);
        await fileSave(data);
        return tab;
      }
    }
    throw new Error('Tab not found');
  },
  async remove(group, id) {
    const data = await fileLoad();
    for (const [player, tabs] of Object.entries(data.groups[group] || {})) {
      data.groups[group][player] = tabs.filter((t) => t.id !== id);
    }
    await fileSave(data);
  },
};

async function getStore() {
  const sqlReady = getSql();
  if (!sqlReady) return fileStore;
  try {
    return dbStore(await sqlReady);
  } catch {
    sqlPromise = null; // retry schema setup on the next request
    throw new Error('Database unavailable');
  }
}

// ---------- request handling ----------

async function readBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    const text = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
    return text ? JSON.parse(text) : {};
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export default async function handler(req, res) {
  const { group, player, id } = req.query || {};
  const token = req.headers['authorization'];
  if (!group || !token || !(await isValidToken(group, token))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let body = null;
  if (req.method === 'POST' || req.method === 'PATCH') {
    try {
      body = await readBody(req);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  try {
    const store = await getStore();
    switch (req.method) {
      case 'GET': {
        if (!player) return res.status(400).json({ error: 'Player is required' });
        return res.status(200).json(await store.list(group, player));
      }
      case 'POST': {
        if (!player) return res.status(400).json({ error: 'Player is required' });
        const name = cleanName(body.name);
        if (!name) return res.status(400).json({ error: 'Name is required' });
        return res.status(200).json(
          await store.create(group, player, { name, icon: cleanIcon(body.icon) }),
        );
      }
      case 'PATCH': {
        const tabId = Number(id);
        if (!Number.isInteger(tabId)) return res.status(400).json({ error: 'Invalid id' });
        const patch = {};
        if (body.name !== undefined) {
          const name = cleanName(body.name);
          if (!name) return res.status(400).json({ error: 'Name is required' });
          patch.name = name;
        }
        if (body.icon !== undefined) patch.icon = cleanIcon(body.icon);
        if (body.items !== undefined) patch.items = cleanItems(body.items);
        return res.status(200).json(await store.update(group, tabId, patch));
      }
      case 'DELETE': {
        const tabId = Number(id);
        if (!Number.isInteger(tabId)) return res.status(400).json({ error: 'Invalid id' });
        await store.remove(group, tabId);
        return res.status(200).json({ ok: true });
      }
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Storage error' });
  }
}
