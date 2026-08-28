/**
 * Latest completed FPL daily price moves from LiveFPL's public price_changes page.
 * Used to seed / refresh the home sidebar when our own baseline missed the window.
 */

export type LiveFplPriceMove = {
  /** Calendar date on LiveFPL (usually UK), YYYY-MM-DD */
  date: string;
  web_name: string;
  team: string;
  /** New price in £m */
  new_price: number;
  direction: "rise" | "fall";
  /** Delta in tenths of £m (typically ±1) */
  delta_tenths: number;
};

const FETCH_TIMEOUT_MS = 8_000;
const memoryCache: {
  at: number;
  moves: LiveFplPriceMove[];
  latestDate: string | null;
} = { at: 0, moves: [], latestDate: null };
const MEMORY_TTL_MS = 15 * 60 * 1000;

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function parseLiveFplPriceChangesHtml(html: string): {
  latestDate: string | null;
  moves: LiveFplPriceMove[];
} {
  const rowRe = /<tr([^>]*)>([\s\S]*?)<\/tr>/gi;

  const byDate = new Map<string, LiveFplPriceMove[]>();

  for (const m of html.matchAll(rowRe)) {
    const attrs = m[1] ?? "";
    const body = m[2] ?? "";
    const date = /\bdata-date="(\d{4}-\d{2}-\d{2})"/.exec(attrs)?.[1];
    const dirRaw = /\bdata-direction="(up|down)"/.exec(attrs)?.[1];
    const team = decodeHtml(/\bdata-team="([^"]*)"/.exec(attrs)?.[1] ?? "");
    const newRaw = /\bdata-new="([0-9.]+)"/.exec(attrs)?.[1];
    if (!date || !dirRaw || !newRaw) continue;

    const direction = dirRaw === "up" ? ("rise" as const) : ("fall" as const);
    const newPrice = Number(newRaw);
    const nameMatch = /class="pc-playername"[^>]*>([^<]+)</i.exec(body);
    const web_name = decodeHtml(nameMatch?.[1] ?? "");
    if (!web_name || !Number.isFinite(newPrice)) continue;

    const prices = [...body.matchAll(/£\s*([0-9.]+)/g)].map((x) =>
      Number(x[1]),
    );
    let delta_tenths = direction === "rise" ? 1 : -1;
    if (prices.length >= 2 && Number.isFinite(prices[0]) && Number.isFinite(prices[1])) {
      delta_tenths = Math.round((prices[1]! - prices[0]!) * 10);
      if (delta_tenths === 0) delta_tenths = direction === "rise" ? 1 : -1;
    }

    const list = byDate.get(date) ?? [];
    list.push({
      date,
      web_name,
      team,
      new_price: newPrice,
      direction,
      delta_tenths,
    });
    byDate.set(date, list);
  }

  const dates = [...byDate.keys()].sort();
  const latestDate = dates.length ? dates[dates.length - 1]! : null;
  const moves = latestDate ? byDate.get(latestDate)! : [];
  return { latestDate, moves };
}

export async function fetchLatestLiveFplPriceMoves(): Promise<{
  latestDate: string | null;
  moves: LiveFplPriceMove[];
}> {
  const now = Date.now();
  if (now - memoryCache.at < MEMORY_TTL_MS && memoryCache.latestDate) {
    return { latestDate: memoryCache.latestDate, moves: memoryCache.moves };
  }

  try {
    const res = await fetch("https://www.livefpl.net/price_changes", {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; Faleague/1.0; +https://faleague-ai.com)",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) {
      return { latestDate: memoryCache.latestDate, moves: memoryCache.moves };
    }
    const html = await res.text();
    const parsed = parseLiveFplPriceChangesHtml(html);
    if (parsed.latestDate && parsed.moves.length) {
      memoryCache.at = now;
      memoryCache.latestDate = parsed.latestDate;
      memoryCache.moves = parsed.moves;
    }
    return parsed;
  } catch {
    return { latestDate: memoryCache.latestDate, moves: memoryCache.moves };
  }
}

/** Map LiveFPL rows onto bootstrap element ids (web_name + team). */
export function matchMovesToFplIds(
  moves: LiveFplPriceMove[],
  elements: {
    id: number;
    web_name?: string;
    team: number;
    now_cost?: number;
  }[],
  teams: { id: number; name?: string; short_name?: string }[],
): Map<number, number> {
  const teamNameById = new Map<number, string>();
  const teamShortById = new Map<number, string>();
  for (const t of teams) {
    if (t.name) teamNameById.set(t.id, t.name.trim().toLowerCase());
    if (t.short_name) teamShortById.set(t.id, t.short_name.trim().toLowerCase());
  }

  const byName = new Map<string, typeof elements>();
  for (const el of elements) {
    const name = (el.web_name ?? "").trim().toLowerCase();
    if (!name) continue;
    const list = byName.get(name) ?? [];
    list.push(el);
    byName.set(name, list);
  }

  const out = new Map<number, number>();
  for (const move of moves) {
    const key = move.web_name.trim().toLowerCase();
    const candidates = byName.get(key) ?? [];
    if (!candidates.length) continue;

    const teamKey = move.team.trim().toLowerCase();
    let hit =
      candidates.find((el) => {
        const full = teamNameById.get(el.team) ?? "";
        const short = teamShortById.get(el.team) ?? "";
        return (
          full === teamKey ||
          short === teamKey ||
          full.includes(teamKey) ||
          teamKey.includes(full)
        );
      }) ?? null;

    if (!hit && candidates.length === 1) hit = candidates[0]!;
    if (!hit && Number.isFinite(move.new_price)) {
      const want = Math.round(move.new_price * 10);
      hit =
        candidates.find((el) => Number(el.now_cost) === want) ??
        candidates[0] ??
        null;
    }
    if (!hit) continue;
    out.set(hit.id, move.delta_tenths);
  }
  return out;
}
