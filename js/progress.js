/**
 * Geometry Arena — Arena Path progress (localStorage).
 * Mirrors js/runs.js persistence style.
 * Contract: docs/LEVELS_DESIGN.md
 */

import {
  getLevel,
  isUnlocked,
  listPathLevels,
  listUnlockedIds,
  normalizeProgress,
  totalStarsEarned,
  maxPathStars,
} from "./levels.js";

export const PROGRESS_KEY = "geometry-arena-path-progress";
export const PROGRESS_VERSION = 1;

/**
 * @typedef {import('./levels.js').PathProgress} PathProgress
 */

function emptyProgress() {
  return /** @type {PathProgress} */ ({
    stars: {},
    bestScore: {},
    bestTime: {},
    updatedAt: Date.now(),
    version: PROGRESS_VERSION,
  });
}

function canUseStorage() {
  return typeof localStorage !== "undefined" && localStorage != null;
}

/**
 * @returns {PathProgress}
 */
export function loadProgress() {
  if (!canUseStorage()) return emptyProgress();
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw);
    const p = normalizeProgress(parsed);
    p.version = PROGRESS_VERSION;
    return p;
  } catch {
    return emptyProgress();
  }
}

/**
 * @param {PathProgress} p
 */
export function saveProgress(p) {
  const next = normalizeProgress(p);
  next.version = PROGRESS_VERSION;
  next.updatedAt = Date.now();
  if (!canUseStorage()) return next;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  return next;
}

export function clearProgress() {
  if (canUseStorage()) {
    try {
      localStorage.removeItem(PROGRESS_KEY);
    } catch {
      /* ignore */
    }
  }
  return emptyProgress();
}

/**
 * Apply a finished Path run. Never decreases best stars.
 *
 * @param {string} levelId
 * @param {{ score: number, stars: number, elapsedSec?: number, cleared: boolean }} result
 * @returns {PathProgress}
 */
export function recordLevelResult(levelId, result) {
  const level = getLevel(levelId);
  const p = loadProgress();
  if (!level || !result) return p;

  const score = Number(result.score) || 0;
  const stars = Math.max(0, Math.min(3, Number(result.stars) || 0));
  const prevStars = p.stars[levelId] || 0;
  if (stars > prevStars) p.stars[levelId] = stars;

  const prevBest = p.bestScore[levelId] || 0;
  if (score > prevBest) p.bestScore[levelId] = score;

  if (result.elapsedSec != null && Number.isFinite(result.elapsedSec)) {
    const t = Number(result.elapsedSec);
    const prevT = p.bestTime?.[levelId];
    // Prefer lower time when cleared; otherwise keep first sample.
    if (result.cleared) {
      if (prevT == null || t < prevT) {
        p.bestTime = p.bestTime || {};
        p.bestTime[levelId] = t;
      }
    }
  }

  return saveProgress(p);
}

/**
 * @param {string} levelId
 * @param {PathProgress} [p]
 */
export function getStars(levelId, p = loadProgress()) {
  return Math.max(0, Math.min(3, p?.stars?.[levelId] || 0));
}

/**
 * @param {PathProgress} [p]
 * @returns {string[]}
 */
export function getUnlockedIds(p = loadProgress()) {
  return listUnlockedIds(p);
}

/**
 * @param {string} levelId
 * @param {PathProgress} [p]
 */
export function isLevelUnlocked(levelId, p = loadProgress()) {
  return isUnlocked(levelId, p);
}

/** Debug dump for console / UAT */
export function exportProgressDebug() {
  const p = loadProgress();
  const rows = listPathLevels().map((l) => ({
    id: l.id,
    order: l.order,
    unlocked: isUnlocked(l.id, p),
    stars: p.stars[l.id] || 0,
    bestScore: p.bestScore[l.id] || 0,
    bestTime: p.bestTime?.[l.id] ?? null,
  }));
  const summary = {
    earned: totalStarsEarned(p),
    max: maxPathStars(),
    updatedAt: p.updatedAt,
  };
  if (typeof console !== "undefined") {
    console.info("[arena:path-progress]", summary);
    console.table(rows);
  }
  return { progress: p, rows, summary };
}
