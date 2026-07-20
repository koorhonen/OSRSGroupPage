# Group Ironman Tracker

A clean, live-updating web dashboard for your Old School RuneScape **Group Ironman** team.
It connects to the [groupiron.men](https://groupiron.men) API (the backend used by the
[Group Ironmen Tracker RuneLite plugin](https://runelite.net/plugin-hub/show/group-ironmen-tracker))
and shows what everyone in your group owns — from anywhere, without opening the game.

Log in with your group name and access token, and you get:

- 🎒 **Bank, inventory, equipment & rune pouch** for every member, with real item icons,
  in-game style quantity badges (`34.1K`, `18.9K`, …) and exact counts on hover
- 🔍 **Group-wide item search** — find out instantly who has that one Dragon dagger,
  and whether it's in their bank or their inventory
- 🗂️ **Bank filtering** — type to filter a bank with hundreds of items
- ⚡ **Live updates** — polls every 10 seconds and only fetches what changed, so you can
  watch teammates' inventories shift while they play
- 🌙 **Light & dark mode** — follows your system theme automatically

No accounts, no database, no build step. Your token stays in your own browser and is only
forwarded to the groupiron.men API.

## Getting started

You need [Node.js](https://nodejs.org) 18 or newer. There are no dependencies to install:

```
npm start
```

Open http://localhost:3000, enter your group name and token, and you're in.

> Don't have a token? Install the **Group Ironmen Tracker** plugin from the RuneLite
> plugin hub and follow its setup — it gives every group a name and an access token.

## Deploying

The groupiron.men API doesn't send CORS headers, so the browser can't call it directly —
the site ships with a tiny proxy function, which rules out purely static hosts like
GitHub Pages. **Vercel** runs it for free:

1. Push this repository to GitHub.
2. On [vercel.com](https://vercel.com): **Add New → Project**, import the repo.
3. Keep the framework preset **Other**, no build command, output directory `public`.
4. Deploy. The `api/` folder automatically becomes the serverless proxy.

## How it works

```
Browser ── /api/gim ──> proxy (api/gim.js) ──> groupiron.men API
   │
   └────── item icons & names ──> static.runelite.net
```

- `public/` — the whole frontend in plain HTML, CSS and JavaScript (no framework)
- `api/gim.js` — a small serverless function that forwards requests (and your
  `Authorization` token) to groupiron.men; used both by Vercel and the local server
- `server.mjs` — zero-dependency local dev server: serves `public/` and mounts the same
  proxy handler, so local and deployed behavior match

The dashboard fetches group data with the API's `from_time` parameter, so after the first
load only *changed* data crosses the wire. Item icons and names come from RuneLite's
public static cache, which the browser can load directly.

## Credits

- [groupiron.men](https://groupiron.men) / the open-source
  [group-ironmen](https://github.com/christoabrown/group-ironmen) project for the API
- [RuneLite](https://runelite.net) for the item icon and name cache

Not affiliated with Jagex. Old School RuneScape is a trademark of Jagex Ltd.
