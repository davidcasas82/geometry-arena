import { Game } from "./game.js";
import { dumpRunsToConsole, getRecentRuns } from "./runs.js";
import {
  CHAPTER_TITLES,
  getLevel,
  getNextLevelId,
  listPathLevels,
  maxPathStars,
  totalStarsEarned,
} from "./levels.js";
import {
  exportProgressDebug,
  isLevelUnlocked,
  loadProgress,
  recordLevelResult,
} from "./progress.js";

const canvas = document.getElementById("game");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const startBtn = document.getElementById("start-btn");
const interruptBtn = document.getElementById("interrupt-btn");
const titleBtn = document.getElementById("title-btn");
const resumeBtn = document.getElementById("resume-btn");
const pauseBtn = document.getElementById("pause-btn");
const muteBtn = document.getElementById("mute-btn");
const helpBtn = document.getElementById("help-btn");
const panelHelpBtn = document.getElementById("panel-help-btn");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const multEl = document.getElementById("mult");
const livesEl = document.getElementById("lives");
const bombsEl = document.getElementById("bombs");
const bestEl = document.getElementById("best");
const titleBestEl = document.getElementById("title-best");
const howTo = document.getElementById("how-to");
const panelHowto = document.getElementById("panel-howto");
const titleMenu = document.getElementById("title-menu");
const interruptPanel = document.getElementById("interrupt-panel");
const gameoverMenu = document.getElementById("gameover-menu");
const goAgainBtn = document.getElementById("go-again-btn");
const goTitleBtn = document.getElementById("go-title-btn");
const goScoreEl = document.getElementById("go-score");
const goPeakEl = document.getElementById("go-peak");
const goTimeEl = document.getElementById("go-time");
const goBestEl = document.getElementById("go-best");
const goMetaEl = document.getElementById("go-meta");
const goRunsEl = document.getElementById("go-runs");
const splash = document.getElementById("splash");
const touchControls = document.getElementById("touch-controls");
const portraitHint = document.getElementById("portrait-hint");

// Path shell DOM
const pathBtn = document.getElementById("path-btn");
const pathMap = document.getElementById("path-map");
const pathBrief = document.getElementById("path-brief");
const pathResult = document.getElementById("path-result");
const pathChapters = document.getElementById("path-chapters");
const pathMapStars = document.getElementById("path-map-stars");
const titleStarsCount = document.getElementById("title-stars-count");
const pathObjStat = document.getElementById("path-obj-stat");
const pathObjectiveEl = document.getElementById("path-objective");
const levelLabelEl = document.getElementById("level-label");

const pathFocusOrder = document.getElementById("path-focus-order");
const pathFocusName = document.getElementById("path-focus-name");
const pathFocusTag = document.getElementById("path-focus-tag");
const pathFocusMode = document.getElementById("path-focus-mode");
const pathFocusArena = document.getElementById("path-focus-arena");
const pathFocusLock = document.getElementById("path-focus-lock");
const pathFocusLesson = document.getElementById("path-focus-lesson");
const pathFocusBest = document.getElementById("path-focus-best");
const pathSelectBtn = document.getElementById("path-select-btn");
const pathBackBtn = document.getElementById("path-back-btn");

const briefOrder = document.getElementById("brief-order");
const briefName = document.getElementById("brief-name");
const briefTag = document.getElementById("brief-tag");
const briefMode = document.getElementById("brief-mode");
const briefArena = document.getElementById("brief-arena");
const briefObjective = document.getElementById("brief-objective");
const briefLesson = document.getElementById("brief-lesson");
const briefStartBtn = document.getElementById("brief-start-btn");
const briefBackBtn = document.getElementById("brief-back-btn");

const pathResultWord = document.getElementById("path-result-word");
const pathResultTag = document.getElementById("path-result-tag");
const pathResultStars = document.getElementById("path-result-stars");
const prScore = document.getElementById("pr-score");
const prStars = document.getElementById("pr-stars");
const prBest = document.getElementById("pr-best");
const prTime = document.getElementById("pr-time");
const pathResultMeta = document.getElementById("path-result-meta");
const prPrimaryBtn = document.getElementById("pr-primary-btn");
const prRetryBtn = document.getElementById("pr-retry-btn");
const prMapBtn = document.getElementById("pr-map-btn");
const prTitleBtn = document.getElementById("pr-title-btn");

/** @type {"title"|"path"|"brief"|"playing"|"result"} */
let shellView = "title";
/** @type {string|null} */
let pathFocusId = null;
/** @type {string|null} */
let pathBriefId = null;
/** Active Path level while playing (for HUD/fail intercept) */
/** @type {string|null} */
let pathActiveId = null;
/** @type {object|null} last Path result */
let lastPathResult = null;
let pathPrimaryAction = null;
/** RAF handle for Path objective HUD refresh */
let pathHudRaf = 0;
/** Guard against double result UI */
let pathResultLock = false;

let pendingAction = null;
let titleAction = null;
let splashDone = false;
let helpOpen = false;
let panelHelpOpen = false;

