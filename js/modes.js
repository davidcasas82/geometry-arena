/**
 * Geometry Arena — mode runtime (Path levels).
 * Contract: docs/LEVELS_DESIGN.md
 *
 * Classic Evolved uses no controller (passthrough / null modeId).
 * Controllers advise Game via hooks; they do not own the render loop.
 */

import { MODE, SPAWN_PATTERN, isPathModeId } from "./levels.js";
import {
  formationColumn,
  formationCornerArc,
  formationCornerFlood,
  formationEdgeLine,
  formationOppositeEcho,
  formationPincer,
  formationPlayerCircle,
  formationRing,
  formationSingle,
  formationZipper,
} from "./spawns.js";
import { WORLD_H, WORLD_W } from "./constants.js";

export { MODE, isPathModeId };

/**
 * @typedef {import('./levels.js').LevelDef} LevelDef
 * @typedef {import('./levels.js').LevelResultExtra} LevelResultExtra
 * @typedef {import('./levels.js').WaveDef} WaveDef
 * @typedef {import('./levels.js').SpawnPatternId} SpawnPatternId
 * @typedef {import('./spawns.js').SpawnJob} SpawnJob
 *
 * @typedef {object} ModeContext
 * @property {object} game
 * @property {LevelDef} level
 * @property {object} arena
 * @property {number} elapsed
 * @property {number} durationLeft
 * @property {Set<string>} flags
 *
 * @typedef {object} ModeHud
 * @property {string} [timer]
 * @property {string} [objective]
 * @property {string} [wave]
 * @property {number} [starsPreview]
 * @property {string} [label]
 *
 * @typedef {object} ModeHooks
 * @property {(ctx: ModeContext) => void} onEnter
 * @property {(ctx: ModeContext, dt: number) => void} onUpdate
 * @property {(ctx: ModeContext, enemy?: object) => void} [onEnemyKilled]
 * @property {(ctx: ModeContext) => void} [onPlayerDeath]
 * @property {(ctx: ModeContext) => "playing"|"won"|"lost"} getState
 * @property {(ctx: ModeContext) => ModeHud} getHud
 * @property {(ctx: ModeContext) => LevelResultExtra} buildResult
 */

// ── Helpers ─────────────────────────────────────────────────

function formatClock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `0:${String(r).padStart(2, "0")}`;
}

/**
 * @param {object} game
 * @param {SpawnJob[]} jobs
 */
function enqueueJobs(game, jobs) {
  if (!jobs || !jobs.length) return;
  if (!Array.isArray(game.spawnQueue)) game.spawnQueue = [];
  const base = game.spawnQueue.length
    ? Math.max(0, ...game.spawnQueue.map((j) => j.delay))
    : 0;
  const offset = game.spawnQueue.length ? base + 0.02 : 0;
  for (const j of jobs) {
    game.spawnQueue.push({
      type: j.type,
      x: j.x,
      y: j.y,
      delay: (j.delay || 0) + offset,
      approach: j.approach,
      pathScripted: true,
      hp: j.hp,
      score: j.score,
      boss: j.boss,
      pathTag: j.pathTag,
    });
  }
  if (game.spawnTimer == null || game.spawnTimer > 0.05) {
    game.spawnTimer = Math.min(game.spawnTimer ?? 0.05, 0.05);
  }
}

/**
 * Map SPAWN_PATTERN id → formation jobs.
 * Mixed types cycle across slots when count > types.length.
 *
 * @param {string} pattern
 * @param {string[]} types
 * @param {number} count
 * @param {object} [opts]
 * @param {object} [game] — for player_circle
 * @returns {SpawnJob[]}
 */
