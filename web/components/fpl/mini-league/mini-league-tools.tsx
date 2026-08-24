"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type {
  MiniLeagueAnalysis,
  MiniLeagueBeatRival,
  MiniLeagueChipSlot,
  MiniLeagueChipSlots,
  MiniLeagueFormat,
  MiniLeagueH2hPayload,
  MiniLeagueIndex,
  MiniLeagueLivePayload,
  MiniLeaguePlayerRef,
  MiniLeagueRankChartRole,
  MiniLeagueStandingRow,
  MiniLeagueSummary,
  MiniLeagueToolId,
  MiniLeagueToolsPayload,
} from "@/lib/fpl/mini-league/types";
import { pickRivalSample } from "@/lib/fpl/mini-league/math";
import { RivalNameButton } from "@/components/fpl/mini-league/rival-squad-dialog";

type MiniLeagueT = ReturnType<typeof useTranslations<"miniLeague">>;

const TOOL_IDS: MiniLeagueToolId[] = [
  "rankHistory",
  "chips",
  "liveGw",
  "beatRival",
  "fixtures",
  "h2h",
];

const CHIP_COLS: Array<{ key: keyof MiniLeagueChipSlots; label: string }> = [
  { key: "wc1", label: "WC1" },
  { key: "wc2", label: "WC2" },
  { key: "fh1", label: "FH1" },
  { key: "fh2", label: "FH2" },
  { key: "bb1", label: "BB1" },
  { key: "bb2", label: "BB2" },
  { key: "tc1", label: "TC1" },
  { key: "tc2", label: "TC2" },
];

const ROLE_STROKE: Record<MiniLeagueRankChartRole, string> = {
  you: "rgb(45 212 191)",
  leader: "rgb(251 191 36)",
  next: "rgb(56 189 248)",
  nearby: "rgb(148 163 184)",
};

function tr(t: MiniLeagueT, key: string): string {
  return t(key as Parameters<MiniLeagueT>[0]);
}

function qs(entryId: number, extra?: Record<string, string | number>): string {
  const p = new URLSearchParams();
  p.set("entry", String(entryId));
  if (extra) {
    for (const [key, value] of Object.entries(extra)) p.set(key, String(value));
  }
  return `?${p.toString()}`;
}

function leagueKey(format: MiniLeagueFormat, id: number): string {
  return `${format}:${id}`;
}

function formatPrice(price: number | null | undefined): string | null {
  if (price == null || !Number.isFinite(price)) return null;
  return `£${price.toFixed(1)}m`;
}

function playerBits(p: Pick<MiniLeaguePlayerRef, "team" | "position" | "price" | "fixture">) {
  return [p.team, p.position, formatPrice(p.price), p.fixture].filter(Boolean).join(" · ");
}

function PlayerLink({
  fplId,
  name,
  onInspect,
}: {
  fplId: number;
  name: string;
  onInspect: (fplId: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onInspect(fplId)}
      className="font-medium text-foreground hover:text-brand-accent"
    >
      {name}
    </button>
  );
}

function defaultRivalId(analysis: MiniLeagueAnalysis | null, sample: MiniLeagueStandingRow[]): number | null {
  const pool = (sample.length ? sample : analysis?.standings ?? []).filter((r) => !r.isYou);
  if (!pool.length) return null;
  if (analysis?.leader && !analysis.leader.isYou) return analysis.leader.entry;
  return pool[0]?.entry ?? null;
}

function ChipCell({
  slot,
  youSlot,
}: {
  slot: MiniLeagueChipSlot;
  youSlot: MiniLeagueChipSlot | null;
}) {
  const theyHaveYouDont = Boolean(youSlot?.used) && !slot.used;
  const theyPlayedYouHave = slot.used && !youSlot?.used;
  return (
    <span
      className={cn(
        "tabular-nums text-xs",
        theyHaveYouDont && "font-semibold text-emerald-400",
        theyPlayedYouHave && "font-semibold text-amber-300",
        !theyHaveYouDont && !theyPlayedYouHave && "text-muted-foreground",
      )}
    >
      {slot.used ? (slot.event != null ? `GW${slot.event}` : "✓") : "○"}
    </span>
  );
}