/** Phones / tablets: touch points + coarse pointer or narrow viewport. */
function preferTouchUI() {
  if (typeof window === "undefined") return false;
  const touchPoints = navigator.maxTouchPoints || 0;
  if (touchPoints <= 0) return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 900px)").matches;
  return coarse || narrow;
}

function syncTouchChrome() {
  const want = preferTouchUI();
  document.body.classList.toggle("touch-ui", want);

  const playing = game?.state === "playing";
  const showSticks = want && playing;

  if (touchControls) {
    touchControls.classList.toggle("hidden", !showSticks);
    touchControls.setAttribute("aria-hidden", showSticks ? "false" : "true");
  }
  game?.input?.setTouchActive(showSticks);

  // Portrait hint while on a touch device in portrait
  const portrait =
    want && window.matchMedia("(orientation: portrait)").matches;
  portraitHint?.classList.toggle("hidden", !portrait);

  // Refit canvas when chrome density changes
  game?.fitCanvas?.();
}

function format(n) {
  return n.toLocaleString("en-US");
}

function setBestDisplays(n) {
  const s = format(n);
  if (bestEl) bestEl.textContent = s;
  if (titleBestEl) titleBestEl.textContent = s;
}

function setOverlayMode(mode) {
  if (!overlay) return;
  // Exclusive modes — never leave two mode-* classes active
  overlay.classList.remove(
    "mode-title",
    "mode-panel",
    "mode-gameover",
    "mode-path",
    "mode-brief",
    "mode-path-result"
  );
  const known = ["title", "panel", "gameover", "path", "brief", "path-result"];
  if (known.includes(mode)) overlay.classList.add(`mode-${mode}`);

  titleMenu?.classList.toggle("hidden", mode !== "title");
  interruptPanel?.classList.toggle("hidden", mode !== "panel");
  gameoverMenu?.classList.toggle("hidden", mode !== "gameover");
  pathMap?.classList.toggle("hidden", mode !== "path");
  pathBrief?.classList.toggle("hidden", mode !== "brief");
  pathResult?.classList.toggle("hidden", mode !== "path-result");

  if (mode !== "gameover" && gameoverMenu) gameoverMenu.classList.remove("entering");
  if (mode !== "title" && titleMenu) titleMenu.classList.remove("entering");
  if (mode !== "path-result" && pathResult) pathResult.classList.remove("entering");
}

function resetPanelHelp() {
  panelHelpOpen = false;
  panelHowto?.classList.add("hidden");
  if (panelHelpBtn) panelHelpBtn.textContent = "HOW TO PLAY";
}

/** Live-grid title menu (post-splash / return to menu). */
function showTitleMenu() {
  pendingAction = null;
  titleAction = null;
  pathPrimaryAction = null;
  shellView = "title";
  pathActiveId = null;
  pathResultLock = false;
  stopPathHudPoll();
  helpOpen = false;
  howTo?.classList.add("hidden");
  if (helpBtn) helpBtn.textContent = "HOW TO PLAY";
  resetPanelHelp();
  titleBtn?.classList.add("hidden");
  resumeBtn?.classList.add("hidden");
  panelHelpBtn?.classList.add("hidden");
  if (gameoverMenu) gameoverMenu.classList.remove("entering");
  document.body.classList.remove("path-run");
  setPathHudVisible(false);

  refreshTitleStars();
  setOverlayMode("title");
  if (titleMenu) {
    titleMenu.classList.remove("entering");
    void titleMenu.offsetWidth;
    titleMenu.classList.add("entering");
  }
  overlay?.classList.remove("hidden");
  syncTouchChrome();
}


function starGlyphs(n) {
  const s = Math.max(0, Math.min(3, n | 0));
  return "★".repeat(s) + "☆".repeat(3 - s);
}

function refreshTitleStars() {
  const p = loadProgress();
  const earned = totalStarsEarned(p);
  const max = maxPathStars();
  if (titleStarsCount) titleStarsCount.textContent = `${earned}/${max}`;
  if (pathMapStars) pathMapStars.textContent = `${earned}/${max}`;
}

function setPathHudVisible(on) {
  pathObjStat?.classList.toggle("hidden", !on);
  if (!on && pathObjectiveEl) pathObjectiveEl.textContent = "—";
  if (!on && levelLabelEl) levelLabelEl.textContent = "Level";
  document.body.classList.toggle("path-run", !!on);
}

function stopPathHudPoll() {
  if (pathHudRaf) {
    cancelAnimationFrame(pathHudRaf);
    pathHudRaf = 0;
  }
}

/**
 * Keep Obj chip fresh while Path runs.
 * Prefer mode.getHud via game.mode; fall back to local objective + timer.
 * (Cherry-picked from path-ui agent — mode-runtime already pushes HUD too.)
 */
function startPathHudPoll() {
  stopPathHudPoll();
  const tick = () => {
    if (!game || game.state !== "playing" || !pathActiveId) {
      pathHudRaf = 0;
      return;
    }
    updatePathHudFromGame();
    pathHudRaf = requestAnimationFrame(tick);
  };
  pathHudRaf = requestAnimationFrame(tick);
}

