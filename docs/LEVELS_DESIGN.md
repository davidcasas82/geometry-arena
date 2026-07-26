# Geometry Arena — Levels Design Lock (MVP)

**Status:** DESIGN LOCK (Phase A catalog)  
**Audience:** arena-topology · mode-runtime · path-ui-progress · game integration agents  
**Last updated:** 2026-07-26  
**Scope:** data + contracts only. No deep `game.js` rewrite in this phase.

Classic **Evolved** (current endless `Game.start()` loop) remains the default PLAY path and is **never** gated by stars or Path progress.

---

## Product shells

| Shell | Purpose | Entry |
|-------|---------|--------|
| **Classic** | Endless modes (MVP: Evolved only). High-score chase. | Title → **PLAY** (default) |
| **Arena Path** | Authored 8-level ladder, two chapters, star grades. | Title → **PATH** (or equivalent chrome CTA) |

Path is additive. Classic must keep working if Path data is missing or progress is wiped.

---

## Mode rules (MVP)

Shared combat baseline unless a mode overrides:

- Lives / bombs / mult / geom / bomb clear behave like Classic Evolved (`constants.js`).
- Base-progress economy for extra life/bomb (not mult-inflated score).
- Bomb kills award **no** score (same as today).
- Death uses existing mercy package; mode may end the run earlier via its own lose condition.

### `evolved` (Path short-form)

Finite “evolved slice,” not endless marathon.

| | |
|--|--|
| **Win** | Survive `rules.durationSec` **or** reach `rules.targetScore` (whichever the level sets as primary; see level row). MVP: **survive duration** is primary win; score drives stars. |
| **Lose** | Lives → 0 before win. |
| **Timer** | Counts **up** to duration (survive clock). Optional soft spawn ramp compressed into the window. |
| **Lives** | `rules.lives` (default `START_LIVES`). |
| **Bombs** | `rules.bombs` (default `START_BOMBS`). |
| **Scoring** | Same kill×mult + clear bonus as Classic. |
| **Stars** | From final score and/or peak mult via `stars.score` / `stars.peakMult` (see schema). Clear = survive to end with ≥1 life. |

### `deadline`

Score race against a hard clock.

| | |
|--|--|
| **Win** | `score >= rules.targetScore` before timer hits 0. |
| **Lose** | Timer → 0 without target, **or** lives → 0. |
| **Timer** | Counts **down** from `rules.durationSec`. |
| **Lives / bombs** | As `rules` (often fewer lives to raise tension). |
| **Scoring** | Standard. Optional `rules.scoreMult` global display multiplier (default 1) — **does not** affect base progress. |
| **Stars** | 1★ = win (hit target). 2★/3★ = higher score thresholds and/or time remaining (`stars.score`, optional `stars.timeLeftSec`). |

### `checkpoint`

Survive a route of timed gates; arena topology may funnel the ship.

| | |
|--|--|
| **Win** | Reach final checkpoint index (`rules.checkpoints.length - 1`) alive. |
| **Lose** | Lives → 0, **or** fail a gate if `rules.failOnMissedCheckpoint === true` (MVP default **false**: gates are progress markers, not fail timers). |
| **Timer** | Optional global `rules.durationSec` fail-safe (null = no global fail timer). Per-gate `dueSec` is **elapsed-from-start** advisory / star pacing, not hard fail unless flagged. |
| **Checkpoint clear** | When `elapsed >= cp.dueSec` **or** player enters `cp.zone` (circle in world space), mark reached; floater label. |
| **Scoring** | Standard + small `rules.checkpointBonus` per gate (score only; tiny base progress). |
| **Stars** | 1★ = finish. 2★/3★ from score and/or gates hit before their `dueSec` (`stars.score`, `stars.onTimeGates`). |

### `waves`

Authored wave list; director yields to the script.

