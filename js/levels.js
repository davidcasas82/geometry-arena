/**
 * Geometry Arena — Arena Path catalog + pure helpers.
 * Design lock: docs/LEVELS_DESIGN.md
 *
 * Classic Evolved does not import this for the default PLAY loop.
 * Path UI / mode-runtime / progress agents depend on these field names.
 */

// ── Enums (string values are canonical ids) ─────────────────

/** @enum {string} */
export const MODE = Object.freeze({
  EVOLVED: "evolved",
  DEADLINE: "deadline",
  CHECKPOINT: "checkpoint",
  WAVES: "waves",
  BOSS_LITE: "boss-lite",
});

/** @enum {string} */
export const TOPOLOGY = Object.freeze({
  RECT: "rect",
  RECT_TIGHT: "rect_tight",
  RECT_WIDE: "rect_wide",
  DONUT: "donut",
  CORRIDOR: "corridor",
  CROSS: "cross",
  PILL_2D: "pill_2d",
  WRAP_TORUS: "wrap_torus",
  SPLIT: "split",
});

/** Formation pattern ids — mode-runtime maps to spawns.js helpers. */
/** @enum {string} */
export const SPAWN_PATTERN = Object.freeze({
  EDGE_LINE: "edge_line",
  COLUMN: "column",
  CORNER_ARC: "corner_arc",
  PINCER: "pincer",
  RING: "ring",
  ZIPPER: "zipper",
  SINGLE: "single",
  PLAYER_CIRCLE: "player_circle",
  CORNER_FLOOD: "corner_flood",
  OPPOSITE_ECHO: "opposite_echo",
});

/** Chapter display titles (UI). */
export const CHAPTER_TITLES = Object.freeze({
  1: "Neon Primer",
  2: "Pressure Geometry",
});

/**
 * Path BGM beds. Files live at `src` when produced; missing → classic fallback 1|2.
 * @typedef {{
 *   id: string,
 *   title: string,
 *   src: string,
 *   fallback: 1|2,
 *   bpm?: number,
 *   mood: string,
 *   sunoPrompt?: string,
 * }} PathThemeMeta
 */
