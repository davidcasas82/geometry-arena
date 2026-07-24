/**
 * Geometry Wars–style spawn formations.
 *
 * Random edge drops feel chaotic but rarely *readable*. GW and good twin-sticks
 * push enemies in lines, corners, pincers, and rings so a sweeping fire stream
 * can clear a whole row — that’s the juice.
 *
 * Each formation returns a list of spawn jobs:
 *   { type, x, y, delay, approach? }
 */

import { WORLD_H, WORLD_W } from "./constants.js";

const MARGIN = 48;

/** @typedef {{ type: string, x: number, y: number, delay: number, approach?: {x:number,y:number} }} SpawnJob */

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/** Unit vector from edge point toward arena center (readable entry). */
function towardCenter(x, y) {
  const cx = WORLD_W / 2 - x;
  const cy = WORLD_H / 2 - y;
  const l = Math.hypot(cx, cy) || 1;
  return { x: cx / l, y: cy / l };
}

/**
 * Evenly spaced line along one edge — classic “sweep the row” pattern.
 * @param {0|1|2|3} side 0=top 1=bottom 2=left 3=right
 */
export function formationEdgeLine(type, count, side, stagger = 0.08) {
  /** @type {SpawnJob[]} */
  const jobs = [];
  const n = Math.max(2, count);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    // Slight inset from corners so lines don’t stack in corners
    const u = 0.08 + t * 0.84;
    let x;
    let y;
    if (side === 0) {
      x = u * WORLD_W;
      y = -MARGIN;
    } else if (side === 1) {
      x = u * WORLD_W;
      y = WORLD_H + MARGIN;
    } else if (side === 2) {
      x = -MARGIN;
      y = u * WORLD_H;
    } else {
      x = WORLD_W + MARGIN;
      y = u * WORLD_H;
    }
    const approach = towardCenter(x, y);
    jobs.push({ type, x, y, delay: i * stagger, approach });
  }
  return jobs;
}

/**
 * Column / single-file from one edge point — follow-the-leader stream.
 * Great for snake fodder and wanderer trains.
 */
export function formationColumn(type, count, side, stagger = 0.14) {
  /** @type {SpawnJob[]} */
  const jobs = [];
  const n = Math.max(2, count);
  // Anchor near middle of the edge, slight random offset
  const mid = 0.35 + Math.random() * 0.3;
  let baseX;
  let baseY;
  let stepX = 0;
  let stepY = 0;
  if (side === 0) {
    baseX = mid * WORLD_W;
    baseY = -MARGIN;
    stepY = -22;
  } else if (side === 1) {
    baseX = mid * WORLD_W;
    baseY = WORLD_H + MARGIN;
    stepY = 22;
  } else if (side === 2) {
    baseX = -MARGIN;
    baseY = mid * WORLD_H;
    stepX = -22;
  } else {
    baseX = WORLD_W + MARGIN;
    baseY = mid * WORLD_H;
    stepX = 22;
  }
  for (let i = 0; i < n; i++) {
    const x = baseX + stepX * i;
    const y = baseY + stepY * i;
    jobs.push({
      type,
      x,
      y,
      delay: i * stagger,
      approach: towardCenter(baseX, baseY),
    });
  }
  return jobs;
}

/**
 * Corner pocket: enemies fan out from one corner along both adjacent edges.
 * Rewards arcing fire into that corner of the board.
 * corner: 0=TL 1=TR 2=BL 3=BR
 */
export function formationCornerArc(type, count, corner, stagger = 0.07) {
  /** @type {SpawnJob[]} */
  const jobs = [];
  const n = Math.max(3, count);
  // Split count across the two edges that meet at the corner
  const nA = Math.ceil(n / 2);
  const nB = Math.floor(n / 2);
  const along = (i, total) => 0.06 + ((i + 0.5) / total) * 0.38;

  for (let i = 0; i < nA; i++) {
    const t = along(i, nA);
    let x;
    let y;
    if (corner === 0) {
      x = t * WORLD_W;
      y = -MARGIN;
    } else if (corner === 1) {
      x = WORLD_W - t * WORLD_W;
      y = -MARGIN;
    } else if (corner === 2) {
      x = t * WORLD_W;
      y = WORLD_H + MARGIN;
    } else {
      x = WORLD_W - t * WORLD_W;
      y = WORLD_H + MARGIN;
    }
    jobs.push({ type, x, y, delay: i * stagger, approach: towardCenter(x, y) });
  }
  for (let i = 0; i < nB; i++) {
    const t = along(i, nB);
    let x;
    let y;
    if (corner === 0) {
      x = -MARGIN;
      y = t * WORLD_H;
    } else if (corner === 1) {
      x = WORLD_W + MARGIN;
      y = t * WORLD_H;
    } else if (corner === 2) {
      x = -MARGIN;
      y = WORLD_H - t * WORLD_H;
    } else {
      x = WORLD_W + MARGIN;
      y = WORLD_H - t * WORLD_H;
    }
    jobs.push({
      type,
      x,
      y,
      delay: (nA + i) * stagger * 0.85,
      approach: towardCenter(x, y),
    });
  }
  return jobs;
}

/**
 * Pincer: two opposite edge lines at once — forces movement through the middle.
 */
