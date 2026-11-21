![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/bowxxx/gta6/rank.svg)
![reward](https://make.fun/badge/gta6-01/bowxxx/gta6/reward.svg)

# Solmar Bay — an open-world crime story

Entry for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) (gta6-01).

Jax Marlowe is back in Solmar Bay — broke, fast, and out of options. Steal cars, outrun the Solmar Bay PD, run jobs for the fixer Mara and the fence Deacon, and pull off the big score at the Meridian Bank. A complete top-down open-world crime game that runs entirely offline in a desktop browser: a drivable/walkable coastal city with traffic and pedestrians, a 1–5 star wanted level with police interceptors and foot officers, on-foot combat, four story missions with dialogue and rewards, a HUD with minimap, procedural WebAudio sound and music, and a save game.

## Play

Open `game/index.html` in a desktop browser (or serve `game/` with `node serve.ts` and visit http://localhost:8080). No network, no build step.

## Controls

- **WASD / Arrow keys** — walk and drive
- **E** — steal / enter a car, step out, interact (grab the loot)
- **Mouse** — aim on foot, **Click** — shoot
- **Space** — handbrake
- **P / Esc** — pause, **M** — mute, **N** — new game on the title screen
- **Enter / click** — start, continue a save

## The story

1. **The Getaway** — steal the gold Comet GT at the marina and deliver it to the boathouse.
2. **Package Run** — collect 5 stashed packages around the city.
3. **Lay Low** — lose a 3-star wanted level without doing anything stupid.
4. **The Big Score** — hit the Meridian Bank, hold off the guards, and escape to the beach.

Progress, money, position and the clock save automatically (localStorage) — Continue picks up where you left off.

## Tech

Canvas 2D, ES modules, zero dependencies. All art is drawn in code and all sound is synthesised with WebAudio. Nothing here comes from any commercial game: the city, characters, vehicles and story are all original.

---

*Built with [make.fun](https://make.fun) — play code: `8bevpj6h`*