function pad2(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function updatePathHudFromGame() {
  const level = getLevel(pathActiveId) || game?.pathLevel || null;
  if (!level) return;

  let hud = null;
  try {
    if (game.mode && typeof game.mode.getHud === "function") {
      const ctx =
        typeof game._modeContext === "function"
          ? game._modeContext()
          : {
              game,
              level,
              arena: game.arena,
              elapsed: game.elapsed || 0,
              durationLeft: Math.max(
                0,
                (level.rules?.durationSec || 0) - (game.elapsed || 0)
              ),
              flags: game.modeFlags || new Set(),
            };
      hud = game.mode.getHud(ctx) || null;
    }
  } catch {
    hud = null;
  }

  const total = listPathLevels().length;
  const order = level.order || 1;
  if (levelEl) {
    levelEl.textContent = hud?.label || `${order}/${total}`;
    levelEl.title = level.name || "";
  }
  if (levelLabelEl) levelLabelEl.textContent = "Path";

  let obj =
    (hud && (hud.objective || hud.timer || hud.wave)) ||
    objectiveForLevel(level, { short: true });

  // Local countdown/count-up if mode HUD sparse
  if ((!hud || (!hud.timer && !hud.objective)) && level.rules?.durationSec) {
    const elapsed = Number(game.elapsed) || 0;
    const dur = level.rules.durationSec;
    if (level.mode === "deadline") {
      const left = Math.max(0, dur - elapsed);
      obj = `HIT ${(level.rules.targetScore || 0).toLocaleString()} · ${Math.floor(left / 60)}:${pad2(left % 60)}`;
      pathObjStat?.classList.toggle("hot", left < 10);
    } else if (level.mode === "evolved") {
      const t = Math.min(dur, elapsed);
      obj = `SURVIVE ${Math.floor(t / 60)}:${pad2(t % 60)} / ${dur}s`;
      pathObjStat?.classList.remove("hot");
    } else {
      pathObjStat?.classList.remove("hot");
    }
  }

  if (pathObjectiveEl && obj) {
    pathObjectiveEl.textContent = String(obj).slice(0, 36);
  }
  pathObjStat?.classList.remove("hidden");
}

function objectiveForLevel(level, { short = false } = {}) {
  if (!level) return "";
  const r = level.rules || {};
  const mode = String(level.mode || "").toUpperCase();
  switch (level.mode) {
    case "deadline": {
      const tgt = (r.targetScore || 0).toLocaleString();
      const sec = r.durationSec || 0;
      if (short) return `HIT ${tgt} · ${sec}s`;
      return `WIN: score ${tgt}+ before ${sec}s runs out`;
    }
    case "evolved": {
      const sec = r.durationSec || 0;
      if (short) return `SURVIVE ${sec}s`;
      return `WIN: stay alive for ${sec}s (score builds stars)`;
    }
    case "waves": {
      const n = (r.waves || []).length;
      if (short) return `CLEAR ${n} WAVES`;
      return `WIN: clear all ${n} waves (board empty after last)`;
    }
    case "checkpoint": {
      const n = (r.checkpoints || []).length;
      if (short) return `HIT ${n} GATES`;
      return `WIN: reach all ${n} gate zones`;
    }
    case "boss-lite": {
      const name = r.boss?.label || "BOSS";
      if (short) return `KILL ${name}`;
      return `WIN: destroy ${name}${r.boss?.clearAdds ? " + remaining adds" : ""}`;
    }
    default:
      return mode || "PATH";
  }
}

function ensurePathFocus() {
  const levels = listPathLevels();
  if (!levels.length) return null;
  const p = loadProgress();
  if (pathFocusId && levels.some((l) => l.id === pathFocusId)) return pathFocusId;
  const unlocked = levels.filter((l) => isLevelUnlocked(l.id, p));
  pathFocusId = (unlocked[unlocked.length - 1] || levels[0]).id;
  return pathFocusId;
}

function updatePathFocusPanel(level, progress) {
  if (!level) return;
  const unlocked = isLevelUnlocked(level.id, progress);
  const stars = progress.stars?.[level.id] || 0;
  const best = progress.bestScore?.[level.id] || 0;
  if (pathFocusOrder) pathFocusOrder.textContent = String(level.order).padStart(2, "0");
  if (pathFocusName) pathFocusName.textContent = level.name;
  if (pathFocusTag) pathFocusTag.textContent = level.tagline || "";
if (pathFocusMode) pathFocusMode.textContent = String(level.mode).toUpperCase();
  if (pathFocusArena) {
    // MVP: all Path levels use classic rect — show pressure focus, not topology
    pathFocusArena.textContent = "ARENA";
    pathFocusArena.title = "Classic rectangle playfield";
  }
  // Prefer clear win condition over flavor lesson in the focus card
  if (pathFocusLesson) {
    pathFocusLesson.textContent = objectiveForLevel(level);
  }
  if (pathFocusBest) {
    pathFocusBest.textContent = best
      ? `BEST ${format(best)} · ${starGlyphs(stars)}`
      : `BEST — · ${starGlyphs(stars)}`;
  }
  pathFocusLock?.classList.toggle("hidden", unlocked);
  if (pathSelectBtn) {
    pathSelectBtn.disabled = !unlocked;
    pathSelectBtn.textContent = unlocked ? "SELECT" : "LOCKED";
  }
}

function renderPathMap() {
  const levels = listPathLevels();
  const progress = loadProgress();
  ensurePathFocus();
  refreshTitleStars();
  if (!pathChapters) return;

  const byChapter = new Map();
  for (const l of levels) {
    if (!byChapter.has(l.chapter)) byChapter.set(l.chapter, []);
    byChapter.get(l.chapter).push(l);
  }

  pathChapters.innerHTML = "";
  for (const [ch, rows] of [...byChapter.entries()].sort((a, b) => a[0] - b[0])) {
    const section = document.createElement("section");
    section.className = "path-chapter";
    const label = document.createElement("h3");
    label.className = "path-chapter-label";
    label.textContent = `CH.${ch} ${CHAPTER_TITLES[ch] || ""}`.trim();
    section.appendChild(label);

const row = document.createElement("div");
    // CSS expects .path-route (horizontal nodes + connector line)
    row.className = "path-route";
    for (const level of rows) {
      const unlocked = isLevelUnlocked(level.id, progress);
      const stars = progress.stars?.[level.id] || 0;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "path-node";
      btn.dataset.levelId = level.id;
      btn.classList.toggle("is-locked", !unlocked);
      btn.classList.toggle("is-unlocked", unlocked);
      btn.classList.toggle("is-cleared", stars > 0);
      btn.classList.toggle("is-focused", level.id === pathFocusId);
      btn.setAttribute("aria-label", `${level.name}${unlocked ? "" : " locked"}`);
      btn.innerHTML = `
        <span class="path-node-pip" aria-hidden="true"></span>
        <span class="path-node-meta">
          <span class="path-node-order">${String(level.order).padStart(2, "0")}</span>
          <span class="path-node-name">${level.name}</span>
          <span class="path-node-stars">${starGlyphs(stars)}</span>
        </span>`;
      btn.addEventListener("click", () => {
        pathFocusId = level.id;
        renderPathMap();
        if (unlocked) showPathBrief(level.id);
      });
      row.appendChild(btn);
    }
    section.appendChild(row);
    pathChapters.appendChild(section);
  }

  const focus = getLevel(pathFocusId) || levels[0];
  updatePathFocusPanel(focus, progress);
}

function showPathMap() {
  shellView = "path";
  pendingAction = null;
  pathPrimaryAction = null;
  pathResultLock = false;
  stopPathHudPoll();
  document.body.classList.remove("path-run");
  setPathHudVisible(false);
  renderPathMap();
  setOverlayMode("path");
  overlay?.classList.remove("hidden");
  syncTouchChrome();
}

function showPathBrief(levelId) {
  const level = getLevel(levelId);
  if (!level) return;
  if (!isLevelUnlocked(level.id)) return;
  pathBriefId = level.id;
  pathFocusId = level.id;
  shellView = "brief";
  if (briefOrder) briefOrder.textContent = `${level.order} / ${listPathLevels().length}`;
  if (briefName) briefName.textContent = level.name;
  if (briefTag) briefTag.textContent = level.tagline || "";
if (briefMode) briefMode.textContent = String(level.mode).toUpperCase();
  if (briefArena) {
    briefArena.textContent = "ARENA";
    briefArena.title = "Classic rectangle playfield";
  }
  if (briefObjective) briefObjective.textContent = objectiveForLevel(level);
  if (briefLesson) {
    const tip = level.skillLesson || "";
    briefLesson.textContent = tip ? `TIP: ${tip}` : "";
  }
  setOverlayMode("brief");
  overlay?.classList.remove("hidden");
  syncTouchChrome();
}

function launchPathLevel(levelId) {
  const id = levelId || pathBriefId || pathFocusId;
  const level = getLevel(id);
  if (!level) {
    console.warn("[arena:path] missing level", id);
    return;
  }
  if (!isLevelUnlocked(level.id)) return;

  pathActiveId = level.id;
  pathBriefId = level.id;
  pathFocusId = level.id;
  pathResultLock = false;
  shellView = "playing";

  setPathHudVisible(true);
  if (levelLabelEl) levelLabelEl.textContent = "Path";
  const total = listPathLevels().length;
  if (levelEl) {
    levelEl.textContent = `${level.order}/${total}`;
    levelEl.title = level.name;
  }
  if (pathObjectiveEl) {
    pathObjectiveEl.textContent = objectiveForLevel(level, { short: true });
  }

  overlay?.classList.add("hidden");
  setOverlayMode("title");

  const ok =
    typeof game.startLevel === "function"
      ? game.startLevel(level.id)
      : typeof game.startPathLevel === "function"
        ? game.startPathLevel(level.id)
        : (console.warn("[arena:path] Game.startLevel missing — Classic start fallback"),
          game.start(),
          false);

  if (ok === false) {
    try {
      game.shell = "path";
      game.pathLevel = level;
    } catch {
      /* ignore */
    }
  }
  startPathHudPoll();
  syncTouchChrome();
}

function showPathResultUI(result) {
  const incoming = result || lastPathResult;
  if (!incoming) return;

  // Avoid double-finalize from onPathResult + gameOver intercept
  const rid = incoming.levelId || pathActiveId;
  if (pathResultLock && shellView === "result" && lastPathResult?.levelId === rid) {
    return;
  }
  pathResultLock = true;
  stopPathHudPoll();

  lastPathResult = incoming;
  const r = lastPathResult;
  if (r.levelId) pathActiveId = r.levelId;
  const level = r.level || getLevel(r.levelId || pathActiveId);
  const cleared = !!(r.cleared ?? r.won ?? (r.outcome === "won"));
  const stars = Math.max(0, Math.min(3, Number(r.stars) || 0));
  const score = r.score != null ? Number(r.score) : Number(game?.score) || 0;
  const elapsed =
    r.elapsedSec != null
      ? Number(r.elapsedSec)
      : r.extra?.elapsedSec != null
        ? Number(r.extra.elapsedSec)
        : Math.round(Number(game?.elapsed) || 0);

  // Persist bests
  if (r.levelId || pathActiveId) {
    recordLevelResult(r.levelId || pathActiveId, {
      score,
      stars,
      elapsedSec: elapsed,
      cleared,
    });
  }
  refreshTitleStars();

  shellView = "result";
  pathPrimaryAction = null;
  document.body.classList.remove("path-run");
  setPathHudVisible(false);
  pathObjStat?.classList.remove("hot");

  const fill = pathResultWord?.querySelector?.(".path-result-fill") || pathResultWord;
  if (fill) fill.textContent = cleared ? "CLEAR" : "FAIL";
  pathResult?.classList.toggle("is-fail", !cleared);
  pathResult?.classList.toggle("is-clear", cleared);
  if (pathResultTag) pathResultTag.textContent = (level?.name || "PATH").toUpperCase();
  if (prScore) prScore.textContent = format(score);
  if (prStars) prStars.textContent = String(stars);
  if (prTime) prTime.textContent = `${Math.round(elapsed)}s`;
  const best = loadProgress().bestScore?.[r.levelId || pathActiveId] || score;
  if (prBest) prBest.textContent = format(best);
  if (pathResultMeta) {
    pathResultMeta.textContent = cleared
      ? `${starGlyphs(stars)}  ·  ${level?.mode?.toUpperCase() || "PATH"}`
      : "RETRY TO ADVANCE";
  }
  pathResultStars?.querySelectorAll?.(".star-pip")?.forEach((el, i) => {
    el.classList.toggle("on", i < stars);
  });

  const levelId = r.levelId || pathActiveId || level?.id;
  const nextId = levelId ? getNextLevelId(levelId) : null;
  const nextUnlocked = nextId && isLevelUnlocked(nextId);
  if (prPrimaryBtn) {
    if (cleared && nextUnlocked) {
      prPrimaryBtn.textContent = "NEXT";
      pathPrimaryAction = () => {
        pathResultLock = false;
        launchPathLevel(nextId);
      };
    } else if (cleared) {
      prPrimaryBtn.textContent = "PATH MAP";
      pathPrimaryAction = () => {
        pathResultLock = false;
        showPathMap();
      };
    } else {
      prPrimaryBtn.textContent = "RETRY";
      pathPrimaryAction = () => {
        pathResultLock = false;
        launchPathLevel(levelId);
      };
    }
  }

  setOverlayMode("path-result");
  if (pathResult) {
    pathResult.classList.remove("entering");
    void pathResult.offsetWidth;
    pathResult.classList.add("entering");
  }
  overlay?.classList.remove("hidden");
  // Return game to menu ambient without Classic gameover
  try {
    if (game.state === "path_clear" || game.state === "path_fail" || game.state === "playing") {
      game.state = "menu";
    }
  } catch {
    /* ignore */
  }
  syncTouchChrome();
}

const ui = {
  updateScore(n) {
    scoreEl.textContent = format(n);
  },
  updateLevel(n) {
    if (levelEl) levelEl.textContent = String(n);
  },
  updateMult(n) {
    multEl.textContent = `×${Math.floor(n)}`;
    multEl.parentElement?.classList.toggle("hot", n >= 10);
    multEl.parentElement?.classList.toggle("blazing", n >= 40);
  },
  updateLives(n) {
    livesEl.textContent = String(n);
  },
  updateBombs(n) {
    if (bombsEl) bombsEl.textContent = String(n);
  },
  updateBest(n) {
    setBestDisplays(n);
  },
  updateObjective(text) {
    if (pathObjectiveEl) pathObjectiveEl.textContent = text || "—";
    if (text) pathObjStat?.classList.remove("hidden");
  },
  updateTimer(text) {
    // Mode may send timer separately; HUD poll also refreshes — keep last timer soft
    if (!text || !pathObjectiveEl) return;
    const cur = pathObjectiveEl.textContent || "";
    // If objective looks like a bare placeholder, show timer only
    if (!cur || cur === "—") {
      pathObjectiveEl.textContent = text;
      return;
    }
    // Replace trailing time-like suffix rather than stacking forever
    const stripped = cur.replace(/\s*·\s*\d+:\d{2}\s*$/, "").replace(/\s*·\s*\d+s\s*$/i, "");
    if (stripped && stripped !== text) {
      pathObjectiveEl.textContent = `${stripped} · ${text}`;
    } else {
      pathObjectiveEl.textContent = text;
    }
  },
  updatePathLevel(level) {
    setPathHudVisible(true);
    if (levelLabelEl) levelLabelEl.textContent = "Path";
    if (levelEl && level) {
      levelEl.textContent = level.order != null ? String(level.order) : level.name || "—";
    }
if (level && pathObjectiveEl) {
      pathObjectiveEl.textContent = objectiveForLevel(level, { short: true });
    }
  },
  updatePathLabel(label) {
    if (label && levelEl) levelEl.textContent = label;
  },
  updateWave(w) {
    if (w != null && pathObjectiveEl) {
      pathObjectiveEl.textContent = typeof w === "string" ? w : `WAVE ${w}`;
    }
  },
  onPathResult(result) {
    showPathResultUI(result);
  },
  showPathResult(result) {
    showPathResultUI(result);
  },
  hideOverlay() {
    overlay.classList.add("hidden");
    howTo?.classList.add("hidden");
    helpOpen = false;
    resetPanelHelp();
    titleBtn?.classList.add("hidden");
    titleAction = null;
    pendingAction = null;
    pathPrimaryAction = null;
    gameoverMenu?.classList.add("hidden");
    if (gameoverMenu) gameoverMenu.classList.remove("entering");
    pathMap?.classList.add("hidden");
    pathBrief?.classList.add("hidden");
    pathResult?.classList.add("hidden");
    syncTouchChrome();
  },
  /**
   * Interrupt UIs only (pause). Title menu uses showTitleMenu; game over uses showGameOver.
   * @param {{ showTitle?: boolean, onTitle?: function|null, showHelp?: boolean }} [opts]
   */
  showOverlay(
    title,
    message,
    showResume = false,
    primaryLabel = "Play",
    onPrimary = null,
    opts = {}
  ) {
    pendingAction = onPrimary;
    titleAction = typeof opts.onTitle === "function" ? opts.onTitle : null;
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayMessage) {
      let msg = message;
      // Cherry-pick: surface Path objective on pause
      if (pathActiveId && (shellView === "playing" || game?.shell === "path")) {
        const level = getLevel(pathActiveId) || game?.pathLevel;
        if (level) {
          msg = `${message}\n\n${level.name} · ${objectiveForLevel(level, { short: true })}`;
        }
      }
      overlayMessage.textContent = msg;
    }
    if (interruptBtn) interruptBtn.textContent = primaryLabel;

    const needSecondary =
      showResume && primaryLabel.toLowerCase() !== "resume";
    if (needSecondary) {
      resumeBtn?.classList.remove("hidden");
    } else {
      resumeBtn?.classList.add("hidden");
    }

    if (opts.showTitle && titleAction) {
      titleBtn?.classList.remove("hidden");
    } else {
      titleBtn?.classList.add("hidden");
    }

    resetPanelHelp();
    if (opts.showHelp) {
      panelHelpBtn?.classList.remove("hidden");
    } else {
      panelHelpBtn?.classList.add("hidden");
    }

    howTo?.classList.add("hidden");
    setOverlayMode("panel");
    overlay.classList.remove("hidden");
    syncTouchChrome();
  },
  /**
   * Logo-style game over on the live grid (no boilerplate box).
   * @param {{ score:number, best:number, peakMult:number, timeStr:string, deaths:number, level:number, runsSummary?:string, onAgain:function, onTitle:function }}
   */
  showGameOver(data) {
    // Cherry-pick: if Classic gameOver fires mid-Path, route to Path FAIL
    if (
      pathActiveId &&
      (shellView === "playing" || game?.shell === "path" || game?.pathLevel)
    ) {
      showPathResultUI({
        levelId: pathActiveId || game?.pathLevel?.id,
        level: getLevel(pathActiveId) || game?.pathLevel,
        cleared: false,
        score: data.score ?? game?.score,
        peakMult: data.peakMult ?? game?.peakMult,
        elapsedSec: game?.elapsed,
        stars: 0,
      });
      return;
    }

    pendingAction = typeof data.onAgain === "function" ? data.onAgain : null;
    titleAction = typeof data.onTitle === "function" ? data.onTitle : null;
    stopPathHudPoll();
    setPathHudVisible(false);

    if (goScoreEl) goScoreEl.textContent = format(data.score || 0);
    if (goPeakEl) goPeakEl.textContent = `×${Math.floor(data.peakMult || 1)}`;
    if (goTimeEl) goTimeEl.textContent = data.timeStr || "0s";
    if (goBestEl) goBestEl.textContent = format(data.best || 0);
    if (goMetaEl) {
      const deaths = data.deaths ?? 0;
      const level = data.level ?? 1;
      goMetaEl.textContent = `LVL ${level}  ·  ${deaths} DEATH${deaths === 1 ? "" : "S"}`;
    }
    if (goRunsEl) {
      const summary = (data.runsSummary || "").trim();
      if (summary) {
        goRunsEl.textContent = summary;
        goRunsEl.classList.remove("hidden");
      } else {
        goRunsEl.textContent = "";
        goRunsEl.classList.add("hidden");
      }
    }

    howTo?.classList.add("hidden");
    resetPanelHelp();
    titleBtn?.classList.add("hidden");
    resumeBtn?.classList.add("hidden");
    panelHelpBtn?.classList.add("hidden");

    setOverlayMode("gameover");
    if (gameoverMenu) {
      gameoverMenu.classList.remove("entering");
      void gameoverMenu.offsetWidth;
      gameoverMenu.classList.add("entering");
    }
    overlay?.classList.remove("hidden");
    syncTouchChrome();
  },
  showTitleMenu,
  setMuteLabel(on) {
    muteBtn.textContent = on ? "Sound" : "Muted";
  },
};

