#!/usr/bin/env node
/**
 * Crop home-feature screenshots to characteristic UI regions (16:10).
 * Run: node scripts/crop-home-feature-thumbs.mjs
 */
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "..", "public", "home-features");

/** Fractional crop: left/top/width/height of source, then resize to OUT. */
const OUT = { width: 960, height: 600 };

const CROPS = {
  // Pitch + budget strip (skip site header / page title)
  "squad-builder.png": { left: 0.0, top: 0.0, width: 1.0, height: 0.75 },
  // Filters + player table rows — tighter on names/XP
  "players.png": { left: 0.0, top: 0.05, width: 0.7, height: 0.9 },
  // Apply filters + Haaland table — focus table
  "historical.png": { left: 0.0, top: 0.4, width: 1.0, height: 0.58 },
  // Style chips + three generated squad cards — cards only
  "recommended-squad.png": { left: 0.0, top: 0.4, width: 1.0, height: 0.6 },
  // Insights feature card grid
  "insights.png": { left: 0.0, top: 0.15, width: 1.0, height: 0.75 },
  // Mini templates + hot/cold lists
  "mini5.png": { left: 0.0, top: 0.18, width: 1.0, height: 0.72 },
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function cropOne(name, frac) {
  const input = join(dir, name);
  const img = sharp(input);
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new Error(`Bad image ${name}`);

  const left = clamp(Math.round(frac.left * w), 0, w - 2);
  const top = clamp(Math.round(frac.top * h), 0, h - 2);
  const width = clamp(Math.round(frac.width * w), 1, w - left);
  const height = clamp(Math.round(frac.height * h), 1, h - top);

  await sharp(input)
    .extract({ left, top, width, height })
    .resize(OUT.width, OUT.height, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 8 })
    .toFile(join(dir, name.replace(/\.png$/, ".cropped.png")));

  // Atomic replace
  const { renameSync, unlinkSync } = await import("fs");
  const tmp = join(dir, name.replace(/\.png$/, ".cropped.png"));
  const bak = join(dir, name.replace(/\.png$/, ".bak.png"));
  renameSync(input, bak);
  renameSync(tmp, input);
  unlinkSync(bak);
  console.log(`cropped ${name} ← ${width}x${height} @ (${left},${top}) → ${OUT.width}x${OUT.height}`);
}

async function main() {
  for (const [name, frac] of Object.entries(CROPS)) {
    await cropOne(name, frac);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
