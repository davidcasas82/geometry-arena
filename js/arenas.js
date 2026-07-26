/**
 * Arena topologies for Classic + Arena Path.
 * Design lock: docs/LEVELS_DESIGN.md
 *
 * Classic endless uses createArena({ topology: "rect" }) → full WORLD_W×WORLD_H.
 * Path levels pass level.arena; playable solids live inside the same sim space
 * so camera / canvas stay 1600×900 unless params override worldW/worldH.
 */

import { COLORS, WORLD_H, WORLD_W } from "./constants.js";
import { clamp } from "./physics.js";
import { bloom, colorWithAlpha, neonStroke } from "./fx.js";

/** @typedef {"rect"|"rect_tight"|"rect_wide"|"donut"|"corridor"|"cross"|"pill_2d"|"wrap_torus"|"split"} TopologyId */

/**
 * @typedef {object} ArenaInstance
 * @property {TopologyId} topology
 * @property {number} worldW
 * @property {number} worldH
 * @property {{ x:number, y:number, w:number, h:number }} playableBounds
 * @property {object} params
 * @property {boolean} wraps
 * @property {number} cx
 * @property {number} cy
 */

/** Default knobs per topology (overridden by level.arena.params). */
export const TOPOLOGY_DEFAULTS = Object.freeze({
  rect: Object.freeze({}),
  rect_tight: Object.freeze({ width: 1100, height: 700 }),
  rect_wide: Object.freeze({ width: 1500, height: 620 }),
  donut: Object.freeze({ innerR: 150, outerMargin: 40 }),
  corridor: Object.freeze({ axis: "x", halfWidth: 168 }),
  cross: Object.freeze({ armHalfWidth: 180 }),
  pill_2d: Object.freeze({ width: 1400, height: 520 }),
  wrap_torus: Object.freeze({}),
  split: Object.freeze({ gap: 160, wallThickness: 48, axis: "y" }),
});

const SPAWN_MARGIN = 48;

/**
 * @param {{ topology?: TopologyId|string, params?: object }|null|undefined} arenaRef
 * @returns {ArenaInstance}
 */
export function createArena(arenaRef = null) {
  const topology = /** @type {TopologyId} */ (
    (arenaRef && arenaRef.topology) || "rect"
  );
  const base = TOPOLOGY_DEFAULTS[topology] || TOPOLOGY_DEFAULTS.rect;
  const params = { ...base, ...(arenaRef && arenaRef.params ? arenaRef.params : {}) };

  const worldW = Number(params.worldW) > 0 ? Number(params.worldW) : WORLD_W;
  const worldH = Number(params.worldH) > 0 ? Number(params.worldH) : WORLD_H;
  const cx = worldW * 0.5;
  const cy = worldH * 0.5;
  const wraps = topology === "wrap_torus";

  /** @type {{ x:number, y:number, w:number, h:number }} */
  let playableBounds = { x: 0, y: 0, w: worldW, h: worldH };

  if (topology === "rect_tight") {
    const w = Math.min(worldW, Number(params.width) || 1100);
    const h = Math.min(worldH, Number(params.height) || 700);
    playableBounds = { x: cx - w * 0.5, y: cy - h * 0.5, w, h };
  } else if (topology === "rect_wide") {
    const w = Math.min(worldW, Number(params.width) || worldW * 0.94);
    const h = Math.min(worldH, Number(params.height) || 620);
    playableBounds = { x: cx - w * 0.5, y: cy - h * 0.5, w, h };
  } else if (topology === "donut") {
    const m = Math.max(0, Number(params.outerMargin) || 40);
    playableBounds = { x: m, y: m, w: worldW - m * 2, h: worldH - m * 2 };
  } else if (topology === "corridor") {
    const axis = params.axis === "y" ? "y" : "x";
    const half = Math.max(40, Number(params.halfWidth) || 168);
    if (axis === "x") {
      playableBounds = { x: 0, y: cy - half, w: worldW, h: half * 2 };
    } else {
      playableBounds = { x: cx - half, y: 0, w: half * 2, h: worldH };
    }
  } else if (topology === "cross") {
    const arm = Math.max(60, Number(params.armHalfWidth) || 180);
    // AABB of the plus (full extent); solid tests use the cross mask
    playableBounds = { x: 0, y: 0, w: worldW, h: worldH };
    params._armHalfWidth = arm;
  } else if (topology === "pill_2d") {
    const w = Math.min(worldW, Number(params.width) || 1400);
    const h = Math.min(worldH, Number(params.height) || 520);
    playableBounds = { x: cx - w * 0.5, y: cy - h * 0.5, w, h };
  } else if (topology === "split") {
    playableBounds = { x: 0, y: 0, w: worldW, h: worldH };
  } else if (topology === "wrap_torus") {
    playableBounds = { x: 0, y: 0, w: worldW, h: worldH };
  }

  return {
    topology,
    worldW,
    worldH,
    playableBounds,
    params,
    wraps,
    cx,
    cy,
  };
}

