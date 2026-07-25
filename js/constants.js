/**
 * Geometry Arena — GOLDLOCKS PASS 1
 * Target: median death ~90–150s, scarce lives, single-stream skill gun,
 * readable density, mult as the real currency.
 *
 * See docs/GAMEPLAY_TUNING_RESEARCH.md
 */

/** Arena size */
export const WORLD_W = 1600;
export const WORLD_H = 900;

// ── Dial A: Player agency ────────────────────────────────
/** Top speed (px/s). Raised for snappier arena traversal; accel still ramps in. */
export const PLAYER_SPEED = 400;
export const PLAYER_RADIUS = 13;
export const PLAYER_ACCEL = 20;
export const PLAYER_DECEL = 13;

export const START_LIVES = 3;
export const START_BOMBS = 3;
/** Scarce — 4th/5th life is a treat */
export const MAX_LIVES = 5;
export const MAX_BOMBS = 5;

/**
 * Hard invuln windows (no overlap re-extend).
 * Freeze locks move/fire/bomb while you blink in; remaining invuln
 * lets you re-enter combat with control restored.
 */
export const RESPAWN_FREEZE_MS = 1100;
export const RESPAWN_INVULN_MS = 2600;
export const START_INVULN_MS = 1500;
export const RESPAWN_CLEAR_RADIUS = 280;
/** After death clear, cull board down toward this fraction of soft cap */
export const RESPAWN_ENEMY_SOFT_FRAC = 0.48;
export const RESPAWN_SPAWN_PAUSE = 1.15;
export const INVULN_MS = 1200;

/**
 * Base-progress economy (not mult-inflated score).
 * First extra life is expensive; each next life costs more (scale).
 * Wanderer = 100 base → first life ~320 kills of pure fodder.
 */
export const EXTRA_LIFE_EVERY = 32000;
/** Each subsequent extra-life milestone multiplies the interval */
export const EXTRA_LIFE_SCALE = 1.45;
export const EXTRA_BOMB_EVERY = 38000;

/**
 * Death mult tax: keep a recovery seed so late-game density isn't
 * "needle gun vs full swarm". Still a hard hit — never gain mult.
 */
export const DEATH_MULT_KEEP = 0.28;
export const DEATH_MULT_KEEP_CAP = 48;

/** Single needle ~8 shots/sec; mult only trims a little */
export const BULLET_SPEED = 760;
export const BULLET_RADIUS = 3;
export const BULLET_LIFETIME = 2.4;
export const FIRE_COOLDOWN = 0.13;
export const FIRE_COOLDOWN_MIN = 0.095;
export const FIRE_SPREAD = 0.04;
/** Dual/triple are late mult rewards only */
export const MULT_FOR_DUAL = 45;
export const MULT_FOR_TRIPLE = 110;

export const AIM_SENSITIVITY = 0.055;
export const AIM_RETICLE_DIST = 56;

/** Stick magnitude below this is ignored (drift / resting noise). */
export const GAMEPAD_DEADZONE = 0.18;
/** Analog trigger (RT) must exceed this to count as fire. */
export const GAMEPAD_FIRE_THRESHOLD = 0.35;

/** Virtual stick max radius in CSS px before full tilt. */
export const TOUCH_STICK_RADIUS = 54;
/** Same deadzone ratio as gamepad for thumb sticks. */
export const TOUCH_DEADZONE = 0.16;
/** Cap DPR on coarse/touch devices for battery + heat. */
export const TOUCH_MAX_DPR = 1.5;

// ── Dial B: Density (ease-in toward ~2–3 min intensity) ──
export const MAX_ENEMIES = 55;
/** Slow opening tempo */
export const SPAWN_INTERVAL_START = 1.75;
/** Late floor — tense but not instant flood */
export const SPAWN_INTERVAL_MIN = 0.24;
/**
 * Density approaches floor over this window.
 * t² ease-in → real pressure lands ~90–140s (goldilocks median death band).
 */
export const SPAWN_RAMP_SECONDS = 145;
/** Fodder-only teach window */
export const SAFE_OPENING_SEC = 20;
export const WAVE_BURST_MIN = 1;
export const WAVE_BURST_MAX = 8;
/** Sawtooth breathing room */
export const WAVE_LULL_START = 1.4;
export const WAVE_LULL_MIN = 0.42;