/** @type {Record<string, PathThemeMeta>} */
export const PATH_THEMES = Object.freeze({
  "grid-wake": {
    id: "grid-wake",
    title: "Grid Wake",
    src: "audio/path/grid-wake.mp3",
    fallback: 1,
    bpm: 140,
    mood: "Bright teach pulse, open arps, low threat, welcoming neon floor.",
    sunoPrompt:
      "Instrumental electronic twin-stick theme, 140 BPM, bright synth arpeggios, light sidechain, chiptune sparkle, low threat tutorial energy, Geometry Wars cousin, no vocals, seamless loop feel.",
  },
  "deadline-drill": {
    id: "deadline-drill",
    title: "Deadline Drill",
    src: "audio/path/deadline-drill.mp3",
    fallback: 2,
    bpm: 150,
    mood: "Ticking urgency, rising count-in, score-sprint pressure.",
    sunoPrompt:
      "Instrumental electronic action, 150 BPM, ticking hi-hats, urgent rising synth, aggressive sidechain pump, countdown tension, twin-stick shooter, no vocals, loopable.",
  },
  "wave-lane": {
    id: "wave-lane",
    title: "Wave Lane",
    src: "audio/path/wave-lane.mp3",
    fallback: 1,
    bpm: 145,
    mood: "Horizontal drive, staccato perc like edge sweeps in a corridor.",
    sunoPrompt:
      "Instrumental synthwave corridor chase, 145 BPM, staccato percussion, linear driving bass, laser zaps on downbeats, narrow-lane intensity, no vocals.",
  },
  "cross-gates": {
    id: "cross-gates",
    title: "Cross Gates",
    src: "audio/path/cross-gates.mp3",
    fallback: 2,
    bpm: 142,
    mood: "Hub drone center, directional tension toward arms.",
    sunoPrompt:
      "Instrumental electronic mid-tempo tension, 142 BPM, central drone hub, panned stingers, geometric pulse, exploratory but dangerous, twin-stick, no vocals.",
  },
  "donut-orbit": {
    id: "donut-orbit",
    title: "Donut Orbit",
    src: "audio/path/donut-orbit.mp3",
    fallback: 1,
    bpm: 138,
    mood: "Circular ostinato, dizzy filter swirl, hollow center.",
    sunoPrompt:
      "Instrumental electronic orbit theme, 138 BPM, circular repeating ostinato, swirling filters, hollow midrange, dizzy neon ring energy, no vocals, seamless loop.",
  },
  "split-signal": {
    id: "split-signal",
    title: "Split Signal",
    src: "audio/path/split-signal.mp3",
    fallback: 2,
    bpm: 144,
    mood: "Call/response stereo beds, anxious gaps between chambers.",
    sunoPrompt:
      "Instrumental electronic dual-chamber theme, 144 BPM, call and response stereo synths, anxious brief silences, glitchy perc, split-arena tension, no vocals.",
  },
  "torus-rush": {
    id: "torus-rush",
    title: "Torus Rush",
    src: "audio/path/torus-rush.mp3",
    fallback: 1,
    bpm: 148,
    mood: "Seamless wrap-friendly phrase, whoosh motifs, endless edge.",
    sunoPrompt:
      "Instrumental electronic wraparound rush, 148 BPM, seamless loop-first arrangement, whoosh transitions, euphoric pulse, toroidal motion feel, twin-stick, no vocals.",
  },
  "boss-pulse": {
    id: "boss-pulse",
    title: "Boss Pulse",
    src: "audio/path/boss-pulse.mp3",
    fallback: 2,
    bpm: 135,
    mood: "Heavy boss pulse, sparse verses, drop under elite pressure.",
    sunoPrompt:
      "Instrumental electronic boss theme, 135 BPM, heavy pulse bass, sparse ominous verses, explosive chorus drops, elite encounter energy, Geometry Wars cousin, no vocals.",
  },
});

/**
 * @typedef {"evolved"|"deadline"|"checkpoint"|"waves"|"boss-lite"} ModeId
 * @typedef {"rect"|"rect_tight"|"rect_wide"|"donut"|"corridor"|"cross"|"pill_2d"|"wrap_torus"|"split"} TopologyId
 * @typedef {"edge_line"|"column"|"corner_arc"|"pincer"|"ring"|"zipper"|"single"|"player_circle"|"corner_flood"|"opposite_echo"} SpawnPatternId
 * @typedef {"wanderer"|"diamond"|"pink"|"spinner"|"splitter"|"snake"|"tank"|"void"|"atom"} EnemyTypeId
 *
 * @typedef {{ topology: TopologyId, params?: Record<string, number|string|boolean> }} ArenaRef
 *
 * @typedef {{
 *   score?: [number, number],
 *   peakMult?: [number, number],
 *   timeLeftSec?: [number, number],
 *   timeSecMax?: [number, number],
 *   onTimeGates?: [number, number],
 *   livesLeft?: [number, number],
 * }} StarThresholds
 *
 * @typedef {{
 *   id: string,
 *   dueSec: number,
 *   label?: string,
 *   zone?: { x: number, y: number, r: number },
 * }} CheckpointDef
 *
 * @typedef {{
 *   id: string,
 *   label?: string,
 *   types: EnemyTypeId[],
 *   count: number,
 *   pattern: SpawnPatternId,
 *   patternOpts?: {
 *     side?: 0|1|2|3,
 *     corner?: 0|1|2|3,
 *     axis?: "horizontal"|"vertical",
 *     stagger?: number,
 *     perSide?: number,
 *   },
 *   delaySec?: number,
 * }} WaveDef
 *
 * @typedef {{
 *   type: EnemyTypeId,
 *   hp?: number,
 *   score?: number,
 *   spawn?: { x: number, y: number },
 *   adds?: {
 *     everySec: number,
 *     types: EnemyTypeId[],
 *     count: number,
 *     pattern: SpawnPatternId,
 *   },
 *   clearAdds?: boolean,
 *   label?: string,
 * }} BossDef
 *
 * @typedef {{
 *   durationSec?: number,
 *   targetScore?: number,
 *   lives?: number,
 *   bombs?: number,
 *   scoreMult?: number,
 *   safeOpeningSec?: number,
 *   spawnRampSec?: number,
 *   enemyUnlockScale?: number,
 *   softCap?: number,
 *   maxEnemies?: number,
 *   checkpoints?: CheckpointDef[],
 *   failOnMissedCheckpoint?: boolean,
 *   checkpointBonus?: number,
 *   waves?: WaveDef[],
 *   waveGapSec?: number,
 *   waveClearBonus?: number,
 *   allowImprov?: boolean,
 *   boss?: BossDef,
 *   bgm?: 1|2|"auto",
 *   themeId?: string,
 * }} LevelRules
 *
 * @typedef {{
 *   id: string,
 *   name: string,
 *   tagline?: string,
 *   chapter: number,
 *   order: number,
 *   mode: ModeId,
 *   arena: ArenaRef,
 *   rules: LevelRules,
 *   stars: StarThresholds,
 *   skillLesson: string,
 *   unlockDefault?: boolean,
 * }} LevelDef
 *
 * @typedef {{
 *   stars: Record<string, number>,
 *   bestScore: Record<string, number>,
 *   bestTime?: Record<string, number>,
 *   updatedAt?: number,
 *   version: 1,
 * }} PathProgress
 *
 * @typedef {{
 *   cleared: boolean,
 *   timeLeftSec?: number,
 *   elapsedSec?: number,
 *   peakMult?: number,
 *   livesLeft?: number,
 *   onTimeGates?: number,
 *   mode?: ModeId,
 * }} LevelResultExtra
 */

