# Rush Hour Kitchen

[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/rezimx-btc/best-cooking-game-20261125-0137-v1/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/rezimx-btc/best-cooking-game-20261125-0137-v1/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)

**Rush Hour Kitchen** is a time-management cooking game: take order tickets from named regulars, chop, fry and boil each dish at its station, plate it and serve before patience runs out. Three escalating days, a rush bell, burning pans, live score with combos and PERFECT-serve bonuses.

## How to play

1. Click a ticket in the ORDER TICKETS rail (or press **E** at the ORDERS counter) to take it.
2. Grab the next ingredient at the **FRIDGE**.
3. **Chop** it at the BOARD, **fry** it on the STOVE, or **boil** it in the POT — each station shows its state word (IDLE / FRYING / BOILING / READY! / BURNT!).
4. Add finished ingredients at **PLATING**, then serve at the **SERVE** hatch.
5. Serve with patience above 50% for a **PERFECT** bonus. Chain serves without a walkout to raise your **COMBO** multiplier (up to ×3) and earn tips.

**Watch out:** food left on the heat after it is READY burns in 6 seconds — a burnt pan smokes, blocks the station, and must be binned. Press **B** once a day to ring the **RUSH BELL** and finish every cook instantly. A second stove unlocks on Day 2.

**Win:** serve the day's quota before closing (Day 1: 4, Day 2: 5, Day 3: 6). **Lose:** too many customers walk out (Day 1: 2, later days: 3).

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move the chef |
| E | Interact with the nearest station |
| Click | Ticket (take order) or station (interact when close) |
| B | Rush bell (once per day) |
| R | Restart the day |
| M | Mute |

## Run it

Play in a browser — no build step, no network, no dependencies:

```
open game/index.html
```

or serve it locally:

```
python3 -m http.server --directory game 8080
```

Build the make.fun dossier (Node 22+, stdlib only):

```
node main.ts
```

This copies `game/` and `screenshots/` into `./output/` (or `$MAKEFUN_OUTPUT_DIR`) and writes a deterministic `dossier.json` — two runs produce byte-identical output.

## Structure

```
main.ts            entrypoint: copies game + screenshots, writes dossier.json
game/
  index.html       layout: top bar, canvas, ticket rail, legend + controls footer
  css/style.css    kitchen theme
  js/main.js       state, loop, input, day flow, screenshot staging, debug API
  js/orders.js     recipes, customers, tickets, patience, scoring
  js/stations.js   station layout, cooking / chopping / burn logic, E-interactions
  js/render.js     canvas drawing (floor, stations, customers, chef, smoke)
  js/hud.js        DOM: ticket rail, stove panel, tray, ticker, overlay
  js/audio.js      procedural WebAudio (chop, sizzle, ding, bell, win/lose)
screenshots/      4 genuine 1280x720 captures of the game running
```

## Screenshots

- `01-cover.png` — Day 1 mid-service: burger on the stove, lettuce on the board
- `02-cooking.png` — noodles boiling, egg in hand, two tickets up
- `03-rush.png` — three tickets, clock at 0:12, a burnt pan smoking
- `04-serve.png` — PERFECT serve at the hatch, +230, combo ×2

## License

MIT — see [LICENSE](LICENSE).
