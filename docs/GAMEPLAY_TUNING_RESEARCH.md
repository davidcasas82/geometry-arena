# Geometry Arena — Deep Research: Fine-Tuning Gameplay

Research synthesis for tuning a Geometry Wars–style twin-stick arena shooter.  
Mapped to **this codebase’s knobs** and what playtesting already revealed.

---

## 1. What “good” twin-stick feel actually optimizes for

### 1.1 Flow channel (challenge ≈ skill)

Csikszentmihalyi’s **flow channel**: challenge must rise *with* skill.

| Too easy (boredom) | Flow | Too hard (anxiety) |
|--------------------|------|--------------------|
| Kill everything standing still | Constant motion + decisions | Death feels unfair / random |
| Lives never drain | Bombs matter, mult is risk | Immortal or instadeath chains |
| One axis of threat | Multiple readable threats | Screen noise, no pattern |

**Implication for us:** every session should spend ~70–80% of time in “I can handle this if I move well,” not “I win AFK” or “I die to invisible rules.”

**85% rule (learning research, often cited in design):** optimal learning when success rate is high but not perfect. For arcade survival, target roughly:

- Early (0–45s): almost never die if you try  
- Mid (1–3 min): die from mistakes, not from spawn spam  
- Late (3+ min): deaths mostly from greed (chasing mult/geoms) or bad bomb timing  

### 1.2 The Geometry Wars loop (what high scores actually optimize)

From GW strategy discourse and wiki design:

1. **Survive** — movement is the real skill  
2. **Protect multiplier** — death resets the run’s score engine  
3. **Bomb is insurance** — spend bombs to *save mult*, not to farm kills  
4. **Priority targets** — wormholes/voids first, then dense packs  
5. **Keep moving** — standing still is death  

RE1: mult from surviving/killing; lives every 75k, bombs every 100k.  
RE2 Evolved: **geoms** drive mult; bomb still clears with **no points**.

**Implication:** fun is not DPS. Fun is **risk navigation** under rising density while chasing geoms/mult.

### 1.3 Rising difficulty curves (how hard ramps, not just “more”)

From small-game / arcade design (e.g. Abagames “rising difficulty curve”):

- Prefer **sqrt / ease-in** ramps early (gentle), not pure linear wall  
- **Different parameters should use different curves**  
  - Example: enemy *speed* linear, enemy *size/HP* slower (sqrt) so it doesn’t feel unfair  
- **Sawtooth** drops (brief lulls after peaks) restore readability — used in Game & Watch and many arcade designs  
- Target session length first, then solve for “difficulty doubles by ~T”

For a GW-like run, common targets:

| Goal | Rough target |
|------|----------------|
| Tutorial understanding | 0–30s |
| First real pressure | 45–90s |
| “One more run” length for average | **2–4 minutes** |
| Expert high-score runs | 5–15+ minutes |

We already use `t*t` ease-in for spawn density (`_difficulty01`) — good. Keep that; don’t linearize everything.

### 1.4 Density vs unfairness

Industry/playtest consensus on arena shooters:

- **Density** (how many bodies) drives difficulty more than raw enemy DPS  
- **Unreadable density** (everything same speed, random entry) feels cheap  
- **Readable density** (formations, priorities) feels skillful even when hard  

We invested in formations — protect that. Prefer fewer, patterned spawns over more random spam when tightening difficulty.

### 1.5 Player power budget (why the gun felt broken)

Classic balance identity for twin-sticks:

```
Player clear rate  ≲  Spawn rate × average threat
```

If **clear rate ≫ spawn rate**, the board empties, CLEAR bonuses fire, boredom.  
If **spawn rate ≫ clear rate**, screen fills, deaths feel like traffic accidents.

Rule of thumb used by many designers:

- Player should be able to clear **a line** if they aim well  
- Player should **not** be able to clear **the whole screen** without moving  
- Dual/spread weapons are **rewards**, not the default language of the game  

Your recent nerf (single stream, ~8 shots/s) aligns with this. Don’t re-hose without a skill gate (mult).

### 1.6 Mercy systems (respawn)

TV Tropes / shmup tradition: **mercy invincibility** after death.

Good package:

1. Fixed invuln window (1.5–2.5s)  
2. Local clear / push  
3. **No infinite extension** while overlapping (we fixed this)  
4. Lives that actually drain (we fixed inflation)

Bad package:

- Invuln that re-triggers forever  
- Lives refilled every wave  
- Clear radius so big death is free  

---

## 2. The five dials that actually matter

Everything in `constants.js` collapses into five coupled systems.

### Dial A — Player agency (move + aim + fire)

