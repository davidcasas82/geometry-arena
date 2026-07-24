import {
  BULLET_LIFETIME,
  BULLET_RADIUS,
  BULLET_SPEED,
  ENEMY,
  GEOM_LIFE,
  GEOM_MAGNET_RANGE,
  GEOM_MAGNET_SPEED,
  GEOM_RADIUS,
  PLAYER_ACCEL,
  PLAYER_DECEL,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  WORLD_H,
  WORLD_W,
} from "./constants.js";
import { clampToWorld, normalize, separate } from "./physics.js";

export function createPlayer(x = WORLD_W / 2, y = WORLD_H / 2) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    r: PLAYER_RADIUS,
    angle: 0,
    invuln: 0,
    /** ms — no move/fire/bomb while blinking in after death */
    controlLock: 0,
    fireCd: 0,
  };
}

export function updatePlayer(player, move, aimAngle, dt, firing) {
  const tx = move.x * PLAYER_SPEED;
  const ty = move.y * PLAYER_SPEED;
  const hasInput = move.x !== 0 || move.y !== 0;
  const rate = hasInput ? PLAYER_ACCEL : PLAYER_DECEL;
  const k = 1 - Math.exp(-rate * dt);
  player.vx += (tx - player.vx) * k;
  player.vy += (ty - player.vy) * k;

  if (!hasInput && Math.hypot(player.vx, player.vy) < 4) {
    player.vx = 0;
    player.vy = 0;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;
  clampToWorld(player, WORLD_W, WORLD_H);
  if (player.x <= player.r || player.x >= WORLD_W - player.r) player.vx = 0;
  if (player.y <= player.r || player.y >= WORLD_H - player.r) player.vy = 0;

  player.angle = aimAngle;

  // Invuln countdown is handled in game loop so it can extend while overlapping
  if (player.fireCd > 0) player.fireCd -= dt;

  return firing && player.fireCd <= 0;
}

export function createBullet(x, y, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: x + c * (PLAYER_RADIUS + 4),
    y: y + s * (PLAYER_RADIUS + 4),
    vx: c * BULLET_SPEED,
    vy: s * BULLET_SPEED,
    r: BULLET_RADIUS,
    life: BULLET_LIFETIME,
    dead: false,
  };
}

export function updateBullets(bullets, dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (
      b.life <= 0 ||
      b.x < -20 ||
      b.y < -20 ||
      b.x > WORLD_W + 20 ||
      b.y > WORLD_H + 20 ||
      b.dead
    ) {
      bullets.splice(i, 1);
    }
  }
}

export function createGeom(x, y) {
  const ang = Math.random() * Math.PI * 2;
  const sp = 50 + Math.random() * 100;
  return {
    x,
    y,
    vx: Math.cos(ang) * sp,
    vy: Math.sin(ang) * sp,
    r: GEOM_RADIUS,
    life: GEOM_LIFE,
    dead: false,
  };
}

/**
 * @param {number} mult — higher mult = hungrier vacuum (power fantasy)
 * @param {number} vacuumBoost — temporary global pull (milestone pulse)
 */
export function updateGeoms(geoms, player, dt, mult = 1, vacuumBoost = 0) {
  const multBoost = 1 + Math.min(1.2, (mult - 1) * 0.012);
  for (let i = geoms.length - 1; i >= 0; i--) {
    const g = geoms[i];
    g.life -= dt;
    if (g.life <= 0) {
      geoms.splice(i, 1);
      continue;
    }

    const dx = player.x - g.x;
    const dy = player.y - g.y;
    const d2 = dx * dx + dy * dy;
    const magnetR = GEOM_MAGNET_RANGE * (1 + vacuumBoost * 2.5) * (1 + Math.min(0.4, mult * 0.004));
    if (vacuumBoost > 0 || d2 < magnetR * magnetR) {
      const d = Math.sqrt(d2) || 1;
      const pull =
        GEOM_MAGNET_SPEED *
        multBoost *
        (1.35 - Math.min(1, d / Math.max(magnetR, 1))) *
        (1 + vacuumBoost * 4);
      g.vx = (dx / d) * pull;
      g.vy = (dy / d) * pull;
    } else {
      g.vx *= 0.9;
      g.vy *= 0.9;
    }

    g.x += g.vx * dt;
    g.y += g.vy * dt;
  }
}

function edgeSpawn() {
  const margin = 44;
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: Math.random() * WORLD_W, y: -margin };
  if (side === 1) return { x: Math.random() * WORLD_W, y: WORLD_H + margin };
  if (side === 2) return { x: -margin, y: Math.random() * WORLD_H };
  return { x: WORLD_W + margin, y: Math.random() * WORLD_H };
}