| | |
|--|--|
| **Win** | Clear all waves in `rules.waves` (last enemy of last wave dead, board empty of scripted spawns). |
| **Lose** | Lives → 0. Optional `rules.durationSec` fail-safe. |
| **Between waves** | `rules.waveGapSec` lull; no improvisational phrase director unless `rules.allowImprov === true` (MVP: **false**). |
| **Wave spawn** | Each wave: `count` of `types[]` via named formation `pattern` (maps to `spawns.js` helpers). |
| **Scoring** | Standard. Wave clear floater; optional `rules.waveClearBonus`. |
| **Stars** | 1★ = clear all waves. 2★/3★ from score / lives remaining / time (`stars.score`, `stars.livesLeft`, `stars.timeSec` max time). |

### `boss-lite`

Single elite pressure set piece (not a full GW boss FSM).

| | |
|--|--|
| **Win** | Defeat `rules.boss.type` (HP depleted) **and** optional add cleanup (`rules.boss.clearAdds === true`). |
| **Lose** | Lives → 0, or `rules.durationSec` timeout if set. |
| **Flow** | Intro beat → boss spawn at `rules.boss.spawn` → add phrases on interval from `rules.boss.adds`. |
| **Scoring** | Boss uses enemy score × mult; large trauma on kill. |
| **Stars** | 1★ = win. 2★/3★ from score, time-to-kill, lives left. |

### Mode ID constants

Canonical string ids (export from `js/levels.js` as `MODE`):

`evolved` · `deadline` · `checkpoint` · `waves` · `boss-lite`

Classic shell may later add `classic_evolved` as a **shell flag**, not a Path level mode — Path levels never use a separate id for “endless.”

---

## Arena topologies (Phase A)

Data-only ids. Geometry resolution lives in future `js/arenas.js`.

| Id | Intent | Bounds / collision notes |
|----|--------|---------------------------|
| `rect` | Default 1600×900 playfield (today’s world). | Solid outer walls. |
| `rect_tight` | Smaller play rect centered in world. | `arena.params.inset` or explicit `width`/`height`. |
| `rect_wide` | Wider than tall emphasis. | Stretch playable AABB. |
| `donut` | Playable ring; circular inner hazard / wall. | Outer rect + inner circle solid. |
| `corridor` | Long horizontal (or vertical) lane. | Fat walls on long sides. |
| `cross` | Plus-shaped playable region. | Corner blocks solid. |
| `pill_2d` | Capsule / stadium playable region. | Outside capsule solid. |
| `wrap_torus` | Full rect with **toroidal wrap** (no walls). | Position wraps; spawns/camera aware. |
| `split` | Two chambers + linking gap(s). | Center wall with opening(s). |

Export as `TOPOLOGY` from `js/levels.js`. Phase A catalog **only** uses these ids.

---

## Level data schema

TypeScript-style contract. Runtime objects are plain JSON-safe literals in `LEVELS`.

