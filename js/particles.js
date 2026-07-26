import { FLOATER_MAX, GFX, PARTICLE_MAX } from "./constants.js";
import { colorWithAlpha } from "./fx.js";

/**
 * Additive neon particles — sparks, streaks, rings, thruster dust,
 * vacuum inhale streams + electric bolts.
 * Sektori rule: spectacle is front-loaded; debris dies fast so the board stays readable.
 */
export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floaters = [];
    this.rings = []; // expanding shock rings
    /** @type {{ points: {x:number,y:number}[], life: number, maxLife: number, color: string, width: number }[]} */
    this.bolts = []; // vacuum / lightning arcs (not circular rings)
  }

  burst(x, y, color, count = 28, speed = 320) {
    const room = PARTICLE_MAX - this.particles.length;
    const n = Math.min(count, Math.max(0, room));
    const streakLife = GFX.KILL_STREAK_LIFE || 0.26;
    const softLife = GFX.KILL_SOFT_LIFE || 0.32;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = speed * (0.45 + Math.random() * 1.2);
      // Bias streaks — short hot filaments over lingering soft dots
      const isStreak = Math.random() < 0.72;
      const life = isStreak
        ? streakLife * (0.55 + Math.random() * 0.55)
        : softLife * (0.5 + Math.random() * 0.55);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life,
        maxLife: life,
        size: isStreak ? 1.3 + Math.random() * 1.5 : 1.8 + Math.random() * 2.6,
        color,
        streak: isStreak,
        hot: isStreak || Math.random() < 0.55,
      });
    }
    // White-hot core sparks (first-frame punch)
    const coreN = Math.min(18, Math.max(0, room - n));
    for (let i = 0; i < coreN; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = speed * (0.85 + Math.random() * 1.1);
      const life = 0.1 + Math.random() * 0.14;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life,
        maxLife: life,
        size: 1.4 + Math.random() * 1.6,
        color: "#ffffff",
        streak: true,
        hot: true,
      });
    }
  }

  ring(x, y, color, count = 40, speed = 360) {
    const room = PARTICLE_MAX - this.particles.length;
    const n = Math.min(count, Math.max(0, room));
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.05;
      const sp = speed * (0.95 + Math.random() * 0.4);
      const life = 0.28 + Math.random() * 0.12;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life,
        maxLife: life,
        size: 2.4,
        color,
        streak: true,
        hot: i % 2 === 0,
      });
    }
    // Dual expanding shockwave rings — short-lived white core + color
    this.rings.push({
      x,
      y,
      r: 8,
      vr: speed * 0.85,
      life: 0.32,
      maxLife: 0.32,
      color,
      width: 4.2,
    });
    this.rings.push({
      x,
      y,
      r: 3,
      vr: speed * 1.05,
      life: 0.24,
      maxLife: 0.24,
      color: "#ffffff",
      width: 2.4,
    });
  }

  shockwave(x, y, color = "#ffe14a", maxR = 520) {
    // Outer colored blast
    this.rings.push({
      x,
      y,
      r: 16,
      vr: maxR * 2.6,
      life: 0.7,
      maxLife: 0.7,
      color,
      width: 8,
    });
    // Mid glow
    this.rings.push({
      x,
      y,
      r: 8,
      vr: maxR * 2.0,
      life: 0.55,
      maxLife: 0.55,
      color,
      width: 5,
    });
    // Hot white core front
    this.rings.push({
      x,
      y,
      r: 4,
      vr: maxR * 1.7,
      life: 0.45,
      maxLife: 0.45,
      color: "#ffffff",
      width: 3,
    });
    // Delayed secondary pop
    this.rings.push({
      x,
      y,
      r: 2,
      vr: maxR * 1.1,
      life: 0.65,
      maxLife: 0.65,
      color: color,
      width: 2.5,
    });
  }

  trail(x, y, vx, vy, color = "#5efcff") {
    if (this.particles.length >= PARTICLE_MAX - 2) return;
    const sp = Math.hypot(vx, vy);
    if (sp < 25) return;
    const nx = -vx / sp;
    const ny = -vy / sp;
    for (let i = 0; i < 2; i++) {
      this.particles.push({
        x: x + nx * (8 + i * 4) + (Math.random() - 0.5) * 5,
        y: y + ny * (8 + i * 4) + (Math.random() - 0.5) * 5,
        vx: nx * (50 + Math.random() * 40) + (Math.random() - 0.5) * 40,
        vy: ny * (50 + Math.random() * 40) + (Math.random() - 0.5) * 40,
        life: 0.14 + Math.random() * 0.14,
        maxLife: 0.28,
        size: 1.4 + Math.random() * 2,
        color,
        streak: false,
        hot: i === 0,
      });
    }
  }

  floater(x, y, text, color = "#ffffff", scale = 1) {
    if (this.floaters.length >= FLOATER_MAX) this.floaters.shift();
    this.floaters.push({
      x: x + (Math.random() - 0.5) * 12,
      y,
      text,
      color,
      life: 0.95,
      maxLife: 0.95,
      vy: -46,
      scale,
    });
  }

  /**
   * Geom vacuum FX — inbound energy streams + electric arcs (not expanding rings).
   * Particles spawn around the ship and suck inward like a magnetic pulse.
   */
  vacuumInhale(cx, cy, color = "#b8ff4a") {
    const room = PARTICLE_MAX - this.particles.length;
    // Radial stream particles (spawn far out, rocket in)
    const streamN = Math.min(90, Math.max(0, room));
    for (let i = 0; i < streamN; i++) {
      const ang = (i / streamN) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const dist = 90 + Math.random() * 420;
      const px = cx + Math.cos(ang) * dist;
      const py = cy + Math.sin(ang) * dist;
      // Inward + slight swirl so it feels like a vortex, not a straight line only
      const inward = 380 + Math.random() * 520;
      const swirl = (Math.random() - 0.5) * 160;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      this.particles.push({
        x: px,
        y: py,
        vx: -c * inward - s * swirl,
        vy: -s * inward + c * swirl,
        life: 0.35 + Math.random() * 0.45,
        maxLife: 0.8,
        size: 1.2 + Math.random() * 2.4,
        color: Math.random() < 0.35 ? "#ffffff" : color,
        streak: true,
        hot: Math.random() < 0.55,
        attract: true,
        tx: cx,
        ty: cy,
        pull: 900 + Math.random() * 700,
      });
    }

    // Secondary hot spark rain (closer band)
    const sparkN = Math.min(40, Math.max(0, PARTICLE_MAX - this.particles.length));
    for (let i = 0; i < sparkN; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 140;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      this.particles.push({
        x: cx + c * dist,
        y: cy + s * dist,
        vx: -c * (200 + Math.random() * 300),
        vy: -s * (200 + Math.random() * 300),
        life: 0.2 + Math.random() * 0.25,
        maxLife: 0.45,
        size: 1.5 + Math.random() * 1.8,
        color: i % 2 === 0 ? "#ffffff" : color,
        streak: true,
        hot: true,
        attract: true,
        tx: cx,
        ty: cy,
        pull: 1400,
      });
    }

    // Jagged lightning bolts: outer rim → ship
    const boltCount = 10 + Math.floor(Math.random() * 5);
    for (let b = 0; b < boltCount; b++) {
      this._spawnVacuumBolt(cx, cy, color, 160 + Math.random() * 380);
    }
  }

  /**
   * Light sustain while vacuum boost is active — keep the stream alive briefly.
   * @param {number} intensity 0..1 remaining vacuum strength
   */
  vacuumSustain(cx, cy, color = "#b8ff4a", intensity = 1) {
    if (intensity <= 0.05) return;
    if (Math.random() > 0.55 + intensity * 0.35) return;

    const room = PARTICLE_MAX - this.particles.length;
    const n = Math.min(8 + Math.floor(intensity * 14), Math.max(0, room));
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 360 * (0.5 + intensity * 0.5);
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const inward = 300 + Math.random() * 500;
      this.particles.push({
        x: cx + c * dist,
        y: cy + s * dist,
        vx: -c * inward + (Math.random() - 0.5) * 80,
        vy: -s * inward + (Math.random() - 0.5) * 80,
        life: 0.22 + Math.random() * 0.28,
        maxLife: 0.5,
        size: 1.1 + Math.random() * 2,
        color: Math.random() < 0.4 ? "#e8ffb0" : color,
        streak: true,
        hot: Math.random() < 0.5,
        attract: true,
        tx: cx,
        ty: cy,
        pull: 1000 + intensity * 600,
      });
    }

    // Occasional bolt flicker
    if (Math.random() < 0.2 * intensity) {
      this._spawnVacuumBolt(cx, cy, color, 120 + Math.random() * 280);
    }
  }

  _spawnVacuumBolt(cx, cy, color, outerR) {
    const ang = Math.random() * Math.PI * 2;
    const segs = 5 + Math.floor(Math.random() * 5);
    const points = [];
    const perpX = -Math.sin(ang);
    const perpY = Math.cos(ang);
    for (let s = 0; s <= segs; s++) {
      const t = s / segs; // 0 outer → 1 center
      const rr = outerR * (1 - t);
      // Electric jitter stronger mid-path, dies near core
      const jitterAmp = (1 - t) * t * 4 * (12 + Math.random() * 22);
      const j = (Math.random() - 0.5) * 2 * jitterAmp;
      points.push({
        x: cx + Math.cos(ang) * rr + perpX * j,
        y: cy + Math.sin(ang) * rr + perpY * j,
      });
    }
    // Snap last point to ship core
    points[points.length - 1] = { x: cx, y: cy };
    this.bolts.push({
      points,
      life: 0.12 + Math.random() * 0.18,
      maxLife: 0.28,
      color,
      width: 1.2 + Math.random() * 2.2,
    });
    // Twin ghost bolt (white hot, thinner, shorter life)
    if (Math.random() < 0.55) {
      this.bolts.push({
        points: points.map((p) => ({
          x: p.x + (Math.random() - 0.5) * 4,
          y: p.y + (Math.random() - 0.5) * 4,
        })),
        life: 0.08 + Math.random() * 0.1,
        maxLife: 0.18,
        color: "#ffffff",
        width: 0.8 + Math.random(),
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.attract) {
        const dx = (p.tx ?? 0) - p.x;
        const dy = (p.ty ?? 0) - p.y;
        const d = Math.hypot(dx, dy) || 1;
        // Stronger pull as they near the core (electric snap)
        const pull = (p.pull || 1000) * (1 + 80 / (d + 40));
        p.vx += (dx / d) * pull * dt;
        p.vy += (dy / d) * pull * dt;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (d < 14) p.life = 0;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= p.streak ? 0.94 : 0.955;
      p.vy *= p.streak ? 0.94 : 0.955;
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      r.r += r.vr * dt;
      r.vr *= 0.92;
    }

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.bolts.splice(i, 1);
        continue;
      }
      // Subtle crackle: nudge mid control points
      if (b.points.length > 2 && Math.random() < 0.4) {
        const mid = 1 + Math.floor(Math.random() * (b.points.length - 2));
        b.points[mid].x += (Math.random() - 0.5) * 6;
        b.points[mid].y += (Math.random() - 0.5) * 6;
      }
    }

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.floaters.splice(i, 1);
        continue;
      }
      f.y += f.vy * dt;
      f.vy *= 0.97;
    }
  }

  draw(ctx) {
    // Additive particles
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      if (p.streak) {
        const sp = Math.hypot(p.vx, p.vy) || 1;
        // Attract streams draw longer for “energy filament” look
        const len = (p.attract ? 10 : 6) + p.size * (p.attract ? 6 : 4) * a;
        const tx = (p.vx / sp) * len;
        const ty = (p.vy / sp) * len;
        ctx.strokeStyle = colorWithAlpha(p.color, a * (p.hot ? 0.95 : 0.7));
        ctx.lineWidth = p.size * a * (p.attract ? 1.15 : 1);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - tx, p.y - ty);
        ctx.stroke();
        if (p.hot || p.attract) {
          ctx.strokeStyle = `rgba(255,255,255,${a * 0.55})`;
          ctx.lineWidth = Math.max(0.6, p.size * a * 0.35);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - tx * 0.55, p.y - ty * 0.55);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = colorWithAlpha(p.color, a * 0.9);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
        if (p.hot) {
          ctx.fillStyle = `rgba(255,255,255,${a * 0.7})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * a * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    for (const r of this.rings) {
      const a = Math.max(0, r.life / r.maxLife);
      // Outer soft glow stroke + bright core stroke
      ctx.strokeStyle = colorWithAlpha(r.color, a * 0.45);
      ctx.lineWidth = r.width * a * 2.4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = colorWithAlpha(r.color, a * 0.95);
      ctx.lineWidth = r.width * a;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Electric vacuum bolts (polylines into the ship)
    for (const b of this.bolts) {
      if (!b.points || b.points.length < 2) continue;
      const a = Math.max(0, b.life / b.maxLife);
      // Soft outer glow
      ctx.strokeStyle = colorWithAlpha(b.color, a * 0.35);
      ctx.lineWidth = b.width * a * 3.2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(b.points[0].x, b.points[0].y);
      for (let i = 1; i < b.points.length; i++) {
        ctx.lineTo(b.points[i].x, b.points[i].y);
      }
      ctx.stroke();
      // Core
      ctx.strokeStyle = colorWithAlpha(b.color, a * 0.95);
      ctx.lineWidth = b.width * a;
      ctx.beginPath();
      ctx.moveTo(b.points[0].x, b.points[0].y);
      for (let i = 1; i < b.points.length; i++) {
        ctx.lineTo(b.points[i].x, b.points[i].y);
      }
      ctx.stroke();
      // Hot white filament
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.75})`;
      ctx.lineWidth = Math.max(0.5, b.width * a * 0.35);
      ctx.beginPath();
      ctx.moveTo(b.points[0].x, b.points[0].y);
      for (let i = 1; i < b.points.length; i++) {
        ctx.lineTo(b.points[i].x, b.points[i].y);
      }
      ctx.stroke();
    }

    ctx.restore();

    // Score floaters (normal blend, readable)
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of this.floaters) {
      const a = Math.max(0, f.life / f.maxLife);
      const sc = (f.scale || 1) * (0.85 + 0.25 * a);
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(sc, sc);
      ctx.globalAlpha = a;
      ctx.font = "700 15px Orbitron, Outfit, sans-serif";
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "700 13px Orbitron, Outfit, sans-serif";
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.particles.length = 0;
    this.floaters.length = 0;
    this.rings.length = 0;
    this.bolts.length = 0;
  }
}
