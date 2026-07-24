# Geometry Arena — Build Context

**Purpose:** handoff doc so a new session (human or agent) can resume development without re-discovering architecture, product decisions, and past failure modes.

**Last updated:** 2026-07-24  
**Project root:** `geometry-arena/` (under `My Dev Folder`)  
**Stack:** vanilla HTML / CSS / ES modules, Canvas 2D, Web Audio SFX + HTMLAudio BGM, `localStorage` only (no backend)

---

## What this is

A **Geometry Wars–inspired twin-stick shooter** for laptop play:

| Input | Action |
|-------|--------|
| WASD / arrows / left stick (analog) / D-pad | Move (accel/inertia; move ≠ aim) |
| Mouse / trackpad drag | Relative aim |
| Right stick | Absolute aim (hold last dir when centered) |
| Click-hold / RT / RB | Fire |
| Space / B key / LT / A / LB | Bomb (clear, no points) |
| P / Esc / Start | Pause |
| M / Back-Select | Mute |
| R / A / Start | Restart after game over (via game input) |
| Enter-Space / A-Start | Title menu PLAY |

**Death / economy:** extra lives escalate (`EXTRA_LIFE_EVERY` × `EXTRA_LIFE_SCALE^n`). Death keeps a mult recovery seed (`DEATH_MULT_KEEP`, capped) + board cull — not hard ×1. Respawn freezes control (`RESPAWN_FREEZE_MS`) then remaining invuln with sticks live.

**Vibe:** neon arena, reactive grid, geom mult economy, formation spawns, trauma camera, hover-shadow geoms/enemies, SNES-title-inspired splash + chrome logo.

Honest parity notes vs Geometry Wars: `docs/VS_GEOMETRY_WARS.md`  
Tuning research / goldilocks goals: `docs/GAMEPLAY_TUNING_RESEARCH.md`  
**Live balance knobs:** `js/constants.js` (source of truth — README numbers may lag).

---

## How to run

```bash
cd "geometry-arena"
npm start          # static server on :5173
# open http://localhost:5173
```

Scripts:

| Command | What |
|---------|------|
| `npm start` / `npm run dev` | Serve on 5173 |
| `npm run uat` | logic + adversarial + browser UAT |
| `npm run uat:logic` | Pure logic checks |
| `npm run uat:adversarial` | Death / lives / immortality failure modes |
| `npm run uat:browser` | Puppeteer-ish browser harness |

ES modules require a static server (`file://` will fail).

### Debug hooks (browser console)

```js
__geometryArena          // Game instance
__arenaRuns()            // dump run history
__arenaRecent()          // last 10 runs
```

Run history is in `localStorage` (this browser only). Agent sessions cannot see the user’s prior runs unless they’re in the same browser profile.

Death telemetry logs: `[arena:death]` in the console.

---

## File map

```
geometry-arena/
  index.html          # splash + app shell + title menu + interrupt panel
  styles.css          # layout, HUD, splash, title menu, arcade buttons
  package.json
  README.md           # player-facing; may lag constants
  audio/
    neon-swarm-1.mp3  # odd levels (1,3,5…)
    neon-swarm-2.mp3  # even levels
    meta.json
  docs/
    BUILD_CONTEXT.md  # this file
    GAMEPLAY_TUNING_RESEARCH.md
    VS_GEOMETRY_WARS.md
  js/
    main.js           # UI wiring, splash → title menu, overlays
    game.js           # loop, state machine, scoring, spawn/death/bomb
    constants.js      # goldilocks balance (prefer edit here)
    input.js          # keys, mouse aim, gamepad (sticks/buttons), pointer lock
    entities.js       # player / bullets / enemies / geoms factories
    physics.js        # movement, collisions helpers
    spawns.js         # formation spawn jobs / patterns
    camera.js         # trauma, zoom punch, menu cam (DPR-aware transform)
    render.js         # world draw, grid, hover shadows, neon
    postfx.js         # bloom, chromatic, mult grade, vignette
    particles.js      # particles + floaters
    fx.js             # local bloom / neon stroke helpers
    audio.js          # SFX + BGM level themes
    runs.js           # localStorage run history
  uat/
    logic-uat.mjs
    adversarial-uat.mjs
    browser-uat.mjs
```

