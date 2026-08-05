/**
 * Generate daily FALEAGUE themed drafts (template / promising / boosting).
 *
 *   cd web && npx tsx scripts/generate-gw1-draft.ts
 *   cd web && npx tsx scripts/generate-gw1-draft.ts --png
 *   cd web && npx tsx scripts/generate-gw1-draft.ts --png --gw=1
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildDailyGw1DraftPack,
  type DailyGw1Draft,
} from "../lib/fpl/daily-gw1-draft";
import { shanghaiDateIso } from "../lib/fpl/wechat-daily-card";
import { loadScriptEnv } from "./load-env";

loadScriptEnv();

function formatDraftText(draft: DailyGw1Draft): string {
  const lines = [
    `📋 FALEAGUE · ${draft.theme.title_zh}`,
    `GW${draft.gw} · ${draft.card_date}`,
    draft.talking_point_zh,
    `${draft.formation} · £${draft.spend_m}m / bank £${draft.bank_m}m · XI xP ${draft.xi_xp}`,
    "",
    "⚽ 首发",
  ];
  for (const p of draft.starters) {
    const tag = p.is_captain ? " (C)" : p.is_vice ? " (V)" : "";
    lines.push(
      `• ${p.position} ${p.web_name}${tag} — ${p.fixture ?? `GW${draft.gw}`} · £${p.price.toFixed(1)}m · xP ${p.xp_gw1.toFixed(1)}`,
    );
  }
  lines.push("", "🪑 替补");
  for (const p of draft.bench) {
    lines.push(
      `• ${p.position} ${p.web_name} — ${p.fixture ?? `GW${draft.gw}`} · £${p.price.toFixed(1)}m · xP ${p.xp_gw1.toFixed(1)}`,
    );
  }
  lines.push("", draft.rationale_zh, "");
  lines.push("🔗 https://www.faleague-ai.com/zh/squad-builder");
  return lines.join("\n");
}

function formatPackIndex(drafts: DailyGw1Draft[]): string {
  const lines = [
    `📋 FALEAGUE 每日阵容话题 · ${drafts[0]?.card_date ?? ""}`,
    "",
  ];
  for (const d of drafts) {
    lines.push(`【${d.theme.title_zh}】`);
    lines.push(d.talking_point_zh);
    lines.push(
      `队长 ${d.captain.web_name} · ${d.formation} · £${d.spend_m}m · XI xP ${d.xi_xp}`,
    );
    lines.push("");
  }
  lines.push("三套阵容，你站哪一队？把选择打在群里 👇");
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
    `Building FALEAGUE themed drafts for ${cardDate}${gw ? ` (GW${gw})` : ""}…`,
  );
  const drafts = await buildDailyGw1DraftPack({ cardDate, gw });

  writeFileSync(join(outDir, "pack.json"), JSON.stringify(drafts, null, 2), "utf8");
  writeFileSync(join(outDir, "pack.txt"), formatPackIndex(drafts), "utf8");

  // Keep primary draft.json as first theme for backward compatibility
  writeFileSync(join(outDir, "draft.json"), JSON.stringify(drafts[0], null, 2), "utf8");

  for (const draft of drafts) {
    const id = draft.theme.id;
    writeFileSync(
      join(outDir, `draft-${id}.json`),
      JSON.stringify(draft, null, 2),
      "utf8",
    );
    writeFileSync(join(outDir, `draft-${id}.txt`), formatDraftText(draft), "utf8");
    writeFileSync(join(outDir, `rationale-${id}-zh.txt`), draft.rationale_zh, "utf8");
  }

  console.log(`\nWrote ${join(outDir, "pack.txt")}`);
  console.log("\n--- pack.txt ---\n");
  console.log(formatPackIndex(drafts));

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