export function jobsForPattern(pattern, types, count, opts = {}, game = null) {
  const list = types && types.length ? types : ["wanderer"];
  const n = Math.max(1, count | 0);
  const stagger = opts.stagger != null ? Number(opts.stagger) : undefined;
  const side = opts.side != null ? opts.side : Math.floor(Math.random() * 4);
  const corner = opts.corner != null ? opts.corner : Math.floor(Math.random() * 4);
  const axis = opts.axis === "vertical" ? "vertical" : "horizontal";
  const perSide = opts.perSide != null ? opts.perSide : Math.max(2, Math.ceil(n / 4));

  const paint = (jobs) => {
    if (!jobs.length) return jobs;
    return jobs.map((j, i) => ({
      ...j,
      type: list[i % list.length],
    }));
  };

  /** @type {SpawnJob[]} */
  let jobs = [];
  switch (pattern) {
    case SPAWN_PATTERN.EDGE_LINE:
    case "edge_line":
      jobs = formationEdgeLine(list[0], n, /** @type {0|1|2|3} */ (side), stagger ?? 0.08);
      break;
    case SPAWN_PATTERN.COLUMN:
    case "column":
      jobs = formationColumn(list[0], n, /** @type {0|1|2|3} */ (side), stagger ?? 0.14);
      break;
    case SPAWN_PATTERN.CORNER_ARC:
    case "corner_arc":
      jobs = formationCornerArc(list[0], n, /** @type {0|1|2|3} */ (corner), stagger ?? 0.07);
      break;
    case SPAWN_PATTERN.PINCER:
    case "pincer": {
      const per = Math.max(2, Math.ceil(n / 2));
      jobs = formationPincer(list[0], per, axis, stagger ?? 0.06);
      if (jobs.length > n) jobs = jobs.slice(0, n);
      break;
    }
    case SPAWN_PATTERN.RING:
    case "ring":
      jobs = formationRing(list[0], perSide, stagger ?? 0.05);
      if (jobs.length > n) jobs = jobs.slice(0, n);
      break;
    case SPAWN_PATTERN.ZIPPER:
    case "zipper":
      jobs = formationZipper(list[0], n, stagger ?? 0.1);
      break;
    case SPAWN_PATTERN.SINGLE:
    case "single":
      jobs = formationSingle(list[0]);
      while (jobs.length < n) {
        jobs = jobs.concat(
          formationSingle(list[jobs.length % list.length]).map((j) => ({
            ...j,
            delay: jobs.length * (stagger ?? 0.12) + (j.delay || 0),
          }))
        );
      }
      jobs = jobs.slice(0, n);
      break;
    case SPAWN_PATTERN.PLAYER_CIRCLE:
    case "player_circle": {
      const px = game?.player?.x ?? WORLD_W / 2;
      const py = game?.player?.y ?? WORLD_H / 2;
      jobs = formationPlayerCircle(list[0], n, px, py, undefined, stagger ?? 0.04);
      break;
    }
    case SPAWN_PATTERN.CORNER_FLOOD:
    case "corner_flood": {
      const perCorner = Math.max(2, Math.ceil(n / 4));
      jobs = formationCornerFlood(list[0], perCorner, stagger ?? 0.05);
      if (jobs.length > n) jobs = jobs.slice(0, n);
      break;
    }
    case SPAWN_PATTERN.OPPOSITE_ECHO:
    case "opposite_echo":
      jobs = formationOppositeEcho(
        list[0],
        Math.max(2, Math.ceil(n / 2)),
        /** @type {0|1|2|3} */ (side),
        0.85,
        stagger ?? 0.07
      );
      if (jobs.length > n) jobs = jobs.slice(0, n);
      break;
    default:
      jobs = formationEdgeLine(list[0], n, /** @type {0|1|2|3} */ (side), stagger ?? 0.08);
      break;
  }

  return paint(jobs);
}

function livesLeft(game) {
  return Math.max(0, game?.lives ?? 0);
}

function peakMultOf(game) {
  return game?.peakMult ?? game?.mult ?? 1;
}

function baseResult(ctx, cleared) {
  return {
    cleared: !!cleared,
    elapsedSec: ctx.elapsed,
    peakMult: peakMultOf(ctx.game),
    livesLeft: livesLeft(ctx.game),
    mode: ctx.level?.mode,
  };
}

// ── Controllers ─────────────────────────────────────────────

/** @returns {ModeHooks} */
function passthroughController() {
  return {
    onEnter() {},
    onUpdate() {},
    getState() {
      return "playing";
    },
    getHud() {
      return {};
    },
    buildResult() {
      return { cleared: false };
    },
  };
}