/** Full-screen 16-bit title → live-grid menu (iris wipe + sting). */
function dismissSplash() {
  if (splashDone || !splash) return;
  splashDone = true;
  // Unlock audio on the same user gesture, then sting into the wipe
  try {
    game?.audio?.ensure?.();
    game?.audio?.splashDismiss?.();
  } catch {
    /* ignore */
  }
  splash.classList.add("leaving");
  const finish = (e) => {
    if (e && e.target !== splash) return;
    splash.classList.add("hidden");
    splash.removeEventListener("transitionend", finish);
  };
  splash.addEventListener("transitionend", finish);
  setTimeout(() => finish(), 900);
  // Reveal title menu while splash wipes — continuous scene, not a hard cut
  showTitleMenu();
}

if (splash) {
  overlay?.classList.add("hidden");

  const onSplashInput = (e) => {
    if (e.type === "keydown" && e.repeat) return;
    if (e.type === "keydown") e.preventDefault();
    dismissSplash();
    window.removeEventListener("keydown", onSplashInput);
    splash.removeEventListener("pointerdown", onSplashInput);
  };

  window.addEventListener("keydown", onSplashInput);
  splash.addEventListener("pointerdown", onSplashInput);
} else {
  splashDone = true;
  showTitleMenu();
}

/** Assigned after UI helpers so splash dismiss can safely optional-chain audio. */
let game = null;
game = new Game(canvas, ui);
window.__geometryArena = game;
window.__arenaRuns = () => dumpRunsToConsole();
window.__arenaRecent = () => getRecentRuns(10);
window.__arenaPath = () => exportProgressDebug();
refreshTitleStars();