// ── Catalog (source of truth for MVP numbers) ───────────────

/** @type {LevelDef[]} */
export const LEVELS = [
  {
    id: "path-01-grid-wake",
    name: "Grid Wake",
    tagline: "Learn the neon floor.",
    chapter: 1,
    order: 1,
    mode: MODE.EVOLVED,
    arena: { topology: TOPOLOGY.RECT },
    rules: {
      durationSec: 75,
      lives: 3,
      bombs: 3,
      safeOpeningSec: 12,
      spawnRampSec: 55,
      softCap: 18,
      enemyUnlockScale: 0.55,
      bgm: 1,
      themeId: "grid-wake",
    },
    stars: {
      // Mult economy prints huge numbers fast — stars gate on real scooping
      score: [80000, 200000],
      peakMult: [20, 45],
    },
    skillLesson: "Strafe, scoop geoms, trust the needle gun.",
    unlockDefault: true,
  },
  {
    id: "path-02-deadline-drill",
    name: "Deadline Drill",
    tagline: "Hit the score before the clock dies.",
    chapter: 1,
    order: 2,
    mode: MODE.DEADLINE,
    arena: { topology: TOPOLOGY.RECT },
    rules: {
      // ~45s sprint: 8k was ~seconds of play. Target needs sustained mult.
      durationSec: 60,
      targetScore: 100000,
      lives: 3,
      bombs: 2,
      safeOpeningSec: 8,
      spawnRampSec: 50,
      softCap: 22,
      enemyUnlockScale: 0.75,
      bgm: 2,
      themeId: "deadline-drill",
    },
    stars: {
      score: [180000, 320000],
      timeLeftSec: [12, 22],
    },
    skillLesson: "Farm mult fast; every second is points on the board.",
  },
  {
    id: "path-03-wave-lane",
    name: "Wave Lane",
    tagline: "Clear every scripted wave. No freestyle spawns.",
    chapter: 1,
    order: 3,
    mode: MODE.WAVES,
    arena: { topology: TOPOLOGY.RECT },
    rules: {
      lives: 3,
      bombs: 3,
      waveGapSec: 1.2,
      waveClearBonus: 350,
      allowImprov: false,
      durationSec: 110,
      bgm: 1,
      themeId: "wave-lane",
      waves: [
        {
          id: "w1",
          label: "SWEEP",
          types: ["wanderer"],
          count: 6,
          pattern: SPAWN_PATTERN.EDGE_LINE,
          patternOpts: { side: 2, stagger: 0.1 },
          delaySec: 0.4,
        },
        {
          id: "w2",
          label: "COLUMN",
          types: ["diamond"],
          count: 5,
          pattern: SPAWN_PATTERN.COLUMN,
          patternOpts: { side: 3, stagger: 0.12 },
          delaySec: 0.2,
        },
        {
          id: "w3",
          label: "PINCER",
          types: ["pink"],
          count: 6,
          pattern: SPAWN_PATTERN.PINCER,
          patternOpts: { axis: "horizontal", stagger: 0.08 },
        },
        {
          id: "w4",
          label: "ORBIT",
          types: ["spinner"],
          count: 5,
          pattern: SPAWN_PATTERN.EDGE_LINE,
          patternOpts: { side: 0, stagger: 0.09 },
        },
        {
          id: "w5",
          label: "ZIP",
          types: ["wanderer", "diamond"],
          count: 8,
          pattern: SPAWN_PATTERN.ZIPPER,
          patternOpts: { stagger: 0.08 },
        },
      ],
    },
    stars: {
      score: [60000, 140000],
      livesLeft: [2, 3],
    },
    skillLesson: "Read the formation, sweep the line, don't get surrounded.",
  },
  {
    id: "path-04-cross-gates",
    name: "Cross Gates",
    tagline: "Hit each gate marker before the run ends.",
    chapter: 1,
    order: 4,
    mode: MODE.CHECKPOINT,
    arena: { topology: TOPOLOGY.RECT },
    rules: {
      lives: 3,
      bombs: 3,
      durationSec: 95,
      failOnMissedCheckpoint: false,
      checkpointBonus: 400,
      safeOpeningSec: 10,
      spawnRampSec: 70,
      softCap: 20,
      enemyUnlockScale: 0.75,
      bgm: 2,
      themeId: "cross-gates",
      checkpoints: [
        {
          id: "cp-hub",
          dueSec: 15,
          label: "HUB",
          zone: { x: 800, y: 450, r: 90 },
        },
        {
          id: "cp-north",
          dueSec: 35,
          label: "NORTH",
          zone: { x: 800, y: 160, r: 70 },
        },
        {
          id: "cp-east",
          dueSec: 55,
          label: "EAST",
          zone: { x: 1380, y: 450, r: 70 },
        },
        {
          id: "cp-south",
          dueSec: 75,
          label: "SOUTH",
          zone: { x: 800, y: 740, r: 70 },
        },
      ],
    },
    stars: {
      score: [90000, 200000],
      onTimeGates: [3, 4],
    },
    skillLesson: "Visit gate zones on pace — score on the way, don't stall.",
  },
  {
    id: "path-05-donut-orbit",
    name: "Pressure Orbit",
    tagline: "Survive longer as density and threats ramp hard.",
    chapter: 2,
    order: 5,
    mode: MODE.EVOLVED,
    arena: { topology: TOPOLOGY.RECT },
    rules: {
      durationSec: 90,
      lives: 3,
      bombs: 3,
      safeOpeningSec: 10,
      spawnRampSec: 70,
      softCap: 30,
      enemyUnlockScale: 0.95,
      bgm: 1,
      themeId: "donut-orbit",
    },
    stars: {
      score: [200000, 450000],
      peakMult: [35, 70],
    },
    skillLesson: "Keep moving, bank mult, respect late-game voids and snakes.",
  },
  {
    id: "path-06-split-signal",
    name: "Split Signal",
    tagline: "Six heavier waves — splitters and floods included.",
    chapter: 2,
    order: 6,
    mode: MODE.WAVES,
    arena: { topology: TOPOLOGY.RECT },
    rules: {
      lives: 3,
      bombs: 2,
      waveGapSec: 1.35,
      waveClearBonus: 400,
      allowImprov: false,
      durationSec: 120,
      bgm: 2,
      themeId: "split-signal",
      waves: [
        {
          id: "s1",
          label: "LEFT",
          types: ["wanderer"],
          count: 6,
          pattern: SPAWN_PATTERN.EDGE_LINE,
          patternOpts: { side: 2, stagger: 0.09 },
          delaySec: 0.5,
        },
        {
          id: "s2",
          label: "RIGHT",
          types: ["diamond"],
          count: 6,
          pattern: SPAWN_PATTERN.EDGE_LINE,
          patternOpts: { side: 3, stagger: 0.09 },
        },
        {
          id: "s3",
          label: "PINCER",
          types: ["pink", "wanderer"],
          count: 8,
          pattern: SPAWN_PATTERN.PINCER,
          patternOpts: { axis: "vertical", stagger: 0.07 },
        },
        {
          id: "s4",
          label: "SPLITTERS",
          types: ["splitter"],
          count: 3,
          pattern: SPAWN_PATTERN.CORNER_ARC,
          patternOpts: { corner: 0, stagger: 0.12 },
        },
        {
          id: "s5",
          label: "RING",
          types: ["spinner", "diamond"],
          count: 8,
          pattern: SPAWN_PATTERN.RING,
          patternOpts: { perSide: 2, stagger: 0.05 },
        },
        {
          id: "s6",
          label: "FLOOD",
          types: ["wanderer", "diamond"],
          count: 12,
          pattern: SPAWN_PATTERN.CORNER_FLOOD,
          patternOpts: { stagger: 0.045 },
        },
      ],
    },
    stars: {
      score: [120000, 280000],
      timeSecMax: [100, 80],
    },
    skillLesson: "Clear waves cleanly; bomb is insurance when floods land.",
  },
  {
    id: "path-07-torus-rush",
    name: "Torus Rush",
    tagline: "High target, short clock, thin lives.",
    chapter: 2,
    order: 7,
    mode: MODE.DEADLINE,
    arena: { topology: TOPOLOGY.RECT },
    rules: {
      durationSec: 75,
      targetScore: 250000,
      lives: 2,
      bombs: 2,
      safeOpeningSec: 5,
      spawnRampSec: 55,
      softCap: 32,
      enemyUnlockScale: 1.05,
      bgm: 1,
      themeId: "torus-rush",
    },
    stars: {
      score: [400000, 650000],
      timeLeftSec: [10, 20],
    },
    skillLesson: "Greedy mult farming under a hard timer — don't die for scraps.",
  },
  {
    id: "path-08-boss-pulse",
    name: "Boss Pulse",
    tagline: "Kill the elite tank. Adds keep coming until it falls.",
    chapter: 2,
    order: 8,
    mode: MODE.BOSS_LITE,
    arena: { topology: TOPOLOGY.RECT },
    rules: {
      durationSec: 120,
      lives: 3,
      bombs: 3,
      safeOpeningSec: 2,
      bgm: 2,
      themeId: "boss-pulse",
      boss: {
        type: "tank",
        hp: 14,
        score: 2500,
        spawn: { x: 800, y: 200 },
        label: "PULSE TANK",
        clearAdds: true,
        adds: {
          everySec: 6,
          types: ["wanderer", "diamond"],
          count: 5,
          pattern: SPAWN_PATTERN.EDGE_LINE,
        },
      },
    },
    stars: {
      score: [150000, 350000],
      livesLeft: [1, 2],
      timeSecMax: [90, 60],
    },
    skillLesson: "Prioritize the elite; bomb is insurance, not offense.",
  },
];