/** Convenience: Classic default arena. */
export function createDefaultArena() {
  return createArena({ topology: "rect" });
}

/**
 * True if circle center is in the open playable region (ignoring radius).
 * @param {ArenaInstance} arena
 * @param {number} x
 * @param {number} y
 */
export function isInsidePlayable(arena, x, y) {
  if (!arena) return true;
  if (arena.wraps) {
    return x >= 0 && y >= 0 && x <= arena.worldW && y <= arena.worldH;
  }
  return !pointInSolid(arena, x, y);
}

/**
 * True if circle overlaps solid (wall / hole / outside shape).
 * @param {ArenaInstance} arena
 * @param {number} x
 * @param {number} y
 * @param {number} [r=0]
 */
export function hitsSolid(arena, x, y, r = 0) {
  if (!arena || arena.wraps) return false;
  if (r <= 0) return pointInSolid(arena, x, y);

  // Sample center + cardinals on the circle rim (cheap, good enough for ship/enemies)
  if (pointInSolid(arena, x, y)) return true;
  const s = r * 0.92;
  return (
    pointInSolid(arena, x + s, y) ||
    pointInSolid(arena, x - s, y) ||
    pointInSolid(arena, x, y + s) ||
    pointInSolid(arena, x, y - s) ||
    pointInSolid(arena, x + s * 0.7, y + s * 0.7) ||
    pointInSolid(arena, x - s * 0.7, y + s * 0.7) ||
    pointInSolid(arena, x + s * 0.7, y - s * 0.7) ||
    pointInSolid(arena, x - s * 0.7, y - s * 0.7)
  );
}

/**
 * Project a point (+radius clearance) into playable space.
 * Torus wraps; others push out of solids toward open space.
 * @param {ArenaInstance} arena
 * @param {number} x
 * @param {number} y
 * @param {number} [r=0]
 * @returns {{ x:number, y:number }}
 */
export function clampEntity(arena, x, y, r = 0) {
  if (!arena) return { x, y };

  if (arena.wraps) {
    return wrapPosition(arena, x, y);
  }

  let px = x;
  let py = y;
  const topology = arena.topology;

  // Fast path: pure AABB topologies
  if (
    topology === "rect" ||
    topology === "rect_tight" ||
    topology === "rect_wide" ||
    topology === "corridor"
  ) {
    const b = arena.playableBounds;
    return {
      x: clamp(px, b.x + r, b.x + b.w - r),
      y: clamp(py, b.y + r, b.y + b.h - r),
    };
  }

  if (topology === "donut") {
    const b = arena.playableBounds;
    px = clamp(px, b.x + r, b.x + b.w - r);
    py = clamp(py, b.y + r, b.y + b.h - r);
    const innerR = Math.max(20, Number(arena.params.innerR) || 150) + r;
    const dx = px - arena.cx;
    const dy = py - arena.cy;
    const d = Math.hypot(dx, dy);
    if (d < innerR && d > 1e-6) {
      const s = innerR / d;
      px = arena.cx + dx * s;
      py = arena.cy + dy * s;
    } else if (d <= 1e-6) {
      px = arena.cx + innerR;
      py = arena.cy;
    }
    return { x: px, y: py };
  }

  if (topology === "pill_2d") {
    return clampToCapsule(arena, px, py, r);
  }

  if (topology === "cross") {
    return clampToCross(arena, px, py, r);
  }

  if (topology === "split") {
    return clampToSplit(arena, px, py, r);
  }

  // Fallback: world AABB
  return {
    x: clamp(px, r, arena.worldW - r),
    y: clamp(py, r, arena.worldH - r),
  };
}

/**
 * Mutate entity.x/y into playable space (and zero wall-normal velocity if provided).
 * @param {{ x:number, y:number, r?:number, vx?:number, vy?:number }} entity
 * @param {ArenaInstance} arena
 */
export function clampEntityObject(entity, arena) {
  if (!entity || !arena) return entity;
  const r = entity.r || 0;
  const beforeX = entity.x;
  const beforeY = entity.y;
  const p = clampEntity(arena, entity.x, entity.y, r);
  entity.x = p.x;
  entity.y = p.y;
  if (arena.wraps) return entity;
  // Kill velocity into the wall so thrusters don't stick
  if (typeof entity.vx === "number" && Math.abs(p.x - beforeX) > 1e-6) {
    if ((p.x > beforeX && entity.vx < 0) || (p.x < beforeX && entity.vx > 0)) {
      entity.vx = 0;
    }
  }
  if (typeof entity.vy === "number" && Math.abs(p.y - beforeY) > 1e-6) {
    if ((p.y > beforeY && entity.vy < 0) || (p.y < beforeY && entity.vy > 0)) {
      entity.vy = 0;
    }
  }
  return entity;
}