function remainingChips(slots: MiniLeagueChipSlots): string {
  const left: string[] = [];
  if (!slots.wc1.used || !slots.wc2.used) {
    left.push(`WC ${(!slots.wc1.used ? 1 : 0) + (!slots.wc2.used ? 1 : 0)}`);
  }
  if (!slots.fh1.used || !slots.fh2.used) {
    left.push(`FH ${(!slots.fh1.used ? 1 : 0) + (!slots.fh2.used ? 1 : 0)}`);
  }
  if (!slots.bb1.used || !slots.bb2.used) {
    left.push(`BB ${(!slots.bb1.used ? 1 : 0) + (!slots.bb2.used ? 1 : 0)}`);
  }
  if (!slots.tc1.used || !slots.tc2.used) {
    left.push(`TC ${(!slots.tc1.used ? 1 : 0) + (!slots.tc2.used ? 1 : 0)}`);
  }
  return left.join(" · ") || "—";
}

function scaleYRank(v: number, min: number, max: number, yTop: number, yBottom: number): number {
  if (max === min) return (yTop + yBottom) / 2;
  return yTop + ((v - min) / (max - min)) * (yBottom - yTop);
}

function RankMultiChart({
  series,
  xLabels,
  ysFor,
}: {
  series: Array<{
    entry: number;
    teamName: string;
    isYou: boolean;
    role: MiniLeagueRankChartRole;
    values: Array<{ x: number; y: number }>;
  }>;
  xLabels: string[];
  ysFor: (s: (typeof series)[number]) => number[];
}) {
  const usable = series.filter((s) => s.values.length > 0);
  if (!usable.length || !xLabels.length) return null;

  const allY = usable.flatMap((s) => ysFor(s)).filter((n) => Number.isFinite(n) && n > 0);
  if (!allY.length) return null;
  const min = Math.min(...allY);
  const max = Math.max(...allY);
  const pad = Math.max((max - min) * 0.12, 1);
  const lo = Math.max(1, min - pad);
  const hi = max + pad;

  const padRect = { l: 46, r: 14, t: 16, b: 36 };
  const W = 640;
  const H = 220;
  const innerW = W - padRect.l - padRect.r;
  const innerH = H - padRect.t - padRect.b;
  const xCount = Math.max(xLabels.length, 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
      <line
        x1={padRect.l}
        y1={padRect.t + innerH}
        x2={W - padRect.r}
        y2={padRect.t + innerH}
        stroke="rgb(71 85 105)"
        strokeWidth="1"
      />
      {xLabels.map((label, i) => {
        const x =
          padRect.l + (xCount <= 1 ? innerW / 2 : (i / (xCount - 1)) * innerW);
        return (
          <text
            key={`${label}-${i}`}
            x={x}
            y={H - 12}
            textAnchor="middle"
            fill="rgb(148 163 184)"
            fontSize="11"
          >
            {label}
          </text>
        );
      })}
      <text
        x={8}
        y={padRect.t + 4}
        fill="rgb(148 163 184)"
        fontSize="10"
      >
        #{Math.round(lo)}
      </text>
      <text
        x={8}
        y={padRect.t + innerH}
        fill="rgb(148 163 184)"
        fontSize="10"
      >
        #{Math.round(hi)}
      </text>
      {usable.map((s) => {
        const pts = s.values.map((pt) => {
          const x =
            padRect.l +
            (xCount <= 1 ? innerW / 2 : (pt.x / Math.max(xCount - 1, 1)) * innerW);
          const y = scaleYRank(pt.y, lo, hi, padRect.t, padRect.t + innerH);
          return { x, y };
        });
        const stroke = ROLE_STROKE[s.role];
        return (
          <g key={s.entry}>
            {pts.length >= 2 ? (
              <polyline
                fill="none"
                stroke={stroke}
                strokeWidth={s.isYou ? 2.4 : 1.6}
                points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
              />
            ) : null}
            {pts.map((p, i) => (
              <circle
                key={`${s.entry}-${i}`}
                cx={p.x}
                cy={p.y}
                r={s.isYou ? 4 : 3}
                fill={stroke}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function LiveCard({
  row,
  t,
  onOpenSquad,
  live,
}: {
  row: MiniLeagueLivePayload["you"];
  t: MiniLeagueT;
  onOpenSquad: (entry: number) => void;
  live: boolean;
}) {
  if (!row) {
    return (
      <div className="rounded-lg border border-border bg-card/40 px-3 py-2.5 text-sm text-muted-foreground">
        —
      </div>
    );
  }
  return (
    <div
      className={cn(
        "rounded-lg border bg-card/40 px-3 py-2.5",
        row.isYou ? "border-brand-accent/40" : "border-border",
      )}
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        #{row.rank}
        {row.isYou ? ` · ${t("youBadge")}` : ""}
      </p>
      <RivalNameButton name={row.teamName} onClick={() => onOpenSquad(row.entry)} />
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {live && row.livePoints != null ? row.livePoints : row.lastGwPoints}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {live ? t("toolsLivePts") : t("toolsLastGw")}
        </span>
      </p>
      {live && row.remaining != null ? (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("toolsRemaining", { n: row.remaining, playing: row.playing ?? 0 })}
        </p>
      ) : null}
    </div>
  );
}

export function MiniLeagueKillerTools({
  entryId,
  leagueId,
  leagueFormat,
  analysis,
  index,
  onSelectLeague,
  onInspect,
  onOpenSquad,
}: {
  entryId: number;
  leagueId: number;
  leagueFormat: MiniLeagueFormat;
  analysis: MiniLeagueAnalysis | null;
  index: MiniLeagueIndex;
  onSelectLeague: (key: string) => void;
  onInspect: (fplId: number) => void;
  onOpenSquad: (entry: number) => void;
}) {
  const t = useTranslations("miniLeague");
  const [tool, setTool] = useState<MiniLeagueToolId | null>(null);
  const [toolsData, setToolsData] = useState<MiniLeagueToolsPayload | null>(null);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [liveData, setLiveData] = useState<MiniLeagueLivePayload | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [beatId, setBeatId] = useState<number | null>(null);
  const [beatData, setBeatData] = useState<MiniLeagueBeatRival | null>(null);
  const [beatLoading, setBeatLoading] = useState(false);
  const [beatError, setBeatError] = useState<string | null>(null);
  const [h2hData, setH2hData] = useState<MiniLeagueH2hPayload | null>(null);
  const [h2hLoading, setH2hLoading] = useState(false);
  const [h2hError, setH2hError] = useState<string | null>(null);

  useEffect(() => {
    setToolsData(null);
    setToolsError(null);
    setLiveData(null);
    setLiveError(null);
    setBeatId(null);
    setBeatData(null);
    setBeatError(null);
    setH2hData(null);
    setH2hError(null);
  }, [leagueId, leagueFormat]);

  const needBundle = tool === "rankHistory" || tool === "chips" || tool === "fixtures";

  useEffect(() => {
    if (!needBundle || !leagueId) return;
    if (toolsData) return;
    let cancelled = false;
    setToolsLoading(true);
    setToolsError(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/fpl/mini-league/${leagueId}/tools${qs(entryId, { format: leagueFormat })}`,
        );
        const data = (await res.json()) as MiniLeagueToolsPayload & { error?: string };
        if (!res.ok) throw new Error(data.error ?? t("toolsError"));
        if (!cancelled) setToolsData(data);
      } catch (err) {
        if (!cancelled) setToolsError(err instanceof Error ? err.message : t("toolsError"));
      } finally {
        if (!cancelled) setToolsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needBundle, leagueId, leagueFormat, entryId, toolsData, t]);

  useEffect(() => {
    if (tool !== "liveGw" || !leagueId) return;
    let cancelled = false;
    setLiveLoading(true);
    setLiveError(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/fpl/mini-league/${leagueId}/live${qs(entryId, { format: leagueFormat })}`,
        );
        const data = (await res.json()) as MiniLeagueLivePayload & { error?: string };
        if (!res.ok) throw new Error(data.error ?? t("toolsError"));
        if (!cancelled) setLiveData(data);
      } catch (err) {
        if (!cancelled) setLiveError(err instanceof Error ? err.message : t("toolsError"));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tool, leagueId, leagueFormat, entryId, t]);

  const rivalOptions = useMemo(() => {
    const fromTools = toolsData?.sample ?? [];
    const fromAnalysis = analysis?.standings ?? [];
    const source = fromTools.length ? fromTools : pickRivalSample(fromAnalysis, entryId);
    const rows = source.filter((r) => !r.isYou);
    const seen = new Set<number>();
    const out: MiniLeagueStandingRow[] = [];
    for (const row of rows) {
      if (seen.has(row.entry)) continue;
      seen.add(row.entry);
      out.push(row);
    }
    return out;
  }, [toolsData, analysis, entryId]);

  useEffect(() => {
    if (tool !== "beatRival") return;
    if (beatId != null) return;
    const next = defaultRivalId(analysis, rivalOptions);
    if (next) setBeatId(next);
  }, [tool, beatId, analysis, rivalOptions]);

  useEffect(() => {
    if (tool !== "beatRival" || !leagueId || beatId == null) return;
    let cancelled = false;
    setBeatLoading(true);
    setBeatError(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/fpl/mini-league/${leagueId}/beat-rival${qs(entryId, { rival: beatId })}`,
        );
        const data = (await res.json()) as MiniLeagueBeatRival & { error?: string };
        if (!res.ok) throw new Error(data.error ?? t("toolsError"));
        if (!cancelled) setBeatData(data);
      } catch (err) {
        if (!cancelled) {
          setBeatData(null);
          setBeatError(err instanceof Error ? err.message : t("toolsError"));
        }
      } finally {
        if (!cancelled) setBeatLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tool, leagueId, entryId, beatId, t]);

  const h2hLeagueId = leagueFormat === "h2h" ? leagueId : null;

  useEffect(() => {
    if (tool !== "h2h" || h2hLeagueId == null) return;
    let cancelled = false;
    setH2hLoading(true);
    setH2hError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/fpl/mini-league/${h2hLeagueId}/h2h${qs(entryId)}`);
        const data = (await res.json()) as MiniLeagueH2hPayload & { error?: string };
        if (!res.ok) throw new Error(data.error ?? t("toolsError"));
        if (!cancelled) setH2hData(data);
      } catch (err) {
        if (!cancelled) setH2hError(err instanceof Error ? err.message : t("toolsError"));
      } finally {
        if (!cancelled) setH2hLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tool, h2hLeagueId, entryId, t]);

  const selectTool = useCallback((id: MiniLeagueToolId) => {
    setTool((prev) => (prev === id ? prev : id));
  }, []);

  const youChips = toolsData?.chips.find((c) => c.isYou) ?? null;

  const mlChartSeries = useMemo(() => {
    const rows = toolsData?.rankChart.miniLeague ?? [];
    return rows.map((s) => {
      const values: Array<{ x: number; y: number }> = [];
      if (s.lastRank != null && s.lastRank > 0) values.push({ x: 0, y: s.lastRank });
      if (s.rank > 0) values.push({ x: values.length ? 1 : 0, y: s.rank });
      if (values.length === 1 && s.lastRank == null) values[0]!.x = 1;
      return {
        entry: s.entry,
        teamName: s.teamName,
        isYou: s.isYou,
        role: s.role,
        values,
      };
    });
  }, [toolsData]);

  const orChart = useMemo(() => {
    const rows = toolsData?.rankChart.overall ?? [];
    const events = [
      ...new Set(rows.flatMap((s) => s.points.map((p) => p.event))),
    ].sort((a, b) => a - b);
    const eventIndex = new Map(events.map((e, i) => [e, i]));
    const series = rows.map((s) => ({
      entry: s.entry,
      teamName: s.teamName,
      isYou: s.isYou,
      role: s.role,
      values: s.points
        .filter((p) => p.overallRank != null && p.overallRank > 0)
        .map((p) => ({ x: eventIndex.get(p.event) ?? 0, y: p.overallRank as number })),
    }));
    return {
      labels: events.map((e) => `GW${e}`),
      series,
    };
  }, [toolsData]);

  const live = liveData?.status === "live";
  const liveGap =
    live && liveData?.you?.livePoints != null && liveData.above?.livePoints != null
      ? liveData.above.livePoints - liveData.you.livePoints
      : null;

  return (
    <section className="rounded-xl border border-border bg-card/30 p-4">
      <h3 className="text-sm font-semibold">{t("toolsTitle")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{t("toolsHint")}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="tablist" aria-label={t("toolsAria")}>
        {TOOL_IDS.map((id) => {
          const selected = tool === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectTool(id)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-colors",
                selected
                  ? "border-brand-accent/50 bg-brand-accent/10"
                  : "border-border/70 bg-background/40 hover:border-border hover:bg-muted/40",
              )}
            >
              <p className="text-sm font-medium text-foreground">{tr(t, `soon.${id}.title`)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{tr(t, `soon.${id}.body`)}</p>
            </button>
          );
        })}
      </div>

      {tool ? (
        <div className="mt-4 rounded-lg border border-border/70 bg-background/30 p-3 sm:p-4">
          {needBundle && toolsLoading && !toolsData ? (
            <p className="text-sm text-muted-foreground">{t("toolsLoading")}</p>
          ) : null}
          {needBundle && toolsError ? (
            <p className="text-sm text-rose-200">{toolsError}</p>
          ) : null}

          {tool === "rankHistory" && toolsData ? (
            <div className="flex flex-col gap-4">
              <div>
                <h4 className="text-sm font-semibold">{t("toolsRankMlTitle")}</h4>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("toolsRankMlHint")}</p>
                <div className="mt-2 rounded-lg border border-border/60 bg-card/40 p-2">
                  <RankMultiChart
                    series={mlChartSeries}
                    xLabels={[t("toolsRankLast"), t("toolsRankNow", { n: toolsData.gw })]}
                    ysFor={(s) => s.values.map((v) => v.y)}
                  />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold">{t("toolsRankOrTitle")}</h4>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("toolsRankOrHint")}</p>
                <div className="mt-2 rounded-lg border border-border/60 bg-card/40 p-2">
                  {orChart.series.some((s) => s.values.length) ? (
                    <RankMultiChart
                      series={orChart.series}
                      xLabels={orChart.labels}
                      ysFor={(s) => s.values.map((v) => v.y)}
                    />
                  ) : (
                    <p className="px-2 py-4 text-sm text-muted-foreground">{t("toolsRankEmpty")}</p>
                  )}
                </div>
              </div>
              <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {toolsData.rankChart.miniLeague.map((s) => (
                  <li key={s.entry} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: ROLE_STROKE[s.role] }}
                    />
                    <RivalNameButton
                      name={s.teamName}
                      onClick={() => onOpenSquad(s.entry)}
                      className="font-normal"
                    />
                    {s.isYou ? ` · ${t("youBadge")}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tool === "chips" && toolsData ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">{t("toolsChipHint")}</p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("colTeam")}</th>
                      {CHIP_COLS.map((col) => (
                        <th key={col.key} className="px-2 py-2 text-center font-medium">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {toolsData.chips.map((row) => (
                      <tr
                        key={row.entry}
                        className={cn("border-t border-border/60", row.isYou && "bg-brand-accent/10")}
                      >
                        <td className="px-3 py-2">
                          <RivalNameButton name={row.teamName} onClick={() => onOpenSquad(row.entry)} />
                          {row.isYou ? (
                            <span className="ml-1.5 text-[10px] uppercase text-brand-accent">
                              {t("youBadge")}
                            </span>
                          ) : null}
                        </td>
                        {CHIP_COLS.map((col) => (
                          <td key={col.key} className="px-2 py-2 text-center">
                            <ChipCell
                              slot={row.slots[col.key]}
                              youSlot={youChips?.slots[col.key] ?? null}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-emerald-400">{t("toolsChipStill")}</span>
                {" · "}
                <span className="font-semibold text-amber-300">{t("toolsChipSpent")}</span>
              </p>
            </div>
          ) : null}

          {tool === "fixtures" && toolsData ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                {t("toolsFxHint", { from: toolsData.fixtures.fromGw, to: toolsData.fixtures.toGw })}
              </p>
              {!toolsData.fixtures.sharedDgw.length &&
              !toolsData.fixtures.blanks.length &&
              !toolsData.fixtures.sameOpp.length ? (
                <p className="text-sm text-muted-foreground">{t("toolsFxEmpty")}</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {toolsData.fixtures.sharedDgw.map((row) => (
                    <li key={`dgw-${row.gw}-${row.teamId}`} className="text-muted-foreground">
                      {t("toolsFxSharedDgw", {
                        n: row.rivalCount,
                        team: row.team,
                        gw: row.gw,
                      })}
                    </li>
                  ))}
                  {toolsData.fixtures.gws.map((gw) => {
                    const blanks = toolsData.fixtures.blanks.filter((b) => b.gw === gw);
                    if (!blanks.length) return null;
                    return (
                      <li key={`blank-${gw}`} className="text-muted-foreground">
                        {t("toolsFxBlankDef", { n: blanks.length, gw })}
                        {": "}
                        {blanks.map((b, i) => (
                          <span key={b.fplId}>
                            {i > 0 ? ", " : ""}
                            <PlayerLink fplId={b.fplId} name={b.webName} onInspect={onInspect} />
                          </span>
                        ))}
                      </li>
                    );
                  })}
                  {toolsData.fixtures.sameOpp.map((row) => (
                    <li key={`opp-${row.gw}-${row.opp}`} className="text-muted-foreground">
                      {t("toolsFxSameOpp", { n: row.yourCount, opp: row.opp, gw: row.gw })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {tool === "liveGw" ? (
            <div className="flex flex-col gap-3">
              {liveLoading && !liveData ? (
                <p className="text-sm text-muted-foreground">{t("toolsLoading")}</p>
              ) : null}
              {liveError ? <p className="text-sm text-rose-200">{liveError}</p> : null}
              {liveData ? (
                <>
                  {liveData.status === "not_started" ? (
                    <p className="text-sm text-muted-foreground">{t("toolsLiveNotStarted")}</p>
                  ) : null}
                  {liveData.status === "finished" ? (
                    <p className="text-sm text-muted-foreground">{t("toolsLiveFinished")}</p>
                  ) : null}
                  {live && liveGap != null ? (
                    <p className="text-sm text-foreground">
                      {t("toolsLiveGap", { n: liveGap })}
                    </p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t("toolsLiveAbove")}
                      </p>
                      <LiveCard row={liveData.above} t={t} onOpenSquad={onOpenSquad} live={live} />
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t("youBadge")}
                      </p>
                      <LiveCard row={liveData.you} t={t} onOpenSquad={onOpenSquad} live={live} />
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t("toolsLiveBelow")}
                      </p>
                      <LiveCard row={liveData.below} t={t} onOpenSquad={onOpenSquad} live={live} />
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {tool === "beatRival" ? (
            <div className="flex flex-col gap-3">
              <label className="flex max-w-md flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("toolsBeatSelect")}
                </span>
                <select
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  value={beatId ?? ""}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setBeatId(Number.isFinite(n) && n > 0 ? n : null);
                    setBeatData(null);
                  }}
                >
                  {rivalOptions.map((row) => (
                    <option key={row.entry} value={row.entry}>
                      {`#${row.rank} · ${row.entryName}`}
                    </option>
                  ))}
                </select>
              </label>
              {rivalOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("toolsBeatNoRivals")}</p>
              ) : null}
              {beatLoading && !beatData ? (
                <p className="text-sm text-muted-foreground">{t("toolsLoading")}</p>
              ) : null}
              {beatError ? <p className="text-sm text-rose-200">{beatError}</p> : null}
              {beatData ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t("toolsBeatGap", {
                      n: beatData.pointsGap ?? 0,
                      diff:
                        beatData.squadDiffPct == null ? "—" : `${beatData.squadDiffPct}%`,
                    })}
                  </p>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-semibold">{t("rivalDiffTheirs")}</h4>
                      <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                        {beatData.theyHaveYouDont.length ? (
                          beatData.theyHaveYouDont.slice(0, 8).map((p) => (
                            <li key={p.fplId}>
                              <PlayerLink fplId={p.fplId} name={p.webName} onInspect={onInspect} />
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                {playerBits(p)}
                                {p.xp != null ? ` · ${p.xp.toFixed(1)} xP` : ""}
                              </span>
                            </li>
                          ))
                        ) : (
                          <li className="text-muted-foreground">{t("rivalTheyHaveEmpty")}</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">{t("rivalDiffYours")}</h4>
                      <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                        {beatData.youHaveTheyDont.length ? (
                          beatData.youHaveTheyDont.slice(0, 8).map((p) => (
                            <li key={p.fplId}>
                              <PlayerLink fplId={p.fplId} name={p.webName} onInspect={onInspect} />
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                {playerBits(p)}
                                {p.xp != null ? ` · ${p.xp.toFixed(1)} xP` : ""}
                              </span>
                            </li>
                          ))
                        ) : (
                          <li className="text-muted-foreground">{t("rivalYouHaveEmpty")}</li>
                        )}
                      </ul>
                    </div>
                  </div>
                  {beatData.suggestion ? (
                    <div className="rounded-lg border border-brand-accent/30 bg-brand-accent/5 px-3 py-3">
                      <h4 className="text-sm font-semibold">{t("toolsBeatSuggest")}</h4>
                      <p className="mt-2 text-sm">
                        {t("toolsBeatOut")}:{" "}
                        <PlayerLink
                          fplId={beatData.suggestion.out.fplId}
                          name={beatData.suggestion.out.webName}
                          onInspect={onInspect}
                        />
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {playerBits(beatData.suggestion.out)}
                          {beatData.suggestion.out.xp != null
                            ? ` · ${beatData.suggestion.out.xp.toFixed(1)} xP`
                            : ""}
                        </span>
                      </p>
                      <p className="mt-1 text-sm">
                        {t("toolsBeatIn")}:{" "}
                        <PlayerLink
                          fplId={beatData.suggestion.in.fplId}
                          name={beatData.suggestion.in.webName}
                          onInspect={onInspect}
                        />
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {playerBits(beatData.suggestion.in)}
                          {beatData.suggestion.in.xp != null
                            ? ` · ${beatData.suggestion.in.xp.toFixed(1)} xP`
                            : ""}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-brand-accent">
                        {tr(t, `toolsBeatReason.${beatData.suggestion.reason}`)}
                        {beatData.suggestion.xpDelta != null
                          ? ` · ${beatData.suggestion.xpDelta > 0 ? "+" : ""}${beatData.suggestion.xpDelta} xP`
                          : ""}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("toolsBeatNoSuggest")}</p>
                  )}
                </>
              ) : null}
            </div>
          ) : null}

          {tool === "h2h" ? (
            <div className="flex flex-col gap-3">
              {leagueFormat !== "h2h" ? (
                <>
                  <p className="text-sm text-muted-foreground">{t("toolsH2hClassicHint")}</p>
                  {index.h2h.length ? (
                    <ul className="flex flex-col gap-2">
                      {index.h2h.map((league: MiniLeagueSummary) => (
                        <li key={league.id}>
                          <button
                            type="button"
                            onClick={() => onSelectLeague(leagueKey("h2h", league.id))}
                            className="rounded-lg border border-border bg-card/40 px-3 py-2 text-left text-sm hover:border-brand-accent/40"
                          >
                            <span className="font-medium">{league.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {t("toolsH2hSwitch")}
                              {league.rank != null ? ` · #${league.rank}` : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("toolsH2hNoLeagues")}</p>
                  )}
                </>
              ) : (
                <>
                  {h2hLoading && !h2hData ? (
                    <p className="text-sm text-muted-foreground">{t("toolsLoading")}</p>
                  ) : null}
                  {h2hError ? <p className="text-sm text-rose-200">{h2hError}</p> : null}
                  {h2hData && !h2hData.matchup ? (
                    <p className="text-sm text-muted-foreground">{t("toolsH2hNoMatch")}</p>
                  ) : null}
                  {h2hData?.matchup ? (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm font-semibold">
                        {t("toolsH2hMatchup", { gw: h2hData.matchup.gw })}
                      </p>
                      {h2hData.matchup.isBye ? (
                        <p className="text-sm text-muted-foreground">{t("toolsH2hBye")}</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-brand-accent/40 bg-card/40 px-3 py-2.5">
                            <p className="text-[11px] uppercase text-muted-foreground">{t("youBadge")}</p>
                            <RivalNameButton
                              name={h2hData.matchup.you.teamName}
                              onClick={() => onOpenSquad(h2hData.matchup!.you.entry)}
                            />
                            <p className="mt-1 text-lg font-semibold tabular-nums">
                              {h2hData.matchup.you.points ?? "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("toolsH2hChips")}: {remainingChips(h2hData.matchup.you.chips)}
                            </p>
                          </div>
                          {h2hData.matchup.opponent ? (
                            <div className="rounded-lg border border-border bg-card/40 px-3 py-2.5">
                              <p className="text-[11px] uppercase text-muted-foreground">
                                {t("toolsH2hOpp")}
                              </p>
                              <RivalNameButton
                                name={h2hData.matchup.opponent.teamName}
                                onClick={() => onOpenSquad(h2hData.matchup!.opponent!.entry)}
                              />
                              <p className="mt-1 text-lg font-semibold tabular-nums">
                                {h2hData.matchup.opponent.points ?? "—"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t("toolsH2hChips")}: {remainingChips(h2hData.matchup.opponent.chips)}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      )}
                      <p className="text-sm">
                        {h2hData.matchup.lean === "you"
                          ? t("toolsH2hLeanYou")
                          : h2hData.matchup.lean === "them"
                            ? t("toolsH2hLeanThem")
                            : t("toolsH2hLeanEven")}
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
