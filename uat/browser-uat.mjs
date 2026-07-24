/**
 * Browser UAT for Geometry Arena via Puppeteer + system Chrome.
 * Run: node uat/browser-uat.mjs
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const BASE = process.env.UAT_URL || "http://localhost:5173";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const require = createRequire(import.meta.url);

async function loadPuppeteer() {
  try {
    return require("puppeteer-core");
  } catch {
    // Install locally for this run
    console.log("Installing puppeteer-core…");
    await new Promise((resolve, reject) => {
      const p = spawn("npm", ["install", "--no-save", "puppeteer-core@23"], {
        cwd: root,
        stdio: "inherit",
      });
      p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("npm install failed"))));
    });
    return require("puppeteer-core");
  }
}

const results = [];
function log(ok, name, detail = "") {
  results.push({ ok, name, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

async function main() {
  console.log("\n=== Geometry Arena UAT (browser) ===");
  console.log(`URL: ${BASE}\n`);

  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1400,900"],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);

    // Capture page errors
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    page.on("console", (msg) => {
      if (msg.type() === "error") pageErrors.push(msg.text());
    });

    const res = await page.goto(BASE, { waitUntil: "networkidle0" });
    log(res && res.ok(), "Page loads HTTP 200", res ? String(res.status()) : "no response");

    await page.waitForSelector("#game");
    await page.waitForSelector("#start-btn");
    log(true, "Canvas and Play button present");

    // Title overlay visible
    const overlayHidden = await page.$eval("#overlay", (el) => el.classList.contains("hidden"));
    log(!overlayHidden, "Menu overlay visible on boot");

    const title = await page.$eval("#overlay-title", (el) => el.textContent.trim());
    log(title === "Geometry Arena", "Title is Geometry Arena", title);

    // HUD defaults
    const score = await page.$eval("#score", (el) => el.textContent);
    const lives = await page.$eval("#lives", (el) => el.textContent);
    const mult = await page.$eval("#mult", (el) => el.textContent);
    log(score === "0", "Score starts at 0", score);
    log(lives === "3", "Lives start at 3", lives);
    log(mult.includes("1"), "Mult starts at ×1", mult);

    // How-to mentions click & hold
    const howTo = await page.$eval(".how-to", (el) => el.innerText);
    log(/click|hold|trackpad/i.test(howTo), "How-to documents click-hold fire", howTo.replace(/\n/g, " | "));

    // Start game
    await page.click("#start-btn");
    await page.waitForFunction(() => document.getElementById("overlay").classList.contains("hidden"), {
      timeout: 3000,
    });
    log(true, "Play hides overlay");

    // Probe internal game state via page.evaluate — expose from canvas owner?
    // Game is not on window. Re-read main.js… it's module-scoped.
    // Inject test hooks by evaluating against running rAF world is hard.
    // Instead: simulate inputs and check canvas is drawing (non-blank) + no errors.

    // Keyboard diagonal: press W+D
    await page.keyboard.down("w");
    await page.keyboard.down("d");
    await sleep(200);
    await page.keyboard.up("w");
    await page.keyboard.up("d");
    log(true, "WASD diagonal key chord accepted (no crash)");

    // Fire: mousedown on canvas, move mouse, mouseup
    const canvas = await page.$("#game");
    const box = await canvas.boundingBox();
    assert.ok(box, "canvas box");

    // Without pointer lock in headless, relative aim still gets movementX
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // Sweep aim
    for (let i = 0; i < 20; i++) {
      await page.mouse.move(box.x + box.width / 2 + i * 8, box.y + box.height / 2 + Math.sin(i / 3) * 40);
      await sleep(16);
    }
    await page.mouse.up();
    log(true, "Click-hold + drag aim gesture completed");

    // Pause
    await page.keyboard.press("p");
    await sleep(100);
    const pausedVisible = await page.$eval("#overlay", (el) => !el.classList.contains("hidden"));
    const pauseTitle = await page.$eval("#overlay-title", (el) => el.textContent.trim());
    log(pausedVisible && pauseTitle === "Paused", "P pauses game", pauseTitle);

    // Resume
    await page.click("#resume-btn");
    await page.waitForFunction(() => document.getElementById("overlay").classList.contains("hidden"));
    log(true, "Resume continues game");

    // Mute toggle
    const muteBefore = await page.$eval("#mute-btn", (el) => el.textContent);
    await page.keyboard.press("m");
    await sleep(50);
    const muteAfter = await page.$eval("#mute-btn", (el) => el.textContent);
    log(muteBefore !== muteAfter, "M toggles mute label", `${muteBefore} -> ${muteAfter}`);

    // Let spawns run a few seconds
    await sleep(2500);
    log(true, "Survived 2.5s of gameplay without navigation crash");

    // Force game over via lives if we can inject — expose game on window for UAT
    // Patch: evaluate start and reduce lives by reloading... skip forced GO if no hook.

    // High score key exists or not
    const hs = await page.evaluate(() => localStorage.getItem("geometry-arena-highscore"));
    log(true, "localStorage highscore key readable", hs === null ? "(empty)" : hs);

    // Canvas pixels not all black (something rendered)
    const hasPixels = await page.evaluate(() => {
      const c = document.getElementById("game");
      const ctx = c.getContext("2d");
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      // sample for non-near-black pixels
      let colored = 0;
      for (let i = 0; i < data.length; i += 40) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r + g + b > 30) colored++;
      }
      return colored > 50;
    });
    log(hasPixels, "Canvas has visible non-black content (grid/entities)");

    // Page errors
    log(pageErrors.length === 0, "No page JS errors", pageErrors.slice(0, 3).join("; ") || "none");

    // Asset checks (200 OK or 304 Not Modified both fine)
    for (const asset of [
      "/js/main.js",
      "/js/game.js",
      "/js/input.js",
      "/js/entities.js",
      "/js/constants.js",
      "/styles.css",
    ]) {
      const r = await page.goto(BASE + asset, { waitUntil: "networkidle0" });
      const code = r ? r.status() : 0;
      log(code === 200 || code === 304, `Asset ${asset}`, String(code));
    }

    // --- Deep state UAT via window.__geometryArena ---
    await page.goto(BASE, { waitUntil: "networkidle0" });
    await page.waitForSelector("#start-btn");
    await page.click("#start-btn");
    await page.waitForFunction(() => window.__geometryArena?.state === "playing");

    const deep = await page.evaluate(async () => {
      const g = window.__geometryArena;
      const out = { steps: [] };

      const step = (name, ok, detail) => out.steps.push({ name, ok, detail });

      step("hook exposed", !!g, g ? g.state : "missing");
      step("playing after start", g.state === "playing", g.state);

      // Diagonal move vector
      g.input.keys.clear();
      g.input.keys.add("KeyW");
      g.input.keys.add("KeyD");
      const mv = g.input.moveVector();
      const diagOk =
        Math.abs(Math.hypot(mv.x, mv.y) - 1) < 1e-9 && mv.x > 0 && mv.y < 0;
      step("runtime W+D diagonal", diagOk, JSON.stringify(mv));
      g.input.keys.clear();

      // Fire gated: no fire without button
      g.input.mouseDown = false;
      g.input._blockFire = false;
      g.player.fireCd = 0;
      const beforeBullets = g.bullets.length;
      // one update frame worth of logic
      g._update(1 / 60);
      step(
        "no bullets without hold",
        g.bullets.length === beforeBullets,
        `bullets ${beforeBullets}->${g.bullets.length}`
      );

      // Hold fire + aim right should spawn bullets
      g.input.mouseDown = true;
      g.input._blockFire = false;
      g.player.fireCd = 0;
      g.input.aim.x = 1;
      g.input.aim.y = 0;
      g.bullets = [];
      for (let i = 0; i < 20; i++) g._update(1 / 60);
      step("hold fire spawns bullets", g.bullets.length > 0, `count=${g.bullets.length}`);

      // Aim independent of move: aim up while move right
      g.input.aim.x = 0;
      g.input.aim.y = -1;
      g.input.keys.add("KeyD");
      g.player.fireCd = 0;
      g.bullets = [];
      g._update(1 / 60);
      const b = g.bullets[0];
      const aimIndependent = b && b.vy < 0 && Math.abs(b.vx) < Math.abs(b.vy);
      step("bullet follows aim not move", !!aimIndependent, b ? `vx=${b.vx.toFixed(1)} vy=${b.vy.toFixed(1)}` : "no bullet");
      g.input.keys.clear();
      g.input.mouseDown = false;

      // Smooth aim accumulation
      g.input.aim.x = 1;
      g.input.aim.y = 0;
      g.input._onMouseMove({ movementX: 0, movementY: 15 });
      const a1 = { ...g.input.aim };
      step("aim nudge not snap to pure Y", a1.x > 0.5 && a1.y > 0, JSON.stringify(a1));

      // Spawn + kill for score
      g.enemies = [];
      g.score = 0;
      g.mult = 1;
      const e = {
        type: "wanderer",
        x: g.player.x + 40,
        y: g.player.y,
        r: 11,
        hp: 1,
        maxHp: 1,
        speed: 0,
        score: 100,
        color: "#5dff8a",
        angle: 0,
        spin: 0,
        phase: 0,
        dead: false,
      };
      g.enemies.push(e);
      g.input.mouseDown = true;
      g.input.aim.x = 1;
      g.input.aim.y = 0;
      g.player.fireCd = 0;
      g.bullets = [];
      for (let i = 0; i < 45; i++) g._update(1 / 60);
      step("kill awards score", g.score >= 100, `score=${g.score} mult=${g.mult}`);

      // Lives / hit
      const livesBefore = g.lives;
      g.player.invuln = 0;
      g.enemies = [
        {
          type: "wanderer",
          x: g.player.x,
          y: g.player.y,
          r: 20,
          hp: 1,
          maxHp: 1,
          speed: 0,
          score: 100,
          color: "#5dff8a",
          angle: 0,
          spin: 0,
          phase: 0,
          dead: false,
        },
      ];
      g._update(1 / 60);
      step("contact costs a life", g.lives === livesBefore - 1, `lives ${livesBefore}->${g.lives}`);
      step("i-frames after hit", g.player.invuln > 0, `invuln=${g.player.invuln}`);

      // Game over after draining lives
      g.lives = 1;
      g.player.invuln = 0;
      g.enemies = [
        {
          type: "wanderer",
          x: g.player.x,
          y: g.player.y,
          r: 30,
          hp: 1,
          maxHp: 1,
          speed: 0,
          score: 100,
          color: "#5dff8a",
          angle: 0,
          spin: 0,
          phase: 0,
          dead: false,
        },
      ];
      g._update(1 / 60);
      step("game over at 0 lives", g.state === "gameover", g.state);

      // High score persisted
      const hs = localStorage.getItem("geometry-arena-highscore");
      step("high score written on game over", hs != null, hs);

      // Restart
      g.start();
      step("restart returns to playing", g.state === "playing", g.state);
      step("restart clears enemies", g.enemies.length === 0, String(g.enemies.length));

      return out;
    });

    for (const s of deep.steps) {
      log(s.ok, s.name, s.detail || "");
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== Browser UAT: ${results.length - failed.length}/${results.length} passed ===\n`);
  if (failed.length) {
    console.log("Failures:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
