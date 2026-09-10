/**
 * Grant the WeChat founder pack after a transfer lands.
 *
 *   cd web
 *   npx tsx scripts/grant-founder-pack.ts --email user@example.com
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { founderPackExpiresAt } from "../lib/billing/founder-pack";
import { grantInsightsPremium } from "../lib/stripe/insights-billing";
import { getServerSupabase } from "../lib/supabase";

function loadEnvLocal(): void {
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

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  if (i < 0) return null;
  return process.argv[i + 1]?.trim() || null;
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = getServerSupabase();
  const needle = email.trim().toLowerCase();
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    const hit = (data.users ?? []).find(
      (u) => (u.email ?? "").trim().toLowerCase() === needle,
    );
    if (hit) return hit.id;
    if ((data.users?.length ?? 0) < 200) return null;
    page += 1;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const email = argValue("--email");
  if (!email) {
    console.error("Usage: npx tsx scripts/grant-founder-pack.ts --email user@example.com");
    process.exit(1);
  }
  const userId = await findUserIdByEmail(email);
  if (!userId) {
    console.error(`No auth user for ${email}`);
    process.exit(1);
  }
  const expiresAt = founderPackExpiresAt();
  await grantInsightsPremium(userId, { expiresAt });
  console.log(
    `Granted Insights Pro (founder pack) to ${email} (${userId}) until ${expiresAt.toISOString()}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