```ts
/** Shell selector for title / progress — not stored on every level */
type GameShell = "classic" | "path";

type ModeId =
  | "evolved"
  | "deadline"
  | "checkpoint"
  | "waves"
  | "boss-lite";

type TopologyId =
  | "rect"
  | "rect_tight"
  | "rect_wide"
  | "donut"
  | "corridor"
  | "cross"
  | "pill_2d"
  | "wrap_torus"
  | "split";

/** Formation pattern names — mode-runtime maps to spawns.js */
type SpawnPatternId =
  | "edge_line"
  | "column"
  | "corner_arc"
  | "pincer"
  | "ring"
  | "zipper"
  | "single"
  | "player_circle"
  | "corner_flood"
  | "opposite_echo";

type EnemyTypeId =
  | "wanderer"
  | "diamond"
  | "pink"
  | "spinner"
  | "splitter"
  | "snake"
  | "tank"
  | "void"
  | "atom";

interface ArenaRef {
  /** Topology id */
  topology: TopologyId;
  /**
   * Topology-specific knobs (all optional; arenas.js supplies defaults).
   * Examples:
   *   rect_tight: { width: 1100, height: 700 }
   *   donut: { innerR: 140, outerMargin: 40 }
   *   corridor: { axis: "x", halfWidth: 160 }
   *   cross: { armHalfWidth: 180 }
   *   pill_2d: { width: 1400, height: 520 }
   *   split: { gap: 160, wallThickness: 48 }
   *   wrap_torus: { /* empty *\/ }
   */
  params?: Record<string, number | string | boolean>;
}

interface StarThresholds {
  /**
   * Score cutoffs for ★★ and ★★★ after a successful clear.
   * Index 0 → 2★ minimum score; index 1 → 3★ minimum score.
   * 1★ is always "cleared" (win condition met).
   */
  score?: [number, number];
  /** Optional alternate / additional gates (AND with score if both present — see computeStars). */
  peakMult?: [number, number];
  /** Deadline: minimum seconds remaining for 2★ / 3★ */
  timeLeftSec?: [number, number];
  /** Evolved / waves: max elapsed seconds for 2★ / 3★ (faster clear = better). Omit if N/A. */
  timeSecMax?: [number, number];
  /** Checkpoint: gates reached on-time for 2★ / 3★ */
  onTimeGates?: [number, number];
  /** Waves / boss: lives remaining for 2★ / 3★ */
  livesLeft?: [number, number];
}

interface CheckpointDef {
  id: string;
  /** Elapsed seconds from level start when gate becomes due (pacing). */
  dueSec: number;
  label?: string;
  /** Optional world-space zone; if omitted, gate auto-completes at dueSec. */
  zone?: { x: number; y: number; r: number };
}

interface WaveDef {
  id: string;
  label?: string;
  /** Enemy types cycled or randomly picked within the wave */
  types: EnemyTypeId[];
  count: number;
  pattern: SpawnPatternId;
  /** Pattern hints (side 0–3, axis, etc.) */
  patternOpts?: {
    side?: 0 | 1 | 2 | 3;
    corner?: 0 | 1 | 2 | 3;
    axis?: "horizontal" | "vertical";
    stagger?: number;
    perSide?: number;
  };
  /** Delay before this wave starts after previous clear / level start */
  delaySec?: number;
}

interface BossDef {
  type: EnemyTypeId;
  /** Override HP if enemy default is too low (tank=3, void=8, etc.) */
  hp?: number;
  score?: number;
  spawn?: { x: number; y: number };
  /** Add fodder while boss lives */
  adds?: {
    everySec: number;
    types: EnemyTypeId[];
    count: number;
    pattern: SpawnPatternId;
  };
  clearAdds?: boolean;
  label?: string;
}

interface LevelRules {
  /** Primary duration seconds (survive / countdown / fail-safe — mode-specific). */
  durationSec?: number;
  /** Deadline (and optional evolved) score target for win. */
  targetScore?: number;
  lives?: number;
  bombs?: number;
  /** Multiply awarded display score only (not base progress). Default 1. */
  scoreMult?: number;
  /** Spawn director overrides */
  safeOpeningSec?: number;
  spawnRampSec?: number;
  /** Cap enemy types by unlock elapsed *within the level* (compressed SPAWN_TABLE). */
  enemyUnlockScale?: number;
  /** Max simultaneous enemies soft cap override */
  softCap?: number;
  maxEnemies?: number;
  /** checkpoint */
  checkpoints?: CheckpointDef[];
  failOnMissedCheckpoint?: boolean;
  checkpointBonus?: number;
  /** waves */
  waves?: WaveDef[];
  waveGapSec?: number;
  waveClearBonus?: number;
  allowImprov?: boolean;
  /** boss-lite */
  boss?: BossDef;
  /** BGM track preference 1 | 2 | "auto" */
  bgm?: 1 | 2 | "auto";
}

interface LevelDef {
  /** Stable id — progress keys off this */
  id: string;
  /** Short display name */
  name: string;
  /** Flavor line under the name (Path select) */
  tagline?: string;
  /** 1-based chapter index */
  chapter: number;
  /** Order within Path ladder (1..N continuous). */
  order: number;
  mode: ModeId;
  arena: ArenaRef;
  rules: LevelRules;
  stars: StarThresholds;
  /** One teaching sentence for designers / optional UI tip */
  skillLesson: string;
  /** If true, first Path node — always unlocked when Path exists */
  unlockDefault?: boolean;
}

interface PathProgress {
  /** levelId → best stars 0–3 */
  stars: Record<string, number>;
  /** levelId → best score */
  bestScore: Record<string, number>;
  /** levelId → best time sec (mode-dependent meaning) */
  bestTime?: Record<string, number>;
  /** ISO or epoch of last update */
  updatedAt?: number;
  version: 1;
}

interface LevelResultExtra {
  /** Seconds remaining (deadline) */
  timeLeftSec?: number;
  /** Elapsed at win/lose */
  elapsedSec?: number;
  peakMult?: number;
  livesLeft?: number;
  onTimeGates?: number;
  cleared: boolean;
  /** Mode id echoed for star helper */
  mode?: ModeId;
}
```

