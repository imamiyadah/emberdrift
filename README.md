# Emberdrift

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/imamiyadah/emberdrift/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/imamiyadah/emberdrift/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

An original 2D arena-survival game in plain browser JavaScript — no engine,
no build step, no network. You pilot a salvage skiff drifting through an
ember field, hold off waves of hunter drones, harvest the ember cores from
their wreckage, and rebuild your skiff between waves. Every fifth wave an
Ember Dreadnought rises to meet you.

## How to play

- **WASD / arrow keys** — drift
- **Mouse** — aim
- **Hold click / Space** — fire
- **1 / 2 / 3 or click** — choose an upgrade between waves
- **P / Esc** — pause · **M** — mute · **R** — restart after a wreck

Survive the wave, choose one of three upgrades (damage, fire rate, split
cannon, shields, tractor magnet, repair nanites and more — the build you
assemble is the strategy), and see how deep into the swarm you get. Drones
come in four kinds — chasers, orbiting shooters, splitters that burst into
minis, and the dreadnought boss — and every wave is longer and tougher
than the last.

All art is canvas vector drawing and all sound is synthesized WebAudio;
the game ships no image or audio assets.

## Run it locally

Serve the `game/` folder with any static file server and open it in a
desktop browser, for example:

```
python3 -m http.server 8080 -d game
# then open http://localhost:8080
```

## Hand-in

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to the output directory and writes `dossier.json` with the
vendored make.fun library:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Entered in make.fun's [best-game-01](https://make.fun/bounty/best-game-01)
bounty by [@imamiyadah](https://make.fun/r/rwgn4ax4).

## License

MIT — see [LICENSE](LICENSE).
