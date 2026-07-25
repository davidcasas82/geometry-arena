import { Game } from "./game.js";
import { dumpRunsToConsole, getRecentRuns } from "./runs.js";

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
  overlay.classList.toggle("mode-title", mode === "title");
  overlay.classList.toggle("mode-panel", mode === "panel");
  overlay.classList.toggle("mode-gameover", mode === "gameover");
  titleMenu?.classList.toggle("hidden", mode !== "title");
  interruptPanel?.classList.toggle("hidden", mode !== "panel");
  gameoverMenu?.classList.toggle("hidden", mode !== "gameover");
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
  helpOpen = false;
  howTo?.classList.add("hidden");
  if (helpBtn) helpBtn.textContent = "HOW TO PLAY";
  resetPanelHelp();
  titleBtn?.classList.add("hidden");
  resumeBtn?.classList.add("hidden");
  panelHelpBtn?.classList.add("hidden");
  if (gameoverMenu) gameoverMenu.classList.remove("entering");

  setOverlayMode("title");
  if (titleMenu) {
    titleMenu.classList.remove("entering");
    void titleMenu.offsetWidth;
    titleMenu.classList.add("entering");
  }
  overlay?.classList.remove("hidden");
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
  hideOverlay() {
    overlay.classList.add("hidden");
    howTo?.classList.add("hidden");
    helpOpen = false;
    resetPanelHelp();
    titleBtn?.classList.add("hidden");
    titleAction = null;
    pendingAction = null;
    gameoverMenu?.classList.add("hidden");
    if (gameoverMenu) gameoverMenu.classList.remove("entering");
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
    if (overlayMessage) overlayMessage.textContent = message;
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
    pendingAction = typeof data.onAgain === "function" ? data.onAgain : null;
    titleAction = typeof data.onTitle === "function" ? data.onTitle : null;

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
    !overlay.classList.contains("hidden") &&
    overlay.classList.contains("mode-title")
  ) {
    if (input.consumeMenuConfirm()) onPrimaryAction();
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

// Arcade shortcuts on title menu: Enter / Space → PLAY
// (Space also prevented from scrolling when body-focused)
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target === document.body) e.preventDefault();

  if (!splashDone) return;
  if (game.state !== "menu") return;
  if (overlay?.classList.contains("hidden")) return;
  if (!overlay?.classList.contains("mode-title")) return;
  if (e.repeat) return;

  if (e.code === "Enter" || e.code === "Space") {
    e.preventDefault();
    onPrimaryAction();
  }
});