/**
 * Toroidal wrap into [0, world).
 * @param {ArenaInstance} arena
 * @param {number} x
 * @param {number} y
 */
export function wrapPosition(arena, x, y) {
  const w = arena?.worldW ?? WORLD_W;
  const h = arena?.worldH ?? WORLD_H;
  let nx = x;
  let ny = y;
  // Support negative and large overshoot
  nx = ((nx % w) + w) % w;
  ny = ((ny % h) + h) % h;
  return { x: nx, y: ny };
}

/**
 * Edge spawn outside the playable rim (or on torus rim).
 * side: 0=top 1=bottom 2=left 3=right
 * @param {ArenaInstance} arena
 * @param {() => number} [rng]
 * @returns {{ x:number, y:number, side:number }}
 */
export function pickSpawnEdge(arena, rng = Math.random) {
  const a = arena || createDefaultArena();
  const side = Math.floor(rng() * 4);
  const u = 0.12 + rng() * 0.76;
  const b = a.playableBounds;
  const m = SPAWN_MARGIN;

  // Prefer playable AABB edges so corridor/tight spawn into the lane
  if (
    a.topology === "corridor" ||
    a.topology === "rect_tight" ||
    a.topology === "rect_wide" ||
    a.topology === "pill_2d"
  ) {
    if (side === 0) return { x: b.x + u * b.w, y: b.y - m, side };
    if (side === 1) return { x: b.x + u * b.w, y: b.y + b.h + m, side };
    if (side === 2) return { x: b.x - m, y: b.y + u * b.h, side };
    return { x: b.x + b.w + m, y: b.y + u * b.h, side };
  }

  if (a.topology === "cross") {
    const arm = Math.max(60, Number(a.params.armHalfWidth || a.params._armHalfWidth) || 180);
    // Spawn on outer arms so enemies enter the plus
    if (side === 0) return { x: a.cx + (u - 0.5) * arm * 1.6, y: -m, side };
    if (side === 1) return { x: a.cx + (u - 0.5) * arm * 1.6, y: a.worldH + m, side };
    if (side === 2) return { x: -m, y: a.cy + (u - 0.5) * arm * 1.6, side };
    return { x: a.worldW + m, y: a.cy + (u - 0.5) * arm * 1.6, side };
  }

  if (a.topology === "split") {
    const axis = a.params.axis === "x" ? "x" : "y";
    // Bias left/right (or top/bottom) chambers
    if (axis === "y") {
      if (side === 2) return { x: -m, y: u * a.worldH, side };
      if (side === 3) return { x: a.worldW + m, y: u * a.worldH, side };
      // top/bottom still valid near outer rim
      return side === 0
        ? { x: u * a.worldW, y: -m, side }
        : { x: u * a.worldW, y: a.worldH + m, side };
    }
    if (side === 0) return { x: u * a.worldW, y: -m, side };
    if (side === 1) return { x: u * a.worldW, y: a.worldH + m, side };
    return side === 2
      ? { x: -m, y: u * a.worldH, side }
      : { x: a.worldW + m, y: u * a.worldH, side };
  }

  // rect / donut / wrap_torus / default — world edges
  if (side === 0) return { x: u * a.worldW, y: -m, side };
  if (side === 1) return { x: u * a.worldW, y: a.worldH + m, side };
  if (side === 2) return { x: -m, y: u * a.worldH, side };
  return { x: a.worldW + m, y: u * a.worldH, side };
}

/**
 * Random point inside playable open space.
 * @param {ArenaInstance} arena
 * @param {() => number} [rng]
 * @param {number} [r=0] clearance radius
 * @returns {{ x:number, y:number }}
 */