### `computeStars` policy (locked)

```
if (!extra.cleared) return 0;
stars = 1;
// Each configured metric that passes its [2★, 3★] pair can raise the grade.
// Final grade = min(3, max over metrics of tier reached), requiring ALL listed
// metric families on the level to meet the tier when multiple families exist.
// Simpler MVP rule used in js/levels.js:
//   Start at 1 if cleared.
//   For each present threshold family, compute tier 1|2|3 for that family.
//   Final = MIN of family tiers (all must qualify). Missing family = ignore.
```

Implementers: do not invent per-mode one-offs outside `stars` keys above without updating this doc + `computeStars`.

---

## Full 8-level MVP catalog

Chapters: **1 Neon Primer** (orders 1–4), **2 Pressure Geometry** (orders 5–8).  
Unlock: **≥1★ on level N unlocks N+1**. Level 1 always unlocked. Classic Evolved ignores this graph.

| Order | id | Name | Ch | Mode | Topology | Duration / win | 2★ score | 3★ score | Skill lesson |
|------:|----|------|---:|------|----------|----------------|---------:|---------:|--------------|
| 1 | `path-01-grid-wake` | Grid Wake | 1 | evolved | rect | Survive **60s** | 12_000 | 28_000 | Strafe, scoop geoms, trust the needle gun. |
| 2 | `path-02-deadline-drill` | Deadline Drill | 1 | deadline | rect_tight | **45s** · target **8_000** | 14_000 | 22_000 | Farm mult fast in a small box; don’t corner yourself. |
| 3 | `path-03-wave-lane` | Wave Lane | 1 | waves | corridor | 5 waves clear | 10_000 | 20_000 | Sweep lines in a lane; respect the long axis. |
| 4 | `path-04-cross-gates` | Cross Gates | 1 | checkpoint | cross | 4 gates · ~**75s** pace | 15_000 | 30_000 | Hold the hub; clear arms without overcommitting. |
| 5 | `path-05-donut-orbit` | Donut Orbit | 2 | evolved | donut | Survive **75s** | 22_000 | 45_000 | Orbit the hole; never hug the inner wall blind. |
| 6 | `path-06-split-signal` | Split Signal | 2 | waves | split | 6 waves clear | 18_000 | 36_000 | Read which chamber is safe; don’t get sealed. |
| 7 | `path-07-torus-rush` | Torus Rush | 2 | deadline | wrap_torus | **60s** · target **20_000** | 35_000 | 55_000 | Wrap shots and escapes; the edge is a door. |
| 8 | `path-08-boss-pulse` | Boss Pulse | 2 | boss-lite | rect_wide | Kill tank boss + adds | 25_000 | 50_000 | Prioritize the elite; bomb is insurance, not offense. |

### Per-level rule highlights

**path-01-grid-wake** — `durationSec: 60`, lives 3, bombs 3, full rect, gentle spawn ramp (`spawnRampSec: 55`, `safeOpeningSec: 12`). Stars: score only `[12000, 28000]`; optional peakMult `[8, 15]`.

**path-02-deadline-drill** — `durationSec: 45`, `targetScore: 8000`, lives 3, bombs 2, `rect_tight` ~1100×700. Stars: score `[14000, 22000]`, timeLeftSec `[10, 20]`.

**path-03-wave-lane** — corridor axis x; waves: wanderer lines → diamond column → pink pincer → spinner edge → mixed zipper. `waveGapSec: 1.2`. Stars: score `[10000, 20000]`, livesLeft `[2, 3]`.

**path-04-cross-gates** — checkpoints at 15 / 35 / 55 / 75s with hub/arm zones; `checkpointBonus: 400`. Stars: score `[15000, 30000]`, onTimeGates `[3, 4]`.

