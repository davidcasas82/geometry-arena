/**
 * SFX (synth) + looping BGM tracks.
 * Two Geometry Wars–style Suno instrumentals alternate by level.
 */

import { BGM_TRACKS, BGM_VOLUME } from "./constants.js";

export class AudioBus {
  constructor() {
    this.enabled = true;
    this.ctx = null;

    /** @type {HTMLAudioElement[]} */
    this.tracks = BGM_TRACKS.map((src) => {
      const a = new Audio(src);
      a.loop = true;
      a.preload = "auto";
      a.volume = 0;
      return a;
    });
    this.bgmIndex = -1;
    this.bgmVolume = BGM_VOLUME;
    this._fadeTimer = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.pauseBgm();
      this._setAllBgmVolume(0);
    } else {
      this._setAllBgmVolume(this.bgmVolume);
      if (this.bgmIndex >= 0) this._playIndex(this.bgmIndex, false);
    }
    return this.enabled;
  }

  tone(freq, duration, type = "sine", gain = 0.08, slideTo = null) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, slideTo),
        ctx.currentTime + duration
      );
    }
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  shoot(mult = 1) {
    const p = 1 + Math.min(0.35, (mult - 1) * 0.004);
    this.tone(980 * p, 0.04, "square", 0.025, 380 * p);
    this.tone(1400 * p, 0.03, "triangle", 0.015, 600 * p);
  }

  enemyHit() {
    this.tone(360, 0.05, "triangle", 0.035, 160);
  }

  enemyDeath(pitch = 1) {
    this.tone(220 * pitch, 0.14, "sawtooth", 0.05, 50);
    this.tone(520 * pitch, 0.1, "triangle", 0.035, 180);
    this.tone(900 * pitch, 0.06, "sine", 0.02, 200);
  }

  playerHit() {
    this.tone(140, 0.25, "sawtooth", 0.06, 40);
    this.tone(90, 0.3, "square", 0.035, 30);
  }

  gameOver() {
    this.tone(220, 0.35, "sawtooth", 0.05, 70);
    setTimeout(() => this.tone(160, 0.4, "triangle", 0.04, 50), 120);
    this.fadeOutBgm(1.2);
  }

  start() {
    [392, 523, 659].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.1, "triangle", 0.045), i * 60);
    });
  }

  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.1, "square", 0.04), i * 55);
    });
  }

  geom(mult = 1) {
    const p = 1 + Math.min(1.2, (mult - 1) * 0.012);
    this.tone(660 * p, 0.06, "sine", 0.045, 1200 * p);
    this.tone(990 * p, 0.05, "triangle", 0.025, 1400 * p);
  }

  bomb() {
    this.tone(60, 0.4, "sawtooth", 0.08, 25);
    this.tone(160, 0.3, "square", 0.05, 40);
    this.tone(320, 0.2, "triangle", 0.04, 80);
    setTimeout(() => this.tone(100, 0.25, "sawtooth", 0.05, 30), 50);
  }

  extraLife() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.12, "triangle", 0.05), i * 70);
    });
  }

  extraBomb() {
    [392, 494, 587].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.1, "square", 0.035), i * 55);
    });
  }

  // ─── BGM ───────────────────────────────────────────────

  /**
   * Play the track for a 1-based level (odd → track 0, even → track 1).
   * Crossfades when switching.
   */
  playLevelTheme(level, { restart = false } = {}) {
    if (!this.tracks.length) return;
    this.ensure();
    const idx = (Math.max(1, level) - 1) % this.tracks.length;
    if (idx === this.bgmIndex && !restart) {
      // Same track — ensure playing
      if (this.enabled) this._playIndex(idx, false);
      return;
    }
    this._crossfadeTo(idx, restart);
  }

  stopBgm() {
    this._clearFade();
    for (const t of this.tracks) {
      try {
        t.pause();
        t.currentTime = 0;
        t.volume = 0;
      } catch {
        /* ignore */
      }
    }
    this.bgmIndex = -1;
  }

  pauseBgm() {
    for (const t of this.tracks) {
      try {
        t.pause();
      } catch {
        /* ignore */
      }
    }
  }

  resumeBgm() {
    if (!this.enabled || this.bgmIndex < 0) return;
    this.ensure();
    const t = this.tracks[this.bgmIndex];
    if (!t) return;
    t.volume = this.bgmVolume;
    t.play().catch(() => {});
  }

  fadeOutBgm(seconds = 1) {
    if (this.bgmIndex < 0) return;
    const t = this.tracks[this.bgmIndex];
    if (!t) return;
    this._animateVolume(t, t.volume, 0, seconds, () => {
      try {
        t.pause();
      } catch {
        /* ignore */
      }
    });
  }

  _setAllBgmVolume(v) {
    for (const t of this.tracks) t.volume = v;
  }

  _playIndex(idx, fromStart) {
    const t = this.tracks[idx];
    if (!t) return;
    if (fromStart) {
      try {
        t.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    if (this.enabled) {
      t.volume = this.bgmVolume;
      t.play().catch(() => {});
    }
    this.bgmIndex = idx;
  }

  _crossfadeTo(idx, fromStart) {
    this._clearFade();
    const next = this.tracks[idx];
    const prev = this.bgmIndex >= 0 ? this.tracks[this.bgmIndex] : null;
    if (!next) return;

    if (fromStart) {
      try {
        next.currentTime = 0;
      } catch {
        /* ignore */
      }
    }

    // Pause other non-prev tracks
    this.tracks.forEach((t, i) => {
      if (i !== idx && t !== prev) {
        try {
          t.pause();
          t.volume = 0;
        } catch {
          /* ignore */
        }
      }
    });

    if (!this.enabled) {
      this.bgmIndex = idx;
      next.volume = 0;
      return;
    }

    next.volume = 0;
    next.play().catch(() => {});

    const dur = 0.9;
    if (prev && prev !== next) {
      this._animateVolume(prev, prev.volume, 0, dur, () => {
        try {
          prev.pause();
        } catch {
          /* ignore */
        }
      });
    }
    this._animateVolume(next, 0, this.bgmVolume, dur);
    this.bgmIndex = idx;
  }

  _animateVolume(audio, from, to, seconds, onDone) {
    const steps = Math.max(8, Math.floor(seconds * 30));
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      const t = Math.min(1, i / steps);
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (t >= 1) {
        clearInterval(id);
        if (this._fadeTimer === id) this._fadeTimer = null;
        onDone?.();
      }
    }, (seconds * 1000) / steps);
    this._fadeTimer = id;
  }

  _clearFade() {
    if (this._fadeTimer) {
      clearInterval(this._fadeTimer);
      this._fadeTimer = null;
    }
  }
}
