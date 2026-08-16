# Geometry Arena — Upgrade Plan

**Status:** LOCKED path (2026-08-16). Execute; do not re-open the six-audit research.  
**Step 1–2 done. PR A–D shipped.** Plan execute pass complete.

Related: `docs/BUILD_CONTEXT.md`, `docs/GAMEPLAY_TUNING_RESEARCH.md`, `docs/LEVELS_DESIGN.md`, `docs/VS_GEOMETRY_WARS.md`.  
Balance source of truth: `js/constants.js`.

---

## Honest snapshot

In-run combat / juice is a strong GW cousin. Between-run hunger is thin. Three identity holes:

1. **Path is a timer skin on a rectangle.** Catalog promises corridor / cross / donut / split / wrap; shipped `LEVELS` are all `RECT`. Cross Gates auto-completes at `dueSec`.
2. **Classic morph fights the teach script.** First commit at 20s, then every 12s. Circle/flood legal while the floor is already a hallway. `PLAYER_SPEED` is 400 (pass 1 was 340).
3. **Music wastes existing files; Path themes cannot play.** Level advance `{restart:true}` only plays the first 50s of each loop. `playTheme` is a TODO. Both MP3s preload on boot (~5.4MB).

Do not re-litigate: laptop-first, vanilla Canvas, cousin not clone, Classic never star-gated, bombs award no kill score, lives/bombs from base progress, invuln must not re-extend, dual/triple is a late mult reward.

---

## Step 1 — Instrument (done)

Death log now includes `cause` (`CRUSHED` or enemy type), plus `offscreen` (cover-crop context, not a cause), `arena`, `morphWarn`, and death `x`/`y` snapshotted **before** the mercy teleport.

Read in console: `[arena:death]` or `__arenaDeaths()`. Balance knobs were not changed.

---

## Step 2 — Classic playtest (done 2026-08-16)

Ingest: `.playtest/session.jsonl` (also `__arenaDeaths()`). Three finished Classic runs + one mid-run death. **This was PLAY / Classic, not Path.** Title PLAY vs PATH was not obvious to the player (fixed in a side commit: button hints + how-to line).

| Run | First death | Causes (in order) | Arenas seen | Notes |
|-----|------------:|-------------------|-------------|-------|
| 1 | 87s | spinner, wanderer, wanderer | rect_tight → corridor | Peak ×119, **3 bombs unused**, GO at 94s |
| 2 | 42s | diamond, spinner, wanderer | corridor → cross | Peak ×48, bombs unused |
| 3 | 34s | **CRUSHED**, diamond, diamond | corridor → rect_wide | First death is morph crush |
| 4 (partial) | 87s | diamond | rect | Peak ×266, 1 bomb used |

**Lever picked: morph-first.** Early corridor / CRUSHED is the unfair spike. Speed 400 stays. Unused bombs belong in later GO autopsy, not PR A.

Decision table (kept for later passes):

| What the deaths say | First lever |
|---------------------|-------------|
| Mostly **CRUSHED / corridor** early | Morph delay only. Leave speed at 400. |
| Mostly **kite-forever / empty board / die after 3+ min** | `PLAYER_SPEED` 400 → 360. Leave morph. |
| Mixed or unclear | Morph delay + opening lull only. Do not touch speed. |

---

## Step 3 — Four PRs, no mixing

### PR A — Goldilocks from Step 2 + hygiene (done)

Shipped:

- Morph-first knobs (table below). `PLAYER_SPEED` stays 400.
- Death `cause` (Step 1)
- `visibilitychange` / `pagehide` → `pause()` if `playing` (no auto-resume)

Does not include: Path, audio, GFX, mobile layout.

**Morph-first knobs** (`js/constants.js` only):

```
MORPH.FIRST_AT              18 → 48
MORPH.INTERVAL              12 → 22
MORPH.WARN_SEC             2.0 → 2.6
PHRASE.LULL_SCALE.soft    0.85 → 1.20
SOFT_CAP.opening             7 → 9
PHRASE.CIRCLE_MIN_ELAPSED   55 → 95
PHRASE.FLOOD_MIN_ELAPSED    70 → 100
PHRASE.CIRCLE_COOLDOWN      28 → 36
LEVEL_DURATION_SEC          50 → 70
```

**Speed-first alternative:** `PLAYER_SPEED` 400 → 360 only (plus death cause + background pause).