/** Path evolved slice — survive durationSec (score for stars). */
function evolvedController() {
  /** @type {"playing"|"won"|"lost"} */
  let state = "playing";
  let duration = 60;

  return {
    /** @param {ModeContext} ctx */
    onEnter(ctx) {
      state = "playing";
      duration = Number(ctx.level?.rules?.durationSec) || 60;
      ctx.flags.clear();
      if (ctx.game) {
        ctx.game.pathAllowImprov = true;
        ctx.game.pathScriptOnly = false;
      }
    },
    /** @param {ModeContext} ctx */
    onUpdate(ctx) {
      if (state !== "playing") return;
      if (livesLeft(ctx.game) <= 0) {
        state = "lost";
        return;
      }
      if (ctx.elapsed >= duration) {
        state = "won";
        ctx.flags.add("survived");
      }
      const target = ctx.level?.rules?.targetScore;
      if (target != null && (ctx.game?.score || 0) >= target) {
        state = "won";
        ctx.flags.add("target");
      }
    },
    /** @param {ModeContext} ctx */
    onPlayerDeath(ctx) {
      if (livesLeft(ctx.game) <= 0) state = "lost";
    },
    getState() {
      return state;
    },
    /** @param {ModeContext} ctx */
    getHud(ctx) {
      const left = Math.max(0, duration - ctx.elapsed);
      return {
        timer: formatClock(ctx.elapsed),
        objective: `SURVIVE ${formatClock(left)}`,
        label: ctx.level?.name || "EVOLVED",
      };
    },
    /** @param {ModeContext} ctx */
    buildResult(ctx) {
      return baseResult(ctx, state === "won");
    },
  };
}

/** Score race — countdown timer. */
function deadlineController() {
  /** @type {"playing"|"won"|"lost"} */
  let state = "playing";
  let duration = 45;
  let target = 8000;

  return {
    /** @param {ModeContext} ctx */
    onEnter(ctx) {
      state = "playing";
      duration = Number(ctx.level?.rules?.durationSec) || 45;
      target = Number(ctx.level?.rules?.targetScore) || 8000;
      ctx.flags.clear();
      if (ctx.game) {
        ctx.game.pathAllowImprov = true;
        ctx.game.pathScriptOnly = false;
      }
    },
    /** @param {ModeContext} ctx */
    onUpdate(ctx) {
      if (state !== "playing") return;
      if (livesLeft(ctx.game) <= 0) {
        state = "lost";
        return;
      }
      const left = Math.max(0, duration - ctx.elapsed);
      if ((ctx.game?.score || 0) >= target) {
        state = "won";
        ctx.flags.add("target");
        return;
      }
      if (left <= 0) {
        state = "lost";
        ctx.flags.add("timeout");
      }
    },
    onPlayerDeath(ctx) {
      if (livesLeft(ctx.game) <= 0) state = "lost";
    },
    getState() {
      return state;
    },
    /** @param {ModeContext} ctx */
    getHud(ctx) {
      const left = Math.max(0, duration - ctx.elapsed);
      const score = ctx.game?.score || 0;
      return {
        timer: formatClock(left),
        objective: `SCORE ${Math.min(score, target).toLocaleString()}/${target.toLocaleString()}`,
        label: ctx.level?.name || "DEADLINE",
      };
    },
    /** @param {ModeContext} ctx */
    buildResult(ctx) {
      const left = Math.max(0, duration - ctx.elapsed);
      return {
        ...baseResult(ctx, state === "won"),
        timeLeftSec: left,
      };
    },
  };
}

