/**
 * Shared ink/enamel drawing helpers.
 * Fat black outline + colored body. No additive glow.
 */

import { GFX } from "./constants.js";

/** Soft circular bloom under shapes (no-op on low quality). */
export function bloom(ctx, x, y, radius, color, alpha = 0.35) {
  if (GFX.LOCAL_BLOOM === false) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, colorWithAlpha(color, alpha));
  g.addColorStop(0.45, colorWithAlpha(color, alpha * 0.35));
  g.addColorStop(1, colorWithAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Stroke a path with outer glow + bright core (caller builds path).
 */
export function neonStroke(ctx, color, coreWidth = 2, glowWidth = 8, _glowAlpha = 0.35) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.globalCompositeOperation = "source-over";

  ctx.strokeStyle = "#12101c";
  ctx.lineWidth = Math.max(coreWidth * 2.4, (glowWidth || 8) * 0.55 + coreWidth);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = coreWidth;
  ctx.stroke();

  ctx.restore();
}

export function neonFillStroke(ctx, fillColor, strokeColor, coreWidth = 2) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = fillColor;
  ctx.fill();

  ctx.strokeStyle = "#12101c";
  ctx.lineWidth = Math.min(coreWidth + 2.4, coreWidth * 2.2);
  ctx.stroke();

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(1.1, coreWidth);
  ctx.stroke();
  ctx.restore();
}

export function colorWithAlpha(color, a) {
  if (typeof color === "string" && color.startsWith("#") && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  if (typeof color === "string" && color.startsWith("rgba")) {
    return color.replace(/rgba\(([^)]+),\s*[\d.]+\)/, `rgba($1, ${a})`);
  }
  return color;
}

export function hexToRgb(hex) {
  if (!hex.startsWith("#") || hex.length !== 7) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}