// ── Indexes ─────────────────────────────────────────────────

/** @type {Map<string, LevelDef>} */
const BY_ID = new Map(LEVELS.map((l) => [l.id, l]));

// ── Helpers ─────────────────────────────────────────────────

/**
 * @param {string} id
 * @returns {LevelDef | null}
 */
export function getLevel(id) {
  if (!id) return null;
  return BY_ID.get(id) || null;
}

/**
 * Resolve Path theme meta for a level. Missing assets fall back via meta.fallback.
 * @param {LevelDef | string | null | undefined} levelOrId
 * @returns {PathThemeMeta | null}
 */
export function getLevelTheme(levelOrId) {
  /** @type {LevelDef | null} */
  let level = null;
  if (typeof levelOrId === "string") level = getLevel(levelOrId);
  else if (levelOrId && typeof levelOrId === "object") level = levelOrId;
  if (!level) return null;
  const tid = level.rules?.themeId;
  if (tid && PATH_THEMES[tid]) return PATH_THEMES[tid];
  // Synthesize classic fallback meta from rules.bgm / order parity
  const bgm = level.rules?.bgm;
  let fb = 1;
  if (bgm === 2) fb = 2;
  else if (bgm === 1) fb = 1;
  else fb = level.order % 2 === 0 ? 2 : 1;
  return {
    id: fb === 1 ? "classic-1" : "classic-2",
    title: fb === 1 ? "Neon Swarm A" : "Neon Swarm B",
    src: fb === 1 ? "audio/neon-swarm-1.mp3" : "audio/neon-swarm-2.mp3",
    fallback: /** @type {1|2} */ (fb),
    mood: "Classic Neon Swarm fallback",
  };
}

