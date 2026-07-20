// Weekly XP baselines backed by the project's own Postgres database (Neon).
//
// Each call fetches current skill XP from groupiron.men (which also validates
// the token), records a snapshot per player (at most one per 15 minutes) and
// returns each player's earliest snapshot within the past 7 days — the
// baseline the dashboard measures "XP gained this week" against.
//
// The connection string comes from the Vercel Neon integration
// (DATABASE_URL / POSTGRES_URL). Responds 503 when no database is
// configured; the frontend then falls back to groupiron.men's skill history.

const UPSTREAM = 'https://groupiron.men/api/group';
const SNAPSHOT_MIN_INTERVAL_MS = 15 * 60_000;
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 90;

let sqlPromise = null;

function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  if (!sqlPromise) {
    sqlPromise = (async () => {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(url);
      await sql`CREATE TABLE IF NOT EXISTS xp_snapshots (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        group_name text NOT NULL,
        player text NOT NULL,
        taken_at timestamptz NOT NULL DEFAULT now(),
        skills jsonb NOT NULL
      )`;
      await sql`CREATE INDEX IF NOT EXISTS xp_snapshots_lookup
        ON xp_snapshots (group_name, player, taken_at)`;
      return sql;
    })();
  }
  return sqlPromise;
}

export default async function handler(req, res) {
  const { group } = req.query || {};
  const token = req.headers['authorization'];
  if (!group || !token) return res.status(401).json({ error: 'Unauthorized' });

  const sqlReady = getSql();
  if (!sqlReady) return res.status(503).json({ error: 'No database configured' });

  let sql;
  try {
    sql = await sqlReady;
  } catch {
    sqlPromise = null; // retry schema setup on the next request
    return res.status(502).json({ error: 'Database unavailable' });
  }

  const upstream = await fetch(
    `${UPSTREAM}/${encodeURIComponent(group)}/get-group-data?from_time=2020-01-01T00:00:00.000Z`,
    { headers: { Authorization: token } },
  );
  if (!upstream.ok) {
    return res.status(upstream.status === 401 ? 401 : 502).json({ error: 'Upstream error' });
  }
  const members = await upstream.json();

  try {
    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
    const result = [];
    for (const m of members) {
      if (!Array.isArray(m.skills)) continue;

      const [last] = await sql`
        SELECT taken_at FROM xp_snapshots
        WHERE group_name = ${group} AND player = ${m.name}
        ORDER BY taken_at DESC LIMIT 1`;
      if (!last || Date.now() - new Date(last.taken_at).getTime() > SNAPSHOT_MIN_INTERVAL_MS) {
        await sql`INSERT INTO xp_snapshots (group_name, player, skills)
          VALUES (${group}, ${m.name}, ${JSON.stringify(m.skills)}::jsonb)`;
        await sql`DELETE FROM xp_snapshots
          WHERE group_name = ${group} AND player = ${m.name}
            AND taken_at < now() - make_interval(days => ${RETENTION_DAYS})`;
      }

      const [base] = await sql`
        SELECT taken_at, skills FROM xp_snapshots
        WHERE group_name = ${group} AND player = ${m.name} AND taken_at >= ${cutoff}
        ORDER BY taken_at ASC LIMIT 1`;
      if (base) result.push({ name: m.name, since: base.taken_at, skills: base.skills });
    }
    res.status(200).json(result);
  } catch {
    res.status(502).json({ error: 'Database query failed' });
  }
}