**path-05-donut-orbit** — `durationSec: 75`, donut `innerR: 150`, denser mid (`softCap: 22`). Stars: score `[22000, 45000]`, peakMult `[12, 25]`.

**path-06-split-signal** — six waves alternating chambers via pattern sides; includes one splitter intro. Stars: score `[18000, 36000]`, timeSecMax `[100, 80]` (faster clear better).

**path-07-torus-rush** — wrap, `targetScore: 20000`, `durationSec: 60`, lives 2, bombs 2. Stars: score `[35000, 55000]`, timeLeftSec `[8, 18]`.

**path-08-boss-pulse** — boss tank `hp: 14`, label `PULSE TANK`, adds every 6s wanderer/diamond edge lines; `clearAdds: true`; fail-safe `durationSec: 120`. Stars: score `[25000, 50000]`, livesLeft `[1, 2]`, timeSecMax `[90, 60]`.

Exact literals live in `js/levels.js` (source of truth for numbers).

---

## Unlock graph

```
path-01-grid-wake  (always unlocked)
        │  ≥1★
        ▼
path-02-deadline-drill
        │  ≥1★
        ▼
path-03-wave-lane
        │  ≥1★
        ▼
path-04-cross-gates     ── end Chapter 1
        │  ≥1★
        ▼
path-05-donut-orbit     ── Chapter 2
        │  ≥1★
        ▼
path-06-split-signal
        │  ≥1★
        ▼
path-07-torus-rush
        │  ≥1★
        ▼
path-08-boss-pulse
```

- **1★ unlocks next** only (2★/3★ are skill grades, not gates).
- No branching in MVP.
- Chapter headers are UI chrome only (derived from `chapter` field).
- Reset progress must not lock Classic.

---

## Difficulty progression principles

1. **Teach one idea per level** (topology *or* mode pressure, not both brand-new at once when possible).  
   - Ch1: mode variety on simpler shapes; cross is the first “weird” topology.  
   - Ch2: topology is the lesson; modes recycle evolved/waves/deadline/boss.
2. **Path runs are short (45–120s)** — designed for retries, not 3-minute Evolved marathons.
3. **Star 1 = fair clear** for a competent Classic player; **star 3 = intentional mastery** (mult discipline, route knowledge).
4. **Compress spawn intros** with `safeOpeningSec` / `enemyUnlockScale` so Path levels still meet new enemies without waiting 105s for void.
5. **Never require bombs** for 1★; bombs enable 2★/3★ consistency.
6. **Topology must change movement language** (donut hole, wrap, split seal) — not just wallpaper.
7. **Score thresholds assume wanderer base 100 × mult**, with path mult peaks typically 6–30 on short runs (not Classic 100+).
8. **Tune stars after playtests** via `LEVELS[].stars` only when possible; avoid mode code forks for balance.

---

## Public API contracts

Other agents implement bodies; **names and shapes below are locked**.

### `js/arenas.js` (topology agent)

```js
/** @typedef {import('./levels.js').TopologyId} TopologyId */

/**
 * @typedef {object} ArenaInstance
 * @property {TopologyId} topology
 * @property {number} worldW  // sim space (usually WORLD_W)
 * @property {number} worldH
 * @property {{ x:number, y:number, w:number, h:number }} playableBounds // AABB hint
 * @property {object} params
 */

/**
 * Build runtime arena from level.arena ref.
 * @param {{ topology: TopologyId, params?: object }} arenaRef
 * @returns {ArenaInstance}
 */
export function createArena(arenaRef) {}

/** @param {ArenaInstance} arena @param {number} x @param {number} y @param {number} [r] */
export function clampEntity(arena, x, y, r = 0) {
  return { x, y };
}

/** True if circle overlaps solid (wall / donut hole / outside cross). */
export function hitsSolid(arena, x, y, r) {
  return false;
}

/**
 * Spawn helpers must use this for edge jobs under non-rect topologies.
 * @returns {{ x:number, y:number, side?: number }}
 */
export function pickSpawnEdge(arena, rng = Math.random) {
  return { x: 0, y: 0, side: 0 };
}

/** Torus wrap: mutate or return wrapped position. */
export function wrapPosition(arena, x, y) {
  return { x, y };
}

/** Draw floor mask / walls into ctx (world space). */
export function drawArena(ctx, arena, cam) {}

export const TOPOLOGY_DEFAULTS = {
  /* topology → default params */
};
```

