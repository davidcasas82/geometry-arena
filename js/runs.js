/**
 * Persistent run history for tuning (last N games + death events).
 * Stored in localStorage so we can review after the fact.
 */

import { HS_KEY } from "./constants.js";

export const RUNS_KEY = "geometry-arena-runs";
export const DEATHS_KEY = "geometry-arena-deaths";
const MAX_RUNS = 20;
const MAX_DEATHS = 50;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function recordDeath(event) {
  const list = readJson(DEATHS_KEY, []);
  list.unshift({
    t: Date.now(),
    ...event,
  });
  writeJson(DEATHS_KEY, list.slice(0, MAX_DEATHS));
}

export function recordRun(run) {
  const list = readJson(RUNS_KEY, []);
  list.unshift({
    t: Date.now(),
    ...run,
  });
  writeJson(RUNS_KEY, list.slice(0, MAX_RUNS));
  return list.slice(0, MAX_RUNS);
}

export function getRecentRuns(n = 5) {
  return readJson(RUNS_KEY, []).slice(0, n);
}

export function getRecentDeaths(n = 10) {
  return readJson(DEATHS_KEY, []).slice(0, n);
}

/** Human summary for overlay / console */
export function formatRunsSummary(runs) {
  if (!runs.length) return "No saved runs yet — finish a game after this update.";
  return runs
    .map((r, i) => {
      const sec = r.elapsed ?? 0;
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      const time = m > 0 ? `${m}m${String(s).padStart(2, "0")}s` : `${s}s`;
      return `${i + 1}. ${time} · ${Number(r.score || 0).toLocaleString()} · peak ×${r.peakMult ?? r.mult ?? "?"} · L${r.level ?? "?"}`;
    })
    .join("\n");
}

export function dumpRunsToConsole() {
  const runs = getRecentRuns(10);
  const deaths = getRecentDeaths(15);
  console.info("[arena:runs] last games (newest first)");
  if (runs.length) console.table(runs);
  else console.info("(none yet)");
  console.info("[arena:deaths] last deaths");
  if (deaths.length) console.table(deaths);
  else console.info("(none yet)");
  return { runs, deaths, best: localStorage.getItem(HS_KEY) };
}