export function spawnEnemy(typeName, elapsed = 0, at = null) {
  const def = ENEMY[typeName];
  if (!def) return null;

  const pos = at || edgeSpawn();
  // Slow ramp: nearly base speed for first minute, then climbs
  const speedScale = 1 + Math.min(0.4, Math.max(0, elapsed - 30) / 200);

  const enemy = {
    type: def.type,
    x: pos.x,
    y: pos.y,
    r: def.radius,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed * speedScale,
    score: def.score,
    color: def.color,
    geoms: def.geoms || 1,
    angle: 0,
    spin: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
    enter: 0,
    dead: false,
    // type-specific
    dashCd: 0.4 + Math.random() * 0.8,
    dashing: 0,
    spawnCd: def.spawnInterval || 0,
    pull: def.pull || 0,
    dashSpeed: def.dashSpeed || 0,
    // Formation entry: hold line shape briefly while drifting in
    approach: null,
    approachTime: 0,
  };

  if (def.type === "snake") {
    const n = def.segments || 8;
    const spacing = def.spacing || 14;
    enemy.segmentR = def.radius * 0.85;
    enemy.spacing = spacing;
    enemy.history = [];
    enemy.segCount = n;
    const toCenter = normalize(WORLD_W / 2 - pos.x, WORLD_H / 2 - pos.y);
    for (let i = 0; i < n * spacing; i++) {
      enemy.history.push({
        x: pos.x - toCenter.x * i,
        y: pos.y - toCenter.y * i,
      });
    }
  }

  return enemy;
}

/** Spawn splitter children at death location */
export function spawnSplitterChildren(parent, elapsed) {
  const kids = [];
  for (let i = 0; i < 2; i++) {
    const ang = parent.angle + (i === 0 ? -0.8 : 0.8) + Math.random() * 0.3;
    const child = spawnEnemy("splitterChild", elapsed, {
      x: parent.x + Math.cos(ang) * 12,
      y: parent.y + Math.sin(ang) * 12,
    });
    if (child) {
      child.enter = 0.6;
      child.vx = Math.cos(ang) * 120;
      child.vy = Math.sin(ang) * 120;
      kids.push(child);
    }
  }
  return kids;
}

export function snakeSegments(e) {
  if (!e.history || !e.segCount) return [{ x: e.x, y: e.y, r: e.r }];
  const segs = [{ x: e.x, y: e.y, r: e.r }];
  const spacing = e.spacing || 14;
  for (let i = 1; i < e.segCount; i++) {
    const idx = Math.min(e.history.length - 1, i * spacing);
    const p = e.history[idx];
    if (p) segs.push({ x: p.x, y: p.y, r: e.segmentR || e.r * 0.85 });
  }
  return segs;
}

/**
 * @returns {{ atoms: object[] }} extra spawns from voids
 */
