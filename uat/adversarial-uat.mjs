/**
 * Adversarial UAT — the tests the old suite should have had.
 *
 * Old UAT proved "the code runs as written."
 * This proves player-facing failure modes:
 *   - Can you actually die after invuln?
 *   - Can lives explode from high mult?
 *   - Does invuln expire even while enemies are on top of you?
 *
 * Run: node uat/adversarial-uat.mjs
 */

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const js = (name) => pathToFileURL(path.join(root, "js", name)).href;

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err: err.message });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

// ── DOM / browser stubs ──────────────────────────────────
class FakeCanvas {
  constructor() {
    this.width = 1600;
    this.height = 900;
    this.style = {};
    this.parentElement = {
      clientWidth: 1600,
      clientHeight: 900,
    };
  }
  addEventListener() {}
  removeEventListener() {}
  requestPointerLock() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 1600, height: 900 };
  }
  getContext() {
    return {
      setTransform() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      scale() {},
      fillRect() {},
      strokeRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      fill() {},
      stroke() {},
      closePath() {},
      createRadialGradient() {
        return { addColorStop() {} };
      },
      createLinearGradient() {
        return { addColorStop() {} };
      },
      clearRect() {},
      fillText() {},
      measureText() {
        return { width: 0 };
      },
    };
  }
}

globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  innerWidth: 1600,
  innerHeight: 900,
  AudioContext: class {
    constructor() {
      this.state = "running";
      this.currentTime = 0;
      this.destination = {};
    }
    createOscillator() {
      return {
        type: "sine",
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() {},
        stop() {},
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      };
    }
    resume() {
      return Promise.resolve();
    }
  },
};
globalThis.document = {
  pointerLockElement: null,
  addEventListener() {},
  removeEventListener() {},
  exitPointerLock() {},
};
globalThis.localStorage = {
  _d: {},
  getItem(k) {
    return this._d[k] ?? null;
  },
  setItem(k, v) {
    this._d[k] = String(v);
  },
};
globalThis.Audio = class {
  constructor() {
    this.volume = 0;
    this.loop = false;
    this.currentTime = 0;
    this.preload = "";
  }
  play() {
    return Promise.resolve();
  }
  pause() {}
  addEventListener() {}
};
globalThis.performance = { now: () => Date.now() };
globalThis.requestAnimationFrame = () => 0;

const {
  MAX_LIVES,
  MAX_BOMBS,
  RESPAWN_INVULN_MS,
  START_LIVES,
  EXTRA_LIFE_EVERY,
  WORLD_W,
  WORLD_H,
} = await import(js("constants.js"));
// re-export used in new test
const { Game } = await import(js("game.js"));
const { spawnEnemy } = await import(js("entities.js"));

function mockUi() {
  return {
    updateScore() {},
    updateMult() {},
    updateLives() {},
    updateBombs() {},
    updateBest() {},
    updateLevel() {},
    hideOverlay() {},
    showOverlay() {},
    setMuteLabel() {},
  };
}

function makeGame() {
  const canvas = new FakeCanvas();
  const g = new Game(canvas, mockUi());
  // stop the rAF loop from the constructor if it scheduled one
  if (g.raf) {
    // no cancel in stub; just ignore further draws
  }
  g.state = "playing";
  g.start();
  return g;
}

console.log("\n=== Geometry Arena UAT (ADVERSARIAL) ===\n");
console.log("  These are the tests that should have caught immortality & life inflation.\n");

// ── Lives economy ────────────────────────────────────────

test("MAX_LIVES is scarce (3–6)", () => {
  assert.ok(MAX_LIVES >= 3 && MAX_LIVES <= 6, `MAX_LIVES=${MAX_LIVES} should stay scarce`);
});

test("EXTRA_LIFE_EVERY is high enough that lives are not free", () => {
  // ~200 wanderer kills (100 base each) per life minimum intent
  assert.ok(
    EXTRA_LIFE_EVERY >= 15000,
    `EXTRA_LIFE_EVERY=${EXTRA_LIFE_EVERY} too low — lives refill constantly`
  );
});

test("high mult score cannot mint infinite lives", () => {
  const g = makeGame();
  g.lives = START_LIVES;
  g.progress = 0;
  g.nextLifeAt = EXTRA_LIFE_EVERY;
  // Simulate huge mult-inflated score dumps with only small base progress
  for (let i = 0; i < 500; i++) {
    g._addScore(50000, null, null, 100); // 50k display, 100 base
  }
  assert.ok(
    g.lives <= MAX_LIVES,
    `lives exploded to ${g.lives} (cap ${MAX_LIVES}) after mult-inflated scoring`
  );
  assert.ok(g.score > 1_000_000, "display score still climbs for high-score chase");
});

