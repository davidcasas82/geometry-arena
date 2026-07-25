/**
 * Geometry Wars–style spawn formations + phrase director.
 *
 * Random edge drops feel chaotic but rarely *readable*. GW and good twin-sticks
 * push enemies in lines, corners, pincers, rings, and rare player-circles so a
 * sweeping fire stream can clear a whole row — that’s the juice.
 *
 * Phrase director sequences themed beats (money sweep → pincer → lull) instead
 * of rolling type+pattern independently every spawn.
 *
 * Each formation returns a list of spawn jobs:
 *   { type, x, y, delay, approach? }
 */

import { PHRASE, SAFE_OPENING_SEC, WORLD_H, WORLD_W } from "./constants.js";

const MARGIN = 48;

/** @typedef {{ type: string, x: number, y: number, delay: number, approach?: {x:number,y:number} }} SpawnJob */
/**
 * @typedef {{
 *   tag: string,
 *   label?: string|null,
 *   intensity: "soft"|"normal"|"hard"|"setpiece",
 *   beats: SpawnJob[][],
 *   introKey?: string|null,
 * }} Phrase
 */

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

/** Unit vector from edge point toward arena center (readable entry). */
function towardCenter(x, y) {
  const cx = WORLD_W / 2 - x;
  const cy = WORLD_H / 2 - y;
  const l = Math.hypot(cx, cy) || 1;
  return { x: cx / l, y: cy / l };
}

function towardPoint(x, y, tx, ty) {
  const dx = tx - x;
  const dy = ty - y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

function offsetJobs(jobs, delayAdd) {
  return jobs.map((j) => ({ ...j, delay: j.delay + delayAdd }));
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
    jobs.push({ type, x, y, delay: i * stagger, approach: towardCenter(x, y) });
  }
  return jobs;
}

/**
 * Column / single-file from one edge point — follow-the-leader stream.
 */
