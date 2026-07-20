// Proxy for the groupiron.men API. The upstream API sends no CORS headers,
// so the browser cannot call it directly — requests go through this function
// instead. The client's Authorization header is forwarded as-is.
const UPSTREAM = 'https://groupiron.men/api/group';

// Only these upstream endpoints may be reached through the proxy.
const ALLOWED_ENDPOINTS = new Set(['get-group-data', 'get-skill-data', 'collection-log']);

export default async function handler(req, res) {
  const { group, endpoint, ...params } = req.query || {};
  const token = req.headers['authorization'];

  if (!group || !endpoint || !ALLOWED_ENDPOINTS.has(endpoint)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const qs = new URLSearchParams(params).toString();
  const url = `${UPSTREAM}/${encodeURIComponent(group)}/${endpoint}${qs ? '?' + qs : ''}`;

  try {
    const upstream = await fetch(url, { headers: { Authorization: token } });
    const body = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    res.end(body);
  } catch {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Could not reach groupiron.men' }));
  }
}
