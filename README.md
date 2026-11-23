[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Rank](https://make.fun/badge/gta6-01/d333ko23/gta6-velmaris-makefun/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![Reward](https://make.fun/badge/gta6-01/d333ko23/gta6-velmaris-makefun/reward.svg)](https://make.fun/bounty/gta6-01)

# Velmaris: open-world crime — 8 story jobs, VPD dispatch with roadblocks, PIT units and air support, crew and turf control

An open-world crime game in the browser, built for make.fun's **Make GTA 6** bounty
([gta6-01](https://make.fun/bounty/gta6-01)). A coastal city of your own — no
borrowed names, maps or art — played top-down in 2D from static files, with no
network requests and no build step.

## The city

**Velmaris** is a sun-soaked coastal city of six districts — Old Harbor, Marina
Bay, Coral Row, Foundry, Palm Court and North Docks — with a beach and sea along
its north edge, a road grid full of traffic and pedestrians, and a day/night
cycle. Walk it on foot or steal any car on the street and drive.

## What is in the game

- **8 story jobs** — Harbor Heist, Getaway Driver, Silent Courier, Bank Job,
  Turf War, The Informant, Midnight Run and the final Big Score at the Gilded
  Gull Casino, each with its own objectives on the HUD.
- **Job planning** — before every job, pick an approach (Quiet / Loud / Crew
  Run) and buy tools with explicit costs (lockpick $150, disguise $300, getaway
  car $400, signal jammer $250). Final score = loot − tool costs + bonuses.
- **VPD dispatch** — the Velmaris Police Department answers a 5-star wanted
  level with patrols, roadblocks from 3 stars, PIT/RAM units from 4 stars, and
  the "Air One" helicopter at 5 stars. Lay low and the heat fades; get caught
  slow or on foot and you are busted.
- **Crew** — hire Rook the driver, Mira the hacker and Brute the muscle. Each
  one changes how jobs play: faster getaways, more loot, smashed roadblocks.
- **Turf control** — finish jobs to take districts; controlled turf pays cash
  every 30 seconds. Your turf percentage is always on the HUD.
- **Garage** — buy engine, armor and tire upgrades, and repair your ride.
- **Traffic and pedestrians, carjacking, day/night, minimap, concrete dollar
  amounts everywhere, and progress saved in localStorage.**

## How to play

Serve the game and open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk, or drive (W accelerate, S brake/reverse, A/D steer) |
| E | Carjack a nearby car · plan the next job at the Safehouse |
| F | Exit the car |
| G | Open the Garage (near the Garage) |
| C | Open the Crew panel |
| 1–7 | Choose approaches, tools, upgrades and crew in menus |
| Enter / Space | Confirm · start the job |
| P | Pause |
| Esc | Cancel / leave a menu |

## Screenshots

The four shots in `screenshots/` are real renders of the game, staged
deterministically with `?shot=start|play|chase|end&seed=7` (see `shots.json`).

## License

MIT — see `LICENSE`.
