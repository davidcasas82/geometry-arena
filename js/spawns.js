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

function dimsOf(worldW = WORLD_W, worldH = WORLD_H) {
  return { worldW: worldW ?? WORLD_W, worldH: worldH ?? WORLD_H };
}

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
function towardCenter(x, y, worldW = WORLD_W, worldH = WORLD_H) {
  const cx = worldW / 2 - x;
  const cy = worldH / 2 - y;
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
/**
 * Evenly spaced line along one edge — classic “sweep the row” pattern.
 * @param {0|1|2|3} side 0=top 1=bottom 2=left 3=right
 * @param {number} [stagger]
 * @param {number|{worldW?:number,worldH?:number,arena?:object}} [worldW]
 * @param {number} [worldH]
 */
export function formationEdgeLine(type, count, side, stagger = 0.08, worldW = WORLD_W, worldH = WORLD_H) {
  if (worldW && typeof worldW === "object") {
    const d = dimsOf(worldW.worldW ?? worldW.arena?.worldW, worldW.worldH ?? worldW.arena?.worldH);
    worldW = d.worldW;
    worldH = d.worldH;
  } else {
    const d = dimsOf(worldW, worldH);
    worldW = d.worldW;
    worldH = d.worldH;
  }
  /** @type {SpawnJob[]} */
  const jobs = [];
  const n = Math.max(2, count);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const u = 0.08 + t * 0.84;
    let x;
    let y;
    if (side === 0) {
      x = u * worldW;
      y = -MARGIN;
    } else if (side === 1) {
      x = u * worldW;
      y = worldH + MARGIN;
    } else if (side === 2) {
      x = -MARGIN;
      y = u * worldH;
    } else {
      x = worldW + MARGIN;
      y = u * worldH;
    }
    jobs.push({ type, x, y, delay: i * stagger, approach: towardCenter(x, y, worldW, worldH) });
  }
  return jobs;
}

/**
 * Column / single-file from one edge point — follow-the-leader stream.
 */
export function formationColumn(type, count, side, stagger = 0.14, worldW = WORLD_W, worldH = WORLD_H) {
  if (worldW && typeof worldW === "object") {
    const d = dimsOf(worldW.worldW ?? worldW.arena?.worldW, worldW.worldH ?? worldW.arena?.worldH);
    worldW = d.worldW;
    worldH = d.worldH;
  } else {
    const d = dimsOf(worldW, worldH);
    worldW = d.worldW;
    worldH = d.worldH;
  }
  /** @type {SpawnJob[]} */
  const jobs = [];
  const n = Math.max(2, count);
  const mid = 0.35 + Math.random() * 0.3;
  let baseX;
  let baseY;
  let stepX = 0;
  let stepY = 0;
  if (side === 0) {
    baseX = mid * worldW;
    baseY = -MARGIN;
    stepY = -22;
  } else if (side === 1) {
    baseX = mid * worldW;
    baseY = worldH + MARGIN;
    stepY = 22;
  } else if (side === 2) {
    baseX = -MARGIN;
    baseY = mid * worldH;
    stepX = -22;
  } else {
    baseX = worldW + MARGIN;
    baseY = mid * worldH;
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
      approach: towardCenter(baseX, baseY, worldW, worldH),
    });
  }
  return jobs;
}

/**
 * Corner pocket along both edges that meet at a corner.
 * corner: 0=TL 1=TR 2=BL 3=BR
 */