// Virtual sticks + bomb/pause (no-ops on desktop mouse)
game.input.bindTouchControls({
  root: touchControls,
  moveZone: document.getElementById("touch-zone-move"),
  aimZone: document.getElementById("touch-zone-aim"),
  moveStick: document.getElementById("touch-stick-move"),
  aimStick: document.getElementById("touch-stick-aim"),
  moveKnob: document.getElementById("touch-knob-move"),
  aimKnob: document.getElementById("touch-knob-aim"),
  bombBtn: document.getElementById("touch-bomb"),
  pauseBtn: document.getElementById("touch-pause"),
});

syncTouchChrome();
window.addEventListener("resize", syncTouchChrome);
window.addEventListener("orientationchange", () => {
  setTimeout(syncTouchChrome, 120);
});
// Coarse pointer can change when docking keyboards etc.
window.matchMedia("(pointer: coarse)").addEventListener?.("change", syncTouchChrome);
window.matchMedia("(max-width: 900px)").addEventListener?.("change", syncTouchChrome);

// Gamepad: splash dismiss + title PLAY (keyboard still handled below).
// Same physical press must not dismiss splash and immediately start a run.
// Also keep touch chrome in sync with game state.
let lastTouchState = "";
function gamepadUiTick() {
  const input = game.input;
  if (!splashDone) {
    if (input.gamepadAnyButton()) {
      dismissSplash();
      input.blockMenuConfirmUntilRelease();
    }
  } else if (
    game.state === "menu" &&
    overlay &&
    !overlay.classList.contains("hidden")
  ) {
    if (overlay.classList.contains("mode-title")) {
      if (input.consumeMenuConfirm()) onPrimaryAction();
    } else if (
      overlay.classList.contains("mode-path") ||
      overlay.classList.contains("mode-brief") ||
      overlay.classList.contains("mode-path-result")
    ) {
      if (input.consumeMenuConfirm()) onPathConfirm();
    }
  }

  const sig = `${game.state}|${preferTouchUI()}`;
  if (sig !== lastTouchState) {
    lastTouchState = sig;
    syncTouchChrome();
  }
  requestAnimationFrame(gamepadUiTick);
}
requestAnimationFrame(gamepadUiTick);