/**
 * Phrase-based wave director (GW cadence).
 * Scripted beats + intensity-scaled lulls; improvisation after intros land.
 */
export const PHRASE = {
  /** Gap between multi-beat phrase halves (seconds) */
  BEAT_GAP: 0.55,
  /** Player-circle ambush */
  CIRCLE_MIN_ELAPSED: 55,
  CIRCLE_COOLDOWN: 28,
  CIRCLE_RADIUS: 165,
  CIRCLE_COUNT_MIN: 8,
  CIRCLE_COUNT_MAX: 14,
  /** 4-corner flood (jacks-like path cut) */
  FLOOD_MIN_ELAPSED: 70,
  FLOOD_COOLDOWN: 32,
  FLOOD_PER_CORNER: 4,
  /** Min distance from player for any job spawn point */
  SAFE_SPAWN_DIST: 110,
  /** Lull multipliers by phrase intensity tag */
  LULL_SCALE: {
    soft: 0.85,
    normal: 1,
    hard: 1.35,
    setpiece: 1.55,
  },
};

/**
 * Soft enemy caps by elapsed time (anti-flood, keeps formations readable).
 * Tuned so mid-game (45–90s) has teeth without becoming soup.
 */
export const SOFT_CAP = {
  opening: 7, // < SAFE_OPENING_SEC
  early: 14, // < 50s
  mid: 26, // < 100s
  late: 40, // < 150s
  end: 55, // MAX_ENEMIES
};

// ── Dial D: Mult economy ─────────────────────────────────
export const MULT_MAX = 999;
export const GEOM_MULT = 1;
/** Small pickups — must not read as enemies on approach */
export const GEOM_RADIUS = 3.2;
export const GEOM_MAGNET_RANGE = 175;
export const GEOM_MAGNET_SPEED = 380;
export const GEOM_LIFE = 14;
export const GEOM_VACUUM_MILESTONES = [5, 10, 15, 25, 40, 60, 80, 100, 150, 200, 300, 500];
export const BOARD_CLEAR_BASE = 500;
export const BOARD_CLEAR_PER_MULT = 40;
export const BOARD_CLEAR_PROGRESS = 120;
/** Brief aim adjustments shouldn't dump mult instantly */
export const MULT_IDLE_BEFORE_DECAY = 3.2;
export const MULT_DECAY_INTERVAL = 0.7;

// ── Juice (visual only) ──────────────────────────────────
export const PARTICLE_MAX = 1600;
export const FLOATER_MAX = 56;
export const AFTERIMAGE_MAX = 12;
export const GRID_STEP = 34;
export const GRID_IMPULSE_MAX = 36;
export const HOVER_HEIGHT = 8;
export const SHADOW_OX = 5;
export const SHADOW_OY = 11;

/**
 * Post-process / presentation pipeline (Phase A visual upgrade).
 * Tuned for sharp retina + soft bloom without washing the floor.
 */
export const GFX = {
  /** Cap devicePixelRatio so 3× displays don’t melt GPUs */
  MAX_DPR: 2,
  /** Bloom buffer scale vs world (lower = cheaper, softer) */
  BLOOM_RES: 0.42,
  /** CSS filter blur radius in bloom-buffer pixels */
  BLOOM_BLUR_PX: 6,
  BLOOM_BRIGHTNESS: 1.22,
  BLOOM_CONTRAST: 1.12,
  /** How hard bloom adds back onto the frame (lighter composite) */
  BLOOM_STRENGTH: 0.32,
  /** Second softer bloom pass strength (wide halo) — keep low so floor grid stays dark */
  BLOOM_WIDE_STRENGTH: 0.12,
  BLOOM_WIDE_BLUR_PX: 12,
  BLOOM_WIDE_RES: 0.22,
  /** Trauma chromatic fringe */
  CA_TRAUMA_MIN: 0.05,
  CA_MAX_OFFSET_PX: 5,
  CA_ALPHA: 0.32,
  /** Mult color-grade (log-scaled intensity) */
  GRADE_BASE_ALPHA: 0.1,
  GRADE_MULT_ALPHA: 0.22,
  /** Vignette edge darkness at mult=1 and high mult */
  VIGNETTE_BASE: 0.58,
  VIGNETTE_MULT_EXTRA: 0.18,
};