export function randomPlayablePoint(arena, rng = Math.random, r = 0) {
  const a = arena || createDefaultArena();
  const b = a.playableBounds;

  for (let attempt = 0; attempt < 48; attempt++) {
    let x;
    let y;
    if (a.topology === "cross") {
      const arm = Math.max(60, Number(a.params.armHalfWidth || a.params._armHalfWidth) || 180);
      // Mix hub + arms
      if (rng() < 0.45) {
        x = a.cx + (rng() - 0.5) * arm * 1.6;
        y = a.cy + (rng() - 0.5) * arm * 1.6;
      } else if (rng() < 0.5) {
        x = r + rng() * (a.worldW - 2 * r);
        y = a.cy + (rng() - 0.5) * arm * 1.5;
      } else {
        x = a.cx + (rng() - 0.5) * arm * 1.5;
        y = r + rng() * (a.worldH - 2 * r);
      }
    } else if (a.topology === "donut") {
      const innerR = Math.max(20, Number(a.params.innerR) || 150) + r + 8;
      const ang = rng() * Math.PI * 2;
      const maxR = Math.min(b.w, b.h) * 0.5 - r - 8;
      const rad = innerR + rng() * Math.max(10, maxR - innerR);
      x = a.cx + Math.cos(ang) * rad;
      y = a.cy + Math.sin(ang) * rad;
    } else if (a.topology === "pill_2d") {
      x = b.x + r + rng() * Math.max(1, b.w - 2 * r);
      y = b.y + r + rng() * Math.max(1, b.h - 2 * r);
    } else if (a.topology === "split") {
      x = r + rng() * (a.worldW - 2 * r);
      y = r + rng() * (a.worldH - 2 * r);
    } else {
      x = b.x + r + rng() * Math.max(1, b.w - 2 * r);
      y = b.y + r + rng() * Math.max(1, b.h - 2 * r);
    }

    const c = clampEntity(a, x, y, r);
    if (!hitsSolid(a, c.x, c.y, r)) return c;
  }

  // Fallback: center of playable AABB (clamped)
  return clampEntity(a, a.cx, a.cy, r);
}

/**
 * Draw solid guides / walls into world-space ctx (camera already applied).
 * @param {CanvasRenderingContext2D} ctx
 * @param {ArenaInstance} arena
 * @param {{ time?: number, cam?: object }|object} [opts]
 */
export function drawArena(ctx, arena, opts = {}) {
  if (!arena || !ctx) return;
  const t = opts.time || 0;
  const topology = arena.topology;

  // rect / wrap: rim is already drawn by drawGrid — optional subtle torus cue
  if (topology === "rect") return;

  if (topology === "wrap_torus") {
    drawTorusCues(ctx, arena, t);
    return;
  }

  ctx.save();

  if (topology === "rect_tight" || topology === "rect_wide" || topology === "corridor") {
    drawAabbWalls(ctx, arena.playableBounds, t);
    dimOutsideAabb(ctx, arena, arena.playableBounds);
  } else if (topology === "donut") {
    drawAabbWalls(ctx, arena.playableBounds, t);
    dimOutsideAabb(ctx, arena, arena.playableBounds);
    drawDonutHole(ctx, arena, t);
  } else if (topology === "cross") {
    drawCrossSolids(ctx, arena, t);
  } else if (topology === "pill_2d") {
    drawPillGuide(ctx, arena, t);
    dimOutsidePill(ctx, arena);
  } else if (topology === "split") {
    drawSplitWall(ctx, arena, t);
  }

  ctx.restore();
}

/**
 * Sektori-style red danger telegraph: regions that will become solid when
 * `nextArena` commits. Flash rate accelerates as progress → 1.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {ArenaInstance} current
 * @param {ArenaInstance} next
 * @param {number} progress 0..1 through warn window
 * @param {number} [t=0] world time for flicker phase
 */
