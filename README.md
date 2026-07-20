# Group Ironman Tracker

A clean, live-updating web dashboard for Old School RuneScape Group Ironman teams.
It connects to the [groupiron.men](https://groupiron.men) API — the backend used by the
[Group Ironmen Tracker RuneLite plugin](https://runelite.net/plugin-hub/show/group-ironmen-tracker) —
and shows what every member of your group owns, from any browser, without opening the game.

Sign in with your group name and access token to get:

- **Bank, inventory, equipment and rune pouch** for every member, rendered with item
  icons, in-game style quantity badges and exact counts on hover
- **Group-wide item search** — find which member holds an item, and whether it is in
  their bank, inventory or equipment
- **Bank filtering** — quickly narrow down banks with hundreds of items
- **Weekly XP tracking** — XP gained per skill, shown in each player's tab and as a
  group-wide comparison table
- **Live updates** — the dashboard polls every 10 seconds and fetches only what
  changed, so data stays current while members play
- **Light and dark mode** — follows the system theme automatically

No accounts and no database. The access token is stored only in your browser and is
forwarded exclusively to the groupiron.men API.

## Getting started

Requires [Node.js](https://nodejs.org) 18 or newer. There are no dependencies to install:

```
npm start
```

Open http://localhost:3000 and sign in with your group name and access token.

If you do not have a token yet, install the **Group Ironmen Tracker** plugin from the
RuneLite plugin hub and follow its setup — it assigns each group a name and an access
token.

## Deploying

The groupiron.men API does not send CORS headers, so browsers cannot call it directly.
The site therefore includes a small proxy function, which rules out purely static hosts
such as GitHub Pages. Vercel runs it on its free tier:

1. Push this repository to GitHub.
2. On [vercel.com](https://vercel.com), select **Add New → Project** and import the repository.
3. Keep the framework preset **Other**, with no build command and `public` as the output directory.
4. Deploy. The `api/` directory automatically becomes the serverless proxy.

## How it works

```
Browser ── /api/gim ──> proxy (api/gim.js) ──> groupiron.men API
   │
   └────── item icons & names ──> static.runelite.net
```

- `public/` — the frontend, written in plain HTML, CSS and JavaScript (no framework)
- `api/gim.js` — a serverless function that forwards requests (including the
  `Authorization` token) to groupiron.men; used by both Vercel and the local server
- `server.mjs` — zero-dependency local development server that serves `public/` and
  mounts the same proxy handler, so local and deployed behavior match

The dashboard requests group data with the API's `from_time` parameter, so after the
initial load only changed data is transferred. Item icons and names are loaded from
RuneLite's public static cache.

## Credits

- [groupiron.men](https://groupiron.men) and the open-source
  [group-ironmen](https://github.com/christoabrown/group-ironmen) project for the API
- [RuneLite](https://runelite.net) for the item icon and name cache

Not affiliated with Jagex. Old School RuneScape is a trademark of Jagex Ltd.
