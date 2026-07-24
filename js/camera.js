/**
 * Twin-stick / Geometry Wars–adjacent camera.
 *
 * Real GW keeps the whole board framed; dynamism comes from shake + grid.
 * Modern arena shooters add a bit more:
 *   - slight zoom-in so the camera has room to *move*
 *   - smooth follow with velocity look-ahead (weighty, not locked)
 *   - aim bias (lean into where you're shooting)
 *   - trauma shake (decaying multi-frequency, not pure random)
 *   - fire recoil kick + impact zoom punches
 *
 * This keeps the full arena readable while selling motion and hits.
 */

import { WORLD_H, WORLD_W } from "./constants.js";

export const CAM = {
  /** Base zoom (>1 crops slightly so pan/look-ahead is visible) */
  BASE_ZOOM: 1.1,
  MIN_ZOOM: 1.04,
  MAX_ZOOM: 1.22,
  /** How fast the camera catches the player (higher = snappier) */
  FOLLOW: 6.5,
  /** How far velocity pulls the framing ahead of the ship */
  LOOKAHEAD: 0.14,
  /** Aim direction bias (world units at full aim unit vector) */
  AIM_BIAS: 38,
  /** Zoom recovery speed */
  ZOOM_FOLLOW: 5,
  /**
   * Trauma decay per second.
   * Faster than old 1.35 so kill clusters settle between flurries
   * instead of pinning the camera at full shake.
   */
  TRAUMA_DECAY: 2.2,
  MAX_TRAUMA: 1,
  /**
   * Soft ceiling for routine combat hits (fodder kills, clears).
   * Past this, further small hits barely stack. Big events (bomb,
   * death, elites) can still punch through toward MAX_TRAUMA.
   */
  COMBAT_TRAUMA_SOFT_CAP: 0.42,
  /** Max shake offset in world px at trauma=1 (was 28 — too wild when sustained). */
  SHAKE_MAX: 16,
  /** Rotation amplitude scale at trauma=1 (radians factor). */
  SHAKE_ROT: 0.007,
  /** Fire recoil kick strength */
  RECOIL: 5.5,
  RECOIL_DECAY: 14,
};

export function createCamera() {
  return {
    x: WORLD_W / 2,
    y: WORLD_H / 2,
    zoom: CAM.BASE_ZOOM,
    trauma: 0,
    kickX: 0,
    kickY: 0,
    zoomPunch: 0,
    time: 0,
  };
}

export function resetCamera(cam) {
  cam.x = WORLD_W / 2;
  cam.y = WORLD_H / 2;
  cam.zoom = CAM.BASE_ZOOM;
  cam.trauma = 0;
  cam.kickX = 0;
  cam.kickY = 0;
  cam.zoomPunch = 0;
  cam.time = 0;
}

/**
 * Add trauma 0–1 (stacks, clamped).
 * @param {object} cam
 * @param {number} amount
 * @param {{ big?: boolean }} [opts]  big=true for bomb / death / elite hits —
 *   ignores the combat soft-cap so set-piece moments still punch.
 */
export function addTrauma(cam, amount, opts = {}) {
  if (amount <= 0) return;
  const big = opts.big === true;
  let a = amount;

  // Soft-cap routine combat so dense kill streams don't peg trauma at 1.
  if (!big && cam.trauma >= CAM.COMBAT_TRAUMA_SOFT_CAP) {
    const over = cam.trauma - CAM.COMBAT_TRAUMA_SOFT_CAP;
    // Quickly starve further small additions once past the soft cap
    a *= Math.max(0.06, 1 - over / 0.28);
  }

  // Global diminishing returns near the hard ceiling (applies to everything)
  const head = 1 - cam.trauma / CAM.MAX_TRAUMA;
  a *= 0.3 + 0.7 * head * head;

  cam.trauma = Math.min(CAM.MAX_TRAUMA, cam.trauma + a);
}

/** Brief zoom punch — positive = zoom in. */
export function punchZoom(cam, amount = 0.06) {
  cam.zoomPunch = Math.max(cam.zoomPunch, amount);
}

/** Recoil opposite fire direction (angle radians). */
export function recoil(cam, angle, strength = CAM.RECOIL) {
  cam.kickX -= Math.cos(angle) * strength;
  cam.kickY -= Math.sin(angle) * strength;
}

/**
 * @param {object} cam
 * @param {{x:number,y:number,vx?:number,vy?:number}} player
 * @param {{x:number,y:number}|null} aim unit aim vector
 * @param {number} dt
 */