export function formationCornerArc(type, count, corner, stagger = 0.07, worldW = WORLD_W, worldH = WORLD_H) {
  if (worldW && typeof worldW === "object") {
    const d = dimsOf(worldW.worldW ?? worldW.arena?.worldW, worldW.worldH ?? worldW.arena?.worldH);
    worldW = d.worldW;
    worldH = d.worldH;
  } else {
    const d = dimsOf(worldW, worldH);
    worldW = d.worldW;
    worldH = d.worldH;
  }
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
      x = t * worldW;
      y = -MARGIN;
    } else if (corner === 1) {
      x = worldW - t * worldW;
      y = -MARGIN;
    } else if (corner === 2) {
      x = t * worldW;
      y = worldH + MARGIN;
    } else {
      x = worldW - t * worldW;
      y = worldH + MARGIN;
    }
    jobs.push({ type, x, y, delay: i * stagger, approach: towardCenter(x, y, worldW, worldH) });
  }
  for (let i = 0; i < nB; i++) {
    const t = along(i, nB);
    let x;
    let y;
    if (corner === 0) {
      x = -MARGIN;
      y = t * worldH;
    } else if (corner === 1) {
      x = worldW + MARGIN;
      y = t * worldH;
    } else if (corner === 2) {
      x = -MARGIN;
      y = worldH - t * worldH;
    } else {
      x = worldW + MARGIN;
      y = worldH - t * worldH;
    }
    jobs.push({
      type,
      x,
      y,
      delay: (nA + i) * stagger * 0.85,
      approach: towardCenter(x, y, worldW, worldH),
    });
  }
  return jobs;
}