---

## Game state machine

| State | Meaning |
|-------|---------|
| `menu` | Living arena ambient; title UI over grid |
| `playing` | Active run |
| `paused` | Interrupt panel |
| `gameover` | Interrupt panel + run summary |

Core loop in `Game._loop` (`js/game.js`): update only while `playing`; menu still draws ambient grid pulses / particles / menu camera.

### Start / death / bomb (critical contracts)

1. **Invuln must not re-extend on continuous overlap**  
   Early bug: touching enemies while invuln refreshed the timer → effective immortality. Fix: hard windows only; no overlap re-extend.

2. **Lives / bombs from base progress, not mult-inflated score**  
   Early bug: mult made milestones trivial → always full lives (8–9 feel). Fix: `progress` tracks unmultiplied kill value; `EXTRA_LIFE_EVERY` / `EXTRA_BOMB_EVERY` on progress; caps `MAX_LIVES` / `MAX_BOMBS`.

3. **Gun is single-stream by default**  
   Dual at mult ≥ `MULT_FOR_DUAL` (45), triple at `MULT_FOR_TRIPLE` (110). Fire cooldown ~0.13s.

4. **Bomb** clears enemies without scoring those kills; saves runs.

5. **Death** resets mult; respawn with mercy invuln + soft clear pocket / spawn pause (see constants).

6. **Geoms** are small pickups (not enemies); scoop for +mult; magnet range; vacuum milestones auto-pull.

---

## UI flow (current product decision)

### 1. Full-screen splash (`#splash`)

- Black void, 16-bit / SNES title energy (Battletoads Double Dragon inspired)
- Large chrome **GEOMETRY / ARENA** wordmark (CSS, not generated image — text accuracy)
- Floating geometric props, starfield, scanlines
- **Any key or click** dismisses → fades/zooms out

### 2. Title menu on live grid (`#title-menu`, overlay `mode-title`)

- Same chrome logo (smaller) + tagline
- **PLAY** arcade button (Enter / Space also start)
- BEST score
- **HOW TO PLAY** expands control/tips list
- No control chips, no yellow coach box (removed by design)
- Light vignette only — **see the arena** through the menu (not a SaaS modal)

### 3. Interrupt panel (`#interrupt-panel`, overlay `mode-panel`)

- **Pause** and **Game Over** only
- Harder frame + Press Start-style title + arcade primary button
- Game over shows run summary + recent runs text

### 4. Header HUD

- Top-left: compact chrome **GEOMETRY / ARENA** logo (not generic text / not old brand-mark ship box)
- Stats: Score, Level, Mult, Lives, Bombs, Best — enlarged for readability

**UI logic lives in `js/main.js`:** `showTitleMenu()`, `showOverlay()` (interrupts), splash dismiss. Do not reintroduce a frosted “Play + how-to wall” as the default first screen.

---

## Visual / audio language

- **Palette:** deep black, cyan `#5efcff`, magenta/purple accents, green geoms, yellow bombs
- **Logo:** Orbitron blackletter-style chrome gradients + extruded text-shadow; Press Start 2P for prompts/buttons
- **Entities:** hover height + ground shadow for “above the grid” read
- **Camera:** trauma shake with combat soft-cap + diminishing returns (dense kills don’t pin full earthquake); big events use `{ big: true }`; zoom punch on set pieces; menu camera drift  
- **Presentation (Phase A):** DPR-scaled world buffer (cap 2×), dual-pass bloom, trauma chromatic fringe, mult color grade + stronger vignette (`GFX` in constants, `postfx.js`)
- **BGM:** Suno “Neon Swarm” variants; alternate by level parity via `playLevelTheme(level)`

---

## Balance snapshot (Goldilocks pass 1)

Targets (research-backed): median death ~**90–150s**, scarce extra lives, readable density, mult as real skill currency.