function onPrimaryAction() {
  if (typeof pendingAction === "function") {
    const fn = pendingAction;
    pendingAction = null;
    fn();
    syncTouchChrome();
    return;
  }
  // Classic PLAY — leave Path shell fully
  pathActiveId = null;
  pathResultLock = false;
  stopPathHudPoll();
  setPathHudVisible(false);
  shellView = "title";
  game.start();
  syncTouchChrome();
}

startBtn?.addEventListener("click", onPrimaryAction);
interruptBtn?.addEventListener("click", onPrimaryAction);
goAgainBtn?.addEventListener("click", onPrimaryAction);

titleBtn?.addEventListener("click", () => {
  if (typeof titleAction === "function") {
    const fn = titleAction;
    titleAction = null;
    fn();
    syncTouchChrome();
  }
});

goTitleBtn?.addEventListener("click", () => {
  if (typeof titleAction === "function") {
    const fn = titleAction;
    titleAction = null;
    fn();
    syncTouchChrome();
  }
});

resumeBtn?.addEventListener("click", () => {
  game.resume();
});

pauseBtn?.addEventListener("click", () => {
  if (game.state === "playing") game.pause();
  else if (game.state === "paused") game.resume();
});

muteBtn?.addEventListener("click", () => {
  game.toggleMute();
});

helpBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  helpOpen = !helpOpen;
  howTo?.classList.toggle("hidden", !helpOpen);
  helpBtn.textContent = helpOpen ? "HIDE HELP" : "HOW TO PLAY";
});

panelHelpBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  panelHelpOpen = !panelHelpOpen;
  panelHowto?.classList.toggle("hidden", !panelHelpOpen);
  panelHelpBtn.textContent = panelHelpOpen ? "HIDE HELP" : "HOW TO PLAY";
});

function onPathConfirm() {
  if (shellView === "path") {
    const id = ensurePathFocus();
    if (id && isLevelUnlocked(id)) showPathBrief(id);
    return;
  }
  if (shellView === "brief") {
    launchPathLevel(pathBriefId);
    return;
  }
  if (shellView === "result") {
    if (typeof pathPrimaryAction === "function") {
      const fn = pathPrimaryAction;
      pathPrimaryAction = null;
      fn();
    }
  }
}

pathBtn?.addEventListener("click", () => showPathMap());
pathBackBtn?.addEventListener("click", () => showTitleMenu());
pathSelectBtn?.addEventListener("click", () => {
  const id = ensurePathFocus();
  if (id && isLevelUnlocked(id)) showPathBrief(id);
});
briefBackBtn?.addEventListener("click", () => showPathMap());
briefStartBtn?.addEventListener("click", () => launchPathLevel(pathBriefId));
prPrimaryBtn?.addEventListener("click", () => onPathConfirm());
prRetryBtn?.addEventListener("click", () => {
  pathResultLock = false;
  const id = lastPathResult?.levelId || pathActiveId || pathFocusId;
  if (id) launchPathLevel(id);
});
prMapBtn?.addEventListener("click", () => {
  pathResultLock = false;
  showPathMap();
});
prTitleBtn?.addEventListener("click", () => {
  pathResultLock = false;
  showTitleMenu();
});