/** Timed / zone gates along a route. */
function checkpointController() {
  /** @type {"playing"|"won"|"lost"} */
  let state = "playing";
  /** @type {import('./levels.js').CheckpointDef[]} */
  let cps = [];
  let index = 0;
  let onTime = 0;
  let failOnMiss = false;
  let bonus = 400;
  /** @type {number|null} */
  let globalFail = null;

  return {
    /** @param {ModeContext} ctx */
    onEnter(ctx) {
      state = "playing";
      cps = (ctx.level?.rules?.checkpoints || []).slice();
      index = 0;
      onTime = 0;
      failOnMiss = !!ctx.level?.rules?.failOnMissedCheckpoint;
      bonus = Number(ctx.level?.rules?.checkpointBonus) || 0;
      globalFail =
        ctx.level?.rules?.durationSec != null
          ? Number(ctx.level.rules.durationSec)
          : null;
      ctx.flags.clear();
      if (ctx.game) {
        ctx.game.pathAllowImprov = true;
        ctx.game.pathScriptOnly = false;
        ctx.game.pathOnTimeGates = 0;
      }
    },
    /** @param {ModeContext} ctx */
    onUpdate(ctx) {
      if (state !== "playing") return;
      if (livesLeft(ctx.game) <= 0) {
        state = "lost";
        return;
      }
      if (globalFail != null && ctx.elapsed >= globalFail && index < cps.length) {
        if (failOnMiss) {
          state = "lost";
          ctx.flags.add("timeout");
          return;
        }
      }

      while (index < cps.length) {
        const cp = cps[index];
        let hit = false;
        const zone = cp.zone;
        if (zone && ctx.game?.player) {
          const dx = ctx.game.player.x - zone.x;
          const dy = ctx.game.player.y - zone.y;
          const rr = zone.r || 40;
          if (dx * dx + dy * dy <= rr * rr) hit = true;
        }
        if (!hit && ctx.elapsed >= cp.dueSec) {
          hit = true;
        }

        if (!hit) break;

        const onTimeHit = ctx.elapsed <= cp.dueSec + 0.05;
        if (onTimeHit) onTime += 1;
        ctx.flags.add(cp.id);
        if (ctx.game) ctx.game.pathOnTimeGates = onTime;

        if (ctx.game?.particles?.floater && ctx.game.player) {
          const label = cp.label || `GATE ${index + 1}`;
          ctx.game.particles.floater(
            ctx.game.player.x,
            ctx.game.player.y - 48,
            label,
            "#5efcff",
            1.15
          );
        }
        if (bonus > 0 && typeof ctx.game?._addScore === "function") {
          ctx.game._addScore(
            bonus,
            ctx.game.player?.x,
            ctx.game.player?.y - 20,
            Math.min(40, bonus * 0.1)
          );
        } else if (bonus > 0 && ctx.game) {
          ctx.game.score = (ctx.game.score || 0) + bonus;
          ctx.game.ui?.updateScore?.(ctx.game.score);
        }

        index += 1;
      }

      if (index >= cps.length && cps.length > 0) {
        state = "won";
        ctx.flags.add("all-gates");
      }
    },
    onPlayerDeath(ctx) {
      if (livesLeft(ctx.game) <= 0) state = "lost";
    },
    getState() {
      return state;
    },
    /** @param {ModeContext} ctx */
    getHud(ctx) {
      const total = cps.length || 1;
      const next = cps[index];
      return {
        timer: formatClock(ctx.elapsed),
        objective: `GATE ${Math.min(index, total)}/${total}`,
        wave: next?.label ? next.label : undefined,
        label: ctx.level?.name || "CHECKPOINT",
      };
    },
    /** @param {ModeContext} ctx */
    buildResult(ctx) {
      return {
        ...baseResult(ctx, state === "won"),
        onTimeGates: onTime,
      };
    },
  };
}

