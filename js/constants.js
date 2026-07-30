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
export const TOUCH_MAX_DPR = 1.25;

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
/**
 * Geom lifetime (seconds). Must be short enough that clearing a pack then
 * leisurely vacuuming is a bad plan — force risk/reward dives for mult.
 * Was 14s (felt permanent). GW energy: grab now or lose the stack.
 */
export const GEOM_LIFE = 5.2;
/** Start blinking/fading when remaining life is below this (seconds). */
export const GEOM_FADE_SEC = 1.35;
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
 * Presentation quality tiers.
 * `high` — full desktop neon pipeline (offscreen world + bloom + CA).
 * `low`  — mobile/iPad path: draw straight to the visible canvas, no heavy post.
 *
 * Console override:
 *   setGfxQuality('low' | 'high')
 *   GFX.QUALITY_FORCE = 'low' // sticky until cleared
 */
export const GFX_QUALITY_PRESETS = {
  high: {
    id: "high",
    maxDpr: 2,
    touchMaxDpr: 1.5,
    bloom: true,
    chromatic: true,
    colorGrade: true,
    vignette: true,
    /** Offscreen world buffer required for bloom / chromatic passes */
    offscreenWorld: true,
    /** Full multi-pass neon + local radial blooms */
    fancyNeon: true,
    localBloom: true,
    /** Warped reactive grid + underlay + under-grid */
    fancyGrid: true,
    gridStepMul: 1,
    /** Floor contact shadows under entities */
    floorShadows: "all", // 'all' | 'player' | 'none'
    particleScale: 1,
    particleMax: 1600,
    floaterMax: 56,
    afterimageMax: 12,
    floaterShadow: true,
    reducedFlash: false,
  },
  low: {
    id: "low",
    // 1× device pixels — biggest remaining mobile win after killing post-FX
    maxDpr: 1,
    touchMaxDpr: 1,
    bloom: false,
    chromatic: false,
    colorGrade: false,
    vignette: false,
    offscreenWorld: false,
    // 2-pass stroke instead of 4–5; no per-entity radial blooms
    fancyNeon: false,
    localBloom: false,
    // Straight grid, coarser step, no psychedelic underlay / under-grid
    fancyGrid: false,
    gridStepMul: 1.65,
    // Player shadow only — skip enemy/geom contact lights
    floorShadows: "player",
    // Cut debris + vacuum density hard
    particleScale: 0.35,
    particleMax: 420,
    floaterMax: 18,
    afterimageMax: 4,
    floaterShadow: false,
    reducedFlash: true,
  },
};

/**
 * Phones / tablets where Canvas2D blur post-FX tanks the frame budget.
 * Mirrors main.js touch chrome heuristics (coarse pointer or narrow + touch).
 */
export function preferMobileGraphics() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const touchPoints = navigator.maxTouchPoints || 0;
  if (touchPoints <= 0) return false;
  try {
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
    const narrow = window.matchMedia?.("(max-width: 900px)")?.matches;
    if (coarse || narrow) return true;
  } catch {
    /* ignore matchMedia failures */
  }
  // iPadOS desktop-class UA still reports touch points; treat as mobile GPU path
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && touchPoints > 1) return true;
  return false;
}

/** Resolve active tier id from force override or device heuristics. */
export function resolveGfxQuality() {
  const force = GFX.QUALITY_FORCE;
  if (force === "high" || force === "low") return force;
  return preferMobileGraphics() ? "low" : "high";
}

/**
 * Apply a quality preset onto the live GFX flags used by the render path.
 * @param {"high"|"low"} [tier]
 * @returns {"high"|"low"}
 */