export function drawMorphDanger(ctx, current, next, progress = 0, t = 0) {
  if (!ctx || !current || !next) return;
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0) return;
  // Accelerate flash: 4Hz → 14Hz
  const hz = 4 + p * 10;
  const flash = 0.5 + 0.5 * Math.sin(t * hz * Math.PI * 2);
  const reduced = false; // caller can dim via alpha; keep full for telegraph honesty
  const fillA = (0.1 + p * 0.22) * (0.55 + 0.45 * flash);
  const edgeA = (0.45 + p * 0.5) * (0.65 + 0.35 * flash);

  const W = current.worldW;
  const H = current.worldH;
  const step = 28;

  ctx.save();
  // Sample grid cells that are open now but solid after morph
  for (let y = step * 0.5; y < H; y += step) {
    for (let x = step * 0.5; x < W; x += step) {
      const nowSolid = pointInSolid(current, x, y);
      const nextSolid = pointInSolid(next, x, y);
      if (!nowSolid && nextSolid) {
        ctx.fillStyle = colorWithAlpha(COLORS.danger, fillA);
        ctx.fillRect(x - step * 0.5, y - step * 0.5, step + 0.5, step + 0.5);
      }
    }
  }

  // Hard edge strokes of next playable AABB when applicable
  ctx.globalCompositeOperation = "lighter";
  const nb = next.playableBounds;
  if (
    next.topology === "rect_tight" ||
    next.topology === "rect_wide" ||
    next.topology === "corridor" ||
    next.topology === "pill_2d"
  ) {
    ctx.strokeStyle = colorWithAlpha(COLORS.danger, edgeA);
    ctx.lineWidth = 3 + flash * 2;
    ctx.strokeRect(nb.x, nb.y, nb.w, nb.h);
    ctx.strokeStyle = `rgba(255, 200, 210, ${edgeA * 0.55})`;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(nb.x, nb.y, nb.w, nb.h);
    // Outer death slabs get a second rim
    bloom(ctx, nb.x + nb.w * 0.5, nb.y, 80, COLORS.danger, 0.12 * flash * p);
    bloom(ctx, nb.x + nb.w * 0.5, nb.y + nb.h, 80, COLORS.danger, 0.12 * flash * p);
  } else if (next.topology === "cross") {
    const arm = Math.max(60, Number(next.params.armHalfWidth || next.params._armHalfWidth) || 180);
    ctx.strokeStyle = colorWithAlpha(COLORS.danger, edgeA);
    ctx.lineWidth = 3 + flash * 2;
    // Horizontal arm bounds
    ctx.beginPath();
    ctx.moveTo(0, next.cy - arm);
    ctx.lineTo(W, next.cy - arm);
    ctx.moveTo(0, next.cy + arm);
    ctx.lineTo(W, next.cy + arm);
    // Vertical arm bounds
    ctx.moveTo(next.cx - arm, 0);
    ctx.lineTo(next.cx - arm, H);
    ctx.moveTo(next.cx + arm, 0);
    ctx.lineTo(next.cx + arm, H);
    ctx.stroke();
  } else if (next.topology === "rect") {
    // Expanding back to full rect — flash world rim as safe return
    ctx.strokeStyle = colorWithAlpha(COLORS.danger, edgeA * 0.7);
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, W - 8, H - 8);
  }

  // Screen-edge danger vignette during late warn
  if (p > 0.35) {
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.72);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(0.7, "rgba(0,0,0,0)");
    v.addColorStop(1, colorWithAlpha(COLORS.danger, (p - 0.35) * 0.35 * flash));
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
  void reduced;
}

// ── Internal geometry ────────────────────────────────────────

function pointInSolid(arena, x, y) {
  const { topology, worldW, worldH, playableBounds: b, cx, cy, params } = arena;

  if (topology === "wrap_torus") return false;

  if (topology === "rect") {
    return x < 0 || y < 0 || x > worldW || y > worldH;
  }

  if (topology === "rect_tight" || topology === "rect_wide" || topology === "corridor") {
    return x < b.x || y < b.y || x > b.x + b.w || y > b.y + b.h;
  }

  if (topology === "donut") {
    if (x < b.x || y < b.y || x > b.x + b.w || y > b.y + b.h) return true;
    const innerR = Math.max(20, Number(params.innerR) || 150);
    const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    return d2 < innerR * innerR;
  }

  if (topology === "cross") {
    const arm = Math.max(60, Number(params.armHalfWidth || params._armHalfWidth) || 180);
    const inH = Math.abs(y - cy) <= arm;
    const inV = Math.abs(x - cx) <= arm;
    // Outside world is solid; inside world but outside plus is solid
    if (x < 0 || y < 0 || x > worldW || y > worldH) return true;
    return !(inH || inV);
  }

  if (topology === "pill_2d") {
    return !pointInCapsule(arena, x, y);
  }

  if (topology === "split") {
    if (x < 0 || y < 0 || x > worldW || y > worldH) return true;
    return pointInSplitWall(arena, x, y);
  }

  return x < 0 || y < 0 || x > worldW || y > worldH;
}

function pointInCapsule(arena, x, y) {
  const b = arena.playableBounds;
  const hw = b.w * 0.5;
  const hh = b.h * 0.5;
  const r = Math.min(hw, hh);
  const cx = arena.cx;
  const cy = arena.cy;
  // Stadium: rect body + semicircular caps along the long axis
  if (b.w >= b.h) {
    const bodyHalf = hw - r;
    const qx = clamp(x, cx - bodyHalf, cx + bodyHalf);
    const dx = x - qx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  }
  const bodyHalf = hh - r;
  const qy = clamp(y, cy - bodyHalf, cy + bodyHalf);
  const dx = x - cx;
  const dy = y - qy;
  return dx * dx + dy * dy <= r * r;
}

function clampToCapsule(arena, x, y, rad) {
  let px = x;
  let py = y;
  // Already clear of solids with radius clearance
  if (!hitsSolid(arena, px, py, rad) && pointInCapsule(arena, px, py)) {
    return { x: px, y: py };
  }
  return projectOutOfSolid(arena, px, py, rad);
}