/** Authored wave script; director off unless allowImprov. */
function wavesController() {
  /** @type {"playing"|"won"|"lost"} */
  let state = "playing";
  /** @type {WaveDef[]} */
  let waves = [];
  let wi = 0;
  /** @type {"idle"|"delay"|"spawning"|"clearing"|"gap"} */
  let phase = "idle";
  let phaseT = 0;
  let gap = 1.2;
  let clearBonus = 0;
  let allowImprov = false;
  /** @type {number|null} */
  let failSafe = null;

  return {
    /** @param {ModeContext} ctx */
    onEnter(ctx) {
      state = "playing";
      waves = (ctx.level?.rules?.waves || []).slice();
      wi = 0;
      phase = "idle";
      phaseT = 0;
      gap = Number(ctx.level?.rules?.waveGapSec) || 1.2;
      clearBonus = Number(ctx.level?.rules?.waveClearBonus) || 0;
      allowImprov = !!ctx.level?.rules?.allowImprov;
      failSafe =
        ctx.level?.rules?.durationSec != null
          ? Number(ctx.level.rules.durationSec)
          : null;
      ctx.flags.clear();
      if (ctx.game) {
        ctx.game.pathAllowImprov = allowImprov;
        ctx.game.pathScriptOnly = !allowImprov;
        ctx.game.phraseBeats = [];
        ctx.game.phraseTag = null;
        ctx.game.spawnQueue = [];
        ctx.game.spawnTimer = 999;
      }
    },
    /** @param {ModeContext} ctx @param {number} dt */
    onUpdate(ctx, dt) {
      if (state !== "playing") return;
      if (livesLeft(ctx.game) <= 0) {
        state = "lost";
        return;
      }
      if (failSafe != null && ctx.elapsed >= failSafe) {
        state = "lost";
        ctx.flags.add("timeout");
        return;
      }

      const g = ctx.game;
      if (!g) return;

      if (wi >= waves.length) {
        const busy =
          (g.enemies && g.enemies.length > 0) ||
          (g.spawnQueue && g.spawnQueue.length > 0);
        if (!busy) {
          state = "won";
          ctx.flags.add("waves-clear");
        }
        return;
      }

      const wave = waves[wi];

      if (phase === "idle") {
        phase = "delay";
        phaseT = Number(wave.delaySec) || 0;
      }

      if (phase === "delay") {
        phaseT -= dt;
        if (phaseT > 0) return;
        const jobs = jobsForPattern(
          wave.pattern,
          wave.types,
          wave.count,
          wave.patternOpts || {},
          g
        ).map((j) => ({ ...j, pathTag: wave.id }));
        g.pathWaveId = wave.id;
        if (!allowImprov) {
          g.phraseBeats = [];
          g.phraseTag = null;
        }
        enqueueJobs(g, jobs);
        if (wave.label && g.particles?.floater && g.player) {
          g.particles.floater(
            g.player.x,
            g.player.y - 52,
            wave.label,
            "#ffe14a",
            1.2
          );
        }
        phase = "spawning";
        return;
      }

      if (phase === "spawning") {
        const pending = (g.spawnQueue || []).some(
          (j) => j.pathTag === wave.id || j.pathScripted
        );
        if (pending) return;
        phase = "clearing";
        return;
      }

      if (phase === "clearing") {
        const alive = (g.enemies || []).length;
        const q = (g.spawnQueue || []).length;
        if (alive > 0 || q > 0) return;

        ctx.flags.add(`wave:${wave.id}`);
        if (clearBonus > 0) {
          if (typeof g._addScore === "function") {
            g._addScore(
              clearBonus,
              g.player?.x,
              g.player?.y - 28,
              Math.min(50, clearBonus * 0.15)
            );
          } else {
            g.score = (g.score || 0) + clearBonus;
            g.ui?.updateScore?.(g.score);
          }
          g.particles?.floater?.(
            g.player?.x,
            g.player?.y - 70,
            "WAVE CLEAR",
            "#ffe14a",
            1.3
          );
        }
        wi += 1;
        if (wi >= waves.length) {
          phase = "idle";
          return;
        }
        phase = "gap";
        phaseT = gap;
        return;
      }

      if (phase === "gap") {
        phaseT -= dt;
        if (phaseT > 0) return;
        phase = "idle";
      }
    },
    onPlayerDeath(ctx) {
      if (livesLeft(ctx.game) <= 0) state = "lost";
    },
    getState() {
      return state;
    },
    /** @param {ModeContext} ctx */
    getHud(ctx) {
      const total = waves.length || 1;
      const cur = Math.min(wi + 1, total);
      const w = waves[Math.min(wi, total - 1)];
      return {
        timer: formatClock(ctx.elapsed),
        objective: `WAVE ${cur}/${total}`,
        wave: w?.label || undefined,
        label: ctx.level?.name || "WAVES",
      };
    },
    /** @param {ModeContext} ctx */
    buildResult(ctx) {
      return baseResult(ctx, state === "won");
    },
  };
}

