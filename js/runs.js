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

/** Dev-only: POST to local ingest so the agent can read playtest deaths. */
function shipPlaytest(kind, payload) {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return;
  if (typeof fetch !== "function") return;
  try {
    fetch("http://127.0.0.1:5179/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ingest offline — localStorage still holds the event */
  }
}

export function recordDeath(event) {
  const row = {
    t: Date.now(),
    ...event,
  };
  const list = readJson(DEATHS_KEY, []);
  list.unshift(row);
  writeJson(DEATHS_KEY, list.slice(0, MAX_DEATHS));
  shipPlaytest("death", row);
}

export function recordRun(run) {
  const row = {
    t: Date.now(),
    ...run,
  };
  const list = readJson(RUNS_KEY, []);
  list.unshift(row);
  writeJson(RUNS_KEY, list.slice(0, MAX_RUNS));
  shipPlaytest("run", row);
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
