/**
 * Screen-space presentation: bloom, chromatic fringe, mult color grade, vignette.
 * World is drawn into a DPR-scaled buffer; this module composites the final look.
 */

import { GFX, WORLD_H, WORLD_W } from "./constants.js";

/**
 * Soft mult intensity 0..1 — log curve so early mult still grades,
 * extreme mult doesn’t instantly nuke the palette.
 */
export function multGradeT(mult) {
  const m = Math.max(1, mult || 1);
  return Math.min(1, Math.log10(1 + m) / Math.log10(80));
}

/**
 * Downsample + blur “bright” energy, then additive-composite onto the frame.
 * Uses two passes: tight bloom (detail) + wide halo (god-ray-ish soft light).
 *
 * @param {CanvasRenderingContext2D} mainCtx  final present context (device px)
 * @param {HTMLCanvasElement} worldCanvas    full world buffer
 * @param {{ tight: HTMLCanvasElement, wide: HTMLCanvasElement }} buffers
 */
export function compositeBloom(mainCtx, worldCanvas, buffers) {
  const { tight, wide } = buffers;
  const tw = tight.width;
  const th = tight.height;
  const ww = wide.width;
  const wh = wide.height;
  if (tw < 2 || th < 2) return;

  const tctx = tight.getContext("2d");
  const wctx = wide.getContext("2d");
  if (!tctx || !wctx) return;

  // ── Tight bloom (detail neon) ──────────────────────────
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.clearRect(0, 0, tw, th);
  tctx.filter = `blur(${GFX.BLOOM_BLUR_PX}px) brightness(${GFX.BLOOM_BRIGHTNESS}) contrast(${GFX.BLOOM_CONTRAST})`;
  tctx.drawImage(worldCanvas, 0, 0, tw, th);
  tctx.filter = "none";

  mainCtx.save();
  mainCtx.globalCompositeOperation = "lighter";
  mainCtx.globalAlpha = GFX.BLOOM_STRENGTH;
  mainCtx.imageSmoothingEnabled = true;
  mainCtx.drawImage(tight, 0, 0, worldCanvas.width, worldCanvas.height);
  mainCtx.restore();

  // ── Wide soft halo ─────────────────────────────────────
  if (ww >= 2 && wh >= 2) {
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.clearRect(0, 0, ww, wh);
    wctx.filter = `blur(${GFX.BLOOM_WIDE_BLUR_PX}px) brightness(${GFX.BLOOM_BRIGHTNESS * 0.95}) contrast(${GFX.BLOOM_CONTRAST})`;
    // Build wide from the already-bright tight buffer for cheaper soft glow
    wctx.drawImage(tight, 0, 0, ww, wh);
    wctx.filter = "none";

    mainCtx.save();
    mainCtx.globalCompositeOperation = "lighter";
    mainCtx.globalAlpha = GFX.BLOOM_WIDE_STRENGTH;
    mainCtx.imageSmoothingEnabled = true;
    mainCtx.drawImage(wide, 0, 0, worldCanvas.width, worldCanvas.height);
    mainCtx.restore();
  }
}

/**
 * Fake chromatic aberration: offset tinted ghosts of the world buffer.
 * Strength rides trauma² so idle play is clean and hits fringe hard.
 *
 * @param {CanvasRenderingContext2D} mainCtx
 * @param {HTMLCanvasElement} worldCanvas
 * @param {number} trauma 0..1
 * @param {number} dpr
 */
