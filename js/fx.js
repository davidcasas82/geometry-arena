/**
 * Shared neon drawing helpers — multi-pass glow like Geometry Wars.
 * Uses additive compositing carefully for bloom without full post-process.
 */

/** Soft circular bloom under shapes */
export function bloom(ctx, x, y, radius, color, alpha = 0.35) {
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
export function neonStroke(ctx, color, coreWidth = 2, glowWidth = 8, glowAlpha = 0.35) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Dark silhouette strike first (contrast against busy floor)
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.65)";
  ctx.lineWidth = glowWidth * 1.35 + coreWidth;
  ctx.stroke();

  // Wide soft outer
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = colorWithAlpha(color, glowAlpha * 0.45);
  ctx.lineWidth = glowWidth * 1.8;
  ctx.stroke();

  ctx.strokeStyle = colorWithAlpha(color, glowAlpha);
  ctx.lineWidth = glowWidth;
  ctx.stroke();

  // Core
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = color;
  ctx.lineWidth = coreWidth;
  ctx.stroke();

  // Hot white center line
  ctx.strokeStyle = "rgba(255,255,255,0.62)";
  ctx.lineWidth = Math.max(0.8, coreWidth * 0.38);
  ctx.stroke();

  ctx.restore();
}

export function neonFillStroke(ctx, fillColor, strokeColor, coreWidth = 2) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.fillStyle = fillColor;
  ctx.fill();

  // Dark outer strike — punches silhouette off multi-hue floor / bloom
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
  ctx.lineWidth = coreWidth * 4.2;
  ctx.stroke();

  // Soft colored glow outside the dark strike
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = colorWithAlpha(strokeColor, 0.42);
  ctx.lineWidth = coreWidth * 2.6;
  ctx.stroke();

  // Bright body stroke
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = coreWidth * 1.15;
  ctx.stroke();

  // Hot white strike line for edge read
  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = Math.max(0.9, coreWidth * 0.4);
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