| Knob | Role | Too low | Too high |
|------|------|---------|----------|
| `PLAYER_SPEED` | Escape tool | Trapped | Kite forever, no threat |
| Accel/decel | Feel | Sticky/digital | Floaty ice |
| `FIRE_COOLDOWN` | Clear rate | Helpless | Lawn sprinkler |
| Stream count | Coverage | Needle skill | Screen delete |
| `AIM_SENSITIVITY` | Trackpad twin-stick | Can’t aim | Twitchy |

**Current stance (after nerfs):** move-strong, fire-modest. **Keep it.**  
If still too easy, prefer **raising density mid-game** over buffing gun again.

**Tuning tests:**

1. Stand still, fire at a line — should clear *one* line with good aim, not three sides.  
2. Circle-strafe a pack — should feel favored if you aim outward.  
3. Trackpad full 360 sweep in 1s — aim should keep up without overshooting.

### Dial B — Spawn / density pressure

| Knob | Role |
|------|------|
| `SAFE_OPENING_SEC` | Tutorial bubble |
| `SPAWN_INTERVAL_*` + ramp | Global tempo |
| Soft caps by time | Anti-flood |
| Formations | Readability |
| Unlock table | Threat introduction |

**Research-backed pattern:**

```
Time 0–T0:   teach movement + fire (fodder only)
T0–T1:       introduce 1 threat at a time
T1–T2:       combinations (pincer + dashers)
T2+:         priorities (voids) + high density
```

**Sawtooth:** after a hard formation, force a lull (`WAVE_LULL_*`). Don’t spawn the next pincer mid-pincer.

**Tuning tests:**

1. 0–20s: never die if you try.  
2. First pink/void should be *noticed*, not buried in noise.  
3. Average death time for a competent run ≈ 90–180s (adjust to taste).

### Dial C — Enemy roles (variety of decisions)

Good twin-stick casts force **different answers**:

| Role | Player response |
|------|-----------------|
| Slow fodder | Sweep lines, farm geoms |
| Fast seeker | Keep moving |
| Dasher | Sidestep timing |
| Splitter | Don’t stand in children |
| Tank | Focus fire / leave for later |
| Void / hole | Priority interrupt |
| Snake | Lead the beam along the body |

**Tuning principle:** change **one** behavior per new type; unlock spaced so players learn the counter.

If a type is “just faster green square,” delete or differentiate.

### Dial D — Economy (score / mult / lives / bombs)

This is where we repeatedly broke the game.

| Resource | Must feel |
|----------|-----------|
| **Mult** | Precious, terrifying to lose |
| **Bombs** | “Do I spend now or die later?” |
| **Lives** | Finite; three deaths in a minute should threaten game over |
| **Score** | Can go huge (fantasy) without breaking lives |

**Hard rules from our bugs:**

1. Never gate lives on mult-inflated score alone.  
2. Cap lives hard.  
3. Extra life cadence ≫ average deaths per minute for skilled play.  
4. Bomb awards no kill score (GW rule) so bombs protect mult, not farm it.

**Target economy (recommended):**

- Extra life ≈ every **2–4 minutes** of solid play, not every 30s  
- Bombs slightly rarer than lives  
- High mult (×40+) should feel like “don’t get hit” more than “I win”  

### Dial E — Juice without power

Juice (shake, vacuum, CLEAR, particles) **must not equal damage**.

GW separates:

- **Spectacle** (grid, explosions)  
- **Power** (how fast things die)

Safe: bigger blasts, better camera, vacuum *presentation*.  
Unsafe: vacuum that also one-shots enemies, fire rate that scales like score.

---

## 3. Concrete playtest protocol (how to fine-tune without guessing)

Do **one change per play session**. Log: death times, cause of death, max mult, lives at end.

### Session A — Opening (0–45s)
- [ ] Can a new player understand move/aim/fire?  
- [ ] Any death that felt random?  
- [ ] Board ever empty for >3s? (too easy)  

### Session B — Mid (1–3 min)
- [ ] Deaths from greed / bad pathing, not spawn on face?  
- [ ] At least one “I should have bombed”?  
- [ ] Formations still readable?  

### Session C — Late (3+ min)
- [ ] Still have decisions (void vs pack)?  
- [ ] Lives actually went down net?  
- [ ] Want one more run?  

### Metrics to instrument (optional, high value)

Log to console once per death / game over:

```
elapsed, level, mult, lives, bombs, score, enemyCount, deathCause
```

After 10 runs you can see median survival and stop tuning by anecdote alone.

---

## 4. Map: research → our current knobs