/**
 * 0-based index in LEVELS, or -1.
 * @param {string} id
 */
export function getLevelIndex(id) {
  return LEVELS.findIndex((l) => l.id === id);
}

/** Path levels sorted by `order`. */
export function listPathLevels() {
  return LEVELS.slice().sort((a, b) => a.order - b.order);
}

/**
 * @param {number} chapter
 * @returns {LevelDef[]}
 */
export function listChapter(chapter) {
  return listPathLevels().filter((l) => l.chapter === chapter);
}

/**
 * @param {string} id
 * @returns {string | null} next level id, or null if last / unknown
 */
export function getNextLevelId(id) {
  const sorted = listPathLevels();
  const i = sorted.findIndex((l) => l.id === id);
  if (i < 0 || i >= sorted.length - 1) return null;
  return sorted[i + 1].id;
}

/**
 * @param {string} id
 * @returns {string | null}
 */
export function getPrevLevelId(id) {
  const sorted = listPathLevels();
  const i = sorted.findIndex((l) => l.id === id);
  if (i <= 0) return null;
  return sorted[i - 1].id;
}

/**
 * Empty / partial progress shape for unlock checks.
 * @param {Partial<PathProgress> | null | undefined} progress
 * @returns {PathProgress}
 */
export function normalizeProgress(progress) {
  const p = progress && typeof progress === "object" ? progress : {};
  return {
    stars: p.stars && typeof p.stars === "object" ? { ...p.stars } : {},
    bestScore:
      p.bestScore && typeof p.bestScore === "object" ? { ...p.bestScore } : {},
    bestTime:
      p.bestTime && typeof p.bestTime === "object" ? { ...p.bestTime } : {},
    updatedAt: p.updatedAt,
    version: 1,
  };
}

