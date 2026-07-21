# Group Ironman Tracker

**Live site: [osrsgroups.vercel.app](https://osrsgroups.vercel.app)**

A clean, live-updating web dashboard for Old School RuneScape Group Ironman teams.
It connects to the [groupiron.men](https://groupiron.men) API — the backend used by the
[Group Ironmen Tracker RuneLite plugin](https://runelite.net/plugin-hub/show/group-ironmen-tracker) —
and shows what every member of your group owns, from any browser, without opening the game.

Sign in with your group name and access token to get:

- **Bank, inventory, equipment and rune pouch** for every member, rendered with item
  icons, in-game style quantity badges and exact counts on hover
- **Group-wide item search** — find which member holds an item, and whether it is in
  their bank, inventory or equipment
- **Bank tabs** — organize each player's bank like in the game: create tabs with a
  selectable icon inside the bank window and drag items onto them. The main "All"
  tab shows whatever is not yet organized, and searching looks through every tab.
  Tabs are shared by the whole group
- **Weekly XP tracking** — XP gained per skill, shown in each player's tab and as a
  group-wide comparison table
- **Live updates** — the dashboard polls every 10 seconds and fetches only what
  changed, so data stays current while members play
- **Light and dark mode** — follows the system theme automatically

Your access token is stored only in your browser. If you do not have one yet, install
the **Group Ironmen Tracker** plugin from the RuneLite plugin hub and follow its setup —
it assigns each group a name and an access token.

## Credits

- [groupiron.men](https://groupiron.men) and the open-source
  [group-ironmen](https://github.com/christoabrown/group-ironmen) project for the API
- [RuneLite](https://runelite.net) for the item icon and name cache

Not affiliated with Jagex. Old School RuneScape is a trademark of Jagex Ltd.