/** Single elite + timed adds. */
function bossLiteController() {
  /** @type {"playing"|"won"|"lost"} */
  let state = "playing";
  let introT = 0.9;
  let bossSpawned = false;
  let bossDead = false;
  let addAcc = 0;
  /** @type {number|null} */
  let failSafe = null;

  return {
    /** @param {ModeContext} ctx */
    onEnter(ctx) {
      state = "playing";
      introT = Math.max(0.35, Number(ctx.level?.rules?.safeOpeningSec) || 0.9);
      bossSpawned = false;
      bossDead = false;
      addAcc = 0;
      failSafe =
        ctx.level?.rules?.durationSec != null
          ? Number(ctx.level.rules.durationSec)
          : null;
      ctx.flags.clear();
      if (ctx.game) {
        ctx.game.pathAllowImprov = false;
        ctx.game.pathScriptOnly = true;
        ctx.game.phraseBeats = [];
        ctx.game.phraseTag = null;
        ctx.game.spawnQueue = [];
        ctx.game.spawnTimer = 999;
        ctx.game.pathBossAlive = false;
        ctx.game.pathBossKilled = false;
        ctx.game._pathBossSeen = false;
      }
    },
    /** @param {ModeContext} ctx @param {number} dt */
    onUpdate(ctx, dt) {
      if (state !== "playing") return;
      if (livesLeft(ctx.game) <= 0) {
        state = "lost";
        return;
      }
      if (failSafe != null && ctx.elapsed >= failSafe) {
        state = "lost";
        ctx.flags.add("timeout");
        return;
      }

      const g = ctx.game;
      const bossDef = ctx.level?.rules?.boss;
      if (!g || !bossDef) {
        state = "lost";
        return;
      }

      if (!bossSpawned) {
        introT -= dt;
        if (introT > 0) return;
        const sx = bossDef.spawn?.x ?? WORLD_W / 2;
        const sy = bossDef.spawn?.y ?? 180;
        enqueueJobs(g, [
          {
            type: bossDef.type || "tank",
            x: sx,
            y: sy,
            delay: 0,
            approach: { x: 0, y: 1 },
            pathScripted: true,
            boss: true,
            hp: bossDef.hp,
            score: bossDef.score,
            pathTag: "boss",
          },
        ]);
        bossSpawned = true;
        g.pathBossAlive = true;
        if (bossDef.label && g.particles?.floater && g.player) {
          g.particles.floater(
            g.player.x,
            g.player.y - 56,
            bossDef.label,
            "#ff9a2e",
            1.4
          );
        }
        addAcc = 0;
        return;
      }

      const bossEnemy = (g.enemies || []).find((e) => e.pathBoss || e.boss);
      if (bossSpawned && !bossDead) {
        if (bossEnemy) {
          g._pathBossSeen = true;
          g.pathBossAlive = true;
        } else if (
          g.pathBossKilled ||
          (g._pathBossSeen && !(g.spawnQueue || []).some((j) => j.boss))
        ) {
          bossDead = true;
          g.pathBossAlive = false;
          ctx.flags.add("boss-down");
        }
      }

      if (bossSpawned && !bossDead && bossDef.adds) {
        addAcc += dt;
        const every = Math.max(1, Number(bossDef.adds.everySec) || 6);
        if (addAcc >= every) {
          addAcc -= every;
          const jobs = jobsForPattern(
            bossDef.adds.pattern,
            bossDef.adds.types,
            bossDef.adds.count,
            {},
            g
          ).map((j) => ({ ...j, pathTag: "adds", pathScripted: true }));
          enqueueJobs(g, jobs);
        }
      }

      if (bossDead) {
        const needClearAdds = bossDef.clearAdds !== false;
        if (!needClearAdds) {
          state = "won";
          ctx.flags.add("boss-win");
          return;
        }
        const busy =
          (g.enemies || []).length > 0 || (g.spawnQueue || []).length > 0;
        if (!busy) {
          state = "won";
          ctx.flags.add("boss-win");
        }
      }
    },
    /** @param {ModeContext} ctx @param {object} [enemy] */
    onEnemyKilled(ctx, enemy) {
      if (enemy && (enemy.pathBoss || enemy.boss)) {
        bossDead = true;
        ctx.flags.add("boss-down");
        if (ctx.game) {
          ctx.game.pathBossAlive = false;
          ctx.game.pathBossKilled = true;
        }
      }
    },
    onPlayerDeath(ctx) {
      if (livesLeft(ctx.game) <= 0) state = "lost";
    },
    getState() {
      return state;
    },
    /** @param {ModeContext} ctx */
    getHud(ctx) {
      const label = ctx.level?.rules?.boss?.label || "BOSS";
      return {
        timer: formatClock(ctx.elapsed),
        objective: bossDead ? "CLEAR ADDS" : label,
        label: ctx.level?.name || "BOSS",
      };
    },
    /** @param {ModeContext} ctx */
    buildResult(ctx) {
      return baseResult(ctx, state === "won");
    },
  };
}

/**
 * Factory — keep signature stable.
 * @param {string | null | undefined} modeId
 * @returns {ModeHooks}
 */
export function createModeController(modeId) {
  if (!modeId || !isPathModeId(modeId)) {
    return passthroughController();
  }

  switch (modeId) {
    case MODE.EVOLVED:
      return evolvedController();
    case MODE.DEADLINE:
      return deadlineController();
    case MODE.CHECKPOINT:
      return checkpointController();
    case MODE.WAVES:
      return wavesController();
    case MODE.BOSS_LITE:
      return bossLiteController();
    default:
      return passthroughController();
  }
}

/**
 * @param {string} modeId
 */
export function isPathMode(modeId) {
  return isPathModeId(modeId);
}
