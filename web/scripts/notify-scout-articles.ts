/**
 * Inbox registered users when Scout ZH articles go live on Faleague.
 *
 *   cd web && npx tsx scripts/notify-scout-articles.ts
 *   cd web && npx tsx scripts/notify-scout-articles.ts --dry-run
 *   cd web && npx tsx scripts/notify-scout-articles.ts --date=2026-09-11
 *   cd web && npx tsx scripts/notify-scout-articles.ts --since-hours=36
 *   cd web && npx tsx scripts/notify-scout-articles.ts --force
 */
import { loadScriptEnv } from "./load-env";
loadScriptEnv();

import { getServerSupabase } from "../lib/supabase";
import {
  buildScoutReleaseCopy,
  loadScoutReleasesForShanghaiDay,
  notifyScoutArticlesReleased,
  notifyScoutArticlesSinceHours,
  shanghaiDateIso,
} from "../lib/notifications/scout-release";

function flagNum(name: string): number | null {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return null;
  const n = Number(raw.slice(name.length + 3));
  return Number.isFinite(n) ? n : null;
}

function flagStr(name: string): string | null {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return null;
  const v = raw.slice(name.length + 3).trim();
  return v || null;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const dateIso = flagStr("date");
  const sinceHours = flagNum("since-hours");
  const admin = getServerSupabase();

  if (sinceHours != null) {
    const results = await notifyScoutArticlesSinceHours(admin, {
      hours: sinceHours,
      dryRun,
      force,
    });
    console.log(JSON.stringify({ mode: "since-hours", hours: sinceHours, results }, null, 2));
    return;
  }

  const day = dateIso ?? shanghaiDateIso();
  const articles = await loadScoutReleasesForShanghaiDay(admin, day);
  const preview = buildScoutReleaseCopy(articles, "zh", day);
  console.log(
    JSON.stringify(
      {
        date: day,
        count: articles.length,
        slugs: articles.map((a) => a.slug),
        titles: articles.map((a) => a.title_zh || a.title_en),
        preview,
      },
      null,
      2,
    ),
  );

  const result = await notifyScoutArticlesReleased(admin, {
    dateIso: day,
    articles,
    dryRun,
    force,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
