import {
  loadPriceForecastRaw,
  type PriceForecastRow,
} from "@/lib/fpl/insights/price-forecast";
import { plTeamNameZh } from "@/lib/fpl/pl-team-names-zh";
import {
  resolveWechatCardSiteUrl,
  shanghaiDateIso,
} from "@/lib/fpl/wechat-daily-card";

const RISE_MAX = 6;
const FALL_MAX = 6;
const WATCH_FILL = 4;

export type WechatPriceCautionData = {
  card_date: string;
  gw: number;
  source: "live" | "db";
  likely_rise: PriceForecastRow[];
  likely_fall: PriceForecastRow[];
  watch_rise: PriceForecastRow[];
  watch_fall: PriceForecastRow[];
  text: string;
  skipped: boolean;
  skip_reason: string | null;
};

function fmtNet(n: number): string {
  const abs = Math.abs(n);
  const compact =
    abs >= 1_000_000
      ? `${(abs / 1_000_000).toFixed(2)}m`
      : abs >= 1000
        ? `${Math.round(abs / 1000)}k`
        : String(abs);
  return n >= 0 ? `+${compact}` : `-${compact}`;
}

function fmtProgress(row: PriceForecastRow): string {
  const pct = Math.min(999, Math.round(Math.abs(row.progress) * 100));
  return `${pct}%`;
}

function lineFor(row: PriceForecastRow): string {
  const team = plTeamNameZh(row.team_short, row.team);
  const already =
    row.cost_change_event > 0
      ? " · 本轮已涨"
      : row.cost_change_event < 0
        ? " · 本轮已跌"
        : "";
  return `• ${row.web_name}（${team}）£${row.current_price.toFixed(1)}m  进度 ${fmtProgress(row)}  净 ${fmtNet(row.net_transfers)}${already}`;
}

function formatCautionText(data: Omit<WechatPriceCautionData, "text">): string {
  const site = resolveWechatCardSiteUrl();
  const lines: string[] = [
    `💹 身价预警 · GW${data.gw} · ${data.card_date}`,
    "",
    "FPL 身价通常在英国凌晨 1:30–2:30 结算（上海约 8:30–9:30）。今晚不处理，明天可能已涨/已跌。",
    "",
  ];

  if (data.likely_rise.length) {
    lines.push("⬆️ 接近涨价");
    for (const row of data.likely_rise.slice(0, RISE_MAX)) {
      lines.push(lineFor(row));
    }
    lines.push("");
  }

  if (data.likely_fall.length) {
    lines.push("⬇️ 接近降价");
    for (const row of data.likely_fall.slice(0, FALL_MAX)) {
      lines.push(lineFor(row));
    }
    lines.push("");
  }

  const extraRise = data.watch_rise.slice(0, WATCH_FILL);
  const extraFall = data.watch_fall.slice(0, WATCH_FILL);
  if (
    extraRise.length &&
    data.likely_rise.length < 3
  ) {
    lines.push("👀 涨价观察");
    for (const row of extraRise) lines.push(lineFor(row));
    lines.push("");
  }
  if (extraFall.length && data.likely_fall.length < 3) {
    lines.push("👀 降价观察");
    for (const row of extraFall) lines.push(lineFor(row));
    lines.push("");
  }

  lines.push("算法为社区估算（净转入 ≈ 拥有人数的 10%），非官方。");
  lines.push("");
  lines.push(`💬 讨论：你今晚会提前入手谁，或卖掉谁？`);
  lines.push("");
  lines.push("🔗 完整预测");
  lines.push(`${site}/zh/fpl/insights/price-forecast`);

  return lines.join("\n").trimEnd();
}

export async function buildWechatPriceCaution(opts?: {
  asOf?: Date;
}): Promise<WechatPriceCautionData> {
  const asOf = opts?.asOf ?? new Date();
  const forecast = await loadPriceForecastRaw();
  const likelyRise = forecast.likely_rise;
  const likelyFall = forecast.likely_fall;
  const watchRise = forecast.watch_rise;
  const watchFall = forecast.watch_fall;

  const actionable =
    likelyRise.length +
    likelyFall.length +
    watchRise.length +
    watchFall.length;

  const base: Omit<WechatPriceCautionData, "text"> = {
    card_date: shanghaiDateIso(asOf),
    gw: forecast.gw,
    source: forecast.source,
    likely_rise: likelyRise,
    likely_fall: likelyFall,
    watch_rise: watchRise,
    watch_fall: watchFall,
    skipped: actionable === 0,
    skip_reason:
      actionable === 0 ? "当前没有接近涨跌阈值的球员" : null,
  };

  return { ...base, text: base.skipped ? "" : formatCautionText(base) };
}