### `js/modes.js` (mode-runtime agent)

```js
import { MODE } from "./levels.js";

/**
 * @typedef {object} ModeContext
 * @property {object} game          // Game instance (duck-typed)
 * @property {import('./levels.js').LevelDef} level
 * @property {object} arena         // ArenaInstance
 * @property {number} elapsed
 * @property {number} durationLeft  // deadline countdown; else Infinity
 * @property {Set<string>} flags    // reached checkpoint ids, waves cleared, etc.
 */

/**
 * @typedef {object} ModeHooks
 * @property {(ctx: ModeContext) => void} onEnter
 * @property {(ctx: ModeContext, dt: number) => void} onUpdate
 * @property {(ctx: ModeContext) => void} [onEnemyKilled]
 * @property {(ctx: ModeContext) => void} [onPlayerDeath]
 * @property {(ctx: ModeContext) => "playing"|"won"|"lost"} getState
 * @property {(ctx: ModeContext) => object} getHud          // { timer?, objective?, wave?, starsPreview? }
 * @property {(ctx: ModeContext) => import('./levels.js').LevelResultExtra} buildResult
 */

/** @param {string} modeId @returns {ModeHooks} */
export function createModeController(modeId) {}

export function isPathMode(modeId) {
  return Object.values(MODE).includes(modeId);
}
```

Mode controllers **must not** own the render loop; they advise `Game` via hooks. Classic endless = no mode controller (or a passthrough `classicEvolved` that never wins).

### `js/levels.js` (this phase — catalog + pure helpers)

```js
export const MODE = { EVOLVED, DEADLINE, CHECKPOINT, WAVES, BOSS_LITE };
export const TOPOLOGY = { RECT, RECT_TIGHT, /* ... */ };
export const LEVELS = [ /* 8 LevelDef */ ];

export function getLevel(id) {}
export function getLevelIndex(id) {} // 0-based in LEVELS; -1 if missing
export function listPathLevels() {} // LEVELS sorted by order
export function listChapter(chapter) {}
export function getNextLevelId(id) {}
export function isUnlocked(id, progress) {}
export function computeStars(level, score, extra) {}
export function chapterMeta() {} // [{ chapter, title, levelIds }]
```

### `js/progress.js` (path-ui-progress agent)

Mirror `runs.js` localStorage style.

```js
export const PROGRESS_KEY = "geometry-arena-path-progress";
export const PROGRESS_VERSION = 1;

/** @returns {import('./levels.js').PathProgress} */
export function loadProgress() {}

/** @param {import('./levels.js').PathProgress} p */
export function saveProgress(p) {}

export function clearProgress() {}

/**
 * Apply a finished Path run. Updates best stars/score/time; never decreases stars.
 * @param {string} levelId
 * @param {{ score:number, stars:number, elapsedSec?:number, cleared:boolean }} result
 * @returns {import('./levels.js').PathProgress}
 */
export function recordLevelResult(levelId, result) {}

/** @param {import('./levels.js').PathProgress} [p] */
export function getStars(levelId, p = loadProgress()) {
  return 0;
}

/** Convenience for UI */
export function getUnlockedIds(p = loadProgress()) {
  return [];
}

export function exportProgressDebug() {}
```

---

## HUD / UI notes (Path)

Keep the **live-grid neon** language from `BUILD_CONTEXT.md`. No frosted SaaS modals.

### Title

- Existing chrome logo + **PLAY** (Classic Evolved).
- Add secondary arcade control: **PATH** (magenta/cyan outline sibling, not primary steal).
- BEST remains Classic high score; Path can show **STARS 12/24** chip near PATH.

### Path select (overlay on live grid)

- Full-stage overlay `mode-path` (like title, **not** interrupt panel).
- Two chapter rows; nodes as neon diamonds / hex pips on a faint route polyline.
- Node states: locked (dim), unlocked (pulse cyan), cleared 1–3★ (star glyphs in Press Start / simple canvas pips).
- Focus = keyboard/gamepad left-right; **Enter / A** starts level; **Esc / B** back to title.
- Hover/focus shows: name, tagline, mode badge, arena badge, best score, skill lesson one-liner.
- Do **not** bury the grid — vignette only, same as title.