Leave: `FIRE_COOLDOWN`, dual/triple gates, t² ramp, mid/late soft caps, unlock table, lives/bombs, invuln.

After A: 8 more Classic runs. If median first death **<90s**, revert speed toward 380 — not a gun buff. If **>150s** and deaths aren’t morph-crush, tighten mid soft-cap — still not the gun.

### PR B — Path authorship (done)

Shipped:

- Catalog topologies: 02 `rect_tight`, 03 `corridor`, 04 `cross`, 05 `donut`, 06 `split`, 07 `wrap_torus`, 08 `rect_wide`. 01 stays `rect`. Donut Orbit name restored.
- Path badges use real topology ids.
- Cross Gates: zone overlap only; rings drawn; AFK times out instead of auto-clear.
- Result meta: next-star recipe via `describeStarGap`.
- Progress v2 wipe.
- Boss Pulse: 28 HP, 12k score, faster adds, bombs chip 5 HP (do not delete the elite). Stars are lives + time, not an unreachable score AND.

Does not include: new enemy types, new MP3s, Classic morph on Path.

Sync `docs/LEVELS_DESIGN.md` in the same PR.

### PR C — Audio plumbing (done)

Shipped:

- Classic heat already continues `currentTime` (PR A side).
- `playTheme` probes Path src, logs `[arena:bgm-missing]`, falls back to Neon Swarm.
- Path `start({ skipBgm })` then one `playTheme` — no double-start.
- Classic beds lazy-created with `preload=metadata`.
- SFX through a compressor bus; shoot is every other shot at gain 0.012. Fire rate unchanged.

Does not include: commissioned Suno tracks.

### PR D — Mobile clutch (done)

Shipped:

- BOMB sits above the left (move) stick.
- Touch chrome uses `preferMobileGraphics` (iPad included); wide hover laptops stay mouse.
- Pointer lock skipped on that same helper.
- Pause panel has **SOUND ON / MUTED**.

Does not include: stick-radius rewrite, PWA, service worker.

---

## Already shipped (side of the plan — do not redo)

- Death `cause` + `__arenaDeaths()` + local ingest (`uat/playtest-ingest.mjs` → `.playtest/session.jsonl`, gitignored).
- Title buttons: **ENDLESS** (one run · high score) and **STAGES** (8 levels · stars).
- Classic 50s cadence: floater is **HEAT N** (not LEVEL), BGM continues (`restart: false`), no mercy invuln on the sting. Score / lives / bombs already carried — that was never a reset.

Player note “boss is a 5s joke / 1★” is **Path stage 8 (Boss Pulse)** if they ever reach it. Not in this playtest. Handle in **PR B** (or a follow-up on that PR), not as a new research thread.

---
## After A–D (not before)

- Mid GFX preset + FPS governor; CA only on high trauma; particle spawn budget
- Bigger virtual sticks (radius 80 / 96) + portrait rotate-gate
- Scoop lesson floaters + GO autopsy (`NEW BEST`, unused bombs, drop SAFE copy)
- Near-miss sparks (no score / no mult)
- Local PB ghost (Classic only)
- Scale Path intro clocks by `enemyUnlockScale`; atoms honor `_softCap()`
- Then commission **3** Path beds (`boss-pulse`, `deadline-drill`, `grid-wake`), ≤1.2MB each

---

## Do not do

- Buff the gun, dual-default, or scale fire with juice/music
- Gate Classic on stars; live-ops, streaks, global ranks, pay-to-win
- Put power on graze, vacuum, CLEAR, or near-miss
- Scale lives/bombs off display score; re-extend invuln
- Morph Path, or morph Classic faster
- Native / WebGL rewrite
- Separate on-screen FIRE button
- Generate 8 Path MP3s before PR C exists
- Treat UAT green as “fun” or “60fps”

Fold extra UAT cases **into the PR they belong to** (morph crush, wrap, donut, checkpoint-not-AFK, `playTheme` fallback, background pause). Do not open a research phase for gamepad, colorblind, or camera.

---

## Next session checklist

1. Hard-refresh localhost.  
2. Title: **ENDLESS** vs **STAGES**.  
3. Pause → SOUND ON works on phones.  
4. After A–D backlog only if asked (mid GFX, bigger sticks, scoop lesson, etc.).