function clampToCross(arena, x, y, r) {
  const arm = Math.max(60, Number(arena.params.armHalfWidth || arena.params._armHalfWidth) || 180);
  const cx = arena.cx;
  const cy = arena.cy;
  let px = clamp(x, r, arena.worldW - r);
  let py = clamp(y, r, arena.worldH - r);

  const inH = Math.abs(py - cy) <= arm - r;
  const inV = Math.abs(px - cx) <= arm - r;
  if (inH || inV) return { x: px, y: py };

  // Push to nearest arm
  const toH = Math.abs(py - cy); // vertical distance to horizontal arm centerline
  const toV = Math.abs(px - cx);
  if (toH < toV) {
    // Snap into horizontal arm
    py = cy + Math.sign(py - cy || 1) * Math.max(0, arm - r);
    // Keep x free within world
  } else {
    px = cx + Math.sign(px - cx || 1) * Math.max(0, arm - r);
  }
  // If still in a corner pocket, pull to hub edge
  const stillOut =
    Math.abs(py - cy) > arm - r + 0.5 && Math.abs(px - cx) > arm - r + 0.5;
  if (stillOut) {
    if (toH <= toV) px = clamp(px, cx - (arm - r), cx + (arm - r));
    else py = clamp(py, cy - (arm - r), cy + (arm - r));
  }
  return {
    x: clamp(px, r, arena.worldW - r),
    y: clamp(py, r, arena.worldH - r),
  };
}

function pointInSplitWall(arena, x, y) {
  const gap = Math.max(40, Number(arena.params.gap) || 160);
  const thick = Math.max(16, Number(arena.params.wallThickness) || 48);
  const axis = arena.params.axis === "x" ? "x" : "y";
  const halfGap = gap * 0.5;
  const halfT = thick * 0.5;

  if (axis === "y") {
    // Vertical divider (separates left/right chambers), gap centered
    if (Math.abs(x - arena.cx) > halfT) return false;
    return Math.abs(y - arena.cy) > halfGap;
  }
  // Horizontal divider (separates top/bottom)
  if (Math.abs(y - arena.cy) > halfT) return false;
  return Math.abs(x - arena.cx) > halfGap;
}

function clampToSplit(arena, x, y, r) {
  let px = clamp(x, r, arena.worldW - r);
  let py = clamp(y, r, arena.worldH - r);
  if (!hitsSolid(arena, px, py, r)) return { x: px, y: py };
  return projectOutOfSolid(arena, px, py, r);
}

/**
 * Generic gradient-ish push out of solid for awkward shapes.
 */
function projectOutOfSolid(arena, x, y, r) {
  let px = x;
  let py = y;
  // Seed toward center if deeply inside solid
  if (pointInSolid(arena, px, py)) {
    const dx = arena.cx - px;
    const dy = arena.cy - py;
    const d = Math.hypot(dx, dy) || 1;
    for (let i = 0; i < 24; i++) {
      px += (dx / d) * 12;
      py += (dy / d) * 12;
      if (!pointInSolid(arena, px, py)) break;
    }
  }

  for (let iter = 0; iter < 10; iter++) {
    if (!hitsSolid(arena, px, py, r)) break;
    // Sample neighborhood to estimate free direction
    let gx = 0;
    let gy = 0;
    const step = 6 + r * 0.15;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0.7, 0.7],
      [-0.7, 0.7],
      [0.7, -0.7],
      [-0.7, -0.7],
    ];
    for (const [dx, dy] of dirs) {
      const sx = px + dx * step;
      const sy = py + dy * step;
      if (!hitsSolid(arena, sx, sy, r)) {
        gx += dx;
        gy += dy;
      }
    }
    if (gx === 0 && gy === 0) {
      gx = arena.cx - px;
      gy = arena.cy - py;
    }
    const gl = Math.hypot(gx, gy) || 1;
    px += (gx / gl) * step;
    py += (gy / gl) * step;
    px = clamp(px, r, arena.worldW - r);
    py = clamp(py, r, arena.worldH - r);
  }

  // Final hard world clamp
  return {
    x: clamp(px, r, arena.worldW - r),
    y: clamp(py, r, arena.worldH - r),
  };
}

// ── Drawing helpers (neon) ───────────────────────────────────