### In-run HUD additions (Path only)

- Replace or sublabel Classic “Level N” with **Path name** short form / order `3/8`.
- Objective chip: `SURVIVE 0:42` · `SCORE 8K` · `WAVE 2/5` · `GATE 3/4` · `BOSS`.
- Timer: evolved counts up to target; deadline counts down (red flash <10s).
- On win: chrome **CLEAR** wordmark on grid (game-over cousin) + star reveal animation + **NEXT** / **PATH** / **RETRY**.
- On lose: existing game-over language + **RETRY** / **PATH** (not only Classic title).

### Pause

- Same interrupt panel; path objective line under subtitle.

---

## Open tuning knobs

| Knob | Where | Notes |
|------|--------|------|
| Star score pairs | `LEVELS[].stars` | First pass; expect ±30% after UAT plays |
| `durationSec` / `targetScore` | `LEVELS[].rules` | Primary feel levers |
| Arena params (inset, innerR, gap) | `LEVELS[].arena.params` + `TOPOLOGY_DEFAULTS` | Topology readability |
| Wave counts / types | `rules.waves` | Authoring surface |
| Boss HP / add cadence | `rules.boss` | boss-lite only |
| `safeOpeningSec`, `spawnRampSec`, `softCap` | `rules` | Density without touching Classic constants |
| Lives/bombs per level | `rules.lives` / `rules.bombs` | Deadline/torus tighter |
| Checkpoint zones | `rules.checkpoints[].zone` | May need camera-aware placement |
| `computeStars` AND vs OR across families | `levels.js` | Locked to **MIN of families** for MVP |
| Classic vs Path BGM | `rules.bgm` / `themeId` | See **Path audio** below |
| Progress schema version | `progress.js` `version: 1` | Bump + migrate if fields change |

**Out of scope MVP:** drones/supers, WebGL 3D arenas, branching Path, daily challenges, online leaderboards, gating Classic.

---

## Path audio (bespoke themes)

Classic Evolved keeps today’s two **Neon Swarm** loops (`BGM_TRACKS`, odd/even via `playLevelTheme(level)`).

Path levels each get a **named theme bed** so every stage feels authored. Ship code + schema first; drop MP3s as they are produced.

### Schema

```ts
/** Stable theme id — keys audio/path/<id>.mp3 when present */
type PathThemeId =
  | "grid-wake"
  | "deadline-drill"
  | "wave-lane"
  | "cross-gates"
  | "donut-orbit"
  | "split-signal"
  | "torus-rush"
  | "boss-pulse"
  | "chapter-1"
  | "chapter-2"
  | "classic-1"
  | "classic-2";

interface LevelRules {
  // ...existing fields...
  /**
   * BGM preference (legacy shorthand still valid):
   *   1 | 2     → classic Neon Swarm index (fallback)
   *   "auto"    → order parity → classic 1/2
   * Prefer themeId when set.
   */
  bgm?: 1 | 2 | "auto";
  /** Preferred Path theme bed (bespoke track). */
  themeId?: PathThemeId;
}
```

`js/levels.js` exports `PATH_THEMES` metadata:

```ts
interface PathThemeMeta {
  id: PathThemeId;
  title: string;          // UI / debug
  src: string;            // e.g. "audio/path/grid-wake.mp3"
  fallback: 1 | 2;        // classic track if file missing
  bpm?: number;
  mood: string;           // production brief one-liner
  sunoPrompt?: string;    // optional full gen prompt
}
```

### Playback contract (`audio.js` — later implement)

```js
// Preferred entry for Path:
audio.playTheme(themeId | levelDef, { restart?: boolean })
// Resolve order:
// 1. level.rules.themeId → PATH_THEMES[id].src if audio can play
// 2. level.rules.bgm 1|2|auto → existing BGM_TRACKS
// 3. classic-1
// Missing file must silent-fallback (no throw); log once [arena:bgm-missing].
```

