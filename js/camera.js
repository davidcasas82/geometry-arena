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
 *   - edge zoom-out + hard "keep ship visible" clamp (walls never eat the player)
 *
 * This keeps the full arena readable while selling motion and hits.
 */

import { WORLD_H, WORLD_W } from "./constants.js";

export const CAM = {
  /** Base zoom (>1 crops slightly so pan/look-ahead is visible) */
  BASE_ZOOM: 1.1,
  /** Floor zoom near arena edges — keeps the ship framed */
  EDGE_ZOOM: 1.0,
  MIN_ZOOM: 1.0,
  MAX_ZOOM: 1.22,
  /** How fast the camera catches the player (higher = snappier) */
  FOLLOW: 6.5,
  /** How far velocity pulls the framing ahead of the ship */
  LOOKAHEAD: 0.14,
  /** Aim direction bias (world units at full aim unit vector) */
  AIM_BIAS: 38,
  /** World px from wall where we start zooming out / killing look-ahead */
  EDGE_SOFT: 200,
  /** Keep at least this much ship padding inside the visible frame */
  PLAYER_MARGIN: 40,
  /** Allow this much void past the arena when tracking an edge ship */
  VOID_PAD: 72,
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

export function createCamera(worldW = WORLD_W, worldH = WORLD_H) {
  return {
    x: worldW / 2,
    y: worldH / 2,
    zoom: CAM.BASE_ZOOM,
    trauma: 0,
    kickX: 0,
    kickY: 0,
    zoomPunch: 0,
    time: 0,
    worldW,
    worldH,
  };
}

export function resetCamera(cam, worldW = WORLD_W, worldH = WORLD_H) {
  cam.worldW = worldW;
  cam.worldH = worldH;
  cam.x = worldW / 2;
  cam.y = worldH / 2;
  cam.zoom = CAM.BASE_ZOOM;
  cam.trauma = 0;
  cam.kickX = 0;
  cam.kickY = 0;
  cam.zoomPunch = 0;
  cam.time = 0;
}

function camWorld(cam, view) {
  return {
    w: view?.worldW ?? cam?.worldW ?? WORLD_W,
    h: view?.worldH ?? cam?.worldH ?? WORLD_H,
  };
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
 * 0 at center, 1 when within EDGE_SOFT of a wall (per axis then max).
 */
function edgeProximity(player, worldW = WORLD_W, worldH = WORLD_H) {
  const s = CAM.EDGE_SOFT;
  const ex = Math.max(0, Math.max(s - player.x, player.x - (worldW - s)) / s);
  const ey = Math.max(0, Math.max(s - player.y, player.y - (worldH - s)) / s);
  return Math.max(0, Math.min(1, Math.max(ex, ey)));
}

/**
 * Visible half-extents in world units for the *on-screen* frame.
 * `visFrac*` < 1 when CSS cover-crop clips the canvas (phones).
 */
function visibleHalf(zoom, visFracX = 1, visFracY = 1, worldW = WORLD_W, worldH = WORLD_H) {
  const z = Math.max(0.5, zoom);
  return {
    halfW: (worldW / (2 * z)) * Math.max(0.35, Math.min(1, visFracX)),
    halfH: (worldH / (2 * z)) * Math.max(0.35, Math.min(1, visFracY)),
  };
}

/**
 * Keep the ship inside the visible frame. Wins over arena-fill clamps.
 */
function clampToKeepPlayerVisible(tx, ty, player, halfW, halfH) {
  const m = CAM.PLAYER_MARGIN + (player.r || 0);
  // Visible world is [cam ± half]. Player must stay inside with margin.
  // => cam ∈ [player - half + m, player + half - m]
  const minX = player.x - halfW + m;
  const maxX = player.x + halfW - m;
  const minY = player.y - halfH + m;
  const maxY = player.y + halfH - m;
  // If the visible frame is smaller than the ship pad, just lock on player
  const x =
    minX > maxX ? player.x : Math.max(minX, Math.min(maxX, tx));
  const y =
    minY > maxY ? player.y : Math.max(minY, Math.min(maxY, ty));
  return { x, y };
}

/** Soft limit how far past the arena the view may drift. */
function clampVoid(tx, ty, halfW, halfH, worldW = WORLD_W, worldH = WORLD_H) {
  const pad = CAM.VOID_PAD;
  return {
    x: Math.max(halfW - pad, Math.min(worldW - halfW + pad, tx)),
    y: Math.max(halfH - pad, Math.min(worldH - halfH + pad, ty)),
  };
}

/**
 * @param {object} cam
 * @param {{x:number,y:number,vx?:number,vy?:number,r?:number}} player
 * @param {{x:number,y:number}|null} aim unit aim vector
 * @param {number} dt
 * @param {{visFracX?:number,visFracY?:number}|null} [view]
 *        Fraction of the canvas actually on-screen (cover-fit crop).
 */
export function updateCamera(cam, player, aim, dt, view = null) {
  cam.time += dt;

  const visFracX = view?.visFracX ?? 1;
  const visFracY = view?.visFracY ?? 1;
  const { w: worldW, h: worldH } = camWorld(cam, view);
  cam.worldW = worldW;
  cam.worldH = worldH;
  const edge = edgeProximity(player, worldW, worldH);
  // Kill look-ahead / aim lean into walls so we don't push the ship off-frame
  const leadScale = 1 - edge * 0.92;

  const lookX = (player.vx || 0) * CAM.LOOKAHEAD * leadScale;
  const lookY = (player.vy || 0) * CAM.LOOKAHEAD * leadScale;
  const aimX = aim ? aim.x * CAM.AIM_BIAS * leadScale : 0;
  const aimY = aim ? aim.y * CAM.AIM_BIAS * leadScale : 0;

  let targetX = player.x + lookX + aimX + cam.kickX;
  let targetY = player.y + lookY + aimY + cam.kickY;

  // Zoom out toward EDGE_ZOOM near walls so edges stay playable
  const base =
    CAM.BASE_ZOOM * (1 - edge) + CAM.EDGE_ZOOM * edge + cam.zoomPunch * (1 - edge * 0.5);
  const targetZoom = Math.min(CAM.MAX_ZOOM, Math.max(CAM.MIN_ZOOM, base));

  {
    const { halfW, halfH } = visibleHalf(targetZoom, visFracX, visFracY, worldW, worldH);
    // Prefer not showing endless void, then hard-guarantee ship on screen
    const voided = clampVoid(targetX, targetY, halfW, halfH, worldW, worldH);
    const kept = clampToKeepPlayerVisible(voided.x, voided.y, player, halfW, halfH);
    targetX = kept.x;
    targetY = kept.y;
  }

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

  // Final hard clamp after lerp/zoom settle — ship must stay visible
  {
    const { halfW, halfH } = visibleHalf(cam.zoom, visFracX, visFracY, worldW, worldH);
    const voided = clampVoid(cam.x, cam.y, halfW, halfH, worldW, worldH);
    const kept = clampToKeepPlayerVisible(voided.x, voided.y, player, halfW, halfH);
    cam.x = kept.x;
    cam.y = kept.y;
  }
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
export function applyCameraTransform(ctx, cam, dpr = 1, worldW = WORLD_W, worldH = WORLD_H) {
  const shake = cameraShakeOffset(cam);
  const z = cam.zoom;
  const w = worldW ?? cam.worldW ?? WORLD_W;
  const h = worldH ?? cam.worldH ?? WORLD_H;
  // Device-pixel center → world cam, with shake/rotation
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate((w * dpr) / 2, (h * dpr) / 2);
  if (shake.rot) ctx.rotate(shake.rot);
  ctx.scale(z * dpr, z * dpr);
  ctx.translate(-cam.x + shake.x, -cam.y + shake.y);
}

/** Menu idle: gentle drift / breathing zoom */
export function updateMenuCamera(cam, dt, worldW = WORLD_W, worldH = WORLD_H) {
  cam.time += dt;
  const w = worldW ?? cam.worldW ?? WORLD_W;
  const h = worldH ?? cam.worldH ?? WORLD_H;
  cam.worldW = w;
  cam.worldH = h;
  const tx = w / 2 + Math.sin(cam.time * 0.35) * 40;
  const ty = h / 2 + Math.cos(cam.time * 0.28) * 28;
  const k = 1 - Math.exp(-2 * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  const tz = CAM.BASE_ZOOM + Math.sin(cam.time * 0.5) * 0.02;
  cam.zoom += (tz - cam.zoom) * k;
  cam.trauma = Math.max(0, cam.trauma - dt);
}