export function updateEnemies(enemies, player, dt, elapsed = 0) {
  const atoms = [];

  // Void pull affects player velocity (soft)
  let pullX = 0;
  let pullY = 0;

  for (const e of enemies) {
    if (e.dead) continue;

    if (e.enter < 1) e.enter = Math.min(1, e.enter + dt * 3.2);

    // Formation approach: drift inward as a group before full seek AI
    // Keeps rows/columns readable for a beat so sweeping fire feels great
    if (e.approach && e.approachTime > 0) {
      e.approachTime -= dt;
      const spd = e.speed * 0.85;
      e.x += e.approach.x * spd * dt;
      e.y += e.approach.y * spd * dt;
      e.angle = Math.atan2(e.approach.y, e.approach.x);
      // Still clamp soft bounds
      if (e.x > -50 && e.x < WORLD_W + 50 && e.y > -50 && e.y < WORLD_H + 50) {
        e.x = Math.max(-60, Math.min(WORLD_W + 60, e.x));
        e.y = Math.max(-60, Math.min(WORLD_H + 60, e.y));
      }
      continue;
    }

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const toPlayer = { x: dx / dist, y: dy / dist };

    if (e.type === "wanderer") {
      e.phase += dt * 2.2;
      const wobble = Math.sin(e.phase) * 0.35;
      const c = Math.cos(wobble);
      const s = Math.sin(wobble);
      const sx = toPlayer.x * c - toPlayer.y * s;
      const sy = toPlayer.x * s + toPlayer.y * c;
      e.x += sx * e.speed * dt;
      e.y += sy * e.speed * dt;
      e.angle = Math.atan2(sy, sx);
    } else if (e.type === "diamond") {
      e.x += toPlayer.x * e.speed * dt;
      e.y += toPlayer.y * e.speed * dt;
      e.angle = Math.atan2(toPlayer.y, toPlayer.x) + Math.PI / 4;
      e.spin += dt * 6;
    } else if (e.type === "pink") {
      // Creep, then dash
      e.dashCd -= dt;
      if (e.dashing > 0) {
        e.dashing -= dt;
        e.x += e.dashDirX * e.dashSpeed * dt;
        e.y += e.dashDirY * e.dashSpeed * dt;
      } else if (e.dashCd <= 0) {
        e.dashing = 0.22;
        e.dashDirX = toPlayer.x;
        e.dashDirY = toPlayer.y;
        e.dashCd = 1.1 + Math.random() * 0.7;
        e.angle = Math.atan2(toPlayer.y, toPlayer.x);
      } else {
        e.x += toPlayer.x * e.speed * dt;
        e.y += toPlayer.y * e.speed * dt;
        e.angle = Math.atan2(toPlayer.y, toPlayer.x);
      }
      e.spin += dt * 4;
    } else if (e.type === "spinner") {
      e.phase += dt * (ENEMY.spinner.orbit || 2);
      const sideX = -toPlayer.y;
      const sideY = toPlayer.x;
      const vx = toPlayer.x * 0.55 + sideX * Math.sin(e.phase) * 0.9;
      const vy = toPlayer.y * 0.55 + sideY * Math.sin(e.phase) * 0.9;
      const n = normalize(vx, vy);
      e.x += n.x * e.speed * dt;
      e.y += n.y * e.speed * dt;
      e.spin += dt * 9;
    } else if (e.type === "splitter" || e.type === "splitterChild") {
      e.x += toPlayer.x * e.speed * dt;
      e.y += toPlayer.y * e.speed * dt;
      e.angle = Math.atan2(toPlayer.y, toPlayer.x);
      e.spin += dt * 3;
      if (e.vx) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vx *= 0.9;
        e.vy *= 0.9;
      }
    } else if (e.type === "tank") {
      e.x += toPlayer.x * e.speed * dt;
      e.y += toPlayer.y * e.speed * dt;
      e.angle = Math.atan2(toPlayer.y, toPlayer.x);
      e.spin += dt * 1.2;
    } else if (e.type === "snake") {
      e.phase += dt * 3.5;
      const weave = Math.sin(e.phase) * 0.9;
      const sideX = -toPlayer.y;
      const sideY = toPlayer.x;
      const n = normalize(toPlayer.x + sideX * weave * 0.55, toPlayer.y + sideY * weave * 0.55);
      e.x += n.x * e.speed * dt;
      e.y += n.y * e.speed * dt;
      e.angle = Math.atan2(n.y, n.x);
      e.spin += dt * 10;
      if (!e.history) e.history = [];
      e.history.unshift({ x: e.x, y: e.y });
      const maxHist = (e.segCount || 8) * (e.spacing || 14) + 4;
      if (e.history.length > maxHist) e.history.length = maxHist;
    } else if (e.type === "void") {
      // Drift slowly toward player
      e.x += toPlayer.x * e.speed * dt;
      e.y += toPlayer.y * e.speed * dt;
      e.spin += dt * 1.5;
      e.phase += dt;
      // Pull player toward void
      if (dist < 280) {
        const fall = (1 - dist / 280) ** 2;
        pullX += (-dx / dist) * e.pull * fall;
        pullY += (-dy / dist) * e.pull * fall;
      }
      // Pull other enemies slightly
      for (const o of enemies) {
        if (o === e || o.dead || o.type === "void") continue;
        const ox = e.x - o.x;
        const oy = e.y - o.y;
        const od = Math.hypot(ox, oy) || 1;
        if (od < 200) {
          const f = (1 - od / 200) * 40 * dt;
          o.x += (ox / od) * f;
          o.y += (oy / od) * f;
        }
      }
      // Spawn atoms
      e.spawnCd -= dt;
      if (e.spawnCd <= 0) {
        e.spawnCd = ENEMY.void.spawnInterval * (0.85 + Math.random() * 0.3);
        const atom = spawnEnemy("atom", elapsed, {
          x: e.x + (Math.random() - 0.5) * 30,
          y: e.y + (Math.random() - 0.5) * 30,
        });
        if (atom) {
          atom.enter = 0.5;
          atoms.push(atom);
        }
      }
    } else if (e.type === "atom") {
      e.x += toPlayer.x * e.speed * dt;
      e.y += toPlayer.y * e.speed * dt;
      e.spin += dt * 8;
    }

    if (e.x > -50 && e.x < WORLD_W + 50 && e.y > -50 && e.y < WORLD_H + 50) {
      e.x = Math.max(-60, Math.min(WORLD_W + 60, e.x));
      e.y = Math.max(-60, Math.min(WORLD_H + 60, e.y));
    }
  }

  // Apply void pull to player
  if (pullX || pullY) {
    player.vx += pullX * dt;
    player.vy += pullY * dt;
  }

  for (const e of enemies) {
    if (!e.dead && e.type !== "snake" && e.type !== "void") separate(e, enemies, 36);
  }

  return { atoms };
}

export function pickSpawnType(elapsed, table) {
  const available = table.filter((t) => elapsed >= t.unlockAt);
  if (available.length === 0) return "wanderer";
  // Late game: bias voids slightly less than table if many voids already — handled in director
  let total = 0;
  for (const t of available) total += t.weight;
  let roll = Math.random() * total;
  for (const t of available) {
    roll -= t.weight;
    if (roll <= 0) return t.type;
  }
  return available[available.length - 1].type;
}