export function applyGfxQuality(tier) {
  const id = tier === "low" || tier === "high" ? tier : resolveGfxQuality();
  const preset = GFX_QUALITY_PRESETS[id] || GFX_QUALITY_PRESETS.high;
  GFX.QUALITY = preset.id;
  GFX.MAX_DPR = preset.maxDpr;
  GFX.TOUCH_MAX_DPR = preset.touchMaxDpr;
  GFX.ENABLE_BLOOM = !!preset.bloom;
  GFX.ENABLE_CHROMATIC = !!preset.chromatic;
  GFX.ENABLE_COLOR_GRADE = !!preset.colorGrade;
  GFX.ENABLE_VIGNETTE = !!preset.vignette;
  GFX.USE_OFFSCREEN_WORLD = !!preset.offscreenWorld;
  GFX.FANCY_NEON = preset.fancyNeon !== false;
  GFX.LOCAL_BLOOM = preset.localBloom !== false;
  GFX.FANCY_GRID = preset.fancyGrid !== false;
  GFX.GRID_STEP_MUL = Math.max(1, preset.gridStepMul || 1);
  GFX.FLOOR_SHADOWS = preset.floorShadows || "all";
  GFX.PARTICLE_SCALE = Math.max(0.05, preset.particleScale ?? 1);
  GFX.PARTICLE_MAX_LIVE = Math.max(40, preset.particleMax ?? PARTICLE_MAX);
  GFX.FLOATER_MAX_LIVE = Math.max(4, preset.floaterMax ?? FLOATER_MAX);
  GFX.AFTERIMAGE_MAX_LIVE = Math.max(0, preset.afterimageMax ?? AFTERIMAGE_MAX);
  GFX.FLOATER_SHADOW = !!preset.floaterShadow;
  // Low tier also damps flash-heavy paths already gated by REDUCED_FLASH
  GFX.REDUCED_FLASH = !!preset.reducedFlash;
  return preset.id;
}

/**
 * Post-process / presentation pipeline.
 * Sektori-leaning: hotter multi-hue grade, stronger neon bloom, techno breath,
 * front-loaded debris. REDUCED_FLASH softens CA / bomb strobe / underlay pulse.
 *
 * Runtime quality flags (ENABLE_*) are owned by applyGfxQuality — do not hand-edit
 * those unless you also set QUALITY_FORCE.
 */
export const GFX = {
  /** Active tier id after applyGfxQuality() */
  QUALITY: "high",
  /**
   * Sticky override: 'high' | 'low' | null.
   * Console: GFX.QUALITY_FORCE = 'low'; applyGfxQuality(); __geometryArena.fitCanvas()
   */
  QUALITY_FORCE: null,
  /** Cap devicePixelRatio so 3× displays don’t melt GPUs */
  MAX_DPR: 2,
  /** Extra cap while touch chrome is active (phones / tablets) */
  TOUCH_MAX_DPR: 1.25,
/** Heavy post passes — disabled on the mobile quality path */
  ENABLE_BLOOM: true,
  ENABLE_CHROMATIC: true,
  ENABLE_COLOR_GRADE: true,
  ENABLE_VIGNETTE: true,
  /** When false, world draws straight to the visible canvas (no blit / bloom buffers) */
  USE_OFFSCREEN_WORLD: true,
  /** Multi-pass neon strokes + white hot core */
  FANCY_NEON: true,
  /** Per-entity radial gradient blooms (very expensive on mobile GPU) */
  LOCAL_BLOOM: true,
  /** Warped grid, underlay, under-grid, impulse shimmer */
  FANCY_GRID: true,
  /** Multiplier on GRID_STEP (higher = fewer lines) */
  GRID_STEP_MUL: 1,
  /** 'all' | 'player' | 'none' */
  FLOOR_SHADOWS: "all",
  /** Scales burst/vacuum particle counts */
  PARTICLE_SCALE: 1,
  PARTICLE_MAX_LIVE: 1600,
  FLOATER_MAX_LIVE: 56,
  AFTERIMAGE_MAX_LIVE: 12,
  FLOATER_SHADOW: true,
  /** Bloom buffer scale vs world (lower = cheaper, softer) */
  BLOOM_RES: 0.42,
  /** CSS filter blur radius in bloom-buffer pixels */
  BLOOM_BLUR_PX: 6,
  BLOOM_BRIGHTNESS: 1.3,
  BLOOM_CONTRAST: 1.18,
  /** How hard bloom adds back onto the frame (lighter composite) */
  BLOOM_STRENGTH: 0.4,
  /** Second softer bloom pass strength (wide halo) */
  BLOOM_WIDE_STRENGTH: 0.16,
  BLOOM_WIDE_BLUR_PX: 14,
  BLOOM_WIDE_RES: 0.22,
  /** Trauma chromatic fringe */
  CA_TRAUMA_MIN: 0.04,
  CA_MAX_OFFSET_PX: 6,
  CA_ALPHA: 0.34,
  /** Mult color-grade — present but not floor-washing */
  GRADE_BASE_ALPHA: 0.1,
  GRADE_MULT_ALPHA: 0.26,
  /** Vignette edge darkness at mult=1 and high mult */
  VIGNETTE_BASE: 0.58,
  VIGNETTE_MULT_EXTRA: 0.2,
  /**
   * Accessibility: damp flash-heavy effects (CA, bomb flash, underlay pulse).
   * Toggle from console: GFX.REDUCED_FLASH = true
   */
  REDUCED_FLASH: false,
  /**
   * Fake techno BPM for grid/bloom breath (no true beat detection).
   * Half-note @ 128 BPM ≈ 0.94s period.
   */
  TECHNO_BPM: 128,
  /** Beats per full sine cycle (2 = half-note breath, 4 = whole-note) */
  TECHNO_PULSE_BEATS: 2,
  /** Grid major-beam alpha modulation depth (0..1) from techno pulse */
  GRID_PULSE_DEPTH: 0.2,
  /** Bloom strength modulation depth from techno pulse */
  BLOOM_PULSE_DEPTH: 0.1,
  /**
   * Psychedelic underlay — accent only. Too high washes entity contrast.
   * Keep dark floor dominant; shapes carry the color.
   */
  UNDERLAY_ALPHA: 0.09,
  UNDERLAY_ALPHA_REDUCED: 0.035,
  /**
   * Enemy enter 0→1 timeline (Sektori outline telegraph):
   * enter < OUTLINE_END → thick red stroke only, no collision
   * then fill + neon solidify. Target ~450ms outline window.
   */
  ENEMY_OUTLINE_END: 0.58,
  ENEMY_ENTER_RATE: 1.28,
  /** Kill debris: prefer short hot streaks over lingering soft dots */
  KILL_STREAK_LIFE: 0.26,
  KILL_SOFT_LIFE: 0.32,
};

