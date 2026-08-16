/**
 * Local playtest ingest. Writes JSONL the agent can read after you play.
 * Run: node uat/playtest-ingest.mjs
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dir = path.join(root, ".playtest");
const file = path.join(dir, "session.jsonl");
const PORT = 5179;

fs.mkdirSync(dir, { recursive: true });

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && (req.url === "/log" || req.url === "/log/")) {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const rec = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        rec.recvAt = Date.now();
        fs.appendFileSync(file, `${JSON.stringify(rec)}\n`);
        res.writeHead(204);
      } catch {
        res.writeHead(400);
      }
      res.end();
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[playtest] ingest http://127.0.0.1:${PORT}/log → ${file}`);
});