export function formationPincer(type, countPerSide, axis = "horizontal", stagger = 0.06) {
  const a = axis === "horizontal" ? 0 : 2; // top+bottom vs left+right
  const b = a + 1;
  const left = formationEdgeLine(type, countPerSide, a, stagger);
  const right = formationEdgeLine(type, countPerSide, b, stagger);
  // Interleave so both sides advance together
  /** @type {SpawnJob[]} */
  const jobs = [];
  const n = Math.max(left.length, right.length);
  for (let i = 0; i < n; i++) {
    if (left[i]) jobs.push({ ...left[i], delay: i * stagger });
    if (right[i]) jobs.push({ ...right[i], delay: i * stagger + stagger * 0.5 });
  }
  return jobs;
}

/**
 * Ring: surround the arena from all four edges (late-game “oh no”).
 */
export function formationRing(type, perSide, stagger = 0.05) {
  /** @type {SpawnJob[]} */
  const jobs = [];
  for (let side = 0; side < 4; side++) {
    const line = formationEdgeLine(type, perSide, side, 0);
    for (let i = 0; i < line.length; i++) {
      jobs.push({
        ...line[i],
        delay: side * 0.04 + i * stagger,
      });
    }
  }
  return jobs;
}

/**
 * Diagonal zipper: alternate top and side so a diagonal sweep works.
 */
export function formationZipper(type, count, stagger = 0.1) {
  /** @type {SpawnJob[]} */
  const jobs = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    if (i % 2 === 0) {
      jobs.push({
        type,
        x: t * WORLD_W,
        y: -MARGIN,
        delay: i * stagger,
        approach: towardCenter(t * WORLD_W, 0),
      });
    } else {
      jobs.push({
        type,
        x: -MARGIN,
        y: t * WORLD_H,
        delay: i * stagger,
        approach: towardCenter(0, t * WORLD_H),
      });
    }
  }
  return jobs;
}

/**
 * Single random edge spawn (used sparingly).
 */
export function formationSingle(type) {
  const side = Math.floor(Math.random() * 4);
  const u = 0.15 + Math.random() * 0.7;
  let x;
  let y;
  if (side === 0) {
    x = u * WORLD_W;
    y = -MARGIN;
  } else if (side === 1) {
    x = u * WORLD_W;
    y = WORLD_H + MARGIN;
  } else if (side === 2) {
    x = -MARGIN;
    y = u * WORLD_H;
  } else {
    x = WORLD_W + MARGIN;
    y = u * WORLD_H;
  }
  return [{ type, x, y, delay: 0, approach: towardCenter(x, y) }];
}

/**
 * Pick a formation for the current difficulty / roster.
 * Returns SpawnJob[].
 */
export function buildWaveJobs(elapsed, difficulty01, pickType, opts = {}) {
  const opening = elapsed < (opts.safeOpening ?? 18);
  const soft = elapsed < 40;

  // Type for the wave — often homogeneous for readable sweeps
  const primary = opening ? "wanderer" : pickType();
  // Mixed second type later
  const secondary = !opening && !soft && Math.random() < 0.35 ? pickType() : primary;

  const roll = Math.random();
  let count;
  if (opening) count = 2 + Math.floor(Math.random() * 2); // 2–3
  else if (soft) count = 3 + Math.floor(Math.random() * 3); // 3–5
  else count = 4 + Math.floor(difficulty01 * 5 + Math.random() * 3); // 4–12-ish
  count = Math.max(2, Math.min(12, count));

  const side = Math.floor(Math.random() * 4);
  const corner = Math.floor(Math.random() * 4);

  // Weight formations by phase
  if (opening) {
    // Only simple readable patterns
    if (roll < 0.55) return formationEdgeLine(primary, count, side, 0.12);
    if (roll < 0.85) return formationColumn(primary, count, side, 0.16);
    return formationSingle(primary);
  }

  if (soft) {
    if (roll < 0.35) return formationEdgeLine(primary, count, side, 0.09);
    if (roll < 0.55) return formationColumn(primary, count, side, 0.12);
    if (roll < 0.75) return formationCornerArc(primary, count, corner, 0.08);
    if (roll < 0.9) return formationZipper(primary, count, 0.1);
    return formationPincer(primary, Math.max(2, Math.floor(count / 2)), Math.random() < 0.5 ? "horizontal" : "vertical", 0.08);
  }

  // Mid / late — full vocabulary
  if (roll < 0.22) return formationEdgeLine(primary, count, side, 0.06);
  if (roll < 0.38) return formationColumn(primary, Math.min(count + 1, 10), side, 0.1);
  if (roll < 0.52) return formationCornerArc(primary, count, corner, 0.06);
  if (roll < 0.66) return formationPincer(primary, Math.max(2, Math.floor(count / 2)), Math.random() < 0.5 ? "horizontal" : "vertical", 0.055);
  if (roll < 0.78) return formationZipper(secondary, count, 0.08);
  if (roll < 0.9 && elapsed > 70) {
    // Ring is special — fewer per side so it’s fair
    const per = clamp(2 + Math.floor(difficulty01 * 2), 2, 4);
    return formationRing(primary, per, 0.04);
  }
  // Mixed line: half primary half secondary on one edge
  const line = formationEdgeLine(primary, count, side, 0.06);
  for (let i = 0; i < line.length; i++) {
    if (i % 2 === 1) line[i].type = secondary;
  }
  return line;
}
