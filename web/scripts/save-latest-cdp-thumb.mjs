#!/usr/bin/env node
/** Save newest CDP Page.captureScreenshot JSON → public/home-features/<name>.png */
import { readdirSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const name = process.argv[2];
if (!name) {
  console.error("Usage: node scripts/save-latest-cdp-thumb.mjs <name>");
  process.exit(1);
}

const logDir = "C:/Users/admin/.cursor/browser-logs";
const files = readdirSync(logDir)
  .filter((f) => f.includes("Page.captureScreenshot"))
  .map((f) => ({ f, t: f.match(/(\d{4}-\d{2}-\d{2}T[\d-]+Z)/)?.[1] ?? f }))
  .sort((a, b) => a.t.localeCompare(b.t));
const latest = files[files.length - 1];
if (!latest) {
  console.error("No CDP screenshot logs found");
  process.exit(1);
}

const j = JSON.parse(readFileSync(join(logDir, latest.f), "utf8"));
const out = join("c:/Users/admin/FPL_LLM/web/public/home-features", `${name}.png`);
await sharp(Buffer.from(j.data, "base64"))
  .resize(960, 600, { fit: "cover", position: "centre" })
  .png({ compressionLevel: 8 })
  .toFile(out);
console.log(`saved ${out} from ${latest.f}`);