// Default tier for the current environment (no-ops headless UAT without window).
applyGfxQuality(resolveGfxQuality());

/**
 * Classic arena morph (Sektori-style spatial pressure).
 * Cycles topologies with a red danger telegraph before lock-in.
 * Path levels stay static unless a level opts in later.
 */
export const MORPH = {
  ENABLED_CLASSIC: true,
  /** First morph warn starts after this many seconds of a Classic run */
  FIRST_AT: 18,
  /** Seconds between morph commits (warn is inside this window) */
  INTERVAL: 12,
  /** Red flash warning before topology locks */
  WARN_SEC: 2.0,
  /** Cycle of arena refs (wraps). Keep shapes fair on laptop. */
  SHAPES: [
    { topology: "rect" },
    { topology: "rect_tight", params: { width: 1180, height: 700 } },
    { topology: "corridor", params: { axis: "x", halfWidth: 195 } },
    { topology: "rect_wide", params: { width: 1520, height: 600 } },
    { topology: "cross", params: { armHalfWidth: 205 } },
    { topology: "rect_tight", params: { width: 1000, height: 780 } },
    { topology: "corridor", params: { axis: "y", halfWidth: 195 } },
    { topology: "rect" },
  ],
};

export const COLORS = {
  bg: "#020208",
  bgDeep: "#000005",
  // Grid: cyan primary with a touch of violet — not a purple wash
  grid: "rgba(55, 130, 255, 0.17)",
  gridMajor: "rgba(110, 170, 255, 0.34)",
  gridGlow: "rgba(120, 160, 255, 0.48)",
  player: "#7cfff0",
  playerGlow: "#3ae8ff",
  playerCore: "#ffffff",
  bullet: "#ffffff",
  bulletCore: "#b8fbff",
  // Enemy cast: pure primaries/secondaries against void (Sektori multi-hue)
  wanderer: "#3dff7a",
  diamond: "#1ae8ff",
  spinner: "#d86bff",
  tank: "#ff9a2e",
  snake: "#ff2eb8",
  pink: "#ff3db8",
  splitter: "#c24dff",
  void: "#7a5cff",
  atom: "#d4c4ff",
  geom: "#e8ff5a",
  /** Sacred threat telegraph — spawn outlines + danger only */
  danger: "#ff1a3c",
  bomb: "#ffe14a",
  text: "#f2f6ff",
  /** Future system tokens (selector / evolver) — semantic palette */
  selector: "#3d8cff",
  evolver: "#ffd84a",
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
