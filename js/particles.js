import { FLOATER_MAX, PARTICLE_MAX } from "./constants.js";
import { colorWithAlpha } from "./fx.js";

/**
 * Additive neon particles — sparks, streaks, rings, thruster dust.
 */
export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floaters = [];
    this.rings = []; // expanding shock rings
  }

  burst(x, y, color, count = 28, speed = 320) {
    const room = PARTICLE_MAX - this.particles.length;
    const n = Math.min(count, Math.max(0, room));
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = speed * (0.35 + Math.random() * 1.25);
      const isStreak = Math.random() < 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: isStreak ? 0.28 + Math.random() * 0.28 : 0.5 + Math.random() * 0.55,
        maxLife: isStreak ? 0.5 : 0.9,
        size: isStreak ? 1.4 + Math.random() * 1.6 : 2.2 + Math.random() * 4.2,
        color,
        streak: isStreak,
        hot: Math.random() < 0.4,
      });
    }
    // White-hot core sparks
    const coreN = Math.min(14, Math.max(0, room - n));
    for (let i = 0; i < coreN; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = speed * (0.7 + Math.random() * 1.0);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 0.18 + Math.random() * 0.18,
        maxLife: 0.35,
        size: 1.6 + Math.random() * 1.8,
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
      const sp = speed * (0.9 + Math.random() * 0.35);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 0.6,
        maxLife: 0.6,
        size: 2.8,
        color,
        streak: true,
        hot: i % 3 === 0,
      });
    }
    // Dual expanding shockwave rings
    this.rings.push({
      x,
      y,
      r: 10,
      vr: speed * 0.7,
      life: 0.55,
      maxLife: 0.55,
      color,
      width: 4.5,
    });
    this.rings.push({
      x,
      y,
      r: 4,
      vr: speed * 0.95,
      life: 0.4,
      maxLife: 0.4,
      color: "#ffffff",
      width: 2.5,
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

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
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
        const len = 6 + p.size * 4 * a;
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const tx = (p.vx / sp) * len;
        const ty = (p.vy / sp) * len;
        ctx.strokeStyle = colorWithAlpha(p.color, a * (p.hot ? 0.95 : 0.7));
        ctx.lineWidth = p.size * a;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - tx, p.y - ty);
        ctx.stroke();
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
  }
}
