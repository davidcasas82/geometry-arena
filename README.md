# Geometry Arena

A **Geometry Wars–inspired** twin-stick shooter for the browser. Move with WASD, aim with the mouse, hold click to fire, and survive escalating geometric swarms. Bluetooth / USB gamepads work too (left stick move, right stick aim).

## Play now

**[▶ Open Geometry Arena](https://davidcasas82.github.io/geometry-arena/)**

Works best on desktop or laptop with a mouse/trackpad, or a Bluetooth/USB gamepad on a TV/couch setup.

## Play locally

From this folder:

```bash
npm start
```

Then open **http://localhost:5173**

Or open `index.html` with any static file server (ES modules need a server, not `file://`).

## Controls

| Action | Keyboard / mouse | Gamepad |
|--------|------------------|---------|
| Move | `W` `A` `S` `D` (or arrows) | Left stick (analog speed) / D-pad |
| Aim | Drag trackpad / mouse (relative) | Right stick (absolute) |
| Fire | **Click and hold** left mouse | **RT** or **RB** (hold) |
| Bomb | `Space` or `B` | **LT** (also A / LB) |
| Pause | `P` / `Esc` | **Start** / Options |
| Mute | `M` | **Back** / Select / Share |
| Restart | Play Again / `R` after game over | **A** or **Start** |
| Title PLAY | `Enter` / `Space` | **A** or **Start** |

Pair a Bluetooth controller in system settings first (Xbox, DualSense, Switch Pro, 8BitDo, etc.). Press any button once so the browser can see the pad. Keyboard and gamepad work at the same time.

On play, the game captures the pointer so trackpad aim doesn’t stop at the screen edge (gamepad aim does not need pointer lock).

## Geometry Wars–inspired systems

See honest gap scores vs the real game: [`docs/VS_GEOMETRY_WARS.md`](docs/VS_GEOMETRY_WARS.md).

- **Geom mult economy** — +1 ×mult per geom, ceiling 999, idle decay, death resets  
- **Reactive neon grid**, additive particles, thruster afterimages  
- **Fire densifies with mult** (rate + extra streams)  
- **Bombs** — shockwave clear, no points; start 3; +1 / 100k  
- **Extra lives** / 75k  
- **Wave spawn director** (bursts + lulls)

## Enemies

| Shape | Behavior |
|-------|----------|
| Green wanderer | Slow seek |
| Cyan diamond | Fast seek |
| Pink square | Creep then dash |
| Purple spinner | Orbit approach |
| Purple splitter | Dies into 2 children |
| Pink snake | Multi-segment weaver |
| Orange tank | Slow, 3 HP |
| Void (black hole) | Pulls you in, spawns atoms |

Scoop **geoms** to raise multiplier. Death resets mult.

## Soundtrack

Suno-generated instrumental **Neon Swarm** (two variants):

| File | When |
|------|------|
| `audio/neon-swarm-1.mp3` | Levels **1, 3, 5…** |
| `audio/neon-swarm-2.mp3` | Levels **2, 4, 6…** |

Levels advance every **50s** of survival (see `LEVEL_DURATION_SEC`). Tracks crossfade; mute/`M` silences SFX + BGM.

## Stack

- Vanilla HTML / CSS / JS (ES modules)
- Canvas 2D rendering
- Web Audio SFX + HTMLAudioElement BGM loops
- LocalStorage for high score

## Dev / session handoff

For architecture, UI flow, balance contracts, past bugs, and how to resume work in a new session, see:

**[`docs/BUILD_CONTEXT.md`](docs/BUILD_CONTEXT.md)**

Balance knobs live in `js/constants.js` (prefer that over README numbers if they disagree).

## Deploy (GitHub Pages)

This repo is set up for **GitHub Pages** on the `main` branch (site root).

| | |
|--|--|
| **Live game** | https://davidcasas82.github.io/geometry-arena/ |
| **Source** | https://github.com/davidcasas82/geometry-arena |

**Update the live site:** commit and push to `main` — Pages rebuilds automatically (usually under a minute).

```bash
git add -A
git commit -m "Your change"
git push
```

Other static hosts (Vercel, Netlify, Cloudflare Pages) also work if you ever want a custom domain or private deploys.

## Tuning

Gameplay knobs live in `js/constants.js` (speeds, fire rate, spawn ramp, lives, colors).