// Arcade shortcuts on title / path shells
// (Space also prevented from scrolling when body-focused)
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target === document.body) e.preventDefault();

  if (!splashDone) return;
  if (game.state !== "menu" && game.state !== "path_clear" && game.state !== "path_fail") return;
  if (overlay?.classList.contains("hidden")) return;
  if (e.repeat) return;

  // Path map navigation
  if (overlay.classList.contains("mode-path")) {
    const levels = listPathLevels();
    const idx = Math.max(0, levels.findIndex((l) => l.id === pathFocusId));
    if (e.code === "ArrowRight" || e.code === "ArrowDown") {
      e.preventDefault();
      const n = levels[Math.min(levels.length - 1, idx + 1)];
      if (n) {
        pathFocusId = n.id;
        renderPathMap();
      }
      return;
    }
    if (e.code === "ArrowLeft" || e.code === "ArrowUp") {
      e.preventDefault();
      const n = levels[Math.max(0, idx - 1)];
      if (n) {
        pathFocusId = n.id;
        renderPathMap();
      }
      return;
    }
    if (e.code === "Enter" || e.code === "Space") {
      e.preventDefault();
      onPathConfirm();
      return;
    }
    if (e.code === "Escape") {
      e.preventDefault();
      showTitleMenu();
      return;
    }
  }

  if (overlay.classList.contains("mode-brief")) {
    if (e.code === "Enter" || e.code === "Space") {
      e.preventDefault();
      onPathConfirm();
      return;
    }
    if (e.code === "Escape") {
      e.preventDefault();
      showPathMap();
      return;
    }
  }

  if (overlay.classList.contains("mode-path-result")) {
    if (e.code === "Enter" || e.code === "Space") {
      e.preventDefault();
      onPathConfirm();
      return;
    }
    if (e.code === "KeyR") {
      e.preventDefault();
      const id = lastPathResult?.levelId;
      if (id) launchPathLevel(id);
      return;
    }
    if (e.code === "Escape") {
      e.preventDefault();
      showPathMap();
      return;
    }
  }

  if (!overlay.classList.contains("mode-title")) return;

  if (e.code === "Enter" || e.code === "Space") {
    e.preventDefault();
    onPrimaryAction();
  }
});