export function compositeChromatic(mainCtx, worldCanvas, trauma, dpr) {
  const t = Math.min(1, Math.max(0, trauma || 0));
  if (t < GFX.CA_TRAUMA_MIN) return;

  const intensity = t * t;
  const offset = intensity * GFX.CA_MAX_OFFSET_PX * dpr;
  const alpha = Math.min(0.4, intensity * GFX.CA_ALPHA);

  mainCtx.save();
  mainCtx.globalCompositeOperation = "screen";
  mainCtx.globalAlpha = alpha;
  mainCtx.imageSmoothingEnabled = true;

  // Warm / red fringe
  mainCtx.filter = "sepia(1) saturate(6) hue-rotate(-35deg) brightness(1.15)";
  mainCtx.drawImage(worldCanvas, -offset, 0);

  // Cool / cyan fringe
  mainCtx.filter = "sepia(1) saturate(6) hue-rotate(165deg) brightness(1.15)";
  mainCtx.drawImage(worldCanvas, offset, 0);

  mainCtx.filter = "none";
  mainCtx.restore();
}

/**
 * Mult-reactive color grade in world pixel space (caller sets dpr transform).
 * Cool cyan stage → electric → hot magenta as mult climbs.
 */
export function drawColorGrade(ctx, mult = 1) {
  const t = multGradeT(mult);
  const alpha = GFX.GRADE_BASE_ALPHA + t * GFX.GRADE_MULT_ALPHA;

  ctx.save();
  // Soft radial grade: cooler center early, hotter edges at high mult
  const g = ctx.createRadialGradient(
    WORLD_W * 0.5,
    WORLD_H * 0.48,
    WORLD_H * 0.12,
    WORLD_W * 0.5,
    WORLD_H * 0.5,
    WORLD_W * 0.72
  );

  // Center: always a touch of cyan “stage light”
  const cr = Math.round(20 + t * 40);
  const cg = Math.round(90 + t * 20);
  const cb = Math.round(160 - t * 40);
  g.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${alpha * 0.55})`);

  // Mid: electric violet as intensity rises
  const mr = Math.round(40 + t * 120);
  const mg = Math.round(60 - t * 20);
  const mb = Math.round(140 + t * 40);
  g.addColorStop(0.55, `rgba(${mr}, ${mg}, ${mb}, ${alpha * 0.7})`);

  // Edge: hot magenta / ember at high mult, deep navy at low
  const er = Math.round(10 + t * 180);
  const eg = Math.round(8 + t * 20);
  const eb = Math.round(40 + t * 60);
  g.addColorStop(1, `rgba(${er}, ${eg}, ${eb}, ${alpha})`);

  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // High mult: tiny additive warmth so neon “runs hot”
  if (t > 0.25) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 60, 140, ${(t - 0.25) * 0.055})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.fillStyle = `rgba(80, 200, 255, ${(1 - t) * 0.03})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  ctx.restore();
}

/**
 * Stronger vignette; high mult tightens the tunnel slightly (focus / pressure).
 * World-pixel space; caller applies dpr transform.
 */
export function drawPostVignette(ctx, mult = 1) {
  const t = multGradeT(mult);
  const edge = GFX.VIGNETTE_BASE + t * GFX.VIGNETTE_MULT_EXTRA;
  // Tighter inner radius as mult climbs
  const inner = WORLD_H * (0.38 - t * 0.06);

  const g = ctx.createRadialGradient(
    WORLD_W / 2,
    WORLD_H / 2,
    inner,
    WORLD_W / 2,
    WORLD_H / 2,
    WORLD_W * (0.72 - t * 0.04)
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.55, `rgba(0,0,8,${edge * 0.15})`);
  g.addColorStop(1, `rgba(0,0,0,${edge})`);

  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Subtle cool rim light so vignette doesn’t feel like pure dirt
  ctx.globalCompositeOperation = "lighter";
  const rim = ctx.createRadialGradient(
    WORLD_W / 2,
    WORLD_H / 2,
    WORLD_W * 0.42,
    WORLD_W / 2,
    WORLD_H / 2,
    WORLD_W * 0.7
  );
  rim.addColorStop(0, "rgba(0,0,0,0)");
  rim.addColorStop(0.75, "rgba(0,0,0,0)");
  rim.addColorStop(1, `rgba(40, 120, 220, ${0.04 + t * 0.03})`);
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.restore();
}
