// Zero-dependency local dev server. Serves the static frontend from public/
// and routes /api/gim to the same handler Vercel uses in production.
// Run with: npm start  (or: node server.mjs)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import gimHandler from './api/gim.js';

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === '/api/gim') {
      // Adapt the plain Node req/res to the Vercel handler interface.
      req.query = Object.fromEntries(url.searchParams);
      res.status = (code) => ((res.statusCode = code), res);
      res.json = (obj) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(obj));
      };
      return gimHandler(req, res);
    }

    const relPath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const filePath = join(PUBLIC_DIR, normalize(relPath));
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.statusCode = 403;
      return res.end('Forbidden');
    }
    try {
      const data = await readFile(filePath);
      res.setHeader('content-type', MIME[extname(filePath)] || 'application/octet-stream');
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  })
  .listen(PORT, () => {
    console.log(`GIM tracker running at http://localhost:${PORT}`);
  });
