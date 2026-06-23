/**
 * Download WC team flag SVGs into public/wc-flags/ (run once when adding teams).
 * Usage: node scripts/fetch-wc-flags.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ISO_CODES = [
  "mx", "kr", "za", "cz", "ca", "ch", "qa", "ba", "br", "ma", "gb-sct", "ht",
  "us", "py", "au", "tr", "de", "ec", "ci", "cw", "nl", "jp", "tn", "se", "be",
  "ir", "eg", "nz", "es", "uy", "sa", "cv", "fr", "sn", "no", "iq", "ar", "at",
  "dz", "jo", "pt", "co", "uz", "cd", "gb-eng", "hr", "pa", "gh",
];

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "wc-flags");
mkdirSync(outDir, { recursive: true });

let ok = 0;
for (const iso of ISO_CODES) {
  const url = `https://flagcdn.com/${iso}.svg`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "image/svg+xml,*/*", "User-Agent": "FaleagueFlagSync/1.0" },
    });
    if (!res.ok) {
      console.warn("FAIL", iso, res.status);
      continue;
    }
    const svg = await res.text();
    if (!svg.includes("<svg")) {
      console.warn("SKIP", iso, "not svg");
      continue;
    }
    writeFileSync(join(outDir, `${iso}.svg`), svg, "utf8");
    ok++;
    console.log("OK", iso);
  } catch (e) {
    console.warn("ERR", iso, e);
  }
}

console.log(`Done: ${ok}/${ISO_CODES.length} flags in public/wc-flags/`);
