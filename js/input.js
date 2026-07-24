/**
 * Keyboard + trackpad/mouse + gamepad + touch input.
 *
 * Move: WASD / arrows / left stick / D-pad / left virtual stick.
 * Aim: mouse / right stick / right virtual stick.
 * Fire: mouse hold / RT / RB / right virtual stick held (auto-fire).
 * Bomb: Space / B / LT / A / LB / touch bomb button.
 * Pause: P / Esc / Start / touch pause button.
 *
 * Touch UI is opt-in via bindTouchControls + setTouchActive — desktop
 * mouse/keyboard paths are unchanged when touch is inactive.
 */

import {
  AIM_SENSITIVITY,
  GAMEPAD_DEADZONE,
  GAMEPAD_FIRE_THRESHOLD,
  TOUCH_DEADZONE,
  TOUCH_STICK_RADIUS,
} from "./constants.js";

/** Standard gamepad button indices (W3C). */
const GP = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  BACK: 8,
  START: 9,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
};

function buttonValue(pad, index) {
  const b = pad.buttons[index];
  if (!b) return 0;
  if (typeof b.value === "number") return b.value;
  return b.pressed ? 1 : 0;
}

function buttonPressed(pad, index) {
  const b = pad.buttons[index];
  return !!(b && b.pressed);
}

/**
 * Apply radial deadzone; returns {x,y} in [-1,1] or zeroed.
 */
function stickAxis(x, y, deadzone = GAMEPAD_DEADZONE) {
  const mag = Math.hypot(x, y);
  if (mag < deadzone || mag < 1e-6) return { x: 0, y: 0 };
  // Rescale so past deadzone maps to full range
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone));
  return { x: (x / mag) * scaled, y: (y / mag) * scaled };
}

export class Input {
  constructor(canvas) {
    this.canvas = canvas;

    /** @type {Set<string>} key codes e.g. KeyW, ArrowLeft */
    this.keys = new Set();

    /** Unit aim direction (independent of movement). */
    this.aim = { x: 1, y: 0 };

    this.mouseDown = false;
    /** After menu click, ignore mouse fire until mouseup. */
    this._blockFire = false;
    /** Ignore gamepad fire until RT/RB released (only if held across start). */
    this._blockGpFire = false;
    this.pointerLocked = false;

    this._pausePressed = false;
    this._mutePressed = false;
    this._restartPressed = false;
    this._bombPressed = false;
    this._menuConfirmPressed = false;

    /** Cached gamepad move (left stick analog 0–1 mag, or D-pad unit). */
    this._gpMove = { x: 0, y: 0 };
    /** True while RT/RB held. */
    this._gpFire = false;
    /** Previous frame button pressed flags for edge detection. */
    this._gpPrev = Object.create(null);
    /** True after a splash-dismiss press until all menu buttons release. */
    this._blockMenuConfirm = false;

    /** Touch virtual sticks (only while setTouchActive(true)). */
    this.touchActive = false;
    this._touchMove = { x: 0, y: 0 };
    this._touchFire = false;
    this._blockTouchFire = false;
    /** @type {Map<number, { role: 'move'|'aim', ox: number, oy: number }>} */
    this._touchPtrs = new Map();
    this._touchUI = null;

    this._onKeyDown = (e) => {
      const code = e.code;
      if (
        code === "KeyW" ||
        code === "KeyA" ||
        code === "KeyS" ||
        code === "KeyD" ||
        code === "ArrowUp" ||
        code === "ArrowDown" ||
        code === "ArrowLeft" ||
        code === "ArrowRight" ||
        code === "Space"
      ) {
        e.preventDefault();
      }

      // Edge-trigger bomb (don't repeat while held)
      if (code === "Space" && !this.keys.has("Space")) {
        this._bombPressed = true;
      }

      this.keys.add(code);

      if (code === "KeyP" || code === "Escape") this._pausePressed = true;
      if (code === "KeyM") this._mutePressed = true;
      if (code === "KeyR") this._restartPressed = true;
      if (code === "KeyB" && !e.repeat) this._bombPressed = true;
    };

    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };

    // Smooth relative aim: nudge the aim vector, then re-normalize.
    // (Replacing aim with each delta caused jumpy "stepped" sweeps.)
    this._onMouseMove = (e) => {
      const mx = e.movementX || 0;
      const my = e.movementY || 0;
      if (mx === 0 && my === 0) return;

      this.aim.x += mx * AIM_SENSITIVITY;
      this.aim.y += my * AIM_SENSITIVITY;
      const len = Math.hypot(this.aim.x, this.aim.y);
      if (len > 1e-6) {
        this.aim.x /= len;
        this.aim.y /= len;
      }
    };

    this._onMouseDown = (e) => {
      if (e.button !== 0) return;
      if (this._blockFire) return;
      this.mouseDown = true;
    };

    this._onMouseUp = (e) => {
      if (e.button !== 0) return;
      this._blockFire = false;
      this.mouseDown = false;
    };

    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
      this._blockFire = false;
      this._blockGpFire = false;
      this._gpMove.x = 0;
      this._gpMove.y = 0;
      this._gpFire = false;
      this._gpPrev = Object.create(null);
      this._resetTouchSticks();
    };

    this._onContext = (e) => e.preventDefault();

    this._onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    };

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("blur", this._onBlur);
    window.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("mousedown", this._onMouseDown);
    window.addEventListener("mouseup", this._onMouseUp);
    canvas.addEventListener("contextmenu", this._onContext);
    document.addEventListener("pointerlockchange", this._onPointerLockChange);
  }

  /**
   * Poll the first connected standard gamepad.
   * Safe to call multiple times per frame; edge flags only rise once.
   */
  pollGamepad() {
    const list = typeof navigator !== "undefined" ? navigator.getGamepads?.() : null;
    if (!list) {
      this._gpMove.x = 0;
      this._gpMove.y = 0;
      this._gpFire = false;
      return;
    }

    let pad = null;
    for (let i = 0; i < list.length; i++) {
      if (list[i]) {
        pad = list[i];
        break;
      }
    }

    if (!pad) {
      this._gpMove.x = 0;
      this._gpMove.y = 0;
      this._gpFire = false;
      this._gpPrev = Object.create(null);
      return;
    }

    const lx = pad.axes[0] ?? 0;
    const ly = pad.axes[1] ?? 0;
    const rx = pad.axes[2] ?? 0;
    const ry = pad.axes[3] ?? 0;

    // Left stick: keep analog magnitude (partial tilt = slower move).
    // stickAxis already deadzones + rescales to 0..1 length.
    const leftStick = stickAxis(lx, ly);
    let mx = leftStick.x;
    let my = leftStick.y;

    // D-pad is digital full-speed; wins when pressed.
    let dpadX = 0;
    let dpadY = 0;
    if (buttonPressed(pad, GP.LEFT)) dpadX -= 1;
    if (buttonPressed(pad, GP.RIGHT)) dpadX += 1;
    if (buttonPressed(pad, GP.UP)) dpadY -= 1;
    if (buttonPressed(pad, GP.DOWN)) dpadY += 1;
    if (dpadX !== 0 || dpadY !== 0) {
      const l = Math.hypot(dpadX, dpadY);
      mx = dpadX / l;
      my = dpadY / l;
    }
    this._gpMove.x = mx;
    this._gpMove.y = my;

    // Right stick: absolute aim while deflected; hold last direction when centered
    const right = stickAxis(rx, ry);
    if (right.x !== 0 || right.y !== 0) {
      const l = Math.hypot(right.x, right.y);
      this.aim.x = right.x / l;
      this.aim.y = right.y / l;
    }

    const rt = buttonValue(pad, GP.RT);
    const lt = buttonValue(pad, GP.LT);
    const rb = buttonPressed(pad, GP.RB);
    this._gpFire = rt >= GAMEPAD_FIRE_THRESHOLD || rb;

    // If trigger was held across PLAY, keep blocking until it releases.
    if (this._blockGpFire && !this._gpFire) {
      this._blockGpFire = false;
    }

    const edge = (index) => {
      const now = buttonPressed(pad, index);
      const was = !!this._gpPrev[index];
      this._gpPrev[index] = now;
      return now && !was;
    };

    // Analog LT: edge when crossing fire threshold (not mere .pressed noise)
    const ltNow = lt >= GAMEPAD_FIRE_THRESHOLD;
    const ltWas = !!this._gpPrev.ltAnalog;
    this._gpPrev.ltAnalog = ltNow;
    const ltEdge = ltNow && !ltWas;

    // Touch edges for all mapped buttons so prev state stays accurate
    const aEdge = edge(GP.A);
    const lbEdge = edge(GP.LB);
    const startEdge = edge(GP.START);
    const backEdge = edge(GP.BACK);
    edge(GP.B);
    edge(GP.X);
    edge(GP.Y);
    edge(GP.RB);
    edge(GP.RT);
    edge(GP.LT);

    if (aEdge || lbEdge || ltEdge) {
      this._bombPressed = true;
    }
    // Face A also restarts / confirms menus; LT is bomb-only
    if (aEdge || lbEdge) {
      this._restartPressed = true;
    }
    if (startEdge) {
      this._pausePressed = true;
      this._restartPressed = true;
      this._menuConfirmPressed = true;
    }
    if (aEdge) {
      this._menuConfirmPressed = true;
    }
    if (backEdge) {
      this._mutePressed = true;
    }

    // After splash (or any block), require full release of confirm buttons
    const confirmHeld =
      buttonPressed(pad, GP.A) || buttonPressed(pad, GP.START);
    if (this._blockMenuConfirm) {
      if (!confirmHeld) this._blockMenuConfirm = false;
      this._menuConfirmPressed = false;
    }
  }

  /**
   * True if any button is held on a connected pad (splash dismiss, etc.).
   */
  gamepadAnyButton() {
    this.pollGamepad();
    const list = navigator.getGamepads?.();
    if (!list) return false;
    for (let i = 0; i < list.length; i++) {
      const pad = list[i];
      if (!pad) continue;
      for (let j = 0; j < pad.buttons.length; j++) {
        if (pad.buttons[j]?.pressed) return true;
      }
    }
    return false;
  }

  /**
   * After dismissing splash with a pad press, ignore Start/A until released
   * so the same press does not immediately hit PLAY.
   */
  blockMenuConfirmUntilRelease() {
    this._blockMenuConfirm = true;
    this._menuConfirmPressed = false;
  }

  /**
   * Wire DOM touch zones + stick visuals. Safe to call once from main.js.
   * @param {{
   *   root: HTMLElement,
   *   moveZone: HTMLElement,
   *   aimZone: HTMLElement,
   *   moveStick: HTMLElement,
   *   aimStick: HTMLElement,
   *   moveKnob: HTMLElement,
   *   aimKnob: HTMLElement,
   *   bombBtn?: HTMLElement|null,
   *   pauseBtn?: HTMLElement|null,
   * }} ui
   */
  bindTouchControls(ui) {
    if (!ui?.moveZone || !ui?.aimZone) return;
    this._touchUI = ui;
    const onDown = (role) => (e) => {
      if (!this.touchActive) return;
      if (e.pointerType === "mouse") return; // desktop mouse uses classic aim
      e.preventDefault();
      e.stopPropagation();
      if (this._touchPtrs.has(e.pointerId)) return;
      // One pointer per role
      for (const p of this._touchPtrs.values()) {
        if (p.role === role) return;
      }
      const ox = e.clientX;
      const oy = e.clientY;
      this._touchPtrs.set(e.pointerId, { role, ox, oy });
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this._showTouchStick(role, ox, oy, 0, 0);
      if (role === "aim") this._touchFire = true;
    };

    const onMove = (e) => {
      const rec = this._touchPtrs.get(e.pointerId);
      if (!rec) return;
      e.preventDefault();
      const dx = e.clientX - rec.ox;
      const dy = e.clientY - rec.oy;
      const vec = this._touchStickVector(dx, dy);
      if (rec.role === "move") {
        this._touchMove.x = vec.x;
        this._touchMove.y = vec.y;
      } else {
        if (vec.x !== 0 || vec.y !== 0) {
          const l = Math.hypot(vec.x, vec.y);
          this.aim.x = vec.x / l;
          this.aim.y = vec.y / l;
        }
        this._touchFire = true;
      }
      this._showTouchStick(rec.role, rec.ox, rec.oy, dx, dy);
    };

    const onUp = (e) => {
      const rec = this._touchPtrs.get(e.pointerId);
      if (!rec) return;
      e.preventDefault();
      this._touchPtrs.delete(e.pointerId);
      this._hideTouchStick(rec.role);
      if (rec.role === "move") {
        this._touchMove.x = 0;
        this._touchMove.y = 0;
      } else {
        this._touchFire = false;
        this._blockTouchFire = false;
      }
    };

    ui.moveZone.addEventListener("pointerdown", onDown("move"));
    ui.aimZone.addEventListener("pointerdown", onDown("aim"));
    for (const z of [ui.moveZone, ui.aimZone]) {
      z.addEventListener("pointermove", onMove);
      z.addEventListener("pointerup", onUp);
      z.addEventListener("pointercancel", onUp);
      z.addEventListener("lostpointercapture", onUp);
    }

    ui.bombBtn?.addEventListener("pointerdown", (e) => {
      if (!this.touchActive) return;
      e.preventDefault();
      e.stopPropagation();
      this._bombPressed = true;
    });

    ui.pauseBtn?.addEventListener("pointerdown", (e) => {
      if (!this.touchActive) return;
      e.preventDefault();
      e.stopPropagation();
      this._pausePressed = true;
    });
  }

  /** Enable/disable virtual sticks (only while playing on touch devices). */
  setTouchActive(on) {
    this.touchActive = !!on;
    if (!on) this._resetTouchSticks();
  }

  _touchStickVector(dx, dy) {
    const maxR = TOUCH_STICK_RADIUS;
    const mag = Math.hypot(dx, dy);
    if (mag < 1e-6) return { x: 0, y: 0 };
    const nx = dx / mag;
    const ny = dy / mag;
    const clamped = Math.min(1, mag / maxR);
    // Apply deadzone in unit space
    if (clamped < TOUCH_DEADZONE) return { x: 0, y: 0 };
    const scaled = (clamped - TOUCH_DEADZONE) / (1 - TOUCH_DEADZONE);
    return { x: nx * scaled, y: ny * scaled };
  }

  _showTouchStick(role, ox, oy, dx, dy) {
    const ui = this._touchUI;
    if (!ui) return;
    const el = role === "move" ? ui.moveStick : ui.aimStick;
    const knob = role === "move" ? ui.moveKnob : ui.aimKnob;
    if (!el || !knob) return;
    el.classList.remove("hidden");
    el.style.left = `${ox}px`;
    el.style.top = `${oy}px`;
    const maxR = TOUCH_STICK_RADIUS;
    const mag = Math.hypot(dx, dy);
    const f = mag > maxR && mag > 0 ? maxR / mag : 1;
    knob.style.transform = `translate(${dx * f}px, ${dy * f}px)`;
  }

  _hideTouchStick(role) {
    const ui = this._touchUI;
    if (!ui) return;
    const el = role === "move" ? ui.moveStick : ui.aimStick;
    const knob = role === "move" ? ui.moveKnob : ui.aimKnob;
    el?.classList.add("hidden");
    if (knob) knob.style.transform = "translate(0, 0)";
  }

  _resetTouchSticks() {
    this._touchPtrs.clear();
    this._touchMove.x = 0;
    this._touchMove.y = 0;
    this._touchFire = false;
    this._blockTouchFire = false;
    this._hideTouchStick("move");
    this._hideTouchStick("aim");
  }

  /**
   * Movement from WASD / arrows / left stick / D-pad / touch stick.
   * Keyboard + D-pad are full speed (unit). Analog sticks preserve magnitude.
   * Combined length is capped at 1.
   */
  moveVector() {
    this.pollGamepad();

    let x = 0;
    let y = 0;

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;

    // Keyboard is digital — unitize before mixing with analog stick
    if (x !== 0 || y !== 0) {
      const l = Math.hypot(x, y);
      x /= l;
      y /= l;
    }

    x += this._gpMove.x;
    y += this._gpMove.y;
    if (this.touchActive) {
      x += this._touchMove.x;
      y += this._touchMove.y;
    }

    // Cap so keyboard + stick cannot exceed full speed
    const mag = Math.hypot(x, y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
    }
    return { x, y };
  }

  /** True while primary button, RT/RB, or right virtual stick is held. */
  isFiring() {
    this.pollGamepad();
    const mouse = this.mouseDown && !this._blockFire;
    const pad = this._gpFire && !this._blockGpFire;
    const touch =
      this.touchActive && this._touchFire && !this._blockTouchFire;
    return mouse || pad || touch;
  }

  aimVector() {
    this.pollGamepad();
    return { x: this.aim.x, y: this.aim.y };
  }

  aimAngle() {
    this.pollGamepad();
    return Math.atan2(this.aim.y, this.aim.x);
  }

  /** Prefer pointer lock for continuous trackpad aim without hitting screen edges. */
  requestPointerLock() {
    // Touch / mobile: pointer lock is unnecessary and often blocked
    if (this.touchActive) return;
    if (typeof window !== "undefined") {
      const coarse =
        window.matchMedia?.("(pointer: coarse)")?.matches ||
        (navigator.maxTouchPoints || 0) > 0 &&
          window.matchMedia?.("(max-width: 900px)")?.matches;
      if (coarse) return;
    }
    if (document.pointerLockElement === this.canvas) return;
    try {
      this.canvas.requestPointerLock?.();
    } catch {
      // Optional — relative aim still works without lock
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock?.();
    }
  }

  /**
   * Call when starting a run so the Play-button click doesn't immediately spray bullets.
   * Fire only starts on the next fresh press after release.
   */
  clearFireButton() {
    this.mouseDown = false;
    this._blockFire = true;
    // Snapshot residual trigger: only block pad fire if already held.
    this.pollGamepad();
    this._blockGpFire = this._gpFire;
    this._blockTouchFire = this._touchFire;
  }

  /**
   * Drop edge-triggered actions (bomb/pause/restart/menu).
   * Needed when A/Start confirms PLAY so the same press does not bomb on frame 1.
   */
  clearEdgeActions() {
    this._bombPressed = false;
    this._pausePressed = false;
    this._restartPressed = false;
    this._menuConfirmPressed = false;
  }

  consumePause() {
    this.pollGamepad();
    const v = this._pausePressed;
    this._pausePressed = false;
    return v;
  }

  consumeMute() {
    this.pollGamepad();
    const v = this._mutePressed;
    this._mutePressed = false;
    return v;
  }

  consumeRestart() {
    this.pollGamepad();
    const v = this._restartPressed;
    this._restartPressed = false;
    return v;
  }

  /** Geometry Wars bomb — Space, B key, LT, A, or LB */
  consumeBomb() {
    this.pollGamepad();
    const v = this._bombPressed;
    this._bombPressed = false;
    return v;
  }

  /** Title menu PLAY — Start or A (edge). */
  consumeMenuConfirm() {
    this.pollGamepad();
    const v = this._menuConfirmPressed;
    this._menuConfirmPressed = false;
    return v;
  }

  resetAim() {
    this.aim.x = 1;
    this.aim.y = 0;
  }

  dispose() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("mousedown", this._onMouseDown);
    window.removeEventListener("mouseup", this._onMouseUp);
    this.canvas.removeEventListener("contextmenu", this._onContext);
    document.removeEventListener("pointerlockchange", this._onPointerLockChange);
    this.exitPointerLock();
  }
}