export function updateCamera(cam, player, aim, dt) {
  cam.time += dt;

  const lookX = (player.vx || 0) * CAM.LOOKAHEAD;
  const lookY = (player.vy || 0) * CAM.LOOKAHEAD;
  const aimX = aim ? aim.x * CAM.AIM_BIAS : 0;
  const aimY = aim ? aim.y * CAM.AIM_BIAS : 0;

  let targetX = player.x + lookX + aimX + cam.kickX;
  let targetY = player.y + lookY + aimY + cam.kickY;

  // Desired zoom
  const targetZoom = Math.min(
    CAM.MAX_ZOOM,
    Math.max(CAM.MIN_ZOOM, CAM.BASE_ZOOM + cam.zoomPunch)
  );

  // Clamp framing so we never show much outside the arena
  const clampCam = (zx) => {
    const halfW = WORLD_W / (2 * zx);
    const halfH = WORLD_H / (2 * zx);
    targetX = Math.max(halfW, Math.min(WORLD_W - halfW, targetX));
    targetY = Math.max(halfH, Math.min(WORLD_H - halfH, targetY));
  };
  clampCam(targetZoom);

  // Smooth follow (frame-rate independent lerp)
  const k = 1 - Math.exp(-CAM.FOLLOW * dt);
  cam.x += (targetX - cam.x) * k;
  cam.y += (targetY - cam.y) * k;

  const kz = 1 - Math.exp(-CAM.ZOOM_FOLLOW * dt);
  cam.zoom += (targetZoom - cam.zoom) * kz;

  // Decay kick & zoom punch
  const kd = 1 - Math.exp(-CAM.RECOIL_DECAY * dt);
  cam.kickX += (0 - cam.kickX) * kd;
  cam.kickY += (0 - cam.kickY) * kd;
  cam.zoomPunch = Math.max(0, cam.zoomPunch - dt * 0.35);

  // Trauma decay
  cam.trauma = Math.max(0, cam.trauma - CAM.TRAUMA_DECAY * dt);

  // Re-clamp after move (zoom may have changed)
  const halfW = WORLD_W / (2 * cam.zoom);
  const halfH = WORLD_H / (2 * cam.zoom);
  cam.x = Math.max(halfW, Math.min(WORLD_W - halfW, cam.x));
  cam.y = Math.max(halfH, Math.min(WORLD_H - halfH, cam.y));
}

/**
 * Multi-frequency shake offset from trauma (not pure white noise).
 * Returns {x, y, rot} in world pixels / radians.
 */
export function cameraShakeOffset(cam) {
  const t = Math.min(1, cam.trauma);
  if (t <= 0.001) return { x: 0, y: 0, rot: 0 };
  // Square curve: small trauma stays subtle; spikes still read
  const mag = t * t * CAM.SHAKE_MAX;
  const tm = cam.time;
  // Layered sines ≈ classic game-feel shake (less epileptic than pure random)
  const x =
    (Math.sin(tm * 62.1) * 0.45 +
      Math.sin(tm * 37.4) * 0.3 +
      Math.sin(tm * 91.7) * 0.25) *
    mag;
  const y =
    (Math.cos(tm * 54.3) * 0.45 +
      Math.sin(tm * 41.2) * 0.3 +
      Math.cos(tm * 78.9) * 0.25) *
    mag;
  const rot =
    (Math.sin(tm * 48) * 0.5 + Math.cos(tm * 33) * 0.5) * t * t * CAM.SHAKE_ROT;
  return { x, y, rot };
}

/**
 * Apply camera transform for world-space drawing.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} cam
 * @param {number} [dpr=1] device pixel ratio — scales into the backing buffer
 */
export function applyCameraTransform(ctx, cam, dpr = 1) {
  const shake = cameraShakeOffset(cam);
  const z = cam.zoom;
  // Device-pixel center → world cam, with shake/rotation
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate((WORLD_W * dpr) / 2, (WORLD_H * dpr) / 2);
  if (shake.rot) ctx.rotate(shake.rot);
  ctx.scale(z * dpr, z * dpr);
  ctx.translate(-cam.x + shake.x, -cam.y + shake.y);
}

/** Menu idle: gentle drift / breathing zoom */
export function updateMenuCamera(cam, dt) {
  cam.time += dt;
  const tx = WORLD_W / 2 + Math.sin(cam.time * 0.35) * 40;
  const ty = WORLD_H / 2 + Math.cos(cam.time * 0.28) * 28;
  const k = 1 - Math.exp(-2 * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  const tz = CAM.BASE_ZOOM + Math.sin(cam.time * 0.5) * 0.02;
  cam.zoom += (tz - cam.zoom) * k;
  cam.trauma = Math.max(0, cam.trauma - dt);
}
