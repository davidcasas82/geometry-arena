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

function makeInputWithKeys(codes) {
  const input = new Input(new FakeCanvas());
  for (const c of codes) input.keys.add(c);
  return input;
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== Results: ${results.length - failed.length}/${results.length} passed ===\n`);
if (failed.length) {
  process.exitCode = 1;
}
