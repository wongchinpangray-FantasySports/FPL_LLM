/**
 * Inbox every free registered user about FALEAGUE PRO.
 *
 *   cd web && npx tsx scripts/notify-founder-pack.ts
 *   cd web && npx tsx scripts/notify-founder-pack.ts --retract
 *   cd web && npx tsx scripts/notify-founder-pack.ts --force
 */
import { join } from "node:path";
import { getServerSupabase } from "../lib/supabase";
import { insertNotifications } from "../lib/notifications/shared";
import {
  FOUNDER_PACK_TEASER_PATH,
} from "../lib/billing/founder-pack";

function loadEnvLocal(): void {
  const { readFileSync, existsSync } = require("node:fs") as typeof import("node:fs");
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const admin = getServerSupabase();
  const force = process.argv.includes("--force");

  if (process.argv.includes("--retract")) {
    const { data, error } = await admin
      .from("user_notifications")
      .delete()
      .eq("type", "founder_pack_offer")
      .select("id");
    if (error) throw new Error(error.message);
    console.log(JSON.stringify({ retracted: data?.length ?? 0 }));
    return;
  }

  if (force) {
    const { data, error } = await admin
      .from("user_notifications")
      .delete()
      .eq("type", "founder_pack_offer")
      .select("id");
    if (error) throw new Error(error.message);
    console.log(JSON.stringify({ retractedBeforeForce: data?.length ?? 0 }));
  }

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id,insights_plan,insights_plan_expires_at");
  if (error) throw new Error(error.message);

  const now = Date.now();
  const candidates = (profiles ?? []).filter((p) => {
    if (p.insights_plan !== "premium") return true;
    const exp = p.insights_plan_expires_at
      ? Date.parse(String(p.insights_plan_expires_at))
      : null;
    return exp != null && exp < now;
  });

  const { data: existing, error: existErr } = await admin
    .from("user_notifications")
    .select("user_id")
    .eq("type", "founder_pack_offer")
    .eq("href", FOUNDER_PACK_TEASER_PATH);
  if (existErr) throw new Error(existErr.message);
  const already = new Set((existing ?? []).map((r) => r.user_id as string));

  const rows = candidates
    .filter((p) => force || !already.has(p.id as string))
    .map((p) => ({
      user_id: p.id as string,
      type: "founder_pack_offer",
      title: `免费诊断 · 先看你的球队问题`,
      body: "输入 FPL Entry，免费看问题。完整报告（转会 / 队长 / 小联赛）需要再留微信号。可先看样本。",
      href: FOUNDER_PACK_TEASER_PATH,
    }));

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 80) {
    inserted += await insertNotifications(admin, rows.slice(i, i + 80));
  }

  console.log(
    JSON.stringify({
      profiles: profiles?.length ?? 0,
      candidates: candidates.length,
      skippedExisting: force ? 0 : already.size,
      inserted,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