- Crossfade ~0.9s (same as today).
- Preload next Path node theme on path-select focus (optional).
- Intensity layers (mult-band ducking / stems) = post-MVP; single loop bed per level for v1.
- Clear/win sting can stay SFX; optional short `audio/path/clear-sting.mp3` later.

### MVP theme roster (1:1 with 8 levels)

| Level | themeId | Title (working) | Mood / production brief | Fallback |
|-------|---------|-----------------|-------------------------|---------:|
| Grid Wake | `grid-wake` | Grid Wake | Bright teach pulse, 140 BPM, open arps, low threat | 1 |
| Deadline Drill | `deadline-drill` | Deadline Drill | Ticking urgency, sidechain pump, rising count-in energy | 2 |
| Wave Lane | `wave-lane` | Wave Lane | Horizontal drive, staccato percussion like edge sweeps | 1 |
| Cross Gates | `cross-gates` | Cross Gates | Hub drone + directional stingers feel; mid tension | 2 |
| Donut Orbit | `donut-orbit` | Donut Orbit | Circular ostinato, dizzying filter swirl, hollow mid | 1 |
| Split Signal | `split-signal` | Split Signal | Call/response stereo beds, anxious gap silence | 2 |
| Torus Rush | `torus-rush` | Torus Rush | Seamless loop-friendly phrase, wrap whoosh motifs | 1 |
| Boss Pulse | `boss-pulse` | Boss Pulse | Heavy boss pulse, sparse verses, drop on pressure | 2 |

Chapter select idle beds (optional later): `chapter-1`, `chapter-2`.

### Production pipeline

1. Lock briefs in `PATH_THEMES` (code) + this table.  
2. Generate via Suno (or other) using `mood` / `sunoPrompt`; export MP3 ~90–150s seamless-ish loops.  
3. Drop at `audio/path/<themeId>.mp3`; update `audio/meta.json` manifest entries.  
4. No code change required if `src` paths stay stable — only assets.  
5. Until files exist, Path uses classic fallbacks so CI/UAT never depends on assets.

### Shared base style (all Path beds)

> High-energy instrumental electronic twin-stick score, Geometry Wars cousin: neon synthwave + chiptune grit, punchy sidechained bass, glitchy perc, laser accents, **no vocals**. Each track must still be **melodically distinct** (unique hook within 8 bars) so Path nodes are recognizable with eyes closed.

### Non-goals (audio MVP)

- Full adaptive stem mixer  
- Per-enemy leitmotifs  
- Replacing Classic Neon Swarm pair  
- Blocking Path ship on missing bespoke files

---

## Integration sketch (non-binding for this phase)

1. `main.js` title: PLAY → `game.start({ shell: "classic" })`; PATH → path select UI.  
2. Path node → `game.start({ shell: "path", levelId })`.  
3. `start` loads `getLevel`, `createArena`, `createModeController`, resets score/lives from `rules`.  
4. Loop: mode `onUpdate` + existing sim; mode `getState` → won/lost.  
5. Won/lost → `computeStars` → `recordLevelResult` → Path results UI.  

Classic path through `start()` with no levelId **must** preserve today’s behavior bit-for-bit aside from optional shell bookkeeping.

---

## Confirmation: Classic Evolved

- Default title **PLAY** launches current endless Evolved.  
- No star requirement.  
- No Path topology required.  
- `LEVELS` / progress absence cannot block Classic.  
- Existing `level` counter inside Evolved (BGM cadence via `LEVEL_DURATION_SEC`) is **unrelated** to Path `LevelDef` — do not conflate in UI copy (“Stage” vs “Path Level” if needed).

---

## Related files

| File | Role |
|------|------|
| `js/levels.js` | Catalog + pure helpers (shipped this phase) |
| `js/progress.js` | Progress stub + localStorage contract |
| `js/modes.js` | Mode controller stub / registry |
| `js/arenas.js` | *(topology agent)* geometry |
| `js/constants.js` | Combat goldilocks (Classic + defaults) |
| `js/runs.js` | Pattern reference for persistence |
| `docs/BUILD_CONTEXT.md` | UI / architecture law |

When implementation drifts, update **this doc and `LEVELS` in the same change**.
