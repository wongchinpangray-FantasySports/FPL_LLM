/**
 * Email all registered users about FALEAGUE PRO (Resend).
 *
 * Requires RESEND_API_KEY (+ optional RESEND_FROM, default onboarding@resend.dev for test).
 *
 *   cd web && npx tsx scripts/email-founder-pack.ts --dry-run
 *   cd web && npx tsx scripts/email-founder-pack.ts
 *   cd web && npx tsx scripts/email-founder-pack.ts --limit=5
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getServerSupabase } from "../lib/supabase";
import {
  FOUNDER_PACK_PRICE_CNY,
  GW_NOTE_PRICE_CNY,
  SAMPLE_REPORT_A_PDF,
  SAMPLE_REPORT_B_PDF,
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

function argValue(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
}

async function listUserEmails(): Promise<string[]> {
  const admin = getServerSupabase();
  const emails: string[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      const e = u.email?.trim().toLowerCase();
      if (e && e.includes("@")) emails.push(e);
    }
    if (data.users.length < 1000) break;
    page += 1;
    if (page > 50) break;
  }
  return [...new Set(emails)].sort();
}

function buildHtml(site: string): string {
  const a = `${site}${SAMPLE_REPORT_A_PDF}`;
  const b = `${site}${SAMPLE_REPORT_B_PDF}`;
  const pro = `${site}/zh/pro`;
  return `<!DOCTYPE html>
<html lang="zh-CN"><body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.55;color:#111;max-width:560px;margin:0 auto;padding:24px">
  <p style="font-size:12px;color:#00a65a;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">FALEAGUE PRO</p>
  <h1 style="font-size:22px;margin:8px 0 12px">阵容诊断 · 付费数据已上线</h1>
  <p>发哥结合 Faleague-ai，为你打造收获绿箭头的秘密武器。</p>
  <ul>
    <li><strong>A · 单轮 ¥${GW_NOTE_PRICE_CNY}</strong>：本轮诊断 + 小联赛分析 · PDF 交付</li>
    <li><strong>B · 4轮套餐 ¥${FOUNDER_PACK_PRICE_CNY}</strong>：4 份报告 + 付费数据 + 小联赛大杀器 + 4 轮冲冠规划</li>
  </ul>
  <p>开通方法：打开页面选择套餐，留下微信号，发哥联系开通。</p>
  <p style="margin:20px 0">
    <a href="${pro}" style="display:inline-block;background:#00ff85;color:#04120a;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">去开通 FALEAGUE PRO</a>
  </p>
  <p style="margin:8px 0 4px;font-weight:600">先下载参考报告（PDF）：</p>
  <p>
    <a href="${a}" style="color:#0a6b3c">样张 A · ¥${GW_NOTE_PRICE_CNY} 单轮</a>
    &nbsp;·&nbsp;
    <a href="${b}" style="color:#0a6b3c">样张 B · ¥${FOUNDER_PACK_PRICE_CNY} 四轮（含冲冠规划）</a>
  </p>
  <p style="font-size:12px;color:#666;margin-top:28px">Scout 中文继续免费。这不是 Scout 会员替代。<br/>Faleague · faleague-ai.com</p>
</body></html>`;
}

async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  from: string;
  apiKey: string;
}): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text}`);
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const dry = process.argv.includes("--dry-run");
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Math.max(1, Number(limitRaw)) : null;
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.faleague-ai.com";
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const from =
    process.env.RESEND_FROM?.trim() ||
    "Faleague <onboarding@resend.dev>";

  const emails = await listUserEmails();
  const targets = limit ? emails.slice(0, limit) : emails;
  const html = buildHtml(site);
  const subject = `FALEAGUE PRO 上线：¥${GW_NOTE_PRICE_CNY} 单轮 / ¥${FOUNDER_PACK_PRICE_CNY} 四轮 · 可下载参考报告`;

  const outDir = join(process.cwd(), "output", "founder-pack");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "email-preview.html"), html, "utf8");
  writeFileSync(join(outDir, "email-recipients.tsv"), targets.join("\n") + "\n", "utf8");

  if (dry || !apiKey) {
    console.log(
      JSON.stringify(
        {
          dryRun: dry || !apiKey,
          reason: !apiKey ? "RESEND_API_KEY missing" : "dry-run",
          recipients: targets.length,
          totalUsers: emails.length,
          preview: "output/founder-pack/email-preview.html",
          recipientsFile: "output/founder-pack/email-recipients.tsv",
          from,
        },
        null,
        2,
      ),
    );
    if (!apiKey && !dry) {
      console.error(
        "Set RESEND_API_KEY in .env.local (and RESEND_FROM with a verified domain) then re-run.",
      );
      process.exitCode = 2;
    }
    return;
  }

  let sent = 0;
  const errors: { email: string; error: string }[] = [];
  for (const to of targets) {
    try {
      await sendViaResend({ to, subject, html, from, apiKey });
      sent += 1;
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      errors.push({
        email: to,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  writeFileSync(
    join(outDir, "email-send-result.json"),
    JSON.stringify({ sent, errors, attempted: targets.length }, null, 2),
    "utf8",
  );
  console.log(JSON.stringify({ sent, failed: errors.length, attempted: targets.length }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