/**
 * ≥1★ on previous ordered level unlocks next. First / unlockDefault always open.
 * Classic Evolved ignores this helper entirely.
 *
 * @param {string} id
 * @param {Partial<PathProgress> | null | undefined} progress
 */
export function isUnlocked(id, progress) {
  const level = getLevel(id);
  if (!level) return false;
  if (level.unlockDefault || level.order <= 1) return true;

  const p = normalizeProgress(progress);
  const prevId = getPrevLevelId(id);
  if (!prevId) return true;
  return (p.stars[prevId] || 0) >= 1;
}

/**
 * @param {Partial<PathProgress> | null | undefined} progress
 * @returns {string[]}
 */
export function listUnlockedIds(progress) {
  return listPathLevels()
    .filter((l) => isUnlocked(l.id, progress))
    .map((l) => l.id);
}

/**
 * Tier for one metric family given [twoStar, threeStar] thresholds.
 * Higher-is-better metrics use >= ; timeSecMax uses <= .
 *
 * @param {number} value
 * @param {[number, number]} pair
 * @param {"gte"|"lte"} cmp
 * @returns {1|2|3}
 */
function tierFor(value, pair, cmp = "gte") {
  if (!pair || pair.length < 2) return 1;
  const [two, three] = pair;
  if (cmp === "lte") {
    if (value <= three) return 3;
    if (value <= two) return 2;
    return 1;
  }
  if (value >= three) return 3;
  if (value >= two) return 2;
  return 1;
}

