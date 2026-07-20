# Group Ironman Tracker

A clean dashboard for your OSRS Group Ironman group's items, powered by the
[groupiron.men](https://groupiron.men) API. Log in with your group name and
access token to see every member's **bank, inventory, equipment and rune pouch**,
search items across the whole group, and watch it update live every 10 seconds.

## Run locally

Requires Node.js 18+ (no dependencies, no build step):

```
npm start
```

Then open http://localhost:3000 and enter your group name and token.

## Deploy to Vercel

GitHub Pages won't work — the groupiron.men API blocks direct browser requests
(no CORS), so the site needs the small proxy function in `api/gim.js`. Vercel
runs it for free:

1. Push this folder to a GitHub repository.
2. In [vercel.com](https://vercel.com), **Add New → Project** and import the repo.
3. Leave the framework preset as **Other**, no build command, output directory `public`.
4. Deploy. Done — the `api/` folder automatically becomes the serverless proxy.

Your token is never stored on the server; it lives in your browser's
localStorage and is forwarded with each request.

## Project layout

- `public/` — the frontend (plain HTML/CSS/JS, no framework)
- `api/gim.js` — serverless proxy to groupiron.men (used by Vercel and the local server)
- `server.mjs` — zero-dependency local dev server

Item icons and names come from RuneLite's public static cache.
