import {
  AFTERIMAGE_MAX,
  AIM_RETICLE_DIST,
  COLORS,
  DEATH_MULT_KEEP,
  DEATH_MULT_KEEP_CAP,
  EXTRA_BOMB_EVERY,
  EXTRA_LIFE_EVERY,
  EXTRA_LIFE_SCALE,
  MAX_BOMBS,
  MAX_LIVES,
  FIRE_COOLDOWN,
  LEVEL_DURATION_SEC,
  FIRE_COOLDOWN_MIN,
  FIRE_SPREAD,
  MULT_FOR_DUAL,
  BOARD_CLEAR_BASE,
  BOARD_CLEAR_PER_MULT,
  BOARD_CLEAR_PROGRESS,
  GEOM_MULT,
  GEOM_VACUUM_MILESTONES,
  GFX,
  TOUCH_MAX_DPR,
  GRID_IMPULSE_MAX,
  HS_KEY,
  INVULN_MS,
  MAX_ENEMIES,
  RESPAWN_CLEAR_RADIUS,
  RESPAWN_ENEMY_SOFT_FRAC,
  RESPAWN_FREEZE_MS,
  RESPAWN_INVULN_MS,
  RESPAWN_SPAWN_PAUSE,
  START_INVULN_MS,
  MULT_DECAY_INTERVAL,
  MULT_FOR_TRIPLE,
  MULT_IDLE_BEFORE_DECAY,
  MULT_MAX,
  SAFE_OPENING_SEC,
  SOFT_CAP,
  SPAWN_INTERVAL_MIN,
  SPAWN_INTERVAL_START,
  SPAWN_RAMP_SECONDS,
  SPAWN_TABLE,
  START_BOMBS,
  START_LIVES,
  WAVE_LULL_MIN,
  WAVE_LULL_START,
  WORLD_H,
  WORLD_W,
} from "./constants.js";
import { AudioBus } from "./audio.js";
import {
  createBullet,
  createGeom,
  createPlayer,
  pickSpawnType,
  snakeSegments,
  spawnEnemy,
  spawnSplitterChildren,
  updateBullets,
  updateEnemies,
  updateGeoms,
  updatePlayer,
} from "./entities.js";
import {
  addTrauma,
  applyCameraTransform,
  createCamera,
  punchZoom,
  recoil,
  resetCamera,
  updateCamera,
  updateMenuCamera,
} from "./camera.js";
import { Input } from "./input.js";
import { ParticleSystem } from "./particles.js";
import { circlesOverlap } from "./physics.js";
import {
  dumpRunsToConsole,
  formatRunsSummary,
  getRecentRuns,
  recordDeath,
  recordRun,
} from "./runs.js";
import { buildWaveJobs } from "./spawns.js";
import {
  drawAfterimages,
  drawAimReticle,
  drawBombFlash,
  drawBullets,
  drawEnemies,
  drawFloorShadows,
  drawGeoms,
  drawGrid,
  drawPlayer,
} from "./render.js";
import {
  compositeBloom,
  compositeChromatic,
  drawColorGrade,
  drawPostVignette,
} from "./postfx.js";

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx =
      canvas.getContext("2d", { alpha: false, desynchronized: true }) ||
      canvas.getContext("2d", { alpha: false }) ||
      canvas.getContext("2d");
    this.ui = ui;

    /** @type {number} */
    this.dpr = 1;
    /**
     * Presentation buffers (browser only). Node UAT has no `document` —
     * buffers stay null and _draw no-ops the post path safely.
     */
    this.worldCanvas = null;
    this.worldCtx = null;
    this.bloomTight = null;
    this.bloomWide = null;
    this._initPresentationBuffers();

    this.state = "menu";
    this.player = createPlayer();
    this.bullets = [];
    this.enemies = [];
    this.geoms = [];
    this.gridImpulses = [];
    this.particles = new ParticleSystem();
    this.audio = new AudioBus();

    this.score = 0;
    this.best = Number(localStorage.getItem(HS_KEY) || 0);
    this.lives = START_LIVES;
    this.bombs = START_BOMBS;
    this.mult = 1; // integer geom mult (GW RE2-style economy)
    this.multIdle = 0;
    this.multDecayAcc = 0;
    this.elapsed = 0;
    this.spawnTimer = 0.3;
    this.waveLeft = 0;
    /** @type {import('./spawns.js').SpawnJob[]} */
    this.spawnQueue = [];
    this.cam = createCamera();
    this.bombFlash = 0;
    this.nextLifeAt = EXTRA_LIFE_EVERY;
    this.nextBombAt = EXTRA_BOMB_EVERY;
    /** How many extra lives granted this run (escalating cost) */
    this.livesAwarded = 0;
    /** Unmultiplied progress for life/bomb awards (not display score) */
    this.progress = 0;
    this.peakMult = 1;
    this.deathCount = 0;
    this.afterimages = [];
    this.afterimageTimer = 0;
    this.time = 0;
    this.lastTime = 0;
    this.raf = 0;

    this.display = { left: 0, top: 0, width: WORLD_W, height: WORLD_H, scale: 1 };

    this.input = new Input(canvas);

    this._onResize = () => this.fitCanvas();
    window.addEventListener("resize", this._onResize);
    this.fitCanvas();

    this.level = 1;
    this.levelTimer = 0;
    this.geomVacuum = 0;
    this.nextVacuumAt = GEOM_VACUUM_MILESTONES[0] || 5;
    this.boardWasPopulated = false;
    this.clearCooldown = 0;

    this.ui.updateScore(0);
    this.ui.updateMult(1);
    this.ui.updateLives(START_LIVES);
    this.ui.updateBombs?.(START_BOMBS);
    this.ui.updateBest(this.best);
    this.ui.updateLevel?.(1);

    this._loop = this._loop.bind(this);
    this.raf = requestAnimationFrame(this._loop);
  }

  _initPresentationBuffers() {
    if (typeof document === "undefined" || !document.createElement) return;
    this.worldCanvas = document.createElement("canvas");
    this.worldCtx =
      this.worldCanvas.getContext("2d", { alpha: false }) ||
      this.worldCanvas.getContext("2d");
    this.bloomTight = document.createElement("canvas");
    this.bloomWide = document.createElement("canvas");
  }

  fitCanvas() {
    if (!this.worldCanvas) this._initPresentationBuffers();
    const wrap = this.canvas.parentElement;
    // Use full stage area; small padding so border glow still shows
    const pad = 4;
    const maxW = Math.max(320, (wrap ? wrap.clientWidth : window.innerWidth) - pad);
    const maxH = Math.max(180, (wrap ? wrap.clientHeight : window.innerHeight) - pad);
    const scale = Math.min(maxW / WORLD_W, maxH / WORLD_H);
    const cssW = Math.floor(WORLD_W * scale);
    const cssH = Math.floor(WORLD_H * scale);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;

    // Retina / HiDPI backing store (capped; lower on touch UI for heat/battery)
    const touchUi =
      typeof document !== "undefined" &&
      document.body?.classList?.contains("touch-ui");
    const dprCap = touchUi ? Math.min(GFX.MAX_DPR, TOUCH_MAX_DPR) : GFX.MAX_DPR;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    this.dpr = dpr;
    const bw = Math.max(1, Math.round(WORLD_W * dpr));
    const bh = Math.max(1, Math.round(WORLD_H * dpr));

    if (this.canvas.width !== bw) this.canvas.width = bw;
    if (this.canvas.height !== bh) this.canvas.height = bh;
    if (this.worldCanvas) {
      if (this.worldCanvas.width !== bw) this.worldCanvas.width = bw;
      if (this.worldCanvas.height !== bh) this.worldCanvas.height = bh;
    }

    if (this.bloomTight && this.bloomWide) {
      const tw = Math.max(2, Math.round(WORLD_W * dpr * GFX.BLOOM_RES));
      const th = Math.max(2, Math.round(WORLD_H * dpr * GFX.BLOOM_RES));
      if (this.bloomTight.width !== tw) this.bloomTight.width = tw;
      if (this.bloomTight.height !== th) this.bloomTight.height = th;

      const ww = Math.max(2, Math.round(WORLD_W * dpr * GFX.BLOOM_WIDE_RES));
      const wh = Math.max(2, Math.round(WORLD_H * dpr * GFX.BLOOM_WIDE_RES));
      if (this.bloomWide.width !== ww) this.bloomWide.width = ww;
      if (this.bloomWide.height !== wh) this.bloomWide.height = wh;
    }

    const rect = this.canvas.getBoundingClientRect();
    this.display = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      scale,
      dpr,
    };
  }

  start() {
    this.score = 0;
    this.lives = START_LIVES;
    this.bombs = START_BOMBS;
    this.mult = 1;
    this.multIdle = 0;
    this.multDecayAcc = 0;
    this.elapsed = 0;
    this.level = 1;
    this.levelTimer = 0;
    this.geomVacuum = 0;
    this.nextVacuumAt = GEOM_VACUUM_MILESTONES[0] || 5;
    this.boardWasPopulated = false;
    this.clearCooldown = 0;
    this.spawnTimer = 1.2; // first enemies after a beat
    this.waveLeft = 0;
    this.spawnQueue = [];
    this.bombFlash = 0;
    this.nextLifeAt = EXTRA_LIFE_EVERY;
    this.nextBombAt = EXTRA_BOMB_EVERY;
    this.livesAwarded = 0;
    this.progress = 0;
    this.peakMult = 1;
    this.deathCount = 0;
    this.afterimages = [];
    this.afterimageTimer = 0;
    this.time = 0;
    this.bullets = [];
    this.enemies = [];
    this.geoms = [];
    this.gridImpulses = [];
    this.particles.clear();
    this.player = createPlayer();
    resetCamera(this.cam);
    // Opening mercy invincibility (shmup/GW-style spawn protection)
    this.player.invuln = START_INVULN_MS;
    this.player.controlLock = 0;
    this.input.resetAim();
    this.input.clearFireButton();
    this.input.clearEdgeActions();
    this.state = "playing";
    this.audio.ensure();
    this.audio.start();
    // Level 1 → Neon Swarm variant 1
    this.audio.playLevelTheme(1, { restart: true });
    this.ui.hideOverlay();
    this.ui.updateScore(0);
    this.ui.updateMult(1);
    this.ui.updateLives(this.lives);
    this.ui.updateBombs?.(this.bombs);
    this.ui.updateLevel?.(1);
    this.fitCanvas();
    this.input.requestPointerLock();
  }

  pause() {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.input.exitPointerLock();
    this.audio.pauseBgm();
    // Single primary button only (showResume would duplicate "Resume")
    this.ui.showOverlay("Paused", "Take a breath. The shapes can wait.", false, "Resume", () =>
      this.resume()
    );
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.input.clearFireButton();
    this.input.clearEdgeActions();
    this.ui.hideOverlay();
    this.lastTime = performance.now();
    this.audio.resumeBgm();
    this.input.requestPointerLock();
  }

  _advanceLevel() {
    this.level += 1;
    this.levelTimer = 0;
    this.ui.updateLevel?.(this.level);
    this.audio.levelUp();
    // Odd levels → track 1, even → track 2 (both Suno variants)
    this.audio.playLevelTheme(this.level, { restart: true });
    this.particles.floater(
      this.player.x,
      this.player.y - 36,
      `LEVEL ${this.level}`,
      COLORS.player,
      1.35
    );
    addTrauma(this.cam, 0.16, { big: true });
    punchZoom(this.cam, 0.04);
    this._gridPulse(this.player.x, this.player.y, 1.6);
    // Brief mercy + spawn pressure bump
    this.player.invuln = Math.max(this.player.invuln, 500);
    this.spawnTimer = Math.min(this.spawnTimer, 0.15);
  }

  toggleMute() {
    const on = this.audio.toggle();
    this.ui.setMuteLabel(on);
  }

  gameOver() {
    this.state = "gameover";
    this.input.exitPointerLock();
    this.audio.gameOver();
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(HS_KEY, String(this.best));
      this.ui.updateBest(this.best);
    }

    const run = {
      elapsed: Math.round(this.elapsed),
      level: this.level,
      score: this.score,
      peakMult: this.peakMult,
      mult: this.mult,
      deaths: this.deathCount,
      bombsLeft: this.bombs,
    };
    const recent = recordRun(run);
    dumpRunsToConsole();

    const timeStr =
      run.elapsed >= 60
        ? `${Math.floor(run.elapsed / 60)}m ${run.elapsed % 60}s`
        : `${run.elapsed}s`;
    const summary = formatRunsSummary(recent.slice(0, 5));
    this.ui.showOverlay(
      "Game Over",
      `This run: ${timeStr} · ${this.score.toLocaleString()} · peak ×${this.peakMult} · ${this.deathCount} death(s)\nBest ${this.best.toLocaleString()}\n\nLast runs:\n${summary}`,
      false,
      "Play Again",
      () => this.start()
    );
  }

  /**
   * @param {number} points — mult-inflated score for the high-score chase
   * @param {number} [basePoints] — unmultiplied progress for life/bomb economy
   */
  _addScore(points, x, y, basePoints = null) {
    this.score += points;
    this.ui.updateScore(this.score);
    if (x != null) {
      this.particles.floater(x, y, `+${points}`, COLORS.playerCore);
    }

    // Milestone economy uses base progress so high mult can't print free lives
    const prog = basePoints != null ? basePoints : points;
    if (prog > 0) {
      this.progress += prog;
      this._checkMilestones();
    }
  }

  _checkMilestones() {
    while (this.progress >= this.nextLifeAt) {
      // Escalating cost: 1st life = base, 2nd = base×scale, 3rd = base×scale²…
      const interval = Math.floor(
        EXTRA_LIFE_EVERY * Math.pow(EXTRA_LIFE_SCALE, this.livesAwarded)
      );
      this.nextLifeAt += Math.max(EXTRA_LIFE_EVERY, interval);
      this.livesAwarded += 1;
      if (this.lives < MAX_LIVES) {
        this.lives += 1;
        this.ui.updateLives(this.lives);
        this.audio.extraLife();
        this.particles.floater(
          this.player.x,
          this.player.y - 24,
          "EXTRA LIFE",
          COLORS.player
        );
      } else {
        // At cap: convert to score instead of infinite lives
        this.score += 5000;
        this.ui.updateScore(this.score);
        this.particles.floater(
          this.player.x,
          this.player.y - 24,
          "LIFE CAP +5K",
          COLORS.player
        );
      }
    }
    while (this.progress >= this.nextBombAt) {
      this.nextBombAt += EXTRA_BOMB_EVERY;
      if (this.bombs < MAX_BOMBS) {
        this.bombs += 1;
        this.ui.updateBombs?.(this.bombs);
        this.audio.extraBomb();
        this.particles.floater(
          this.player.x,
          this.player.y - 40,
          "+BOMB",
          COLORS.bomb
        );
      } else {
        this.score += 3000;
        this.ui.updateScore(this.score);
        this.particles.floater(
          this.player.x,
          this.player.y - 40,
          "BOMB CAP +3K",
          COLORS.bomb
        );
      }
    }
  }

  /** Geoms are the only way mult climbs (GW RE2). */
  _addGeomMult(x, y) {
    const before = this.mult;
    this.mult = Math.min(MULT_MAX, this.mult + GEOM_MULT);
    this.multIdle = 0;
    this.multDecayAcc = 0;
    this.ui.updateMult(this.mult);
    if (this.mult <= before) return;

    this.particles.floater(
      x,
      y - 8,
      `×${this.mult}`,
      COLORS.geom,
      0.9 + Math.min(0.6, this.mult / 80)
    );

    // Milestone vacuum: crossed nextVacuumAt
    if (this.mult >= this.nextVacuumAt) {
      this._triggerGeomVacuum();
      const nextMs = GEOM_VACUUM_MILESTONES.find((m) => m > this.mult);
      this.nextVacuumAt = nextMs != null ? nextMs : this.mult + 100;
    }
  }

  /**
   * Full-map geom vacuum — one of the most addictive GW feelings:
   * mult hits a beat, every green gem rockets toward you.
   */
  _triggerGeomVacuum() {
    this.geomVacuum = Math.max(this.geomVacuum, 0.85);
    addTrauma(this.cam, 0.14);
    punchZoom(this.cam, 0.05);
    this.particles.ring(this.player.x, this.player.y, COLORS.geom, 40, 400);
    this.particles.shockwave(this.player.x, this.player.y, COLORS.geom, 280);
    this._gridPulse(this.player.x, this.player.y, 1.8);
    this.particles.floater(
      this.player.x,
      this.player.y - 56,
      "VACUUM",
      COLORS.geom,
      1.4
    );
    this.audio.geom(this.mult + 20);
    // Nudge every geom hard toward player immediately
    for (const g of this.geoms) {
      const dx = this.player.x - g.x;
      const dy = this.player.y - g.y;
      const d = Math.hypot(dx, dy) || 1;
      g.vx = (dx / d) * 900;
      g.vy = (dy / d) * 900;
    }
  }

  /**
   * Board clear: kill the last enemy → brief EMPTY + score fireworks.
   * Core twin-stick dopamine: paint the board, erase it, get paid.
   */
  _checkBoardClear() {
    if (this.clearCooldown > 0) return;
    if (this.enemies.length > 0) {
      this.boardWasPopulated = true;
      return;
    }
    if (!this.boardWasPopulated) return;
    // Need at least a few kills worth of presence
    this.boardWasPopulated = false;
    this.clearCooldown = 2.5;
    const bonus = Math.floor(BOARD_CLEAR_BASE + this.mult * BOARD_CLEAR_PER_MULT);
    // Tiny base progress — clears must not farm lives
    this._addScore(bonus, this.player.x, this.player.y - 20, BOARD_CLEAR_PROGRESS);
    this.particles.floater(
      this.player.x,
      this.player.y - 70,
      "CLEAR!",
      COLORS.bomb,
      1.6
    );
    this.particles.floater(
      this.player.x,
      this.player.y - 95,
      `+${bonus}`,
      COLORS.playerCore,
      1.2
    );
    this.particles.ring(this.player.x, this.player.y, COLORS.bomb, 48, 360);
    this.particles.shockwave(this.player.x, this.player.y, COLORS.player, 320);
    addTrauma(this.cam, 0.18);
    punchZoom(this.cam, 0.06);
    this.audio.levelUp();
    this.bombFlash = Math.max(this.bombFlash, 0.2);
    // Tiny mult gift for the clear
    if (this.mult < MULT_MAX) {
      this.mult = Math.min(MULT_MAX, this.mult + 1);
      this.ui.updateMult(this.mult);
      this.multIdle = 0;
    }
  }

  _tickMultDecay(dt) {
    if (this.mult <= 1) {
      this.multIdle = 0;
      return;
    }
    this.multIdle += dt;
    if (this.multIdle < MULT_IDLE_BEFORE_DECAY) return;
    this.multDecayAcc += dt;
    while (this.multDecayAcc >= MULT_DECAY_INTERVAL && this.mult > 1) {
      this.multDecayAcc -= MULT_DECAY_INTERVAL;
      this.mult -= 1;
      this.ui.updateMult(this.mult);
    }
  }

  _fireCooldown() {
    // Mild mult reward only — never turns into a full-auto carpet
    const t = Math.min(1, Math.max(0, this.mult - 1) / 120);
    return FIRE_COOLDOWN + (FIRE_COOLDOWN_MIN - FIRE_COOLDOWN) * t;
  }

  _gridPulse(x, y, strength = 1) {
    if (this.gridImpulses.length >= GRID_IMPULSE_MAX) this.gridImpulses.shift();
    this.gridImpulses.push({
      x,
      y,
      strength,
      life: 0.65,
      maxLife: 0.65,
    });
  }

  _difficulty01() {
    // Ease-in curve: stays low early, then ramps (not linear)
    const t = Math.min(1, this.elapsed / SPAWN_RAMP_SECONDS);
    return t * t;
  }

  _spawnInterval() {
    const d = this._difficulty01();
    const base = SPAWN_INTERVAL_START + (SPAWN_INTERVAL_MIN - SPAWN_INTERVAL_START) * d;
    // Levels only matter after the opening; mild extra pressure
    const levelBoost = this.elapsed < SAFE_OPENING_SEC ? 0 : Math.max(0, this.level - 1) * 0.015;
    return Math.max(SPAWN_INTERVAL_MIN * 0.9, base - levelBoost);
  }

  _waveLull() {
    const d = this._difficulty01();
    return WAVE_LULL_START + (WAVE_LULL_MIN - WAVE_LULL_START) * d;
  }

  _softCap() {
    // Goldilocks density bands — teeth at 90–150s without soup
    if (this.elapsed < SAFE_OPENING_SEC) return SOFT_CAP.opening;
    if (this.elapsed < 50) return SOFT_CAP.early;
    if (this.elapsed < 100) return SOFT_CAP.mid;
    if (this.elapsed < 150) return SOFT_CAP.late;
    return SOFT_CAP.end;
  }

  _pickType() {
    if (this.elapsed < SAFE_OPENING_SEC) return "wanderer";
    let type = pickSpawnType(this.elapsed, SPAWN_TABLE);
    const voidCount = this.enemies.filter((e) => e.type === "void").length;
    const voidUnlock = SPAWN_TABLE.find((t) => t.type === "void")?.unlockAt ?? 105;
    if (type === "void" && (voidCount >= 1 || this.elapsed < voidUnlock)) type = "wanderer";
    if (type === "void" && voidCount >= 2) type = "diamond";
    return type;
  }

  /**
   * Drain formation queue: staggered entry keeps rows readable.
   */
  _drainSpawnQueue(dt, softCap) {
    if (!this.spawnQueue.length) return false;
    for (const job of this.spawnQueue) job.delay -= dt;

    let spawned = 0;
    while (this.spawnQueue.length && this.spawnQueue[0].delay <= 0) {
      if (this.enemies.length >= softCap) {
        // Hold remaining jobs briefly
        this.spawnTimer = 0.35;
        return true;
      }
      const job = this.spawnQueue.shift();
      let type = job.type;
      // Specials that shouldn't mass-spawn
      if (type === "void" || type === "tank") {
        // Only first of wave may be special; rest become wanderers/diamonds
        if (spawned > 0 || this.enemies.some((e) => e.type === "void" && type === "void")) {
          type = type === "void" ? "diamond" : "wanderer";
        }
      }
      const e = spawnEnemy(type, this.elapsed, { x: job.x, y: job.y });
      if (e) {
        if (job.approach) {
          e.approach = job.approach;
          // Hold formation 0.45–0.9s while drifting in (longer early)
          e.approachTime =
            this.elapsed < SAFE_OPENING_SEC
              ? 0.85
              : 0.45 + Math.random() * 0.25;
        }
        this.enemies.push(e);
        spawned += 1;
      }
    }

    if (this.spawnQueue.length) {
      // Next job soon
      this.spawnTimer = Math.max(0.02, this.spawnQueue[0].delay);
      return true;
    }
    // Wave finished — lull before next formation
    this.spawnTimer = this._waveLull() + this._spawnInterval() * 0.4;
    return true;
  }

  /**
   * Wave director: formation-based entry (lines, columns, pincers, rings).
   * Patterns exist so sweeping fire can clear whole rows — GW juice.
   */
  _trySpawn(dt) {
    const softCap = this._softCap();

    // Always drain active formation first
    if (this.spawnQueue.length) {
      this._drainSpawnQueue(dt, softCap);
      return;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    if (this.enemies.length >= softCap) {
      this.spawnTimer = 0.55;
      return;
    }

    const d = this._difficulty01();

    // Occasional solo void (not in a ring of voids)
    if (
      this.elapsed > 105 &&
      Math.random() < 0.07 + d * 0.06 &&
      !this.enemies.some((e) => e.type === "void")
    ) {
      const e = spawnEnemy("void", this.elapsed);
      if (e) {
        e.approachTime = 0.3;
        e.approach = { x: Math.sign(WORLD_W / 2 - e.x) || 1, y: Math.sign(WORLD_H / 2 - e.y) || 0 };
        // normalize
        const L = Math.hypot(e.approach.x, e.approach.y) || 1;
        e.approach.x /= L;
        e.approach.y /= L;
        this.enemies.push(e);
      }
      this.spawnTimer = this._waveLull() * 1.2;
      return;
    }

    // Build a full formation wave
    const jobs = buildWaveJobs(this.elapsed, d, () => this._pickType(), {
      safeOpening: SAFE_OPENING_SEC,
    });

    // Cap formation size to remaining soft cap
    const room = Math.max(0, softCap - this.enemies.length);
    this.spawnQueue = jobs.slice(0, room);

    if (!this.spawnQueue.length) {
      this.spawnTimer = 0.5;
      return;
    }

    // Kick drain immediately
    this._drainSpawnQueue(0, softCap);
  }

  _dropGeoms(enemy) {
    const n = enemy.geoms || 1;
    for (let i = 0; i < n; i++) {
      const jx = (Math.random() - 0.5) * 18;
      const jy = (Math.random() - 0.5) * 18;
      this.geoms.push(createGeom(enemy.x + jx, enemy.y + jy));
    }
  }

  _onKill(enemy, opts = {}) {
    const { fromBomb = false } = opts;
    const big =
      enemy.type === "tank" ||
      enemy.type === "snake" ||
      enemy.type === "void" ||
      enemy.type === "splitter";
    // Layered blast: color debris + white core + shock ring
    this.particles.burst(enemy.x, enemy.y, enemy.color, 38 + enemy.r * 1.4, 360 + enemy.r * 10);
    this.particles.burst(enemy.x, enemy.y, "#ffffff", 16 + (big ? 10 : 0), 280);
    this.particles.ring(enemy.x, enemy.y, enemy.color, big ? 36 : 18, big ? 380 : 240);
    if (big) {
      this.particles.shockwave(enemy.x, enemy.y, enemy.color, 220 + enemy.r * 8);
      this.bombFlash = Math.max(this.bombFlash, 0.22);
      // Elite/big kills: punchy spike that can breach the combat soft-cap
      addTrauma(this.cam, 0.3, { big: true });
      punchZoom(this.cam, 0.07);
    } else {
      this.bombFlash = Math.max(this.bombFlash, 0.08);
      // Fodder: light hit; soft-cap + faster decay prevent sustained earthquake
      addTrauma(this.cam, 0.07 + Math.min(0.05, this.mult * 0.0015));
      punchZoom(this.cam, 0.02);
    }
    this._gridPulse(enemy.x, enemy.y, big ? 2.8 : 1.55);

    // Splitters birth children (not on bomb clear)
    if (!fromBomb && enemy.type === "splitter") {
      const kids = spawnSplitterChildren(enemy, this.elapsed);
      for (const k of kids) this.enemies.push(k);
    }

    if (!fromBomb) {
      const base = enemy.score;
      const points = Math.floor(base * this.mult);
      this._addScore(points, enemy.x, enemy.y, base);
      this._dropGeoms(enemy);
      this.audio.enemyDeath(big ? 0.65 : 1 + Math.min(1.5, this.mult * 0.02));
    } else if (big) {
      addTrauma(this.cam, 0.15, { big: true });
    }
  }

  _detonateBomb() {
    if (this.bombs <= 0) return;
    const savedMult = this.mult;
    this.bombs -= 1;
    this.ui.updateBombs?.(this.bombs);
    this.audio.bomb();
    this.bombFlash = 1.0;
    addTrauma(this.cam, 0.72, { big: true });
    punchZoom(this.cam, 0.12);
    this._gridPulse(this.player.x, this.player.y, 4.5);
    this.particles.shockwave(this.player.x, this.player.y, COLORS.bomb, 620);
    this.particles.shockwave(this.player.x, this.player.y, "#ffffff", 400);
    this.particles.ring(this.player.x, this.player.y, COLORS.bomb, 72, 560);
    this.particles.burst(this.player.x, this.player.y, COLORS.player, 70, 520);
    this.particles.burst(this.player.x, this.player.y, COLORS.bomb, 40, 440);
    this.particles.burst(this.player.x, this.player.y, "#ffffff", 36, 400);

    for (const e of this.enemies) {
      e.dead = true;
      this.particles.burst(e.x, e.y, e.color, 22, 300);
      this.particles.ring(e.x, e.y, e.color, 12, 220);
      this._gridPulse(e.x, e.y, 1.0);
    }
    this.enemies = [];
    this.bullets = [];
    this.player.invuln = Math.max(this.player.invuln, 700);
    this.boardWasPopulated = false; // bomb clear doesn't count as skill clear
    this.spawnQueue = [];
    this.spawnTimer = Math.max(this.spawnTimer, 0.8);

    // Peak strategic fun: bomb protects a high mult — celebrate it
    if (savedMult >= 10) {
      this.particles.floater(
        this.player.x,
        this.player.y - 50,
        `SAVED ×${savedMult}`,
        COLORS.bomb,
        1.5
      );
      this.audio.extraBomb();
    }
    // Vacuum leftover geoms after the panic clear
    if (this.geoms.length > 0) {
      this._triggerGeomVacuum();
    }
  }

  /**
   * Pick a respawn point: not always center.
   *
   * Geometry Wars often uses center (predictable). Fairer for crowded boards is
   * the *safest open pocket* — center is still a strong candidate when clear.
   * Avoids dumping you into the densest swarm if the middle is already owned.
   */
  _findRespawnPoint() {
    const margin = 80;
    const candidates = [
      { x: WORLD_W / 2, y: WORLD_H / 2 }, // classic center
      // Cardinal mid-edges (inset)
      { x: WORLD_W * 0.25, y: WORLD_H * 0.25 },
      { x: WORLD_W * 0.75, y: WORLD_H * 0.25 },
      { x: WORLD_W * 0.25, y: WORLD_H * 0.75 },
      { x: WORLD_W * 0.75, y: WORLD_H * 0.75 },
      { x: WORLD_W * 0.5, y: WORLD_H * 0.28 },
      { x: WORLD_W * 0.5, y: WORLD_H * 0.72 },
      { x: WORLD_W * 0.28, y: WORLD_H * 0.5 },
      { x: WORLD_W * 0.72, y: WORLD_H * 0.5 },
      // Slight jitter samples
      {
        x: margin + Math.random() * (WORLD_W - margin * 2),
        y: margin + Math.random() * (WORLD_H - margin * 2),
      },
      {
        x: margin + Math.random() * (WORLD_W - margin * 2),
        y: margin + Math.random() * (WORLD_H - margin * 2),
      },
    ];

    let best = candidates[0];
    let bestScore = -Infinity;

    for (const c of candidates) {
      // Distance to nearest enemy (higher = safer)
      let nearest = Infinity;
      let nearby = 0;
      const nearR = 220;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - c.x, e.y - c.y);
        if (d < nearest) nearest = d;
        if (d < nearR) nearby += 1 + (nearR - d) / nearR;
      }
      if (nearest === Infinity) nearest = 800;

      // Prefer roomy space; mild bias toward center so it still feels arena-like
      const cx = WORLD_W / 2;
      const cy = WORLD_H / 2;
      const centerBias = 1 - Math.hypot(c.x - cx, c.y - cy) / (Math.hypot(cx, cy) || 1);
      const score = nearest * 1.4 - nearby * 55 + centerBias * 40;

      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    return best;
  }

  /**
   * Death mult tax: keep a recovery seed so late density isn't "needle vs swarm".
   * Never gains mult. Caps retained seed so death still hurts.
   */
  _multAfterDeath(prevMult) {
    const prev = Math.max(1, prevMult | 0);
    if (prev <= 1) return 1;
    let keep = Math.floor(prev * DEATH_MULT_KEEP);
    keep = Math.min(keep, DEATH_MULT_KEEP_CAP);
    // Always lose a real chunk (at least half when mult is meaningful)
    keep = Math.min(keep, Math.floor(prev * 0.5));
    return Math.max(1, keep);
  }

  /**
   * Cull leftover swarm after mercy clear so power drop matches board pressure.
   * Prefers removing distant fodder; keeps elites if under budget.
   */
  _cullEnemiesAfterDeath() {
    const target = Math.max(
      6,
      Math.floor(this._softCap() * RESPAWN_ENEMY_SOFT_FRAC)
    );
    if (this.enemies.length <= target) return;

    const px = this.player.x;
    const py = this.player.y;
    // Sort: farthest + non-elite first
    const ranked = this.enemies
      .map((e, i) => {
        const elite =
          e.type === "void" ||
          e.type === "tank" ||
          e.type === "snake" ||
          e.type === "splitter";
        const dist = Math.hypot(e.x - px, e.y - py);
        return { e, i, elite, dist };
      })
      .sort((a, b) => {
        if (a.elite !== b.elite) return a.elite ? 1 : -1;
        return b.dist - a.dist;
      });

    let left = this.enemies.length;
    for (const row of ranked) {
      if (left <= target) break;
      if (row.e.dead) continue;
      row.e.dead = true;
      this.particles.burst(row.e.x, row.e.y, row.e.color, 10, 160);
      left -= 1;
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  /**
   * Death → safe-pocket respawn with mercy package:
   * 1) Choose safest open area (center if it’s clear)
   * 2) Death blast clears a wide radius there + soft board cull
   * 3) Remaining enemies are shoved outward
   * 4) Control freeze (blink, no input) then invuln with control restored
   * 5) Soft mult retain (recovery seed) — not hard reset to ×1
   */
  _playerHit() {
    if (this.player.invuln > 0) return;
    this.lives -= 1;
    this.ui.updateLives(this.lives);

    const prevMult = this.mult;
    const spawn = this._findRespawnPoint();
    this.player.x = spawn.x;
    this.player.y = spawn.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.invuln = RESPAWN_INVULN_MS;
    this.player.controlLock = RESPAWN_FREEZE_MS;
    // Don't spray or bomb from residual stick/trigger held through death
    this.input.clearFireButton();
    this.input.clearEdgeActions();

    addTrauma(this.cam, 0.62, { big: true });
    punchZoom(this.cam, 0.09);
    this.bombFlash = Math.max(this.bombFlash, 0.45);

    // Soft mult tax — recovery seed so you're not cooked by late density
    this.mult = this._multAfterDeath(prevMult);
    this.multIdle = 0;
    this.multDecayAcc = 0;
    this.ui.updateMult(this.mult);

    this.audio.playerHit();
    this.particles.shockwave(this.player.x, this.player.y, COLORS.danger, 380);
    this.particles.ring(this.player.x, this.player.y, COLORS.danger, 52, 420);
    this.particles.burst(this.player.x, this.player.y, COLORS.danger, 36, 340);
    this.particles.burst(this.player.x, this.player.y, "#ffffff", 28, 320);
    this._gridPulse(this.player.x, this.player.y, 3.2);
    this.afterimages = [];

    // Mercy clear around respawn (GW-style breathing room)
    const clearR = RESPAWN_CLEAR_RADIUS;
    for (const e of this.enemies) {
      if (circlesOverlap(this.player.x, this.player.y, clearR, e.x, e.y, e.r)) {
        e.dead = true;
        this.particles.burst(e.x, e.y, e.color, 16, 220);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    this._cullEnemiesAfterDeath();

    // Knock survivors outward so you’re not ringed the instant grace ends
    for (const e of this.enemies) {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const d = Math.hypot(dx, dy) || 1;
      const push = 220;
      e.x += (dx / d) * push;
      e.y += (dy / d) * push;
      // Short stun only — must end well before invuln so contact can kill again
      e.approach = { x: dx / d, y: dy / d };
      e.approachTime = Math.max(e.approachTime || 0, 0.45);
    }

    // Don’t refill the board immediately; drop any queued formation mid-entry
    this.spawnQueue = [];
    this.spawnTimer = Math.max(this.spawnTimer, RESPAWN_SPAWN_PAUSE);

    this.particles.floater(
      this.player.x,
      this.player.y - 40,
      "SAFE",
      COLORS.player,
      1.1
    );
    if (prevMult > this.mult) {
      this.particles.floater(
        this.player.x,
        this.player.y - 62,
        `×${prevMult}→${this.mult}`,
        COLORS.danger,
        1.05
      );
    }
    if (this.mult > 1) {
      this.particles.floater(
        this.player.x,
        this.player.y - 84,
        `KEEP ×${this.mult}`,
        COLORS.geom,
        0.95
      );
    }

    this.deathCount += 1;
    const deathEvent = {
      elapsed: Math.round(this.elapsed),
      level: this.level,
      mult: prevMult,
      multAfter: this.mult,
      peakMult: this.peakMult,
      livesLeft: this.lives,
      bombs: this.bombs,
      score: this.score,
      enemies: this.enemies.length,
      deathNum: this.deathCount,
    };
    // Tuning telemetry — median death target 90–150s
    console.info("[arena:death]", deathEvent);
    recordDeath(deathEvent);

    if (this.lives <= 0) {
      this.gameOver();
    }
  }

  /** True if any enemy is currently touching the player. */
  _playerOverlappingEnemy() {
    for (const e of this.enemies) {
      if (this._enemyHitPlayer(e)) return true;
    }
    return false;
  }

  _enemyHitPlayer(e) {
    if (e.type === "snake") {
      for (const s of snakeSegments(e)) {
        if (circlesOverlap(this.player.x, this.player.y, this.player.r, s.x, s.y, s.r)) {
          return true;
        }
      }
      return false;
    }
    return circlesOverlap(this.player.x, this.player.y, this.player.r, e.x, e.y, e.r);
  }

  _bulletHitsEnemy(b, e) {
    if (e.type === "snake") {
      for (const s of snakeSegments(e)) {
        if (circlesOverlap(b.x, b.y, b.r, s.x, s.y, s.r)) return true;
      }
      return false;
    }
    return circlesOverlap(b.x, b.y, b.r, e.x, e.y, e.r);
  }

  _update(dt) {
    if (this.input.consumePause()) {
      this.pause();
      return;
    }
    if (this.input.consumeMute()) this.toggleMute();

    // Control freeze: blink in place — ignore move / fire / bomb (sticks may still be held)
    const locked =
      this.player.controlLock != null && this.player.controlLock > 0;
    if (locked) {
      this.player.controlLock = Math.max(
        0,
        this.player.controlLock - dt * 1000
      );
      // Swallow bomb edges while frozen (held A/LT from death shouldn't detonate)
      this.input.consumeBomb();
    } else if (this.input.consumeBomb()) {
      this._detonateBomb();
    }

    this.elapsed += dt;
    this.time += dt;
    this.levelTimer += dt;
    if (this.mult > this.peakMult) this.peakMult = this.mult;
    if (this.levelTimer >= LEVEL_DURATION_SEC) {
      this._advanceLevel();
    }
    this._tickMultDecay(dt);
    if (this.geomVacuum > 0) this.geomVacuum = Math.max(0, this.geomVacuum - dt);
    if (this.clearCooldown > 0) this.clearCooldown = Math.max(0, this.clearCooldown - dt);

    let move = this.input.moveVector();
    const aimAngle = this.input.aimAngle();
    let firing = this.input.isFiring();
    if (locked) {
      move = { x: 0, y: 0 };
      firing = false;
      this.player.vx = 0;
      this.player.vy = 0;
    }
    const canFire = updatePlayer(this.player, move, aimAngle, dt, firing);
    if (canFire) {
      const a = this.player.angle;
      // Default: single bolt. Dual/triple only at high mult (earned, not free).
      let angles = [a];
      if (this.mult >= MULT_FOR_DUAL) {
        angles = [a - FIRE_SPREAD, a + FIRE_SPREAD];
      }
      if (this.mult >= MULT_FOR_TRIPLE) {
        angles = [a - FIRE_SPREAD, a, a + FIRE_SPREAD];
      }
      for (const ang of angles) {
        this.bullets.push(createBullet(this.player.x, this.player.y, ang));
      }
      this.player.fireCd = this._fireCooldown();
      this.audio.shoot(this.mult);
      recoil(this.cam, a, 3.5); // lighter kick with single stream
      const c = Math.cos(a);
      const s = Math.sin(a);
      this.particles.burst(
        this.player.x + c * 16,
        this.player.y + s * 16,
        COLORS.bulletCore,
        4,
        110
      );
      this._gridPulse(this.player.x + c * 22, this.player.y + s * 22, 0.18);
    }

    // Hard invuln countdown (ms). No extension — that caused infinite safety in crowds.
    if (this.player.invuln > 0) {
      this.player.invuln = Math.max(0, this.player.invuln - dt * 1000);
    }

    // Camera: follow + look-ahead + aim lean + trauma
    updateCamera(this.cam, this.player, this.input.aimVector(), dt);

    // Thruster dust + motion afterimages
    this.particles.trail(
      this.player.x,
      this.player.y,
      this.player.vx,
      this.player.vy,
      COLORS.player
    );
    this.afterimageTimer -= dt;
    const spd = Math.hypot(this.player.vx, this.player.vy);
    if (spd > 40 && this.afterimageTimer <= 0) {
      this.afterimageTimer = 0.028;
      this.afterimages.push({
        x: this.player.x,
        y: this.player.y,
        angle: this.player.angle,
        life: 0.18,
      });
      if (this.afterimages.length > AFTERIMAGE_MAX) this.afterimages.shift();
    }
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].life -= dt;
      if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
    }

    updateBullets(this.bullets, dt);
    const { atoms } = updateEnemies(this.enemies, this.player, dt, this.elapsed);
    if (atoms.length) {
      for (const a of atoms) {
        if (this.enemies.length < MAX_ENEMIES) this.enemies.push(a);
      }
    }
    updateGeoms(this.geoms, this.player, dt, this.mult, this.geomVacuum);
    this._trySpawn(dt);

    // Continuous soft grid pull near voids
    for (const e of this.enemies) {
      if (e.type === "void" && Math.random() < 0.15) {
        this._gridPulse(e.x, e.y, 0.35);
      }
    }

    // Collect geoms → multiplier (core GW RE2 loop)
    for (let i = this.geoms.length - 1; i >= 0; i--) {
      const g = this.geoms[i];
      if (
        // Generous pickup radius so tiny geoms stay easy to scoop
        circlesOverlap(this.player.x, this.player.y, this.player.r + 10, g.x, g.y, g.r)
      ) {
        this.geoms.splice(i, 1);
        this._addGeomMult(g.x, g.y);
        this.audio.geom(this.mult);
        this.particles.burst(g.x, g.y, COLORS.geom, 12, 140);
        this.particles.burst(g.x, g.y, "#ffffff", 4, 90);
      }
    }

    // Bullet → enemy
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (this._bulletHitsEnemy(b, e)) {
          b.dead = true;
          e.hp -= 1;
          this.audio.enemyHit();
          this.particles.burst(b.x, b.y, e.color, 10, 160);
          this.particles.burst(b.x, b.y, "#ffffff", 3, 100);
          if (e.hp <= 0) {
            e.dead = true;
            this._onKill(e);
          }
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    if (this.enemies.some((e) => !e.dead)) this.boardWasPopulated = true;
    this.enemies = this.enemies.filter((e) => !e.dead);
    this._checkBoardClear();

    if (this.player.invuln <= 0) {
      for (const e of this.enemies) {
        if (this._enemyHitPlayer(e)) {
          this._playerHit();
          break;
        }
      }
    }

    // Grid impulses decay
    for (let i = this.gridImpulses.length - 1; i >= 0; i--) {
      this.gridImpulses[i].life -= dt;
      if (this.gridImpulses[i].life <= 0) this.gridImpulses.splice(i, 1);
    }

    this.particles.update(dt);
    if (this.bombFlash > 0) this.bombFlash = Math.max(0, this.bombFlash - dt * 1.35);
  }

  _draw() {
    const rect = this.canvas.getBoundingClientRect?.() || {
      left: 0,
      top: 0,
      width: WORLD_W,
      height: WORLD_H,
    };
    this.display.left = rect.left;
    this.display.top = rect.top;
    this.display.width = rect.width;
    this.display.height = rect.height;

    // Headless UAT: no presentation buffers — skip paint
    if (!this.worldCtx || !this.worldCanvas || !this.ctx) return;

    const dpr = this.dpr || 1;
    const wctx = this.worldCtx;
    const main = this.ctx;
    const bw = this.worldCanvas.width;
    const bh = this.worldCanvas.height;

    // ── 1) World buffer (DPR-scaled logical world) ────────
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.fillStyle = "#000005";
    wctx.fillRect(0, 0, bw, bh);

    wctx.save();
    applyCameraTransform(wctx, this.cam, dpr);
    // Floor environment first…
    drawGrid(wctx, 0, 0, this.gridImpulses, this.time);
    // …then shadows on the floor…
    drawFloorShadows(wctx, this.player, this.enemies, this.geoms, this.time);
    // …then shapes hovering above
    drawGeoms(wctx, this.geoms, this.time);
    drawEnemies(wctx, this.enemies, this.time);
    drawBullets(wctx, this.bullets);
    drawAfterimages(wctx, this.afterimages);
    drawPlayer(wctx, this.player, this.time);
    this.particles.draw(wctx);
    if (this.state === "playing") {
      const aim = this.input.aimVector();
      drawAimReticle(
        wctx,
        this.player.x + aim.x * AIM_RETICLE_DIST,
        this.player.y + aim.y * AIM_RETICLE_DIST,
        this.player.x,
        this.player.y
      );
    }
    wctx.restore();

    // Screen-space flash in world pixels (not camera-warped)
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBombFlash(wctx, this.bombFlash);

    // ── 2) Present base world ─────────────────────────────
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.imageSmoothingEnabled = true;
    main.fillStyle = "#000005";
    main.fillRect(0, 0, main.canvas.width, main.canvas.height);
    main.drawImage(this.worldCanvas, 0, 0);

    // ── 3) Bloom (tight + wide additive) ──────────────────
    compositeBloom(main, this.worldCanvas, {
      tight: this.bloomTight,
      wide: this.bloomWide,
    });

    // ── 4) Trauma chromatic fringe ────────────────────────
    compositeChromatic(main, this.worldCanvas, this.cam.trauma, dpr);

    // ── 5) Mult color grade + vignette (world px space) ───
    main.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawColorGrade(main, this.mult);
    drawPostVignette(main, this.mult);
  }

  _loop(now) {
    const raw = this.lastTime ? (now - this.lastTime) / 1000 : 0;
    this.lastTime = now;
    const dt = Math.min(raw, 1 / 30);

    if (this.state === "playing") {
      this._update(dt);
    } else {
      if (this.input.consumeMute()) this.toggleMute();
      if (this.state === "gameover" && this.input.consumeRestart()) {
        this.start();
      }
      if (this.state === "menu") {
        this.time += dt;
        this.player.angle += dt * 0.85;
        this.particles.update(dt * 0.5);
        updateMenuCamera(this.cam, dt);
        // Ambient grid pulses — sell the "living arena" on the title screen
        if (Math.random() < 0.035) {
          this._gridPulse(
            Math.random() * WORLD_W,
            Math.random() * WORLD_H,
            0.55 + Math.random() * 0.7
          );
          this.particles.burst(
            Math.random() * WORLD_W,
            Math.random() * WORLD_H,
            COLORS.player,
            6,
            80
          );
        }
        for (let i = this.gridImpulses.length - 1; i >= 0; i--) {
          this.gridImpulses[i].life -= dt;
          if (this.gridImpulses[i].life <= 0) this.gridImpulses.splice(i, 1);
        }
      }
      if (this.state === "paused" && this.input.consumePause()) {
        this.resume();
      }
    }

    this._draw();
    this.raf = requestAnimationFrame(this._loop);
  }
}