| Research principle | Our knobs | Current risk |
|--------------------|-----------|--------------|
| Flow: start easy | `SAFE_OPENING_SEC`, spawn intervals | Opening OK after nerfs |
| Sqrt/ease density | `_difficulty01` = t² | Good — keep |
| Sawtooth lulls | `WAVE_LULL_*`, formation queue | Good — don’t shrink lulls too much |
| Density over raw DPS | soft caps, formations | Watch late soft cap 65 |
| Player clear ≲ spawn | `FIRE_COOLDOWN`, dual unlock | Recently fixed — protect |
| Mult is the real score | geom mult, death reset | Core is healthy |
| Bomb = insurance | bomb no points, SAVED ×N | Good fantasy |
| Lives scarce | `MAX_LIVES`, `EXTRA_LIFE_EVERY` | Was broken; re-validate in play |
| Mercy not immortality | hard invuln timer | Fixed — adversarial UAT |
| Readable threats | unlock table spacing | Unlock times look OK |
| Session length 2–4 min | ramp 160s + levels 50s | Reasonable skeleton |

---

## 5. Recommended fine-tune order (priority)

When something feels wrong, change **in this order** (least collateral first):

1. **Spawn lull / soft cap** — board breathing  
2. **Enemy unlock timing** — when threats appear  
3. **Enemy speed** (slow types first) — not all speeds at once  
4. **Player fire rate / streams** — power fantasy last  
5. **Player move speed** — only if kite/trap extremes  
6. **Life/bomb thresholds** — economy only after combat feels right  
7. **Juice** — never as a substitute for balance  

---

## 6. Suggested “goldilocks” targets for *this* game

**Pass 1 applied** in `js/constants.js` + soft-cap bands in `game.js` (see changelog note at bottom of §6).

Not sacred numbers — starting hypotheses after our bug history:

| Parameter | Goldilocks zone | Notes |
|-----------|-----------------|-------|
| Median death | 90–150s | “One more run” |
| Fire | Single stream ~7–9/s | Dual only as mult reward |
| Opening | 15–25s fodder | Teach aim on lines |
| First real threat | ~30–40s | Pink/diamond |
| Void | ≥90–110s | Priority target |
| Max lives | 5 | Scarcity |
| Extra life | rare | Not every death refill |
| Board empty | brief | CLEAR is special, not constant |
| Mult death | sting | Bomb decision meaningful |

### Pass 1 changelog (applied)

| Area | Change |
|------|--------|
| Player speed | 360 → **340** (less free kiting) |
| Fire | **0.13s** CD single stream; dual @×45, triple @×110 |
| Spawn ramp | **145s** ease-in; min interval **0.24s** |
| Opening | **20s** fodder-only |
| Soft caps | 7 / 14 / 26 / 40 / 55 by time band |
| Unlocks | diamond 20s → void **105s** |
| Lives/bombs | max **5**; rare milestones unchanged |
| Mercy | invuln **1.7s**, clear **200**, pause **0.7s** |
| Mult decay | slightly more forgiving idle (3.2s / 0.7s) |
| Telemetry | `console.info("[arena:death]", …)` on each death |

**How to judge pass 1:** 5–10 runs, check death times in the browser console. Aim for median **90–150s**.

---

## 7. Anti-patterns we already proved in this project

| Anti-pattern | What happened |
|--------------|----------------|
| UAT “green” = good game | Immortal invuln + 141 lives shipped |
| Mult-scaled life thresholds | Lives printed at high × |
| Dual stream default | Screen delete, no tension |
| Invuln extends while overlapping | Cannot die in crowds |
| Soft opening then linear spam | Feels either baby or unfair |

**Process fix:** always add an **adversarial** test when a player reports “I can’t X.”

---

## 8. Ideation: highest-fun levers still on the table

Ranked by “fun per implementation hour” given current code:

1. **Mult-tier spawn tables** — at ×25+, spawn more geoms-rich fodder (reward aggression)  
2. **Threat telegraphs** — 0.3s edge flash before a pincer lands  
3. **Bomb greedy vs safe** — small score *penalty* text when bombing at low mult (teach insurance)  
4. **Near-miss sparks** — graze reward without power  
5. **Set-piece every level** — scripted “learn this” formation  
6. **Gates** — only if we want a new strategic verb  

---

## 9. Bottom line

Fine-tuning this genre is not “make numbers bigger.” It is:

1. Keep the player in the **flow channel**  
2. Make **density readable**  
3. Make **mult the real currency**  
4. Make **death and bombs expensive decisions**  
5. Change **one dial per playtest**  
6. Verify with **adversarial tests + death metrics**, not happy-path UAT alone  

Our systems (formations, geoms, camera, mercy, BGM) are enough to feel like a real cousin of Geometry Wars.  
The remaining work is **discipline on the five dials**, especially **clear rate vs spawn rate** and **life scarcity**.

---

## 10. Quick reference — files to touch

| Intent | File |
|--------|------|
| Power / speed / economy / unlocks | `js/constants.js` |
| Density curve, soft caps, formations | `js/game.js` (`_trySpawn`, `_difficulty01`) |
| Enemy behaviors / speeds | `js/constants.js` `ENEMY` + `js/entities.js` |
| Formation shapes | `js/spawns.js` |
| “Can I die / life cap” regressions | `uat/adversarial-uat.mjs` |
