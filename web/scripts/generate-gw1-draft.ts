/**
 * Generate daily FALEAGUE GW1 15-man draft + pitch/rationale cards.
 *
 *   cd web && npx tsx scripts/generate-gw1-draft.ts
 *   cd web && npx tsx scripts/generate-gw1-draft.ts --png
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDailyGw1Draft } from "../lib/fpl/daily-gw1-draft";
import { shanghaiDateIso } from "../lib/fpl/wechat-daily-card";
import { loadScriptEnv } from "./load-env";

loadScriptEnv();

function formatDraftText(draft: Awaited<ReturnType<typeof buildDailyGw1Draft>>): string {
  const lines = [
    `📋 FALEAGUE GW${draft.gw} DRAFT · ${draft.card_date}`,
    `${draft.formation} · £${draft.spend_m}m / bank £${draft.bank_m}m · XI xP ${draft.xi_xp}`,
    "",
    "⚽ 首发",
  ];
  for (const p of draft.starters) {
    const tag = p.is_captain ? " (C)" : p.is_vice ? " (V)" : "";
    lines.push(
      `• ${p.position} ${p.web_name}${tag} — ${p.fixture ?? "GW1"} · £${p.price.toFixed(1)}m · xP ${p.xp_gw1.toFixed(1)}`,
    );
  }
  lines.push("", "🪑 替补");
  for (const p of draft.bench) {
    lines.push(
      `• ${p.position} ${p.web_name} — ${p.fixture ?? "GW1"} · £${p.price.toFixed(1)}m · xP ${p.xp_gw1.toFixed(1)}`,
    );
  }
  lines.push("", draft.rationale_zh, "");
  lines.push("🔗 https://www.faleague-ai.com/zh/squad-builder");
  return lines.join("\n");
}

async function main() {
  const withPng = process.argv.includes("--png");
  const dateArg = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const gwArg = process.argv.find((a) => /^--gw=\d+$/.test(a));
  const cardDate = dateArg ?? shanghaiDateIso();
  const gw = gwArg ? Number(gwArg.split("=")[1]) : undefined;

  const outDir = join(process.cwd(), "output", "gw1-draft");
  mkdirSync(outDir, { recursive: true });

  console.log(
    `Building FALEAGUE draft for ${cardDate}${gw ? ` (GW${gw})` : ""}…`,
  );
  const draft = await buildDailyGw1Draft({ cardDate, gw });
  const text = formatDraftText(draft);

  writeFileSync(join(outDir, "draft.json"), JSON.stringify(draft, null, 2), "utf8");
  writeFileSync(join(outDir, "draft.txt"), text, "utf8");
  writeFileSync(join(outDir, "rationale-zh.txt"), draft.rationale_zh, "utf8");
  writeFileSync(join(outDir, "rationale-en.txt"), draft.rationale_en, "utf8");

  console.log(`\nWrote ${join(outDir, "draft.txt")}`);
  console.log("\n--- draft.txt ---\n");
  console.log(text);

  if (withPng) {
    console.log("\nRendering PNGs…");
    execSync("node scripts/render-gw1-draft.mjs", {
      cwd: process.cwd(),
      stdio: "inherit",
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