export function formationColumn(type, count, side, stagger = 0.14) {
  /** @type {SpawnJob[]} */
  const jobs = [];
  const n = Math.max(2, count);
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
 * Corner pocket along both edges that meet at a corner.
 * corner: 0=TL 1=TR 2=BL 3=BR
 */
export function formationCornerArc(type, count, corner, stagger = 0.07) {
  /** @type {SpawnJob[]} */
  const jobs = [];
  const n = Math.max(3, count);
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

/** Pincer: two opposite edge lines at once. */
export function formationPincer(type, countPerSide, axis = "horizontal", stagger = 0.06) {
  const a = axis === "horizontal" ? 0 : 2;
  const b = a + 1;
  const left = formationEdgeLine(type, countPerSide, a, stagger);
  const right = formationEdgeLine(type, countPerSide, b, stagger);
  /** @type {SpawnJob[]} */
  const jobs = [];
  const n = Math.max(left.length, right.length);
  for (let i = 0; i < n; i++) {
    if (left[i]) jobs.push({ ...left[i], delay: i * stagger });
    if (right[i]) jobs.push({ ...right[i], delay: i * stagger + stagger * 0.5 });
  }
  return jobs;
}

/** Arena-edge ring from all four sides. */
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

/** Diagonal zipper: alternate top and side. */
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

/** Single random edge spawn. */
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
 * Classic GW surround: ring around the player at fixed radius.
 */
export function formationPlayerCircle(
  type,
  count,
  px,
  py,
  radius = PHRASE.CIRCLE_RADIUS,
  stagger = 0.04
) {
  /** @type {SpawnJob[]} */
  const jobs = [];
  const n = Math.max(6, count);
  const r = radius;
  const cx = clamp(px, r + 24, WORLD_W - r - 24);
  const cy = clamp(py, r + 24, WORLD_H - r - 24);
  const phase = Math.random() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const ang = phase + (i / n) * Math.PI * 2;
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r;
    jobs.push({
      type,
      x,
      y,
      delay: i * stagger * 0.35,
      approach: towardPoint(x, y, cx, cy),
    });
  }
  return jobs;
}

/** 4-corner flood — jacks-like path-cut fantasy. */
export function formationCornerFlood(type, perCorner = PHRASE.FLOOD_PER_CORNER, stagger = 0.05) {
  /** @type {SpawnJob[]} */
  const jobs = [];
  for (let corner = 0; corner < 4; corner++) {
    const arc = formationCornerArc(type, perCorner, corner, stagger);
    for (let i = 0; i < arc.length; i++) {
      jobs.push({
        ...arc[i],
        delay: corner * 0.08 + arc[i].delay,
      });
    }
  }
  return jobs;
}

/** Edge line + delayed opposite edge echo. */
export function formationOppositeEcho(type, count, side, echoDelay = 0.85, stagger = 0.07) {
  const first = formationEdgeLine(type, count, side, stagger);
  const opp = side < 2 ? side ^ 1 : 2 + ((side - 2) ^ 1);
  const second = offsetJobs(formationEdgeLine(type, count, opp, stagger), echoDelay);
  return first.concat(second);
}

/** Drop jobs that would spawn on top of the player. */
export function filterJobsNearPlayer(jobs, player, minDist = PHRASE.SAFE_SPAWN_DIST) {
  if (!player) return jobs;
  const d2 = minDist * minDist;
  return jobs.filter((j) => {
    const dx = j.x - player.x;
    const dy = j.y - player.y;
    return dx * dx + dy * dy >= d2;
  });
}

function phraseOf(tag, intensity, beats, opts = {}) {
  return {
    tag,
    label: opts.label ?? null,
    intensity,
    beats,
    introKey: opts.introKey ?? null,
  };
}

function moneyType(elapsed, pickType) {
  if (elapsed < SAFE_OPENING_SEC) return "wanderer";
  if (elapsed < 35) return Math.random() < 0.55 ? "wanderer" : "diamond";
  const roll = Math.random();
  if (roll < 0.4) return "wanderer";
  if (roll < 0.75) return "diamond";
  const t = pickType();
  if (t === "void" || t === "tank" || t === "snake") return "diamond";
  return t;
}

function fodderType(elapsed) {
  if (elapsed < 20) return "wanderer";
  return Math.random() < 0.45 ? "wanderer" : "diamond";
}

/**
 * Build one phrase for the live director.
 *
 * @param {number} elapsed
 * @param {number} difficulty01
 * @param {() => string} pickType
 * @param {object} [ctx]
 * @returns {Phrase}
 */
export function buildPhrase(elapsed, difficulty01, pickType, ctx = {}) {
  const safeOpening = ctx.safeOpening ?? SAFE_OPENING_SEC;
  const seen = ctx.seenIntros instanceof Set ? ctx.seenIntros : new Set(ctx.seenIntros || []);
  const player = ctx.player || null;
  const d = clamp(difficulty01, 0, 1);
  const side = Math.floor(Math.random() * 4);
  const corner = Math.floor(Math.random() * 4);
  const axis = Math.random() < 0.5 ? "horizontal" : "vertical";

  // Opening teach
  if (elapsed < safeOpening) {
    const count = 2 + Math.floor(Math.random() * 2);
    const roll = Math.random();
    if (roll < 0.55) {
      return phraseOf("open-line", "soft", [formationEdgeLine("wanderer", count, side, 0.14)]);
    }
    if (roll < 0.9) {
      return phraseOf("open-column", "soft", [formationColumn("wanderer", count, side, 0.18)]);
    }
    return phraseOf("open-single", "soft", [formationSingle("wanderer")]);
  }

  // First-unlock set pieces (once each)
  const intros = [
    {
      key: "pink",
      at: 35,
      build: () =>
        phraseOf(
          "intro-pink",
          "setpiece",
          [
            formationColumn("pink", 3, side, 0.2),
            formationEdgeLine("wanderer", 3, (side + 2) % 4, 0.12),
          ],
          { label: "DASHERS", introKey: "pink" }
        ),
    },
    {
      key: "spinner",
      at: 48,
      build: () =>
        phraseOf("intro-spinner", "normal", [formationEdgeLine("spinner", 4, side, 0.12)], {
          label: "ORBIT",
          introKey: "spinner",
        }),
    },
    {
      key: "pincer",
      at: 50,
      build: () =>
        phraseOf(
          "intro-pincer",
          "hard",
          [formationPincer(moneyType(elapsed, pickType), 3, axis, 0.08)],
          { label: "PINCER", introKey: "pincer" }
        ),
    },
    {
      key: "splitter",
      at: 62,
      build: () =>
        phraseOf(
          "intro-splitter",
          "setpiece",
          [
            formationCornerArc("splitter", 3, corner, 0.14),
            formationEdgeLine("wanderer", 3, side, 0.1),
          ],
          { label: "SPLITTERS", introKey: "splitter" }
        ),
    },
    {
      key: "snake",
      at: 78,
      build: () =>
        phraseOf(
          "intro-snake",
          "setpiece",
          [
            formationSingle("snake"),
            formationEdgeLine("wanderer", 4, (side + 1) % 4, 0.1),
          ],
          { label: "SNAKE", introKey: "snake" }
        ),
    },
    {
      key: "tank",
      at: 95,
      build: () =>
        phraseOf(
          "intro-tank",
          "setpiece",
          [
            formationSingle("tank"),
            formationEdgeLine("diamond", 4, side, 0.09),
          ],
          { label: "TANK", introKey: "tank" }
        ),
    },
    {
      key: "void",
      at: 105,
      build: () =>
        phraseOf(
          "intro-void",
          "setpiece",
          [
            formationSingle("void"),
            formationColumn(fodderType(elapsed), 3, side, 0.16),
          ],
          { label: "VOID", introKey: "void" }
        ),
    },
  ];

  for (const intro of intros) {
    if (elapsed >= intro.at && !seen.has(intro.key)) {
      if (intro.key === "void" && ctx.hasVoid) continue;
      return intro.build();
    }
  }

  // Rare set pieces on cooldown
  const lastCircle = ctx.lastCircleAt ?? -999;
  const lastFlood = ctx.lastFloodAt ?? -999;
  const canCircle =
    elapsed >= PHRASE.CIRCLE_MIN_ELAPSED &&
    elapsed - lastCircle >= PHRASE.CIRCLE_COOLDOWN &&
    player &&
    !(player.invuln > 0) &&
    !(player.controlLock > 0) &&
    Math.random() < 0.14 + d * 0.08;

  if (canCircle) {
    const n = randInt(PHRASE.CIRCLE_COUNT_MIN, PHRASE.CIRCLE_COUNT_MAX);
    const type = fodderType(elapsed);
    let jobs = formationPlayerCircle(type, n, player.x, player.y, PHRASE.CIRCLE_RADIUS, 0.035);
    jobs = filterJobsNearPlayer(jobs, player, PHRASE.SAFE_SPAWN_DIST * 0.55);
    if (jobs.length >= 6) {
      return phraseOf("circle", "setpiece", [jobs], {
        label: "SURROUND",
        introKey: "circle-event",
      });
    }
  }

  const canFlood =
    elapsed >= PHRASE.FLOOD_MIN_ELAPSED &&
    elapsed - lastFlood >= PHRASE.FLOOD_COOLDOWN &&
    Math.random() < 0.12 + d * 0.1;

  if (canFlood) {
    const per = clamp(PHRASE.FLOOD_PER_CORNER + Math.floor(d * 2), 3, 6);
    return phraseOf("flood", "hard", [formationCornerFlood(fodderType(elapsed), per, 0.045)], {
      label: "FLOOD",
      introKey: "flood-event",
    });
  }

  // Early money sweeps
  if (elapsed < 45) {
    const type = moneyType(elapsed, pickType);
    const count = 3 + Math.floor(Math.random() * 3);
    const roll = Math.random();
    if (roll < 0.4) {
      return phraseOf("money-line", "normal", [formationEdgeLine(type, count, side, 0.1)]);
    }
    if (roll < 0.65) {
      return phraseOf("money-corner", "normal", [formationCornerArc(type, count, corner, 0.09)]);
    }
    if (roll < 0.85) {
      return phraseOf("money-echo", "normal", [
        formationOppositeEcho(type, Math.max(3, count - 1), side, 0.9, 0.1),
      ]);
    }
    return phraseOf("money-column", "soft", [formationColumn(type, count, side, 0.14)]);
  }

  // Mid / late improvisation — homogeneous by default
  const primary = (() => {
    let t = pickType();
    if (t === "void" || t === "tank" || t === "snake") {
      if (Math.random() < 0.7) t = moneyType(elapsed, pickType);
    }
    return t;
  })();

  let count = 4 + Math.floor(d * 5 + Math.random() * 3);
  count = clamp(count, 3, 12);
  const roll = Math.random();

  if (elapsed > 100 && Math.random() < 0.1 && !ctx.hasVoid) {
    return phraseOf("solo-void", "setpiece", [formationSingle("void")], { label: "VOID" });
  }
  if (elapsed > 90 && primary === "tank" && Math.random() < 0.5) {
    return phraseOf("solo-tank", "hard", [
      formationSingle("tank"),
      formationEdgeLine(fodderType(elapsed), 3, side, 0.1),
    ]);
  }
  if (elapsed > 78 && primary === "snake" && Math.random() < 0.45) {
    return phraseOf("snake-lane", "hard", [
      formationSingle("snake"),
      formationEdgeLine(fodderType(elapsed), 4, (side + 2) % 4, 0.09),
    ]);
  }

  if (roll < 0.22) {
    return phraseOf("line", "normal", [formationEdgeLine(primary, count, side, 0.07)]);
  }
  if (roll < 0.38) {
    return phraseOf("column", "normal", [
      formationColumn(primary, Math.min(count + 1, 10), side, 0.11),
    ]);
  }
  if (roll < 0.52) {
    return phraseOf("corner", "normal", [formationCornerArc(primary, count, corner, 0.065)]);
  }
  if (roll < 0.66) {
    return phraseOf(
      "pincer",
      "hard",
      [formationPincer(primary, Math.max(2, Math.floor(count / 2)), axis, 0.055)],
      { label: Math.random() < 0.35 ? "PINCER" : null }
    );
  }
  if (roll < 0.78) {
    return phraseOf("zipper", "normal", [formationZipper(primary, count, 0.085)]);
  }
  if (roll < 0.88 && elapsed > 70) {
    const per = clamp(2 + Math.floor(d * 2), 2, 4);
    return phraseOf("ring", "hard", [formationRing(primary, per, 0.04)], {
      label: Math.random() < 0.4 ? "RING" : null,
    });
  }
  if (roll < 0.94) {
    return phraseOf("echo", "normal", [
      formationOppositeEcho(primary, Math.max(3, count - 1), side, 0.8, 0.065),
    ]);
  }

  // Rare chaos mix
  const secondary = pickType();
  const line = formationEdgeLine(primary, count, side, 0.06);
  for (let i = 0; i < line.length; i++) {
    if (i % 2 === 1) line[i].type = secondary === "void" ? "diamond" : secondary;
  }
  return phraseOf("chaos-line", "hard", [line]);
}

/**
 * Legacy flat job list (tests / compatibility). Prefer buildPhrase live.
 */
export function buildWaveJobs(elapsed, difficulty01, pickType, opts = {}) {
  const phrase = buildPhrase(elapsed, difficulty01, pickType, opts);
  /** @type {SpawnJob[]} */
  const flat = [];
  let t = 0;
  for (let b = 0; b < phrase.beats.length; b++) {
    const beat = phrase.beats[b];
    for (const job of beat) {
      flat.push({ ...job, delay: job.delay + t });
    }
    t +=
      (beat.reduce((m, j) => Math.max(m, j.delay), 0) || 0) +
      (b < phrase.beats.length - 1 ? PHRASE.BEAT_GAP : 0);
  }
  return flat;
}
