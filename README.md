# Trenchain

> **Proof of Concept** — Work in progress

On-chain campaign game for [Trench Crusade](https://www.trenchcrusade.com/) built as a Polkadot SDK parachain.

The idea: bring the Trench Crusade tabletop wargame into a persistent world where campaign results, warband progression, resource logistics, and territorial control all live on-chain. Players fight battles on the tabletop, report results to the blockchain, and the world evolves season after season based on collective outcomes.

## What's Interesting

- **All game rules on-chain**: 27 FRAME pallets encode the full game logic — factions, unit entries, equipment rules, campaign lifecycle, battle resolution, post-battle trauma/XP, exploration loot tables. No backend server, no database. The chain IS the game state.

- **Hex-based logistics simulation**: A world map of ~4000 hex tiles grouped into 162 regions runs a per-block economic simulation. Resources (flesh, iron, powder) are produced by buildings, packaged into caravans, and routed via BFS to regions in deficit. Supply lines can be cut. Powder comes from the Orient, iron from central Europe, food from the north. Trade is life.

- **Season-based world mutation**: Campaigns play out on theatres (groups of regions). At season end, results are compiled and the chain permanently mutates the world — territory changes hands, buildings are destroyed or built, supply routes are disrupted. The next season starts on the new world state.

- **Scarcity-driven economy**: Global production is intentionally below global demand. No region is self-sufficient. Every army needs trade routes to survive. Powder is the critical bottleneck (produced almost exclusively in Islamic regions per the lore).

## Quick Start

```bash
./start.sh
```

Builds the runtime, starts a dev node (3s blocks), seeds all game data, and launches the dApp at `http://localhost:5173`.

Requires: Rust (stable + nightly), Node.js 20+, `polkadot-omni-node`, `chain-spec-builder`.

## Docker

```bash
docker build -t trenchain .
docker run -p 9944:9944 -p 5173:5173 trenchain
```

Requires `polkadot-omni-node` and `chain-spec-builder` available in the image or mounted. The all-in-one image builds the runtime, serves the dApp, and seeds the chain on startup.

## Structure

```
parachain-template/    Polkadot SDK parachain (runtime + 27 pallets)
dapp/                  React + Vite + TailwindCSS frontend
start.sh               One-command full-stack launcher
GAMEPLAY.md            Campaign rules and implementation status
```

## Game Rules

See [GAMEPLAY.md](GAMEPLAY.md) for the full Long War campaign loop: turn structure (battle, post-battle, movement, supply), victory conditions, season system, and what's implemented vs what's next.

## Status

This is a POC. The chain compiles, seeds, and runs. The dApp renders the world map, logistics flows, theatres, and warband management. The campaign gameplay loop (battle reporting, post-battle phases, hex movement, seasons) is designed and partially implemented on-chain but not yet wired end-to-end in the dApp.

## License

[GPLv3](LICENSE)
