/**
 * Headless logic UAT for Geometry Arena (no browser).
 * Run: node uat/logic-uat.mjs
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
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

// Minimal DOM stubs for Input class construction
class FakeCanvas {
  addEventListener() {}
  removeEventListener() {}
  requestPointerLock() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 1280, height: 720 };
  }
}

globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  AudioContext: class {
    constructor() {
      this.state = "running";
      this.currentTime = 0;
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
    resume() {}
    get destination() {
      return {};
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

const {
  AIM_SENSITIVITY,
  FIRE_COOLDOWN,
  PLAYER_SPEED,
  WORLD_W,
  WORLD_H,
  START_LIVES,
} = await import(js("constants.js"));
const { Input } = await import(js("input.js"));
const {
  createPlayer,
  updatePlayer,
  createBullet,
  updateBullets,
  spawnEnemy,
  pickSpawnType,
  updateEnemies,
} = await import(js("entities.js"));
const { circlesOverlap, clampToWorld } = await import(js("physics.js"));
const { ParticleSystem } = await import(js("particles.js"));

console.log("\n=== Geometry Arena UAT (logic) ===\n");

// --- Movement / diagonals ---
test("W alone moves up (negative Y)", () => {
  const input = makeInputWithKeys(["KeyW"]);
  const v = input.moveVector();
  assert.equal(v.x, 0);
  assert.equal(v.y, -1);
});

test("D alone moves right", () => {
  const input = makeInputWithKeys(["KeyD"]);
  const v = input.moveVector();
  assert.equal(v.x, 1);
  assert.equal(v.y, 0);
});

test("W+D diagonal is normalized (not faster than cardinal)", () => {
  const input = makeInputWithKeys(["KeyW", "KeyD"]);
  const v = input.moveVector();
  assert.ok(v.x > 0 && v.y < 0, "should be up-right");
  const speed = Math.hypot(v.x, v.y);
  assert.ok(Math.abs(speed - 1) < 1e-9, `diagonal length ${speed}`);
  assert.ok(Math.abs(v.x - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(v.y + Math.SQRT1_2) < 1e-9);
});

test("W+A+S+D cancel / net zero or near", () => {
  const input = makeInputWithKeys(["KeyW", "KeyA", "KeyS", "KeyD"]);
  const v = input.moveVector();
  assert.equal(v.x, 0);
  assert.equal(v.y, 0);
});

test("Player moves on diagonal independent of aim angle", () => {
  const p = createPlayer(100, 100);
  const move = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
  const aimRight = 0; // face +X
  const dt = 1 / 60;
  updatePlayer(p, move, aimRight, dt, false);
  assert.ok(p.x > 100, "moved right component");
  assert.ok(p.y < 100, "moved up component");
  assert.equal(p.angle, aimRight, "face aim, not move dir");
});

test("Player has slight accel (not full speed in first frame)", () => {
  const p = createPlayer(200, 200);
  updatePlayer(p, { x: 1, y: 0 }, 0, 1 / 60, false);
  const speed = Math.hypot(p.vx, p.vy);
  assert.ok(speed > 0, "starts moving");
  assert.ok(speed < PLAYER_SPEED * 0.95, `startup not instant, speed=${speed}`);
});

test("Player coasts slightly after keys release (inertia)", () => {
  const p = createPlayer(200, 200);
  // Spin up
  for (let i = 0; i < 30; i++) updatePlayer(p, { x: 1, y: 0 }, 0, 1 / 60, false);
  const xAtRelease = p.x;
  const vxAtRelease = p.vx;
  assert.ok(vxAtRelease > PLAYER_SPEED * 0.8, "near full speed before release");
  // No input — should still drift a bit
  updatePlayer(p, { x: 0, y: 0 }, 0, 1 / 60, false);
  assert.ok(p.x > xAtRelease, "coasts forward after release");
  assert.ok(p.vx > 0 && p.vx < vxAtRelease, "velocity decays");
  // Eventually settles
  for (let i = 0; i < 90; i++) updatePlayer(p, { x: 0, y: 0 }, 0, 1 / 60, false);
  assert.ok(Math.hypot(p.vx, p.vy) < 1, "settles to stop");
});

// --- Fire gating ---
test("isFiring false by default", () => {
  const input = new Input(new FakeCanvas());
  assert.equal(input.isFiring(), false);
});

test("clearFireButton blocks fire until mouseup then fresh down", () => {
  const input = new Input(new FakeCanvas());
  // Simulate Play click still held
  input.mouseDown = true;
  input.clearFireButton();
  assert.equal(input.isFiring(), false);
  assert.equal(input._blockFire, true);

  // Still held — mousedown ignored while blocked
  input._onMouseDown({ button: 0 });
  assert.equal(input.isFiring(), false);

  // Release unlocks block
  input._onMouseUp({ button: 0 });
  assert.equal(input._blockFire, false);
  assert.equal(input.isFiring(), false);

  // Fresh press fires
  input._onMouseDown({ button: 0 });
  assert.equal(input.isFiring(), true);
});

test("updatePlayer only returns canFire when firing and cooldown ready", () => {
  const p = createPlayer();
  p.fireCd = 0;
  assert.equal(updatePlayer(p, { x: 0, y: 0 }, 0, 0.016, false), false);
  assert.equal(updatePlayer(p, { x: 0, y: 0 }, 0, 0.016, true), true);
  p.fireCd = FIRE_COOLDOWN;
  assert.equal(updatePlayer(p, { x: 0, y: 0 }, 0, 0.016, true), false);
});

// --- Smooth aim (no replace-snap) ---
test("aim accumulates deltas for continuous sweep (not snap to delta dir)", () => {
  const input = new Input(new FakeCanvas());
  input.aim.x = 1;
  input.aim.y = 0;

  // Pure +Y motion should gradually rotate toward down, not snap instantly to (0,1)
  input._onMouseMove({ movementX: 0, movementY: 20 });
  const after1 = { ...input.aim };
  // After one nudge, still mostly pointing right if sens is moderate
  assert.ok(after1.x > 0.5, `expected mostly right after small nudge, got ${after1.x}`);
  assert.ok(after1.y > 0, "should gain down component");

  // Many steps should approach down
  for (let i = 0; i < 80; i++) {
    input._onMouseMove({ movementX: 0, movementY: 30 });
  }
  assert.ok(input.aim.y > 0.9, `sweep should reach down, y=${input.aim.y}`);
  assert.ok(Math.abs(Math.hypot(input.aim.x, input.aim.y) - 1) < 1e-6, "unit vector");
});

test("bullet spawns along aim angle, not move direction", () => {
  const p = createPlayer(200, 200);
  const aimUp = -Math.PI / 2;
  updatePlayer(p, { x: 1, y: 0 }, aimUp, 0.016, false); // moving right, aiming up
  const b = createBullet(p.x, p.y, p.angle);
  assert.ok(b.vy < 0, "bullet goes up");
  assert.ok(Math.abs(b.vx) < 1, `bullet mostly vertical, vx=${b.vx}`);
});

// --- Combat / entities ---
test("circlesOverlap detects hits", () => {
  assert.equal(circlesOverlap(0, 0, 10, 15, 0, 10), true);
  assert.equal(circlesOverlap(0, 0, 10, 50, 0, 10), false);
});

test("spawnEnemy places outside arena edges", () => {
  for (let i = 0; i < 40; i++) {
    const e = spawnEnemy("wanderer", 0);
    const outside =
      e.x < 0 || e.x > WORLD_W || e.y < 0 || e.y > WORLD_H;
    assert.ok(outside, `spawn should be outside, got ${e.x},${e.y}`);
  }
});

test("pickSpawnType unlocks types by elapsed time", () => {
  const table = [
    { type: "wanderer", weight: 1, unlockAt: 0 },
    { type: "diamond", weight: 1, unlockAt: 8 },
    { type: "tank", weight: 1, unlockAt: 30 },
  ];
  const early = new Set();
  for (let i = 0; i < 50; i++) early.add(pickSpawnType(0, table));
  assert.deepEqual([...early], ["wanderer"]);

  const late = new Set();
  for (let i = 0; i < 200; i++) late.add(pickSpawnType(40, table));
  assert.ok(late.has("wanderer"));
  assert.ok(late.has("diamond"));
  assert.ok(late.has("tank"));
});

test("splitter children spawn on factory call", async () => {
  const { spawnSplitterChildren } = await import(js("entities.js"));
  const parent = spawnEnemy("splitter", 0);
  parent.x = 400;
  parent.y = 300;
  const kids = spawnSplitterChildren(parent, 0);
  assert.equal(kids.length, 2);
  assert.equal(kids[0].type, "splitterChild");
});

test("void enemy has high HP and pull", () => {
  const e = spawnEnemy("void", 50);
  assert.ok(e.hp >= 6);
  assert.ok(e.pull > 0);
});

test("tank has 3 HP", () => {
  const e = spawnEnemy("tank", 0);
  assert.equal(e.hp, 3);
});

test("player clamps to world bounds", () => {
  const p = createPlayer(-100, -50);
  clampToWorld(p, WORLD_W, WORLD_H);
  assert.ok(p.x >= p.r);
  assert.ok(p.y >= p.r);
});

test("bullets expire by lifetime", () => {
  const bullets = [createBullet(100, 100, 0)];
  bullets[0].life = 0.01;
  updateBullets(bullets, 0.05);
  assert.equal(bullets.length, 0);
});

test("particles burst respects max budget indirectly", () => {
  const ps = new ParticleSystem();
  ps.burst(0, 0, "#fff", 50, 100);
  assert.ok(ps.particles.length > 0);
  ps.update(1);
  // after 1s most short-lived particles gone
  assert.ok(ps.particles.length < 50);
});

test("START_LIVES is 3", () => {
  assert.equal(START_LIVES, 3);
});

test("AIM_SENSITIVITY is positive for smooth aim", () => {
  assert.ok(AIM_SENSITIVITY > 0 && AIM_SENSITIVITY < 1);
});

test("enemy seeks player over time", () => {
  const player = createPlayer(WORLD_W / 2, WORLD_H / 2);
  const e = spawnEnemy("wanderer", 0);
  e.x = 0;
  e.y = WORLD_H / 2;
  const dist0 = Math.hypot(e.x - player.x, e.y - player.y);
  for (let i = 0; i < 60; i++) updateEnemies([e], player, 1 / 60);
  const dist1 = Math.hypot(e.x - player.x, e.y - player.y);
  assert.ok(dist1 < dist0, `should approach player ${dist0} -> ${dist1}`);
});

test("approach-hold keeps a shared heading for a beat", () => {
  const player = createPlayer(WORLD_W / 2, WORLD_H / 2);
  const e = spawnEnemy("wanderer", 0);
  e.x = 80;
  e.y = 80;
  e.enter = 1;
  e.approach = { x: 1, y: 0 };
  e.approachTime = 0.4;
  const x0 = e.x;
  const y0 = e.y;
  for (let i = 0; i < 18; i++) updateEnemies([e], player, 1 / 60);
  assert.ok(e.x > x0 + 8, `should drift along approach x ${x0} -> ${e.x}`);
  assert.ok(Math.abs(e.y - y0) < 6, `must not peel toward player yet, dy=${e.y - y0}`);
});

// --- Phrase director / formations ---
test("opening phrase is wanderer-only readable patterns", async () => {
  const {
    buildPhrase,
    formationEdgeLine,
    formationPlayerCircle,
    filterJobsNearPlayer,
  } = await import(js("spawns.js"));
  const { SAFE_OPENING_SEC, WORLD_W, WORLD_H, PHRASE } = await import(js("constants.js"));

  for (let i = 0; i < 40; i++) {
    const p = buildPhrase(5, 0, () => "pink", { safeOpening: SAFE_OPENING_SEC });
    assert.ok(p.beats.length >= 1, "has beats");
    assert.equal(p.intensity, "soft");
    for (const beat of p.beats) {
      for (const job of beat) {
        assert.equal(job.type, "wanderer", `opening must be wanderer, got ${job.type}`);
        assert.ok(Number.isFinite(job.x) && Number.isFinite(job.y));
        assert.ok(job.delay >= 0);
      }
    }
  }

  // sanity: edge line exists
  const line = formationEdgeLine("diamond", 5, 0, 0.1);
  assert.equal(line.length, 5);
  assert.ok(line.every((j) => j.y < 0), "top line above arena");

  // player circle keeps radius around player
  const circ = formationPlayerCircle("wanderer", 10, WORLD_W / 2, WORLD_H / 2, 160, 0.02);
  assert.ok(circ.length >= 6);
  for (const j of circ) {
    const d = Math.hypot(j.x - WORLD_W / 2, j.y - WORLD_H / 2);
    assert.ok(Math.abs(d - 160) < 2, `circle radius ${d}`);
  }

  // filter drops near-player jobs
  const player = { x: 100, y: 100 };
  const risky = [
    { type: "wanderer", x: 100, y: 100, delay: 0 },
    { type: "wanderer", x: 500, y: 500, delay: 0 },
  ];
  const safe = filterJobsNearPlayer(risky, player, PHRASE.SAFE_SPAWN_DIST);
  assert.equal(safe.length, 1);
  assert.equal(safe[0].x, 500);
});

test("first pink intro fires once then is marked via introKey", async () => {
  const { buildPhrase } = await import(js("spawns.js"));
  const seen = new Set();
  const first = buildPhrase(36, 0.1, () => "wanderer", {
    seenIntros: seen,
    player: { x: 800, y: 450, invuln: 0, controlLock: 0 },
  });
  assert.equal(first.introKey, "pink");
  assert.ok(first.beats.some((b) => b.some((j) => j.type === "pink")));
  seen.add("pink");
  // After seen, should not re-intro pink forever
  let pinkIntroAgain = 0;
  for (let i = 0; i < 30; i++) {
    const p = buildPhrase(36, 0.1, () => "wanderer", {
      seenIntros: seen,
      player: { x: 800, y: 450, invuln: 0, controlLock: 0 },
      lastCircleAt: 9999,
      lastFloodAt: 9999,
    });
    if (p.introKey === "pink") pinkIntroAgain += 1;
  }
  assert.equal(pinkIntroAgain, 0, "pink intro should not repeat");
});

// Simulate short combat loop
test("combat sim: hold fire kills nearby wanderer", () => {
  const p = createPlayer(400, 360);
  p.angle = 0;
  p.fireCd = 0;
  const enemy = spawnEnemy("wanderer", 0);
  enemy.x = 450;
  enemy.y = 360;
  enemy.hp = 1;
  const bullets = [];
  let kills = 0;

  for (let frame = 0; frame < 90; frame++) {
    const dt = 1 / 60;
    const canFire = updatePlayer(p, { x: 0, y: 0 }, 0, dt, true);
    if (canFire) {
      bullets.push(createBullet(p.x, p.y, p.angle));
      p.fireCd = FIRE_COOLDOWN;
    }
    updateBullets(bullets, dt);
    for (const b of bullets) {
      if (!b.dead && circlesOverlap(b.x, b.y, b.r, enemy.x, enemy.y, enemy.r)) {
        b.dead = true;
        enemy.hp -= 1;
        if (enemy.hp <= 0) {
          enemy.dead = true;
          kills++;
        }
      }
    }
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (bullets[i].dead) bullets.splice(i, 1);
    }
    if (enemy.dead) break;
  }
  assert.equal(kills, 1, "should kill one wanderer while holding fire");
});

test("Path catalog uses authored topologies, not all rect", async () => {
  const { LEVELS } = await import(js("levels.js"));
  const byId = Object.fromEntries(LEVELS.map((l) => [l.id, l.arena.topology]));
  assert.equal(byId["path-01-grid-wake"], "rect");
  assert.equal(byId["path-02-deadline-drill"], "rect_tight");
  assert.equal(byId["path-03-wave-lane"], "corridor");
  assert.equal(byId["path-04-cross-gates"], "cross");
  assert.equal(byId["path-05-donut-orbit"], "donut");
  assert.equal(byId["path-06-split-signal"], "split");
  assert.equal(byId["path-07-torus-rush"], "wrap_torus");
  assert.equal(byId["path-08-boss-pulse"], "rect_wide");
});

test("AFK does not auto-complete Cross Gates", async () => {
  const { getLevel } = await import(js("levels.js"));
  const { createModeController } = await import(js("modes.js"));
  const level = getLevel("path-04-cross-gates");
  const mode = createModeController(level.mode);
  const game = {
    player: { x: 10, y: 10 },
    score: 0,
    lives: 3,
    elapsed: 0,
    enemies: [],
    spawnQueue: [],
  };
  const ctx = {
    game,
    level,
    arena: { topology: "cross" },
    elapsed: 0,
    durationLeft: 95,
    flags: new Set(),
  };
  mode.onEnter(ctx);
  ctx.elapsed = 80;
  mode.onUpdate(ctx, 1);
  assert.equal(mode.getState(ctx), "playing", "sitting still must not clear gates");
  assert.equal(game.pathOnTimeGates, 0);
  ctx.elapsed = 96;
  mode.onUpdate(ctx, 1);
  assert.equal(mode.getState(ctx), "lost", "timeout with gates remaining is a fail");
});

test("visiting Cross Gates zones early does not win", async () => {
  const { getLevel } = await import(js("levels.js"));
  const { createModeController } = await import(js("modes.js"));
  const level = getLevel("path-04-cross-gates");
  const mode = createModeController(level.mode);
  const game = {
    player: { x: 800, y: 450 },
    score: 0,
    lives: 3,
    enemies: [],
    spawnQueue: [],
    _addScore() {},
    _gatePulse() {},
  };
  const ctx = {
    game,
    level,
    arena: { topology: "cross" },
    elapsed: 1,
    durationLeft: 94,
    flags: new Set(),
  };
  mode.onEnter(ctx);
  for (const cp of level.rules.checkpoints) {
    game.player.x = cp.zone.x;
    game.player.y = cp.zone.y;
    ctx.elapsed = Math.max(1, cp.dueSec - 1);
    mode.onUpdate(ctx, 0.1);
  }
  assert.equal(mode.getState(ctx), "playing", "sprint must not clear the level");
  assert.equal(game.pathOnTimeGates, 4);
  ctx.elapsed = level.rules.durationSec;
  mode.onUpdate(ctx, 0.1);
  assert.equal(mode.getState(ctx), "won", "clock + all gates is the win");
});

test("star gap names the missing family", async () => {
  const { getLevel, computeStars, describeStarGap } = await import(js("levels.js"));
  const level = getLevel("path-01-grid-wake");
  const extra = { cleared: true, peakMult: 8 };
  const stars = computeStars(level, 90000, extra);
  assert.equal(stars, 1, "peakMult 8 blocks 2★ even if score clears 80k");
  const gap = describeStarGap(level, 90000, extra, stars);
  assert.ok(/NEED ×15/.test(gap), gap);
});

test("Path deadline target is a real clock, not a pop-quiz", async () => {
  const { getLevel } = await import(js("levels.js"));
  const level = getLevel("path-02-deadline-drill");
  assert.ok(level.rules.targetScore >= 200000, "target too low");
  assert.equal(level.rules.durationSec, 60);
});

test("Path waves last longer than a sweep", async () => {
  const { getLevel } = await import(js("levels.js"));
  const lane = getLevel("path-03-wave-lane");
  const split = getLevel("path-06-split-signal");
  const laneN = lane.rules.waves.reduce((s, w) => s + w.count, 0);
  const splitN = split.rules.waves.reduce((s, w) => s + w.count, 0);
  assert.ok(lane.rules.waves.length >= 8, "wave lane too short");
  assert.ok(laneN >= 45, `wave lane count ${laneN}`);
  assert.ok(split.rules.waves.length >= 8, "split too short");
  assert.ok(splitN >= 50, `split count ${splitN}`);
  assert.equal(split.rules.waves.some((w) => w.seal), true);
});

test("Boss Pulse is a set piece, not a slab", async () => {
  const { getLevel } = await import(js("levels.js"));
  const { BOSS_BOMB_CHIP } = await import(js("constants.js"));
  const level = getLevel("path-08-boss-pulse");
  assert.ok(level.rules.boss.hp >= 80, "boss HP too low");
  assert.ok(BOSS_BOMB_CHIP <= 3, "bomb must not delete the elite");
  assert.ok(level.rules.boss.hp > BOSS_BOMB_CHIP * 3, "three bombs cannot skip the fight");
});

test("Classic morph cycle includes verb shapes", async () => {
  const { MORPH } = await import(js("constants.js"));
  const ids = MORPH.SHAPES.map((s) => s.topology);
  assert.ok(ids.includes("donut"));
  assert.ok(ids.includes("split"));
  assert.ok(ids.includes("wrap_torus"));
  assert.equal(MORPH.FIRST_AT, 48);
  assert.equal(MORPH.INTERVAL, 22);
});

test("death seed cap can keep dual", async () => {
  const { DEATH_MULT_KEEP, DEATH_MULT_KEEP_CAP, MULT_FOR_DUAL } = await import(
    js("constants.js")
  );
  const prev = 220;
  const keep = Math.min(
    Math.floor(prev * DEATH_MULT_KEEP),
    DEATH_MULT_KEEP_CAP,
    Math.floor(prev * 0.5)
  );
  assert.ok(keep >= MULT_FOR_DUAL, `keep ${keep} should hold dual`);
});

function makeInputWithKeys(codes) {
  const input = new Input(new FakeCanvas());
  for (const c of codes) input.keys.add(c);
  return input;
}

function fakePad({ buttons = {}, axes = [0, 0, 0, 0] } = {}) {
  const list = Array.from({ length: 16 }, (_, i) => {
    const v = buttons[i] ? 1 : 0;
    return { pressed: v > 0, value: v };
  });
  return { buttons: list, axes: axes.slice() };
}

function withGamepad(pad, fn) {
  if (!globalThis.navigator) {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
      writable: true,
    });
  }
  const nav = globalThis.navigator;
  const had = Object.prototype.hasOwnProperty.call(nav, "getGamepads");
  const prev = nav.getGamepads;
  nav.getGamepads = () => [pad];
  try {
    return fn();
  } finally {
    if (had) nav.getGamepads = prev;
    else delete nav.getGamepads;
  }
}

test("D-pad right/left emit one menu-nav edge each press", () => {
  const input = new Input(new FakeCanvas());
  const pad = fakePad({ buttons: { 15: true } }); // RIGHT
  withGamepad(pad, () => {
    const a = input.consumeMenuNav();
    assert.equal(a.x, 1);
    assert.equal(a.y, 0);
    const held = input.consumeMenuNav();
    assert.equal(held.x, 0, "hold must not spam");
  });
  pad.buttons[15] = { pressed: false, value: 0 };
  withGamepad(pad, () => input.consumeMenuNav());
  pad.buttons[14] = { pressed: true, value: 1 }; // LEFT
  withGamepad(pad, () => {
    const b = input.consumeMenuNav();
    assert.equal(b.x, -1);
  });
});

test("left stick tilt emits menu-nav from raw axes", () => {
  const input = new Input(new FakeCanvas());
  const pad = fakePad({ axes: [0.7, 0, 0, 0] });
  withGamepad(pad, () => {
    const a = input.consumeMenuNav();
    assert.equal(a.x, 1);
    const held = input.consumeMenuNav();
    assert.equal(held.x, 0);
  });
});

test("menu capture keeps A from bombing", () => {
  const input = new Input(new FakeCanvas());
  input.setMenuCapture(true);
  const pad = fakePad({ buttons: { 0: true } }); // A
  withGamepad(pad, () => {
    assert.equal(input.consumeMenuConfirm(), true);
    assert.equal(input.consumeBomb(), false);
  });
});

const failed = results.filter((r) => !r.ok);
console.log(`\n=== Results: ${results.length - failed.length}/${results.length} passed ===\n`);
if (failed.length) {
  process.exitCode = 1;
}