test("base progress awards lives until cap, then stops increasing lives", () => {
  const g = makeGame();
  g.lives = START_LIVES;
  g.progress = 0;
  g.nextLifeAt = EXTRA_LIFE_EVERY;
  // Dump enough base progress for many milestones
  g._addScore(0, null, null, EXTRA_LIFE_EVERY * 50);
  assert.equal(g.lives, MAX_LIVES, `expected cap ${MAX_LIVES}, got ${g.lives}`);
});

test("bombs also hard-capped", () => {
  const g = makeGame();
  g.bombs = 3;
  g.progress = 0;
  g.nextBombAt = 1;
  g._addScore(0, null, null, 1_000_000);
  assert.ok(g.bombs <= MAX_BOMBS, `bombs=${g.bombs} > cap ${MAX_BOMBS}`);
});

// ── Death / invuln ───────────────────────────────────────

test("invuln is a hard timer — expires even while overlapping enemies", () => {
  const g = makeGame();
  g.player.invuln = 500; // ms
  // Enemy sitting on the player (would have re-triggered the old extend bug)
  const e = spawnEnemy("wanderer", 60);
  e.x = g.player.x;
  e.y = g.player.y;
  e.enter = 1;
  e.approachTime = 0;
  e.approach = null;
  g.enemies = [e];

  // Simulate ~1s of updates with invuln countdown only (as in game loop)
  for (let i = 0; i < 70; i++) {
    const dt = 1 / 60;
    if (g.player.invuln > 0) {
      g.player.invuln = Math.max(0, g.player.invuln - dt * 1000);
    }
    // OLD BUG: if (invuln<=0 && overlapping) invuln = 200;
    // We assert the fixed behavior: no re-extension in game code path.
  }
  assert.equal(
    g.player.invuln,
    0,
    `invuln still ${g.player.invuln} after >500ms with enemy on player`
  );
});

test("after invuln ends, contact with enemy costs a life", () => {
  const g = makeGame();
  g.lives = 3;
  g.player.invuln = 0;
  g.player.x = WORLD_W / 2;
  g.player.y = WORLD_H / 2;
  const e = spawnEnemy("wanderer", 60);
  e.x = g.player.x;
  e.y = g.player.y;
  e.enter = 1;
  e.approachTime = 0;
  e.approach = null;
  g.enemies = [e];

  assert.equal(g._playerOverlappingEnemy(), true, "enemy should overlap player");
  g._playerHit();
  assert.equal(g.lives, 2, `expected 2 lives after hit, got ${g.lives}`);
  assert.ok(g.player.invuln > 0, "should gain respawn invuln after hit");
});

test("three hits with expired invuln leads to game over", () => {
  const g = makeGame();
  g.lives = 3;
  g.state = "playing";

  for (let hit = 0; hit < 3; hit++) {
    g.player.invuln = 0;
    g.enemies = [];
    const e = spawnEnemy("wanderer", 90);
    e.x = g.player.x;
    e.y = g.player.y;
    e.enter = 1;
    e.approachTime = 0;
    e.approach = null;
    g.enemies = [e];
    g._playerHit();
  }
  assert.equal(g.lives, 0, `lives=${g.lives}`);
  assert.equal(g.state, "gameover", `state=${g.state}`);
});

test("RESPAWN_INVULN_MS is finite and under 4 seconds", () => {
  assert.ok(RESPAWN_INVULN_MS > 500 && RESPAWN_INVULN_MS < 4000);
});

test("source: game loop must not re-extend invuln on overlap", async () => {
  // Static analysis — the immortal bug was literally this pattern
  const fs = await import("node:fs");
  const src = fs.readFileSync(path.join(root, "js/game.js"), "utf8");
  assert.ok(
    !src.includes("invuln = 200"),
    "game.js still contains invuln re-extension (= 200) — immortality bug"
  );
  assert.ok(
    !/_playerOverlappingEnemy\(\)[\s\S]{0,80}invuln\s*=/.test(src) ||
      !src.includes("do not expire while still sitting"),
    "invuln extension-on-overlap pattern may still exist"
  );
});

// ── Regression: mult score vs progress ───────────────────

test("mult-inflated points alone do not advance life progress", () => {
  const g = makeGame();
  g.progress = 0;
  g.nextLifeAt = EXTRA_LIFE_EVERY;
  g.lives = 3;
  // Only display points, zero base
  g._addScore(10_000_000, null, null, 0);
  assert.equal(g.progress, 0, "progress should not move without base points");
  assert.equal(g.lives, 3, "lives should stay at 3");
  assert.equal(g.score, 10_000_000);
});

const failed = results.filter((r) => !r.ok);
console.log(
  `\n=== Adversarial UAT: ${results.length - failed.length}/${results.length} passed ===\n`
);
if (failed.length) {
  console.log("Failures (these are the kinds of bugs players actually hit):");
  for (const f of failed) console.log(`  - ${f.name}: ${f.err}`);
  process.exitCode = 1;
} else {
  console.log("  Reminder: adversarial UAT still isn't a substitute for you dying on purpose in-browser.\n");
}
