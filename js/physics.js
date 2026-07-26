/** Movement helpers and circle–circle collision. */

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function len(x, y) {
  return Math.hypot(x, y);
}

export function normalize(x, y) {
  const l = Math.hypot(x, y);
  if (l < 1e-8) return { x: 0, y: 0 };
  return { x: x / l, y: y / l };
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const r = ar + br;
  return dist2(ax, ay, bx, by) <= r * r;
}

/** Keep entity inside world bounds, accounting for radius. */
export function clampToWorld(entity, worldW, worldH) {
  entity.x = clamp(entity.x, entity.r, worldW - entity.r);
  entity.y = clamp(entity.y, entity.r, worldH - entity.r);
}

/**
 * Keep entity inside an arena (topology-aware).
 * Falls back to axis-aligned world clamp when arena is missing.
 * Prefer this over bare clampToWorld when Path topologies are active.
 *
 * @param {{ x:number, y:number, r?:number, vx?:number, vy?:number }} entity
 * @param {{ topology?: string, worldW?: number, worldH?: number, wraps?: boolean }|null|undefined} arena
 * @param {typeof import('./arenas.js')} [arenasApi] optional arenas module (avoids hard cycle if inlined)
 */
export function clampToArena(entity, arena, arenasApi = null) {
  if (!entity) return;
  if (arena && arenasApi && typeof arenasApi.clampEntityObject === "function") {
    arenasApi.clampEntityObject(entity, arena);
    return;
  }
  if (arena && typeof arena.worldW === "number" && typeof arena.worldH === "number") {
    if (arena.wraps) {
      const w = arena.worldW;
      const h = arena.worldH;
      entity.x = ((entity.x % w) + w) % w;
      entity.y = ((entity.y % h) + h) % h;
      return;
    }
    clampToWorld(entity, arena.worldW, arena.worldH);
    return;
  }
  // Legacy fallback — callers should pass dims
  clampToWorld(entity, arena?.worldW ?? 1600, arena?.worldH ?? 900);
}

/**
 * Soft separation: push `a` away from nearby entities in `list`.
 * Mutates a.x/a.y slightly. Used so enemies don't fully stack.
 */
export function separate(a, list, strength = 28) {
  let ox = 0;
  let oy = 0;
  let count = 0;
  for (const b of list) {
    if (b === a || b.dead) continue;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const minDist = a.r + b.r;
    const d2 = dx * dx + dy * dy;
    if (d2 > 0 && d2 < minDist * minDist) {
      const d = Math.sqrt(d2);
      ox += (dx / d) * (minDist - d);
      oy += (dy / d) * (minDist - d);
      count++;
    }
  }
  if (count > 0) {
    a.x += (ox / count) * strength * 0.02;
    a.y += (oy / count) * strength * 0.02;
  }
}
