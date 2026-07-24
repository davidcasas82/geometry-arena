import { Game } from "./game.js";
import { dumpRunsToConsole, getRecentRuns } from "./runs.js";

const canvas = document.getElementById("game");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const startBtn = document.getElementById("start-btn");
const interruptBtn = document.getElementById("interrupt-btn");
const resumeBtn = document.getElementById("resume-btn");
const pauseBtn = document.getElementById("pause-btn");
const muteBtn = document.getElementById("mute-btn");
const helpBtn = document.getElementById("help-btn");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const multEl = document.getElementById("mult");
const livesEl = document.getElementById("lives");
const bombsEl = document.getElementById("bombs");
const bestEl = document.getElementById("best");
const titleBestEl = document.getElementById("title-best");
const howTo = document.getElementById("how-to");
const titleMenu = document.getElementById("title-menu");
const interruptPanel = document.getElementById("interrupt-panel");
const splash = document.getElementById("splash");

let pendingAction = null;
let splashDone = false;
let helpOpen = false;

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
  titleMenu?.classList.toggle("hidden", mode !== "title");
  interruptPanel?.classList.toggle("hidden", mode !== "panel");
}

/** Live-grid title menu (post-splash / return to menu). */
function showTitleMenu() {
  pendingAction = null;
  helpOpen = false;
  howTo?.classList.add("hidden");
  if (helpBtn) helpBtn.textContent = "HOW TO PLAY";

  setOverlayMode("title");
  if (titleMenu) {
    titleMenu.classList.remove("entering");
    void titleMenu.offsetWidth;
    titleMenu.classList.add("entering");
  }
  overlay?.classList.remove("hidden");
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
  },
  /** Interrupt UIs only (pause / game over). Title menu uses showTitleMenu. */
  showOverlay(title, message, showResume = false, primaryLabel = "Play", onPrimary = null) {
    pendingAction = onPrimary;
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

    howTo?.classList.add("hidden");
    setOverlayMode("panel");
    overlay.classList.remove("hidden");
  },
  showTitleMenu,
  setMuteLabel(on) {
    muteBtn.textContent = on ? "Sound" : "Muted";
  },
};

/** Full-screen 16-bit title → live-grid menu. */
function dismissSplash() {
  if (splashDone || !splash) return;
  splashDone = true;
  splash.classList.add("leaving");
  const finish = () => {
    splash.classList.add("hidden");
    splash.removeEventListener("transitionend", finish);
  };
  splash.addEventListener("transitionend", finish);
  setTimeout(finish, 700);
  // Reveal title menu while splash fades — continuous scene, not a hard cut
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

const game = new Game(canvas, ui);
window.__geometryArena = game;
window.__arenaRuns = () => dumpRunsToConsole();
window.__arenaRecent = () => getRecentRuns(10);

// Gamepad: splash dismiss + title PLAY (keyboard still handled below).
// Same physical press must not dismiss splash and immediately start a run.
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
  requestAnimationFrame(gamepadUiTick);
}
requestAnimationFrame(gamepadUiTick);

function onPrimaryAction() {
  if (typeof pendingAction === "function") {
    const fn = pendingAction;
    pendingAction = null;
    fn();
    return;
  }
  game.start();
}

startBtn?.addEventListener("click", onPrimaryAction);
interruptBtn?.addEventListener("click", onPrimaryAction);

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