function drawAabbWalls(ctx, b, t) {
  const pulse = 0.55 + Math.sin(t * 2.2) * 0.08;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Outer trench glow
  ctx.strokeStyle = colorWithAlpha(COLORS.playerGlow, 0.2 * pulse);
  ctx.lineWidth = 14;
  ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);

  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  neonStroke(ctx, COLORS.player, 1.6, 7, 0.32 * pulse);

  // Corner ticks
  const tick = 22;
  ctx.strokeStyle = colorWithAlpha("#ffffff", 0.45);
  ctx.lineWidth = 1.4;
  const corners = [
    [b.x, b.y, 1, 1],
    [b.x + b.w, b.y, -1, 1],
    [b.x, b.y + b.h, 1, -1],
    [b.x + b.w, b.y + b.h, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * tick);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * tick, y);
    ctx.stroke();
  }
  ctx.restore();
}

function dimOutsideAabb(ctx, arena, b) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 8, 0.55)";
  // four slabs around playable AABB within world
  const W = arena.worldW;
  const H = arena.worldH;
  ctx.fillRect(0, 0, W, Math.max(0, b.y));
  ctx.fillRect(0, b.y + b.h, W, Math.max(0, H - (b.y + b.h)));
  ctx.fillRect(0, b.y, Math.max(0, b.x), b.h);
  ctx.fillRect(b.x + b.w, b.y, Math.max(0, W - (b.x + b.w)), b.h);
  ctx.restore();
}

function drawDonutHole(ctx, arena, t) {
  const innerR = Math.max(20, Number(arena.params.innerR) || 150);
  const pulse = 0.5 + Math.sin(t * 2.6) * 0.1;
  ctx.save();
  // Solid void fill
  ctx.fillStyle = "rgba(0, 0, 6, 0.82)";
  ctx.beginPath();
  ctx.arc(arena.cx, arena.cy, innerR, 0, Math.PI * 2);
  ctx.fill();

  // Danger ring
  ctx.globalCompositeOperation = "lighter";
  bloom(ctx, arena.cx, arena.cy, innerR * 0.55, COLORS.danger, 0.12 * pulse);
  ctx.beginPath();
  ctx.arc(arena.cx, arena.cy, innerR, 0, Math.PI * 2);
  neonStroke(ctx, COLORS.danger, 1.8, 10, 0.4 * pulse);

  // Inner hatch ticks
  ctx.strokeStyle = colorWithAlpha(COLORS.danger, 0.25);
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + t * 0.15;
    ctx.beginPath();
    ctx.moveTo(arena.cx + Math.cos(a) * (innerR - 10), arena.cy + Math.sin(a) * (innerR - 10));
    ctx.lineTo(arena.cx + Math.cos(a) * (innerR - 2), arena.cy + Math.sin(a) * (innerR - 2));
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrossSolids(ctx, arena, t) {
  const arm = Math.max(60, Number(arena.params.armHalfWidth || arena.params._armHalfWidth) || 180);
  const cx = arena.cx;
  const cy = arena.cy;
  const W = arena.worldW;
  const H = arena.worldH;
  const pulse = 0.55 + Math.sin(t * 2) * 0.08;

  ctx.save();
  // Dim corner blocks
  ctx.fillStyle = "rgba(0, 0, 8, 0.62)";
  // TL
  ctx.fillRect(0, 0, cx - arm, cy - arm);
  // TR
  ctx.fillRect(cx + arm, 0, W - (cx + arm), cy - arm);
  // BL
  ctx.fillRect(0, cy + arm, cx - arm, H - (cy + arm));
  // BR
  ctx.fillRect(cx + arm, cy + arm, W - (cx + arm), H - (cy + arm));

  // Neon edges of the plus
  ctx.globalCompositeOperation = "lighter";
  const segs = [
    // horizontal arm outline
    [0, cy - arm, W, cy - arm],
    [0, cy + arm, W, cy + arm],
    // vertical arm outline
    [cx - arm, 0, cx - arm, H],
    [cx + arm, 0, cx + arm, H],
  ];
  // Only draw the free edges (clip-ish via path pieces at corners)
  // Horizontal top edge: left arm + right arm outside vertical band... keep simple full lines with dim corners already filled
  for (const [x0, y0, x1, y1] of segs) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    neonStroke(ctx, COLORS.player, 1.4, 6, 0.28 * pulse);
  }

  // Hub diamond cue
  ctx.beginPath();
  ctx.moveTo(cx, cy - 14);
  ctx.lineTo(cx + 14, cy);
  ctx.lineTo(cx, cy + 14);
  ctx.lineTo(cx - 14, cy);
  ctx.closePath();
  neonStroke(ctx, COLORS.playerGlow, 1.2, 5, 0.35 * pulse);
  ctx.restore();
}

function drawPillGuide(ctx, arena, t) {
  const b = arena.playableBounds;
  const pulse = 0.55 + Math.sin(t * 2.1) * 0.08;
  const r = Math.min(b.w, b.h) * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  roundRectPath(ctx, b.x, b.y, b.w, b.h, r);
  neonStroke(ctx, COLORS.player, 1.6, 8, 0.3 * pulse);
  ctx.restore();
}