| Area | Current intent |
|------|----------------|
| World | 1600×900 |
| Lives | start 3, max 5; +life every **20k base progress** |
| Bombs | start 3, max 5; +bomb every **30k base progress** |
| Safe opening | ~20s fodder-only teach window |
| Spawn ramp | ease-in over ~145s; soft density caps by time |
| Geoms | small radius ~3.2 (sparkle pickups) |
| Mult decay | idle delay then stepwise decay |

Always re-read `js/constants.js` before tuning — it is intentionally the single dial board.

---

## Testing philosophy

- **Logic UAT:** pure functions / invariants without browser where possible  
- **Adversarial UAT:** specifically hunts immortality, life inflation, invuln abuse  
- **Browser UAT:** smoke + interaction in real page  

When changing death, invuln, scoring, or life awards, **run adversarial UAT** before calling it done.

---

## Product decisions already made (don’t re-litigate casually)

1. Twin-stick laptop first (WASD + mouse); gamepad is additive (same Input API).  
2. Vanilla Canvas — no engine.  
3. Geometry Wars **cousin**, not clone (see VS doc).  
4. Splash → **title on live grid**, not modal instructions as hero UI.  
5. How-to is opt-in under HOW TO PLAY; no redundant control chips.  
6. Logo is the chrome wordmark everywhere (splash, title, header).  
7. Interrupt panels only for pause / game over.  
8. Prefer CSS for exact logo text; image gen only for decorative non-text art.

---

## Known polish / future ideas (not committed)

These were discussed or are natural next steps — pick when product asks:

- [ ] Title-menu geom rain / ambient ship intro on PLAY  
- [ ] Game over → return to title menu option (today: Play Again starts immediately)  
- [ ] Stronger audio sting on splash dismiss  
- [ ] Iris / scanline wipe transition (instead of pure fade)  
- [ ] Further goldilocks passes from run history (`__arenaRuns`)  
- [x] Gamepad support (Bluetooth/USB via Gamepad API; deadzone in constants)  
- [x] Deployable static host (GitHub Pages → https://davidcasas82.github.io/geometry-arena/)  
- [ ] Sync README milestone numbers with `constants.js`  
- [ ] Pause help deep-link to same how-to content  

---

## Session resume checklist

1. Skim this file + `js/constants.js`.  
2. `npm start` → hard-refresh browser.  
3. Walk: splash → title → play 30s → pause → die once → game over.  
4. If touching combat/lives: `npm run uat:adversarial` (or full `npm run uat`).  
5. Keep UI language consistent with chrome logo + live-grid title menu.  
6. Prefer small, focused diffs; balance via constants first.

---

## Architecture notes for agents

- **No bundler** — edit modules directly; browser loads `js/main.js` as module entry.  
- **`Game` owns simulation**; **`main.js` owns DOM/UI**. Don’t put panel HTML updates inside `game.js` beyond `this.ui.*` calls.  
- **`ui.showOverlay`** = interrupt modes; **`ui.showTitleMenu`** = menu.  
- Input fire ignores residual button state after menu click (`clearFireButton` / related guards in `input.js`). Mouse block until mouseup; gamepad RT/RB only blocked if held across start.  
- Gamepad: `pollGamepad()` via Gamepad API; edges cleared on `start`/`resume` so A/Start confirm does not bomb frame 1. Title PLAY + splash via `main.js` `gamepadUiTick`.  
 
- Canvas is letterboxed inside `.stage-wrap`; `fitCanvas()` maps display size for input.  
- Formation spawns are queued jobs in `spawns.js`, drained by `game.js`.

---

## Related docs

| Doc | Use when |
|-----|----------|
| `docs/GAMEPLAY_TUNING_RESEARCH.md` | Changing feel, difficulty, death time, economy |
| `docs/VS_GEOMETRY_WARS.md` | Feature parity / “are we like GW?” questions |
| `docs/BUILD_CONTEXT.md` | Session handoff (this file) |
| `README.md` | Player-facing play instructions |

When this document drifts from code, **update this file** in the same PR/session as the change — especially UI flow, state machine, and critical contracts.