/**
 * Star grade 0–3.
 * - Not cleared → 0
 * - Cleared → at least 1
 * - Each configured threshold family yields a tier; final = MIN(tiers)
 *
 * @param {LevelDef | string | null} levelOrId
 * @param {number} score
 * @param {LevelResultExtra} [extra]
 * @returns {0|1|2|3}
 */
export function computeStars(levelOrId, score, extra = { cleared: false }) {
  const level =
    typeof levelOrId === "string" ? getLevel(levelOrId) : levelOrId;
  if (!level) return 0;
  if (!extra || !extra.cleared) return 0;

  /** @type {number[]} family tiers only — cleared baseline is 1 if none configured */
  const tiers = [];
  const s = level.stars || {};
  const sc = Number(score) || 0;

  if (s.score) tiers.push(tierFor(sc, s.score, "gte"));
  if (s.peakMult && extra.peakMult != null) {
    tiers.push(tierFor(Number(extra.peakMult) || 0, s.peakMult, "gte"));
  }
  if (s.timeLeftSec && extra.timeLeftSec != null) {
    tiers.push(tierFor(Number(extra.timeLeftSec) || 0, s.timeLeftSec, "gte"));
  }
  if (s.timeSecMax && extra.elapsedSec != null) {
    tiers.push(tierFor(Number(extra.elapsedSec) || 0, s.timeSecMax, "lte"));
  }
  if (s.onTimeGates && extra.onTimeGates != null) {
    tiers.push(tierFor(Number(extra.onTimeGates) || 0, s.onTimeGates, "gte"));
  }
  if (s.livesLeft && extra.livesLeft != null) {
    tiers.push(tierFor(Number(extra.livesLeft) || 0, s.livesLeft, "gte"));
  }

  // No threshold families → clear alone is 1★
  if (!tiers.length) return 1;
  // Families present but extra omitted their values: only count families that contributed.
  // (Absent optional extras are skipped above; score always counts if configured.)
  const grade = Math.min(...tiers);
  return /** @type {0|1|2|3} */ (Math.max(1, Math.min(3, grade)));
}

/**
 * UI chapter blocks.
 * @returns {{ chapter: number, title: string, levelIds: string[] }[]}
 */
export function chapterMeta() {
  const chapters = [...new Set(LEVELS.map((l) => l.chapter))].sort(
    (a, b) => a - b
  );
  return chapters.map((chapter) => ({
    chapter,
    title: CHAPTER_TITLES[chapter] || `Chapter ${chapter}`,
    levelIds: listChapter(chapter).map((l) => l.id),
  }));
}

/** Total possible stars (3 × level count). */
export function maxPathStars() {
  return LEVELS.length * 3;
}

/**
 * @param {Partial<PathProgress> | null | undefined} progress
 */
export function totalStarsEarned(progress) {
  const p = normalizeProgress(progress);
  let n = 0;
  for (const l of LEVELS) n += Math.min(3, Math.max(0, p.stars[l.id] || 0));
  return n;
}

/**
 * Whether id is a known Path mode string.
 * @param {string} modeId
 */
export function isPathModeId(modeId) {
  return Object.values(MODE).includes(modeId);
}