/** Pincer: two opposite edge lines at once. */
export function formationPincer(type, countPerSide, axis = "horizontal", stagger = 0.06, worldW = WORLD_W, worldH = WORLD_H) {
  const worldOpts =
    worldW && typeof worldW === "object" ? worldW : { worldW, worldH };
  const a = axis === "horizontal" ? 0 : 2;
  const b = a + 1;
  const left = formationEdgeLine(type, countPerSide, a, stagger, worldOpts);
  const right = formationEdgeLine(type, countPerSide, b, stagger, worldOpts);
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
export function formationRing(type, perSide, stagger = 0.05, worldW = WORLD_W, worldH = WORLD_H) {
  const worldOpts =
    worldW && typeof worldW === "object" ? worldW : { worldW, worldH };
  /** @type {SpawnJob[]} */
  const jobs = [];
  for (let side = 0; side < 4; side++) {
    const line = formationEdgeLine(type, perSide, side, 0, worldOpts);
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
export function formationZipper(type, count, stagger = 0.1, worldW = WORLD_W, worldH = WORLD_H) {
  if (worldW && typeof worldW === "object") {
    const d = dimsOf(worldW.worldW ?? worldW.arena?.worldW, worldW.worldH ?? worldW.arena?.worldH);
    worldW = d.worldW;
    worldH = d.worldH;
  } else {
    const d = dimsOf(worldW, worldH);
    worldW = d.worldW;
    worldH = d.worldH;
  }
  /** @type {SpawnJob[]} */
  const jobs = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    if (i % 2 === 0) {
      jobs.push({
        type,
        x: t * worldW,
        y: -MARGIN,
        delay: i * stagger,
        approach: towardCenter(t * worldW, 0, worldW, worldH),
      });
    } else {
      jobs.push({
        type,
        x: -MARGIN,
        y: t * worldH,
        delay: i * stagger,
        approach: towardCenter(0, t * worldH, worldW, worldH),
      });
    }
  }
  return jobs;
}

/** Single random edge spawn. */
export function formationSingle(type, worldW = WORLD_W, worldH = WORLD_H) {
  if (worldW && typeof worldW === "object") {
    const d = dimsOf(worldW.worldW ?? worldW.arena?.worldW, worldW.worldH ?? worldW.arena?.worldH);
    worldW = d.worldW;
    worldH = d.worldH;
  } else {
    const d = dimsOf(worldW, worldH);
    worldW = d.worldW;
    worldH = d.worldH;
  }
  const side = Math.floor(Math.random() * 4);
  const u = 0.15 + Math.random() * 0.7;
  let x;
  let y;
  if (side === 0) {
    x = u * worldW;
    y = -MARGIN;
  } else if (side === 1) {
    x = u * worldW;
    y = worldH + MARGIN;
  } else if (side === 2) {
    x = -MARGIN;
    y = u * worldH;
  } else {
    x = worldW + MARGIN;
    y = u * worldH;
  }
  return [{ type, x, y, delay: 0, approach: towardCenter(x, y, worldW, worldH) }];
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
  stagger = 0.04,
  worldW = WORLD_W,
  worldH = WORLD_H
) {
  if (worldW && typeof worldW === "object") {
    const d = dimsOf(worldW.worldW ?? worldW.arena?.worldW, worldW.worldH ?? worldW.arena?.worldH);
    worldW = d.worldW;
    worldH = d.worldH;
  } else {
    const d = dimsOf(worldW, worldH);
    worldW = d.worldW;
    worldH = d.worldH;
  }
  /** @type {SpawnJob[]} */
  const jobs = [];
  const n = Math.max(6, count);
  const r = radius;
  const cx = clamp(px, r + 24, worldW - r - 24);
  const cy = clamp(py, r + 24, worldH - r - 24);
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
export function formationCornerFlood(type, perCorner = PHRASE.FLOOD_PER_CORNER, stagger = 0.05, worldW = WORLD_W, worldH = WORLD_H) {
  const worldOpts =
    worldW && typeof worldW === "object" ? worldW : { worldW, worldH };
  /** @type {SpawnJob[]} */
  const jobs = [];
  for (let corner = 0; corner < 4; corner++) {
    const arc = formationCornerArc(type, perCorner, corner, stagger, worldOpts);
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
export function formationOppositeEcho(type, count, side, echoDelay = 0.85, stagger = 0.07, worldW = WORLD_W, worldH = WORLD_H) {
  const worldOpts =
    worldW && typeof worldW === "object" ? worldW : { worldW, worldH };
  const first = formationEdgeLine(type, count, side, stagger, worldOpts);
  const opp = side < 2 ? side ^ 1 : 2 + ((side - 2) ^ 1);
  const second = offsetJobs(formationEdgeLine(type, count, opp, stagger, worldOpts), echoDelay);
  return first.concat(second);
}

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
  const worldOpts =
    ctx.arena || ctx.worldW || ctx.worldH
      ? {
          worldW: ctx.worldW ?? ctx.arena?.worldW ?? WORLD_W,
          worldH: ctx.worldH ?? ctx.arena?.worldH ?? WORLD_H,
          arena: ctx.arena,
        }
      : null;
  const d = clamp(difficulty01, 0, 1);
  const side = Math.floor(Math.random() * 4);

  const wo = worldOpts;
  // Bind real formation fns (do not recurse through F.*)
  const _edgeLine = formationEdgeLine;
  const _column = formationColumn;
  const _cornerArc = formationCornerArc;
  const _pincer = formationPincer;
  const _ring = formationRing;
  const _zipper = formationZipper;
  const _single = formationSingle;
  const _playerCircle = formationPlayerCircle;
  const _cornerFlood = formationCornerFlood;
  const _oppositeEcho = formationOppositeEcho;
  const F = {
    edgeLine: (type, count, s, stagger) =>
      wo ? _edgeLine(type, count, s, stagger, wo) : _edgeLine(type, count, s, stagger),
    column: (type, count, s, stagger) =>
      wo ? _column(type, count, s, stagger, wo) : _column(type, count, s, stagger),
    cornerArc: (type, count, c, stagger) =>
      wo ? _cornerArc(type, count, c, stagger, wo) : _cornerArc(type, count, c, stagger),
    pincer: (type, n, axis, stagger) =>
      wo ? _pincer(type, n, axis, stagger, wo) : _pincer(type, n, axis, stagger),
    ring: (type, per, stagger) =>
      wo ? _ring(type, per, stagger, wo) : _ring(type, per, stagger),
    zipper: (type, count, stagger) =>
      wo ? _zipper(type, count, stagger, wo) : _zipper(type, count, stagger),
    single: (type) => (wo ? _single(type, wo) : _single(type)),
    playerCircle: (type, n, px, py, r, stagger) =>
      wo
        ? _playerCircle(type, n, px, py, r, stagger, wo)
        : _playerCircle(type, n, px, py, r, stagger),
    cornerFlood: (type, per, stagger) =>
      wo ? _cornerFlood(type, per, stagger, wo) : _cornerFlood(type, per, stagger),
    oppositeEcho: (type, count, s, echo, stagger) =>
      wo
        ? _oppositeEcho(type, count, s, echo, stagger, wo)
        : _oppositeEcho(type, count, s, echo, stagger),
  };
  const corner = Math.floor(Math.random() * 4);
  const axis = Math.random() < 0.5 ? "horizontal" : "vertical";

  // Opening teach
  if (elapsed < safeOpening) {
    const count = 2 + Math.floor(Math.random() * 2);
    const roll = Math.random();
    if (roll < 0.55) {
      return phraseOf("open-line", "soft", [F.edgeLine("wanderer", count, side, 0.14)]);
    }
    if (roll < 0.9) {
      return phraseOf("open-column", "soft", [F.column("wanderer", count, side, 0.18)]);
    }
    return phraseOf("open-single", "soft", [F.single("wanderer")]);
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
            F.column("pink", 3, side, 0.2),
            F.edgeLine("wanderer", 3, (side + 2) % 4, 0.12),
          ],
          { label: "DASHERS", introKey: "pink" }
        ),
    },
    {
      key: "spinner",
      at: 48,
      build: () =>
        phraseOf("intro-spinner", "normal", [F.edgeLine("spinner", 4, side, 0.12)], {
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
          [F.pincer(moneyType(elapsed, pickType), 3, axis, 0.08)],
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
            F.cornerArc("splitter", 3, corner, 0.14),
            F.edgeLine("wanderer", 3, side, 0.1),
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
            F.single("snake"),
            F.edgeLine("wanderer", 4, (side + 1) % 4, 0.1),
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
            F.single("tank"),
            F.edgeLine("diamond", 4, side, 0.09),
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
            F.single("void"),
            F.column(fodderType(elapsed), 3, side, 0.16),
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
    let jobs = F.playerCircle(type, n, player.x, player.y, PHRASE.CIRCLE_RADIUS, 0.035);
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
    return phraseOf("flood", "hard", [F.cornerFlood(fodderType(elapsed), per, 0.045)], {
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
      return phraseOf("money-line", "normal", [F.edgeLine(type, count, side, 0.1)]);
    }
    if (roll < 0.65) {
      return phraseOf("money-corner", "normal", [F.cornerArc(type, count, corner, 0.09)]);
    }
    if (roll < 0.85) {
      return phraseOf("money-echo", "normal", [
        F.oppositeEcho(type, Math.max(3, count - 1), side, 0.9, 0.1),
      ]);
    }
    return phraseOf("money-column", "soft", [F.column(type, count, side, 0.14)]);
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
    return phraseOf("solo-void", "setpiece", [F.single("void")], { label: "VOID" });
  }
  if (elapsed > 90 && primary === "tank" && Math.random() < 0.5) {
    return phraseOf("solo-tank", "hard", [
      F.single("tank"),
      F.edgeLine(fodderType(elapsed), 3, side, 0.1),
    ]);
  }
  if (elapsed > 78 && primary === "snake" && Math.random() < 0.45) {
    return phraseOf("snake-lane", "hard", [
      F.single("snake"),
      F.edgeLine(fodderType(elapsed), 4, (side + 2) % 4, 0.09),
    ]);
  }

  if (roll < 0.22) {
    return phraseOf("line", "normal", [F.edgeLine(primary, count, side, 0.07)]);
  }
  if (roll < 0.38) {
    return phraseOf("column", "normal", [
      F.column(primary, Math.min(count + 1, 10), side, 0.11),
    ]);
  }
  if (roll < 0.52) {
    return phraseOf("corner", "normal", [F.cornerArc(primary, count, corner, 0.065)]);
  }
  if (roll < 0.66) {
    return phraseOf(
      "pincer",
      "hard",
      [F.pincer(primary, Math.max(2, Math.floor(count / 2)), axis, 0.055)],
      { label: Math.random() < 0.35 ? "PINCER" : null }
    );
  }
  if (roll < 0.78) {
    return phraseOf("zipper", "normal", [F.zipper(primary, count, 0.085)]);
  }
  if (roll < 0.88 && elapsed > 70) {
    const per = clamp(2 + Math.floor(d * 2), 2, 4);
    return phraseOf("ring", "hard", [F.ring(primary, per, 0.04)], {
      label: Math.random() < 0.4 ? "RING" : null,
    });
  }
  if (roll < 0.94) {
    return phraseOf("echo", "normal", [
      F.oppositeEcho(primary, Math.max(3, count - 1), side, 0.8, 0.065),
    ]);
  }

  // Rare chaos mix
  const secondary = pickType();
  const line = F.edgeLine(primary, count, side, 0.06);
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
