import {
  COLORS,
  GEOM_FADE_SEC,
  GEOM_LIFE,
  GFX,
  GRID_STEP,
  HOVER_HEIGHT,
  SHADOW_OX,
  SHADOW_OY,
  WORLD_H,
  WORLD_W,
} from "./constants.js";
import { snakeSegments } from "./entities.js";
import { bloom, colorWithAlpha, neonFillStroke, neonStroke } from "./fx.js";

/** Enemy still in red-outline telegraph phase (no solid fill / no collision). */
export function enemyIsOutline(e) {
  const enter = e?.enter != null ? e.enter : 1;
  return enter < (GFX.ENEMY_OUTLINE_END ?? 0.58);
}

/**
 * Quiet paper wash behind the grid. Decorative only.
 */
function drawPsychedelicUnderlay(ctx, W, H, t = 0) {
  const reduced = !!GFX.REDUCED_FLASH;
  const baseA = reduced
    ? GFX.UNDERLAY_ALPHA_REDUCED ?? 0.035
    : GFX.UNDERLAY_ALPHA ?? 0.09;
  if (baseA <= 0.001) return;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Quiet multi-hue accent — floor stays dark so entities keep contrast
  const cx = W * 0.5 + Math.sin(t * 0.14) * W * 0.1;
  const cy = H * 0.5 + Math.cos(t * 0.11) * H * 0.08;
  const rMax = Math.hypot(W, H) * 0.55;

  const g1 = ctx.createRadialGradient(cx, cy, 30, cx, cy, rMax);
  g1.addColorStop(0, `rgba(255, 244, 220, ${baseA * 0.55})`);
  g1.addColorStop(0.5, `rgba(47, 211, 154, ${baseA * 0.22})`);
  g1.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  const g3 = ctx.createRadialGradient(W * 0.12, H * 0.18, 0, W * 0.12, H * 0.18, W * 0.3);
  g3.addColorStop(0, `rgba(255, 77, 77, ${baseA * 0.28})`);
  g3.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g3;
  ctx.fillRect(0, 0, W, H);
  const g4 = ctx.createRadialGradient(W * 0.88, H * 0.82, 0, W * 0.88, H * 0.82, W * 0.32);
  g4.addColorStop(0, `rgba(255, 210, 58, ${baseA * 0.22})`);
  g4.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g4;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();
}

/**
 * Floor environment: ink wash + hairline paper grid.
 * Shapes are drawn later with shadows so they read as hovering above this floor.
 * @param {number} [pulse=0.5] techno breath 0..1 (modulates major beams)
 */