function dimOutsidePill(ctx, arena) {
  const b = arena.playableBounds;
  const r = Math.min(b.w, b.h) * 0.5;
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 8, 0.55)";
  ctx.beginPath();
  ctx.rect(0, 0, arena.worldW, arena.worldH);
  roundRectPath(ctx, b.x, b.y, b.w, b.h, r);
  ctx.fill("evenodd");
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, rad) {
  const r = Math.min(rad, w * 0.5, h * 0.5);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSplitWall(ctx, arena, t) {
  const gap = Math.max(40, Number(arena.params.gap) || 160);
  const thick = Math.max(16, Number(arena.params.wallThickness) || 48);
  const axis = arena.params.axis === "x" ? "x" : "y";
  const halfGap = gap * 0.5;
  const halfT = thick * 0.5;
  const pulse = 0.55 + Math.sin(t * 2.4) * 0.1;

  ctx.save();
  ctx.fillStyle = "rgba(4, 8, 24, 0.92)";
  ctx.globalCompositeOperation = "source-over";

  if (axis === "y") {
    // Two vertical slabs with center gap
    const x0 = arena.cx - halfT;
    ctx.fillRect(x0, 0, thick, Math.max(0, arena.cy - halfGap));
    ctx.fillRect(x0, arena.cy + halfGap, thick, Math.max(0, arena.worldH - (arena.cy + halfGap)));

    ctx.globalCompositeOperation = "lighter";
    // Wall edges
    for (const y0 of [0, arena.cy + halfGap]) {
      const h =
        y0 === 0 ? arena.cy - halfGap : arena.worldH - (arena.cy + halfGap);
      if (h <= 0) continue;
      ctx.beginPath();
      ctx.rect(x0, y0, thick, h);
      neonStroke(ctx, COLORS.player, 1.3, 6, 0.3 * pulse);
    }
    // Gap mouth ticks
    ctx.beginPath();
    ctx.moveTo(x0 - 6, arena.cy - halfGap);
    ctx.lineTo(x0 + thick + 6, arena.cy - halfGap);
    ctx.moveTo(x0 - 6, arena.cy + halfGap);
    ctx.lineTo(x0 + thick + 6, arena.cy + halfGap);
    neonStroke(ctx, COLORS.playerGlow, 1.2, 5, 0.35 * pulse);
  } else {
    const y0 = arena.cy - halfT;
    ctx.fillRect(0, y0, Math.max(0, arena.cx - halfGap), thick);
    ctx.fillRect(arena.cx + halfGap, y0, Math.max(0, arena.worldW - (arena.cx + halfGap)), thick);

    ctx.globalCompositeOperation = "lighter";
    for (const x0 of [0, arena.cx + halfGap]) {
      const w =
        x0 === 0 ? arena.cx - halfGap : arena.worldW - (arena.cx + halfGap);
      if (w <= 0) continue;
      ctx.beginPath();
      ctx.rect(x0, y0, w, thick);
      neonStroke(ctx, COLORS.player, 1.3, 6, 0.3 * pulse);
    }
    ctx.beginPath();
    ctx.moveTo(arena.cx - halfGap, y0 - 6);
    ctx.lineTo(arena.cx - halfGap, y0 + thick + 6);
    ctx.moveTo(arena.cx + halfGap, y0 - 6);
    ctx.lineTo(arena.cx + halfGap, y0 + thick + 6);
    neonStroke(ctx, COLORS.playerGlow, 1.2, 5, 0.35 * pulse);
  }
  ctx.restore();
}

function drawTorusCues(ctx, arena, t) {
  const pulse = 0.4 + Math.sin(t * 1.8) * 0.1;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // Dashed wrap rim — edges are doors
  ctx.setLineDash([10, 14]);
  ctx.beginPath();
  ctx.rect(6, 6, arena.worldW - 12, arena.worldH - 12);
  neonStroke(ctx, COLORS.playerGlow, 1.2, 5, 0.22 * pulse);
  ctx.setLineDash([]);

  // Corner wrap arrows (simple chevrons)
  const m = 28;
  const tips = [
    [m, m],
    [arena.worldW - m, m],
    [m, arena.worldH - m],
    [arena.worldW - m, arena.worldH - m],
  ];
  ctx.strokeStyle = colorWithAlpha(COLORS.player, 0.35 * pulse);
  ctx.lineWidth = 1.5;
  for (const [x, y] of tips) {
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x, y - 8);
    ctx.lineTo(x + 8, y);
    ctx.stroke();
  }
  ctx.restore();
}
