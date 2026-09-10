/**
 * Capture itch.io stills (cover + screenshots) from a local Geometry Arena build.
 * Run: npm start  (in another terminal, if needed)
 *      node uat/capture-itch-shots.mjs
 *
 * Writes PNGs to dist/itch-shots/ (gitignored via dist/).
 */

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "dist", "itch-shots");
const BASE = process.env.UAT_URL || "http://localhost:5173";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const require = createRequire(import.meta.url);

async function loadPuppeteer() {
  try {
    return require("puppeteer-core");
  } catch {
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

async function ensureServer() {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(1500) });
    if (res.ok) return null;
  } catch {
    /* start one */
  }
  console.log("Starting local server…");
  const child = spawn("npx", ["--yes", "serve", "-l", "5173"], {
    cwd: root,
    stdio: "ignore",
    detached: true,
  });
  child.unref();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(500) });
      if (res.ok) return child;
    } catch {
      /* retry */
    }
  }
  throw new Error("Could not start http://localhost:5173");
}

async function shot(page, name, opts = {}) {
  const dest = path.join(outDir, name);
  await page.screenshot({
    path: dest,
    type: "png",
    captureBeyondViewport: false,
    ...opts,
  });
  console.log("  wrote", dest);
}

async function dressSwarm() {
  const g = window.__geometryArena;
  const { spawnEnemy, createGeom } = await import("/js/entities.js");
  g.start({ skipBgm: true });
  if (g.audio?.enabled !== false) g.toggleMute?.();
  g.elapsed = 88;
  g.time = 88;
  g.level = 4;
  g.mult = 48;
  g.peakMult = 48;
  g.score = 86420;
  g.progress = 28000;
  g.player.invuln = 99999;
  g.player.x = 800;
  g.player.y = 470;
  g.player.angle = -0.45;
  g.ui.updateScore(g.score);
  g.ui.updateMult(g.mult);
  g.ui.updateLevel?.(g.level);
  g.ui.updateLives(g.lives);
  g.ui.updateGun?.(g.mult);

  const types = [
    "wanderer",
    "diamond",
    "pink",
    "spinner",
    "splitter",
    "snake",
    "tank",
    "void",
  ];
  const ring = 16;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2;
    const r = 210 + (i % 3) * 55;
    const type = types[i % types.length];
    const e = spawnEnemy(type, 90, {
      x: g.player.x + Math.cos(a) * r,
      y: g.player.y + Math.sin(a) * r * 0.72,
    });
    if (!e) continue;
    e.enter = 1;
    e.approach = null;
    e.approachTime = 0;
    g.enemies.push(e);
  }

  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 160;
    g.geoms.push(
      createGeom(g.player.x + Math.cos(a) * r, g.player.y + Math.sin(a) * r * 0.7)
    );
  }

  g._gridPulse?.(g.player.x, g.player.y, 2.2);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  await ensureServer();

  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,800", "--hide-scrollbars"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    page.setDefaultTimeout(20000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#splash");
    await page.waitForSelector("#game");
    await new Promise((r) => setTimeout(r, 900));

    await shot(page, "01-splash.png");

    const splashBox = await page.$eval("#splash", (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const coverW = 630;
    const coverH = 500;
    const cx = splashBox.x + splashBox.width / 2;
    const cy = splashBox.y + splashBox.height / 2 + 20;
    await shot(page, "00-cover-630x500.png", {
      clip: {
        x: Math.max(0, cx - coverW / 2),
        y: Math.max(0, cy - coverH / 2),
        width: coverW,
        height: coverH,
      },
    });

    await page.click("#splash");
    await page.waitForFunction(
      () =>
        document.getElementById("overlay") &&
        !document.getElementById("overlay").classList.contains("hidden") &&
        document.getElementById("title-menu")
    );
    await new Promise((r) => setTimeout(r, 700));
    await shot(page, "02-title.png");

    await page.click("#path-btn");
    await page.waitForFunction(
      () => document.getElementById("path-map") && !document.getElementById("path-map").classList.contains("hidden")
    );
    await new Promise((r) => setTimeout(r, 500));
    await shot(page, "03-path-map.png");

    await page.click("#path-back-btn");
    await page.waitForFunction(
      () =>
        document.getElementById("overlay") &&
        !document.getElementById("overlay").classList.contains("hidden") &&
        document.getElementById("path-map")?.classList.contains("hidden")
    );
    await page.evaluate(dressSwarm);
    await new Promise((r) => setTimeout(r, 280));
    await shot(page, "04-classic-swarm.png");

    await page.evaluate(() => {
      const g = window.__geometryArena;
      g._detonateBomb?.();
    });
    await new Promise((r) => setTimeout(r, 90));
    await shot(page, "05-bomb.png");

    console.log("\nDone. Upload dist/itch-shots/00-cover-630x500.png as the itch cover.");
    console.log("Use 01–05 as screenshots (pick 3–5).");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