export function drawGrid(
  ctx,
  shakeX = 0,
  shakeY = 0,
  impulses = [],
  t = 0,
  worldW = WORLD_W,
  worldH = WORLD_H,
  pulse = 0.5
) {
  const W = worldW || WORLD_W;
  const H = worldH || WORLD_H;
  const fancy = GFX.FANCY_GRID !== false;
  const stepMul = Math.max(1, GFX.GRID_STEP_MUL || 1);
  const step = Math.max(24, Math.round(GRID_STEP * stepMul));
  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Deep void under the arena
  ctx.fillStyle = COLORS.bgDeep;
  ctx.fillRect(-8, -8, W + 16, H + 16);

  // Floor plate — solid fill on low; gradient on high
  if (fancy) {
    const floor = ctx.createLinearGradient(0, 0, 0, H);
    floor.addColorStop(0, "rgba(18, 16, 28, 0.98)");
    floor.addColorStop(0.5, "rgba(12, 10, 20, 0.99)");
    floor.addColorStop(1, "rgba(7, 6, 13, 1)");
    ctx.fillStyle = floor;
  } else {
    ctx.fillStyle = "rgba(12, 10, 20, 1)";
  }
  ctx.fillRect(0, 0, W, H);

  if (fancy) {
    // Quiet multi-hue accent under the grid (not a full wash)
    drawPsychedelicUnderlay(ctx, W, H, t);

    // Soft stage light — mostly dark edges, cool center
    const vg = ctx.createRadialGradient(
      W / 2,
      H / 2,
      50,
      W / 2,
      H / 2,
      W * 0.7
    );
    vg.addColorStop(0, "rgba(255, 244, 220, 0.05)");
    vg.addColorStop(0.55, "rgba(18, 16, 28, 0.08)");
    vg.addColorStop(1, "rgba(0, 0, 0, 0.38)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  const pulseAmt = Math.max(0, Math.min(1, pulse));
  const majorBoost = 1 + (pulseAmt - 0.5) * 2 * (GFX.GRID_PULSE_DEPTH || 0.22);

  // Low quality: axis-aligned straight lines (no per-vertex warp / shimmer)
  if (!fancy) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    for (let x = 0; x <= W; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = 0; y <= H; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();

    // Sparse major beams (single path batch)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = COLORS.gridMajor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const major = step * 4;
    for (let x = 0; x <= W; x += major) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = 0; y <= H; y += major) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.restore();

    // Simple rim
    ctx.strokeStyle = "rgba(18, 16, 28, 0.85)";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    // Cheap impulse dots (no radial bloom gradients)
    if (impulses.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const imp of impulses) {
        const a = (imp.life / imp.maxLife) * 0.35 * imp.strength;
        ctx.fillStyle = colorWithAlpha(COLORS.gridGlow, a);
        ctx.beginPath();
        ctx.arc(imp.x, imp.y, 18 + imp.strength * 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
    return;
  }

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

  // Impulse ripples on the floor (ink, not neon bloom)
  ctx.globalCompositeOperation = "source-over";
  for (const imp of impulses) {
    const a = (imp.life / imp.maxLife) * 0.35 * imp.strength;
    ctx.beginPath();
    ctx.arc(imp.x, imp.y, 28 + imp.strength * 22, 0, Math.PI * 2);
    ctx.strokeStyle = colorWithAlpha(COLORS.gridMajor, a);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Secondary “under-grid” (slightly dimmer, offset) — sells floor thickness
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(18, 16, 28, 0.55)";
  ctx.translate(2, 3);
  for (let x = 0; x <= W; x += step * 2) {
    ctx.beginPath();
    for (let y = 0; y <= H; y += step) {
      const p = warp(x, y);
      if (y === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += step * 2) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += step) {
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
  for (let x = 0; x <= W; x += step) {
    ctx.beginPath();
    for (let y = 0; y <= H; y += step) {
      const p = warp(x, y);
      if (y === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += step) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += step) {
      const p = warp(x, y);
      if (x === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // Major floor beams — techno breath modulates alpha/width
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = Math.max(0.35, Math.min(1, majorBoost));
  ctx.strokeStyle = COLORS.gridMajor;
  ctx.lineWidth = 1.55 + pulseAmt * 0.55;
  for (let x = 0; x <= W; x += step * 5) {
    ctx.beginPath();
    for (let y = 0; y <= H; y += step) {
      const p = warp(x, y);
      if (y === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += step * 5) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += step) {
      const p = warp(x, y);
      if (x === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Arena rim — floor edge / trench wall (slight pulse)
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = COLORS.ink || "#12101c";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);
  ctx.strokeStyle = colorWithAlpha(COLORS.paper || "#fff4dc", 0.28);
  ctx.lineWidth = 1.4;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.restore();

  // Thin atmospheric haze above the floor (separates air from ground)
  const haze = ctx.createLinearGradient(0, 0, 0, H);
  haze.addColorStop(0, "rgba(0, 0, 0, 0.12)");
  haze.addColorStop(0.5, "rgba(18, 16, 28, 0.04)");
  haze.addColorStop(1, "rgba(0, 0, 0, 0.18)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);

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
  ctx.globalCompositeOperation = "source-over";
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
  const mode = GFX.FLOOR_SHADOWS || "all";
  if (mode === "none") return;

  // Player
  if (player) {
    drawFloorShadow(ctx, player.x, player.y, player.r * 2.8, 0.5);
    if (mode === "all") {
      drawFloorContact(ctx, player.x, player.y, player.r * 3.2, COLORS.player, 0.2);
    }
  }
  if (mode === "player") return;

  // Enemies — skip / dim shadows during outline telegraph
  for (const e of enemies) {
    if (e.dead) continue;
    if (enemyIsOutline(e)) {
      // Faint danger contact only — no solid floor shadow yet
      drawFloorContact(ctx, e.x, e.y, e.r * 2.4, COLORS.danger, 0.08);
      continue;
    }
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
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < images.length; i++) {
    const im = images[i];
    const lifeA = im.life != null ? Math.max(0, im.life / 0.18) : 1;
    const a = ((i + 1) / (images.length + 1)) * 0.4 * lifeA;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(im.x, hoverY(im.y));
    ctx.rotate(im.angle);
    const vis = (GFX.SHIP_DRAW || 1.38) * 11;
    clawPath(ctx, vis);
    ctx.fillStyle = colorWithAlpha(COLORS.paper || "#fff4dc", 0.55);
    ctx.fill();
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
    ctx.strokeStyle = colorWithAlpha(COLORS.player, 0.35 + 0.4 * pulse);
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

  const vis = player.r * (GFX.SHIP_DRAW || 1.38);
  const pulse = 0.7 + 0.3 * Math.sin(t * 18);
  ctx.beginPath();
  ctx.moveTo(-vis * 0.95, 0);
  ctx.lineTo(-vis * 1.55 * pulse, vis * 0.22);
  ctx.lineTo(-vis * 1.55 * pulse, -vis * 0.22);
  ctx.closePath();
  ctx.fillStyle = COLORS.playerGlow;
  ctx.fill();
  ctx.strokeStyle = "#12101c";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  clawPath(ctx, vis);
  ctx.fillStyle = COLORS.paper || "#fff4dc";
  ctx.fill();
  ctx.strokeStyle = "#12101c";
  ctx.lineWidth = 2.1;
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(vis * 0.12, 0, vis * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.playerGlow;
  ctx.fill();
  ctx.strokeStyle = "#12101c";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  ctx.restore();
}

export function drawBullets(ctx, bullets) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "round";
  const fat = GFX.BULLET_DRAW || 2.4;
  const dart = GFX.BULLET_LEN || 18;
  for (const b of bullets) {
    const bx = b.x;
    const by = hoverY(b.y, 2);
    const r = (b.r + 1.2) * fat;

    if ((GFX.FLOOR_SHADOWS || "all") === "all") {
      drawFloorShadow(ctx, b.x, b.y, r * 1.4, 0.2);
    }

    const sp = Math.hypot(b.vx, b.vy) || 1;
    const nx = b.vx / sp;
    const ny = b.vy / sp;
    const hx = nx * dart;
    const hy = ny * dart;
    const tx = nx * dart * 0.55;
    const ty = ny * dart * 0.55;

    ctx.strokeStyle = "#12101c";
    ctx.lineWidth = r * 1.85;
    ctx.beginPath();
    ctx.moveTo(bx - tx, by - ty);
    ctx.lineTo(bx + hx * 0.35, by + hy * 0.35);
    ctx.stroke();

    ctx.strokeStyle = COLORS.paper || "#fff4dc";
    ctx.lineWidth = r * 1.15;
    ctx.beginPath();
    ctx.moveTo(bx - tx * 0.85, by - ty * 0.85);
    ctx.lineTo(bx + hx * 0.22, by + hy * 0.22);
    ctx.stroke();

    ctx.fillStyle = COLORS.bomb || "#ffd23a";
    ctx.beginPath();
    ctx.arc(bx + hx * 0.12, by + hy * 0.12, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#12101c";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawGeoms(ctx, geoms, t = 0) {
  // Small sparkle pickups — deliberately not enemy-shaped (no big diamonds)
  // Fade/blink when about to expire so players feel the urgency to scoop.
  for (const g of geoms) {
const maxL = g.maxLife > 0 ? g.maxLife : GEOM_LIFE;
    const lifeFrac = Math.max(0, Math.min(1, g.life / maxL));
    // Last GEOM_FADE_SEC: drop alpha + blink hard
    let alpha = 1;
    if (g.life < GEOM_FADE_SEC) {
      const u = Math.max(0, g.life / GEOM_FADE_SEC);
      const blink = Math.floor(t * (10 + (1 - u) * 18)) % 2 === 0 ? 1 : 0.28;
      alpha = (0.25 + 0.75 * u) * blink;
    } else if (lifeFrac < 0.45) {
      alpha = 0.55 + 0.45 * ((lifeFrac - 0.2) / 0.25);
      alpha = Math.max(0.55, Math.min(1, alpha));
    }

    const pulse = 0.85 + 0.15 * Math.sin(t * 10 + g.x * 0.12);
    const bob = Math.sin(t * 6 + g.y * 0.08) * 1.1;
    const s = Math.max(3.2, g.r * pulse * (GFX.GEOM_DRAW || 1.45));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(g.x, hoverY(g.y, bob));

    bloom(ctx, 0, 0, s * 2.8, COLORS.geom, 0.35 * alpha);

    ctx.beginPath();
    ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.geom;
    ctx.fill();
    ctx.strokeStyle = "#12101c";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.paper || "#fff4dc";
    ctx.fill();

    ctx.rotate(t * 2.2 + g.x * 0.05);
    ctx.strokeStyle = colorWithAlpha("#12101c", 0.7);
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

/** Build enemy silhouette path at local origin (caller sets transform). */
function enemySilhouettePath(ctx, e, t = 0) {
  if (e.type === "wanderer") {
    const s = e.r;
    const wob = 1 + 0.04 * Math.sin(t * 6 + e.phase);
    ctx.beginPath();
    ctx.rect(-s * wob, -s * wob, s * 2 * wob, s * 2 * wob);
  } else if (e.type === "diamond") {
    const s = e.r * (1 + 0.05 * Math.sin(t * 10 + e.spin));
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.rect(-s, -s, s * 2, s * 2);
  } else if (e.type === "pink") {
    const s = e.r * (e.dashing > 0 ? 1.15 : 1);
    const stretch = e.dashing > 0 ? 1.25 : 1;
    ctx.scale(stretch, 1 / stretch);
    ctx.beginPath();
    ctx.rect(-s, -s, s * 2, s * 2);
  } else if (e.type === "spinner") {
    const s = e.r;
    ctx.rotate(e.spin || 0);
    ctx.beginPath();
    for (let arm = 0; arm < 3; arm++) {
      const a0 = (arm * Math.PI * 2) / 3;
      const c = Math.cos(a0);
      const s0 = Math.sin(a0);
      // Approximate spinner arm as diamond lobe for outline
      const x1 = c * s * 1.1;
      const y1 = s0 * s * 1.1;
      const x2 = c * -s * 0.35 - s0 * s * 0.4;
      const y2 = s0 * -s * 0.35 + c * s * 0.4;
      const x3 = c * -s * 0.15;
      const y3 = s0 * -s * 0.15;
      const x4 = c * -s * 0.35 + s0 * s * 0.4;
      const y4 = s0 * -s * 0.35 - c * s * 0.4;
      if (arm === 0) ctx.moveTo(x1, y1);
      else ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.lineTo(x4, y4);
    }
    ctx.closePath();
  } else if (e.type === "splitter" || e.type === "splitterChild") {
    const s = e.r;
    ctx.rotate(e.spin || 0);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s, 0);
    ctx.closePath();
  } else if (e.type === "void") {
    const s = e.r;
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
  } else if (e.type === "atom") {
    const s = e.r * (1 + 0.1 * Math.sin(t * 12 + e.spin));
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
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
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
  }
}

/** Sektori-style red wireframe telegraph before enemy solidifies. */
function drawEnemyOutline(ctx, e, t = 0) {
  const enter = e.enter != null ? e.enter : 0;
  const outlineEnd = GFX.ENEMY_OUTLINE_END ?? 0.58;
  const u = outlineEnd > 0 ? Math.min(1, enter / outlineEnd) : 1;
  // Faster flash near solidify so the pop is obvious
  const flashHz = 10 + u * 14;
  const pulse = 0.5 + 0.5 * Math.sin(t * flashHz + (e.phase || 0));
  const bob = Math.sin(t * 4.2 + (e.phase || 0)) * 0.6;
  const scale = 1.05 + pulse * 0.08; // slight size pop so outlines read at a glance

  ctx.save();
  ctx.translate(e.x, hoverY(e.y, bob));
  ctx.rotate(e.angle || 0);
  const vis = scale * (GFX.ENEMY_DRAW || 1.22);
  ctx.scale(vis, vis);
  // Full size silhouette — outline is the threat shape
  enemySilhouettePath(ctx, e, t);

const a = 0.75 + 0.25 * pulse;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (GFX.FANCY_NEON === false) {
    // Mobile: one thick danger stroke — still reads as telegraph
    ctx.strokeStyle = colorWithAlpha(COLORS.danger, a);
    ctx.lineWidth = 4.2;
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "#12101c";
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.strokeStyle = colorWithAlpha(COLORS.danger, a);
  ctx.lineWidth = 3.2;
  ctx.stroke();

  bloom(ctx, 0, 0, e.r * 3.2, COLORS.danger, 0.42 * pulse);
  ctx.restore();
}

export function drawEnemies(ctx, enemies, t = 0) {
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.type === "snake") {
      drawSnake(ctx, e, t);
      continue;
    }

    const enter = e.enter != null ? e.enter : 1;
    const outlineEnd = GFX.ENEMY_OUTLINE_END ?? 0.38;

    // Phase A: red outline only (Sektori telegraph)
    if (enter < outlineEnd) {
      drawEnemyOutline(ctx, e, t);
      continue;
    }

    // Phase B: solidify — scale from ~0.85→1 and fade fill in
    const solidU = Math.min(1, (enter - outlineEnd) / Math.max(0.001, 1 - outlineEnd));
    const scale = 0.85 + 0.15 * solidU;
    const bob = Math.sin(t * 4.2 + e.phase) * 1.4 * solidU;

    ctx.save();
    ctx.translate(e.x, hoverY(e.y, bob));
    ctx.rotate(e.angle);
    ctx.scale(scale * (GFX.ENEMY_DRAW || 1.22), scale * (GFX.ENEMY_DRAW || 1.22));
    ctx.globalAlpha = 0.55 + 0.45 * solidU;

    bloom(ctx, 0, 0, e.r * 2.2, e.color, 0.28 * solidU);

    const hpFrac = e.hp / e.maxHp;

    if (e.type === "wanderer") {
      const s = e.r;
      const wob = 1 + 0.04 * Math.sin(t * 6 + e.phase);
      ctx.beginPath();
      ctx.rect(-s * wob, -s * wob, s * 2 * wob, s * 2 * wob);
      neonFillStroke(ctx, colorWithAlpha(e.color, 0.82), e.color, 2.2);
    } else if (e.type === "diamond") {
      const s = e.r * (1 + 0.05 * Math.sin(t * 10 + e.spin));
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-s, -s, s * 2, s * 2);
      neonFillStroke(ctx, colorWithAlpha(e.color, 0.82), e.color, 2.2);
    } else if (e.type === "pink") {
      // Classic aggressive pink square
      const s = e.r * (e.dashing > 0 ? 1.15 : 1);
      const stretch = e.dashing > 0 ? 1.25 : 1;
      ctx.scale(stretch, 1 / stretch);
      ctx.beginPath();
      ctx.rect(-s, -s, s * 2, s * 2);
      neonFillStroke(ctx, colorWithAlpha(e.color, e.dashing > 0 ? 0.95 : 0.82), e.color, 2.3);
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
        neonFillStroke(ctx, colorWithAlpha(e.color, 0.82), e.color, 1.8);
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
      neonFillStroke(ctx, colorWithAlpha(e.color, 0.82), e.color, e.type === "splitter" ? 2.4 : 1.8);
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
      neonFillStroke(ctx, colorWithAlpha(e.color, 0.85), e.color, 1.6);
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
      neonFillStroke(ctx, colorWithAlpha(e.color, 0.7 + 0.2 * hpFrac), e.color, 2.6);
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
  const outlineEnd = GFX.ENEMY_OUTLINE_END ?? 0.38;
  const lift = (s, i) => hoverY(s.y, Math.sin(t * 5 + i) * 1.2);

  // Outline telegraph: red wireframe spine + segment strokes
  if (enter < outlineEnd) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 16 + (e.phase || 0));
    const a = 0.5 + 0.4 * pulse;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = colorWithAlpha(COLORS.danger, a * 0.55);
    ctx.lineWidth = 7;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < segs.length; i++) {
      const hy = lift(segs[i], i);
      if (i === 0) ctx.moveTo(segs[i].x, hy);
      else ctx.lineTo(segs[i].x, hy);
    }
    ctx.stroke();
    ctx.strokeStyle = colorWithAlpha(COLORS.danger, a);
    ctx.lineWidth = 2.2;
    ctx.stroke();
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i];
      const size = i === 0 ? e.r : s.r;
      ctx.save();
      ctx.translate(s.x, lift(s, i));
      ctx.rotate((e.spin || 0) + i * 0.35 + t);
      ctx.beginPath();
      ctx.moveTo(size * 1.1, 0);
      ctx.lineTo(0, size * 0.75);
      ctx.lineTo(-size, 0);
      ctx.lineTo(0, -size * 0.75);
      ctx.closePath();
      ctx.strokeStyle = colorWithAlpha(COLORS.danger, a * (i === 0 ? 1 : 0.65));
      ctx.lineWidth = i === 0 ? 2.2 : 1.4;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  const solidU = Math.min(1, (enter - outlineEnd) / Math.max(0.001, 1 - outlineEnd));

  // Glowing spine (hovering)
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.55 + 0.45 * solidU;
  ctx.strokeStyle = colorWithAlpha(e.color, 0.35 * solidU);
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
  ctx.strokeStyle = colorWithAlpha(e.color, 0.7 * solidU);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    const size = (i === 0 ? e.r : s.r) * (0.9 + 0.1 * solidU);
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * solidU;
    ctx.translate(s.x, lift(s, i));
    ctx.rotate((e.spin || 0) + i * 0.35 + t);
    bloom(ctx, 0, 0, size * 2, e.color, i === 0 ? 0.4 : 0.2);
    ctx.beginPath();
    ctx.moveTo(size * 1.1, 0);
    ctx.lineTo(0, size * 0.75);
    ctx.lineTo(-size, 0);
    ctx.lineTo(0, -size * 0.75);
    ctx.closePath();
    neonFillStroke(ctx, colorWithAlpha(e.color, i === 0 ? 0.9 : 0.75), e.color, i === 0 ? 2.2 : 1.4);
    ctx.restore();
  }
}

export function drawBombFlash(ctx, flash) {
  if (!flash || flash <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const reduced = !!GFX.REDUCED_FLASH;
  const a = Math.min(1, flash) * (reduced ? 0.22 : 0.45);
  ctx.fillStyle = `rgba(255, 244, 220, ${a * 0.28})`;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  const g = ctx.createRadialGradient(
    WORLD_W / 2,
    WORLD_H / 2,
    10,
    WORLD_W / 2,
    WORLD_H / 2,
    WORLD_W * 0.75
  );
  g.addColorStop(0, `rgba(255,244,220,${a * 0.55})`);
  g.addColorStop(0.35, `rgba(255,210,58,${a * 0.22})`);
  g.addColorStop(1, "rgba(255,210,58,0)");
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

/** Path Cross Gates — pulsing rings. Next gate is brighter. */
export function drawCheckpoints(ctx, checkpoints, nextIndex, time = 0) {
  if (!checkpoints || !checkpoints.length) return;
  const t = time || 0;
  for (let i = 0; i < checkpoints.length; i++) {
    const cp = checkpoints[i];
    const zone = cp?.zone;
    if (!zone) continue;
    const done = i < nextIndex;
    const next = i === nextIndex;
    const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * (next ? 6 : 3) + i));
    const a = done ? 0.22 : next ? 0.55 + 0.35 * pulse : 0.28;
    const col = done ? COLORS.playerGlow : COLORS.danger;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.r || 70, 0, Math.PI * 2);
    ctx.strokeStyle = colorWithAlpha(col, a);
    ctx.lineWidth = next ? 3.4 : 1.8;
    ctx.setLineDash(done ? [4, 8] : [10, 8]);
    ctx.lineDashOffset = -t * (next ? 40 : 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, 4 + (next ? pulse * 3 : 0), 0, Math.PI * 2);
    ctx.fillStyle = colorWithAlpha(col, a);
    ctx.fill();
    if (cp.label && next) {
      ctx.font = "700 12px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = colorWithAlpha("#fff", 0.85);
      ctx.fillText(cp.label, zone.x, zone.y - (zone.r || 70) - 8);
    }
    ctx.restore();
  }
}

export function drawAimReticle(ctx, rx, ry, shipX, shipY) {
  const hy = hoverY(shipY);
  const hry = hoverY(ry, 2);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = colorWithAlpha("#12101c", 0.5);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(shipX, hy);
  ctx.lineTo(rx, hry);
  ctx.stroke();
  ctx.strokeStyle = colorWithAlpha(COLORS.player, 0.7);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(shipX, hy);
  ctx.lineTo(rx, hry);
  ctx.stroke();

  bloom(ctx, rx, hry, 12, COLORS.player, 0.35);
  ctx.strokeStyle = "#12101c";
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