export const COLORS = {
  bg: "#020208",
  bgDeep: "#000005",
  grid: "rgba(40, 120, 255, 0.16)",
  gridMajor: "rgba(90, 190, 255, 0.32)",
  gridGlow: "rgba(70, 170, 255, 0.5)",
  player: "#5efcff",
  playerGlow: "#2ad4ff",
  playerCore: "#ffffff",
  bullet: "#ffffff",
  bulletCore: "#a8f7ff",
  wanderer: "#3dff7a",
  diamond: "#2adfff",
  spinner: "#d06bff",
  tank: "#ff9a2e",
  snake: "#ff3db5",
  pink: "#ff4da6",
  splitter: "#b44dff",
  void: "#6b5cff",
  atom: "#c8b8ff",
  geom: "#b8ff4a",
  danger: "#ff3355",
  bomb: "#ffe14a",
  text: "#f2f6ff",
};

// ── Dial C: Enemy roles (speeds for ~90–150s pressure) ───
export const ENEMY = {
  wanderer: {
    type: "wanderer",
    speed: 90,
    radius: 12,
    hp: 1,
    score: 100,
    color: COLORS.wanderer,
    geoms: 1,
  },
  diamond: {
    type: "diamond",
    speed: 150,
    radius: 11,
    hp: 1,
    score: 150,
    color: COLORS.diamond,
    geoms: 1,
  },
  pink: {
    type: "pink",
    speed: 60,
    dashSpeed: 270,
    radius: 11,
    hp: 1,
    score: 175,
    color: COLORS.pink,
    geoms: 1,
  },
  spinner: {
    type: "spinner",
    speed: 108,
    radius: 13,
    hp: 1,
    score: 200,
    color: COLORS.spinner,
    orbit: 2.0,
    geoms: 2,
  },
  splitter: {
    type: "splitter",
    speed: 80,
    radius: 16,
    hp: 1,
    score: 250,
    color: COLORS.splitter,
    geoms: 2,
  },
  splitterChild: {
    type: "splitterChild",
    speed: 128,
    radius: 8,
    hp: 1,
    score: 75,
    color: COLORS.splitter,
    geoms: 1,
  },
  snake: {
    type: "snake",
    speed: 122,
    radius: 10,
    hp: 1,
    score: 400,
    color: COLORS.snake,
    geoms: 3,
    segments: 9,
    spacing: 13,
  },
  tank: {
    type: "tank",
    speed: 54,
    radius: 20,
    hp: 3,
    score: 350,
    color: COLORS.tank,
    geoms: 3,
  },
  void: {
    type: "void",
    speed: 24,
    radius: 22,
    hp: 8,
    score: 800,
    color: COLORS.void,
    geoms: 5,
    pull: 75,
    spawnInterval: 2.6,
  },
  atom: {
    type: "atom",
    speed: 155,
    radius: 7,
    hp: 1,
    score: 50,
    color: COLORS.atom,
    geoms: 1,
  },
};

/**
 * Threat introduction schedule (seconds).
 * First real threat ~35s; void ~105s (priority target, not opening spam).
 */
export const SPAWN_TABLE = [
  { type: "wanderer", weight: 1.25, unlockAt: 0 },
  { type: "diamond", weight: 0.6, unlockAt: 20 },
  { type: "pink", weight: 0.5, unlockAt: 35 },
  { type: "spinner", weight: 0.42, unlockAt: 48 },
  { type: "splitter", weight: 0.38, unlockAt: 62 },
  { type: "snake", weight: 0.32, unlockAt: 78 },
  { type: "tank", weight: 0.3, unlockAt: 95 },
  { type: "void", weight: 0.12, unlockAt: 105 },
];

export const HS_KEY = "geometry-arena-highscore";

/** Level / BGM cadence (~50s → track swap near mid-run) */
export const LEVEL_DURATION_SEC = 50;
export const BGM_TRACKS = [
  "audio/neon-swarm-1.mp3",
  "audio/neon-swarm-2.mp3",
];
export const BGM_VOLUME = 0.38;
