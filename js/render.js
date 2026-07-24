import {
  COLORS,
  GRID_STEP,
  HOVER_HEIGHT,
  SHADOW_OX,
  SHADOW_OY,
  WORLD_H,
  WORLD_W,
} from "./constants.js";
import { snakeSegments } from "./entities.js";
import { bloom, colorWithAlpha, neonFillStroke, neonStroke } from "./fx.js";

/**
 * Floor environment: deep void + grounded neon grid plane.
 * Shapes are drawn later with shadows so they read as hovering above this floor.
 */
export function drawGrid(ctx, shakeX = 0, shakeY = 0, impulses = [], t = 0) {
  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Deep void under the arena
  ctx.fillStyle = COLORS.bgDeep;
  ctx.fillRect(-8, -8, WORLD_W + 16, WORLD_H + 16);

  // Floor plate — slightly lifted panels of dark navy so the grid feels like a surface
  const floor = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  floor.addColorStop(0, "rgba(6, 10, 28, 0.95)");
  floor.addColorStop(0.45, "rgba(4, 8, 22, 0.98)");
  floor.addColorStop(1, "rgba(2, 4, 14, 1)");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Soft “stage” light on the floor center
  const vg = ctx.createRadialGradient(
    WORLD_W / 2,
    WORLD_H / 2,
    60,
    WORLD_W / 2,
    WORLD_H / 2,
    WORLD_W * 0.7
  );
  vg.addColorStop(0, "rgba(30, 70, 140, 0.2)");
  vg.addColorStop(0.5, "rgba(12, 24, 55, 0.1)");
  vg.addColorStop(1, "rgba(0, 0, 0, 0.35)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  const step = GRID_STEP;

  function warp(px, py) {
    let ox = 0;
    let oy = 0;
    for (const imp of impulses) {
      const dx = px - imp.x;
      const dy = py - imp.y;
      const d = Math.hypot(dx, dy) + 6;
      const fall = (imp.life / imp.maxLife) * imp.strength;
      const push = (fall * 4200) / (d * d);
      ox += (dx / d) * push;
      oy += (dy / d) * push;
    }
    const shimmer = Math.sin(px * 0.02 + t * 1.5) * Math.cos(py * 0.02 - t) * 0.85;
    return {
      x: px + Math.max(-58, Math.min(58, ox)) + shimmer,
      y: py + Math.max(-58, Math.min(58, oy)),
    };
  }

  // Impulse light on the floor
  ctx.globalCompositeOperation = "lighter";
  for (const imp of impulses) {
    const a = (imp.life / imp.maxLife) * 0.4 * imp.strength;
    bloom(ctx, imp.x, imp.y, 90 + imp.strength * 45, COLORS.gridGlow, a);
  }
  ctx.globalCompositeOperation = "source-over";

  // Secondary “under-grid” (slightly dimmer, offset) — sells floor thickness
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(20, 60, 120, 0.5)";
  ctx.translate(2, 3);
  for (let x = 0; x <= WORLD_W; x += step * 2) {
    ctx.beginPath();
    for (let y = 0; y <= WORLD_H; y += step) {
      const p = warp(x, y);
      if (y === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD_H; y += step * 2) {
    ctx.beginPath();
    for (let x = 0; x <= WORLD_W; x += step) {
      const p = warp(x, y);
      if (x === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Primary floor grid
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLORS.grid;
  for (let x = 0; x <= WORLD_W; x += step) {
    ctx.beginPath();
    for (let y = 0; y <= WORLD_H; y += step) {
      const p = warp(x, y);
      if (y === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD_H; y += step) {
    ctx.beginPath();
    for (let x = 0; x <= WORLD_W; x += step) {
      const p = warp(x, y);
      if (x === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // Major floor beams
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = COLORS.gridMajor;
  ctx.lineWidth = 1.6;
  for (let x = 0; x <= WORLD_W; x += step * 5) {
    ctx.beginPath();
    for (let y = 0; y <= WORLD_H; y += step) {
      const p = warp(x, y);
      if (y === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD_H; y += step * 5) {
    ctx.beginPath();
    for (let x = 0; x <= WORLD_W; x += step) {
      const p = warp(x, y);
      if (x === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Arena rim — floor edge / trench wall
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(40, 100, 180, 0.35)";
  ctx.lineWidth = 10;
  ctx.strokeRect(4, 4, WORLD_W - 8, WORLD_H - 8);
  ctx.strokeStyle = "rgba(80, 200, 255, 0.3)";
  ctx.lineWidth = 5;
  ctx.strokeRect(2, 2, WORLD_W - 4, WORLD_H - 4);
  ctx.strokeStyle = "rgba(160, 240, 255, 0.65)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, WORLD_W - 2, WORLD_H - 2);
  ctx.restore();

  // Thin atmospheric haze above the floor (separates air from ground)
  const haze = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  haze.addColorStop(0, "rgba(0, 0, 0, 0.12)");
  haze.addColorStop(0.5, "rgba(0, 20, 50, 0.04)");
  haze.addColorStop(1, "rgba(0, 0, 0, 0.18)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.restore();
}

/**
 * Soft ground contact blob — light cast on the floor under a hovering shape.
 */
export function drawFloorContact(ctx, x, y, radius, color, alpha = 0.22) {
  const fx = x + SHADOW_OX * 0.3;
  const fy = y + SHADOW_OY * 0.35;
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(1.25, 0.48);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  g.addColorStop(0, colorWithAlpha(color, alpha));
  g.addColorStop(0.55, colorWithAlpha(color, alpha * 0.25));
  g.addColorStop(1, colorWithAlpha(color, 0));
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Drop shadow on the floor plane (oval, offset — light from upper-left).
 */
export function drawFloorShadow(ctx, x, y, radius, alpha = 0.45) {
  const fx = x + SHADOW_OX;
  const fy = y + SHADOW_OY;
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(1.35, 0.42);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  g.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
  g.addColorStop(0.55, `rgba(0, 0, 0, ${alpha * 0.4})`);
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Floor pass: all shadows + contact lights under entities (drawn before hover layer).
 */
export function drawFloorShadows(ctx, player, enemies, geoms, t = 0) {
  // Player
  if (player) {
    drawFloorShadow(ctx, player.x, player.y, player.r * 2.8, 0.5);
    drawFloorContact(ctx, player.x, player.y, player.r * 3.2, COLORS.player, 0.2);
  }
  // Enemies
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.type === "snake") {
      for (const s of snakeSegments(e)) {
        drawFloorShadow(ctx, s.x, s.y, (s.r || e.r) * 2.2, 0.38);
      }
      drawFloorContact(ctx, e.x, e.y, e.r * 2.6, e.color, 0.14);
      continue;
    }
    const enter = e.enter != null ? e.enter : 1;
    drawFloorShadow(ctx, e.x, e.y, e.r * 2.5, 0.4 * enter);
    drawFloorContact(ctx, e.x, e.y, e.r * 2.8, e.color, 0.16 * enter);
  }
  // Geoms — tiny floor blips (pickups, not threats)
  for (const g of geoms) {
    const pulse = 0.9 + 0.1 * Math.sin(t * 8 + g.x * 0.08);
    drawFloorShadow(ctx, g.x, g.y, g.r * 1.6 * pulse, 0.22);
    drawFloorContact(ctx, g.x, g.y, g.r * 2.2 * pulse, COLORS.geom, 0.12);
  }
}

/** World Y offset so sprites sit above their floor shadows. */
function hoverY(y, bob = 0) {
  return y - HOVER_HEIGHT - bob;
}

/** Motion-blur afterimages of the ship */
export function drawAfterimages(ctx, images) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < images.length; i++) {
    const im = images[i];
    const lifeA = im.life != null ? Math.max(0, im.life / 0.18) : 1;
    const a = ((i + 1) / (images.length + 1)) * 0.4 * lifeA;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(im.x, hoverY(im.y));
    ctx.rotate(im.angle);
    clawPath(ctx, 11);
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function clawPath(ctx, r) {
  // Classic twin-stick "claw / arrowhead" silhouette
  ctx.beginPath();
  ctx.moveTo(r + 5, 0);
  ctx.lineTo(-r * 0.55, r * 0.95);
  ctx.lineTo(-r * 0.15, r * 0.28);
  ctx.lineTo(-r * 0.85, 0);
  ctx.lineTo(-r * 0.15, -r * 0.28);
  ctx.lineTo(-r * 0.55, -r * 0.95);
  ctx.closePath();
}

export function drawPlayer(ctx, player, t = 0) {
  const invuln = player.invuln > 0;
  // Classic shmup blink, but keep a shield ring so grace is obvious
  const flashHide = invuln && Math.floor(player.invuln / 80) % 2 === 0;
  const bob = Math.sin(t * 5.5) * 1.2; // gentle hover bob

  ctx.save();
  ctx.translate(player.x, hoverY(player.y, bob));

  if (invuln) {
    const pulse = 0.65 + 0.35 * Math.sin(t * 14);
    const shieldR = player.r + 14 + pulse * 4;
    bloom(ctx, 0, 0, shieldR * 1.6, COLORS.player, 0.35 * pulse);
    ctx.beginPath();
    ctx.arc(0, 0, shieldR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(94, 252, 255, ${0.35 + 0.4 * pulse})`;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, shieldR * 0.72, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 + 0.35 * pulse})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  if (flashHide) {
    ctx.restore();
    return;
  }

  ctx.rotate(player.angle);

  // Outer bloom
  bloom(ctx, 0, 0, 28, COLORS.playerGlow, 0.45);
  bloom(ctx, 4, 0, 14, "#ffffff", 0.2);

  // Engine pulse behind
  const pulse = 0.7 + 0.3 * Math.sin(t * 18);
  bloom(ctx, -10, 0, 10 * pulse, COLORS.player, 0.35);

  clawPath(ctx, player.r);
  neonFillStroke(
    ctx,
    "rgba(40, 180, 255, 0.18)",
    COLORS.player,
    2.4
  );

  // Hot core
  ctx.beginPath();
  ctx.arc(1, 0, 2.8, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  bloom(ctx, 1, 0, 8, "#fff", 0.5);

  ctx.restore();
}

export function drawBullets(ctx, bullets) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const b of bullets) {
    // Hover slightly above the floor plane
    const bx = b.x;
    const by = hoverY(b.y, 2);
    const r = b.r + 1.2;

    // Tiny floor dash under bolt (depth cue)
    drawFloorShadow(ctx, b.x, b.y, r * 1.8, 0.22);

    const glow = ctx.createRadialGradient(bx, by, 0, bx, by, r * 3.2);
    glow.addColorStop(0, "rgba(180, 245, 255, 0.85)");
    glow.addColorStop(0.35, "rgba(90, 220, 255, 0.35)");
    glow.addColorStop(1, "rgba(90, 220, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bx, by, r * 3.2, 0, Math.PI * 2);
    ctx.fill();

    const sp = Math.hypot(b.vx, b.vy) || 1;
    const tx = (b.vx / sp) * (r * 1.1);
    const ty = (b.vy / sp) * (r * 1.1);
    ctx.strokeStyle = "rgba(200, 250, 255, 0.55)";
    ctx.lineWidth = r * 1.15;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx - tx * 0.35, by - ty * 0.35);
    ctx.lineTo(bx + tx * 0.45, by + ty * 0.45);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawGeoms(ctx, geoms, t = 0) {
  // Small sparkle pickups — deliberately not enemy-shaped (no big diamonds)
  for (const g of geoms) {
    const pulse = 0.85 + 0.15 * Math.sin(t * 10 + g.x * 0.12);
    const bob = Math.sin(t * 6 + g.y * 0.08) * 1.1;
    const s = Math.max(2.2, g.r * pulse);
    ctx.save();
    ctx.translate(g.x, hoverY(g.y, bob));

    // Soft lime glow (compact)
    bloom(ctx, 0, 0, s * 2.8, COLORS.geom, 0.35);

    // Core dot
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(220, 255, 160, 0.95)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // Tiny 4-point sparkle (reads as loot, not a seeker)
    ctx.rotate(t * 2.2 + g.x * 0.05);
    ctx.strokeStyle = "rgba(200, 255, 120, 0.75)";
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    const arm = s * 1.35;
    ctx.beginPath();
    ctx.moveTo(-arm, 0);
    ctx.lineTo(arm, 0);
    ctx.moveTo(0, -arm);
    ctx.lineTo(0, arm);
    ctx.stroke();

    ctx.restore();
  }
}

export function drawEnemies(ctx, enemies, t = 0) {
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.type === "snake") {
      drawSnake(ctx, e, t);
      continue;
    }

    const enter = e.enter != null ? e.enter : 1;
    const scale = 0.25 + 0.75 * enter;
    const bob = Math.sin(t * 4.2 + e.phase) * 1.4 * enter;

    ctx.save();
    ctx.translate(e.x, hoverY(e.y, bob));
    ctx.rotate(e.angle);
    ctx.scale(scale, scale);

    bloom(ctx, 0, 0, e.r * 2.2, e.color, 0.28 * enter);

    const hpFrac = e.hp / e.maxHp;

    if (e.type === "wanderer") {
      const s = e.r;
      const wob = 1 + 0.04 * Math.sin(t * 6 + e.phase);
      ctx.beginPath();
      ctx.rect(-s * wob, -s * wob, s * 2 * wob, s * 2 * wob);
      neonFillStroke(ctx, colorWithAlpha(e.color, 0.15), e.color, 2.2);
    } else if (e.type === "diamond") {
      const s = e.r * (1 + 0.05 * Math.sin(t * 10 + e.spin));
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-s, -s, s * 2, s * 2);
      neonFillStroke(ctx, colorWithAlpha(e.color, 0.18), e.color, 2.2);
    } else if (e.type === "pink") {
      // Classic aggressive pink square
      const s = e.r * (e.dashing > 0 ? 1.15 : 1);
      const stretch = e.dashing > 0 ? 1.25 : 1;
      ctx.scale(stretch, 1 / stretch);
      ctx.beginPath();
      ctx.rect(-s, -s, s * 2, s * 2);
      neonFillStroke(ctx, colorWithAlpha(e.color, e.dashing > 0 ? 0.35 : 0.18), e.color, 2.3);
      if (e.dashing > 0) bloom(ctx, 0, 0, s * 2.5, e.color, 0.45);
    } else if (e.type === "spinner") {
      const s = e.r;
      ctx.rotate(e.spin || 0);
      for (let arm = 0; arm < 3; arm++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.moveTo(s * 1.1, 0);
        ctx.lineTo(-s * 0.35, s * 0.4);
        ctx.lineTo(-s * 0.15, 0);
        ctx.lineTo(-s * 0.35, -s * 0.4);
        ctx.closePath();
        neonFillStroke(ctx, colorWithAlpha(e.color, 0.2), e.color, 1.8);
      }
    } else if (e.type === "splitter" || e.type === "splitterChild") {
      const s = e.r;
      ctx.rotate(e.spin || 0);
      // Nested diamonds
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s, 0);
      ctx.closePath();
      neonFillStroke(ctx, colorWithAlpha(e.color, 0.2), e.color, e.type === "splitter" ? 2.4 : 1.8);
      if (e.type === "splitter") {
        const s2 = s * 0.45;
        ctx.beginPath();
        ctx.moveTo(0, -s2);
        ctx.lineTo(s2, 0);
        ctx.lineTo(0, s2);
        ctx.lineTo(-s2, 0);
        ctx.closePath();
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    } else if (e.type === "void") {
      // Black hole — dark core + rotating purple teeth
      const s = e.r;
      bloom(ctx, 0, 0, s * 3.2, e.color, 0.5);
      bloom(ctx, 0, 0, s * 1.4, "#1a0a40", 0.8);
      ctx.rotate(e.spin || 0);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const rr = i % 2 === 0 ? s : s * 0.55;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      neonFillStroke(ctx, "rgba(20, 0, 40, 0.85)", e.color, 2.5);
      // Accretion swirl
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.strokeStyle = colorWithAlpha(e.color, 0.8);
      ctx.lineWidth = 2;
      ctx.stroke();
      // HP pips
      if (e.hp < e.maxHp) {
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2 * hpFrac);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (e.type === "atom") {
      const s = e.r * (1 + 0.1 * Math.sin(t * 12 + e.spin));
      ctx.rotate(e.spin || 0);
      bloom(ctx, 0, 0, s * 2.5, e.color, 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      neonFillStroke(ctx, colorWithAlpha(e.color, 0.3), e.color, 1.6);
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    } else if (e.type === "tank") {
      const s = e.r;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6 + t * 0.4;
        const px = Math.cos(a) * s;
        const py = Math.sin(a) * s;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      neonFillStroke(ctx, colorWithAlpha(e.color, 0.12 + 0.1 * hpFrac), e.color, 2.6);
      if (e.hp < e.maxHp) {
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2 * hpFrac);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

function drawSnake(ctx, e, t) {
  const segs = snakeSegments(e);
  const enter = e.enter != null ? e.enter : 1;
  const lift = (s, i) => hoverY(s.y, Math.sin(t * 5 + i) * 1.2);

  // Glowing spine (hovering)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = colorWithAlpha(e.color, 0.35 * enter);
  ctx.lineWidth = 8;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < segs.length; i++) {
    const hy = lift(segs[i], i);
    if (i === 0) ctx.moveTo(segs[i].x, hy);
    else ctx.lineTo(segs[i].x, hy);
  }
  ctx.stroke();
  ctx.strokeStyle = colorWithAlpha(e.color, 0.7 * enter);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    const size = (i === 0 ? e.r : s.r) * enter;
    ctx.save();
    ctx.translate(s.x, lift(s, i));
    ctx.rotate((e.spin || 0) + i * 0.35 + t);
    bloom(ctx, 0, 0, size * 2, e.color, i === 0 ? 0.4 : 0.2);
    ctx.beginPath();
    ctx.moveTo(size * 1.1, 0);
    ctx.lineTo(0, size * 0.75);
    ctx.lineTo(-size, 0);
    ctx.lineTo(0, -size * 0.75);
    ctx.closePath();
    neonFillStroke(ctx, colorWithAlpha(e.color, i === 0 ? 0.28 : 0.12), e.color, i === 0 ? 2.2 : 1.4);
    ctx.restore();
  }
}

export function drawBombFlash(ctx, flash) {
  if (!flash || flash <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const a = Math.min(1, flash);
  // Full-field punch + hot center
  ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.22})`;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  const g = ctx.createRadialGradient(
    WORLD_W / 2,
    WORLD_H / 2,
    10,
    WORLD_W / 2,
    WORLD_H / 2,
    WORLD_W * 0.75
  );
  g.addColorStop(0, `rgba(255,255,255,${a * 0.95})`);
  g.addColorStop(0.2, `rgba(255,240,160,${a * 0.65})`);
  g.addColorStop(0.5, `rgba(255,200,80,${a * 0.28})`);
  g.addColorStop(1, "rgba(255,180,40,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.restore();
}

export function drawVignette(ctx) {
  const g = ctx.createRadialGradient(
    WORLD_W / 2,
    WORLD_H / 2,
    WORLD_H * 0.35,
    WORLD_W / 2,
    WORLD_H / 2,
    WORLD_W * 0.75
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
}

export function drawAimReticle(ctx, rx, ry, shipX, shipY) {
  const hy = hoverY(shipY);
  const hry = hoverY(ry, 2);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(94, 252, 255, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(shipX, hy);
  ctx.lineTo(rx, hry);
  ctx.stroke();

  bloom(ctx, rx, hry, 12, COLORS.player, 0.35);
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  const s = 8;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(rx - s, hry);
  ctx.lineTo(rx + s, hry);
  ctx.moveTo(rx, hry - s);
  ctx.lineTo(rx, hry + s);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(rx, hry, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// re-export for any leftover imports
export { neonStroke };
