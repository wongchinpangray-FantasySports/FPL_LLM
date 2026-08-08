"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { UnderstatShot } from "@/lib/fpl/understat-shots";

export type PlayerShotMapLabels = {
  title: string;
  subtitle: string;
  empty: string;
  legendGoal: string;
  legendSaved: string;
  legendOther: string;
  legendSize: string;
  statShots: string;
  statGoals: string;
  statXg: string;
  statOnTarget: string;
  sourceNote: string;
};

function formatSeasonLabel(season: string | null | undefined): string | null {
  if (!season) return null;
  const y = Number(season);
  if (!Number.isFinite(y)) return season;
  const yy = String((y + 1) % 100).padStart(2, "0");
  return `${y}/${yy}`;
}

function formatCoverageDate(
  iso: string | null | undefined,
  locale: string,
): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type ResultFilter = "all" | "goal" | "saved" | "blocked" | "missed";
type SituationFilter =
  | "all"
  | "open"
  | "setpiece"
  | "penalty"
  | "corner";
type ShotTypeFilter = "all" | "right" | "left" | "head" | "other";
type WindowFilter = "all" | "10" | "6";

function resultFill(result: string): "goal" | "saved" | "other" {
  if (result === "Goal") return "goal";
  if (result === "SavedShot" || result === "ShotOnPost") return "saved";
  return "other";
}

function matchesResult(shot: UnderstatShot, f: ResultFilter): boolean {
  if (f === "all") return true;
  if (f === "goal") return shot.result === "Goal";
  if (f === "saved")
    return shot.result === "SavedShot" || shot.result === "ShotOnPost";
  if (f === "blocked") return shot.result === "BlockedShot";
  return (
    shot.result === "MissedShots" ||
    (shot.result !== "Goal" &&
      shot.result !== "SavedShot" &&
      shot.result !== "ShotOnPost" &&
      shot.result !== "BlockedShot")
  );
}

function situationBucket(
  situation: string | null,
): Exclude<SituationFilter, "all"> {
  const s = (situation ?? "").toLowerCase();
  if (s.includes("penal")) return "penalty";
  if (s.includes("corner")) return "corner";
  if (
    s.includes("set") ||
    s.includes("freekick") ||
    s.includes("free kick") ||
    s.includes("directfree")
  ) {
    return "setpiece";
  }
  return "open";
}

function matchesSituation(shot: UnderstatShot, f: SituationFilter): boolean {
  if (f === "all") return true;
  return situationBucket(shot.situation) === f;
}

function shotTypeBucket(shotType: string | null): Exclude<ShotTypeFilter, "all"> {
  const s = (shotType ?? "").toLowerCase();
  if (s.includes("left")) return "left";
  if (s.includes("right")) return "right";
  if (s.includes("head")) return "head";
  return "other";
}

function matchesShotType(shot: UnderstatShot, f: ShotTypeFilter): boolean {
  if (f === "all") return true;
  return shotTypeBucket(shot.shot_type) === f;
}

function applyWindow(shots: UnderstatShot[], w: WindowFilter): UnderstatShot[] {
  if (w === "all") return shots;
  const n = w === "6" ? 6 : 10;
  const sorted = [...shots].sort((a, b) => {
    const da = a.match_date ?? "";
    const db = b.match_date ?? "";
    if (da !== db) return db.localeCompare(da);
    return (b.minute ?? 0) - (a.minute ?? 0);
  });
  const matchIds: string[] = [];
  const seen = new Set<string>();
  for (const s of sorted) {
    if (seen.has(s.match_id)) continue;
    seen.add(s.match_id);
    matchIds.push(s.match_id);
    if (matchIds.length >= n) break;
  }
  const keep = new Set(matchIds);
  return sorted.filter((s) => keep.has(s.match_id));
}

function summarize(shots: UnderstatShot[]) {
  const goals = shots.filter((s) => s.result === "Goal").length;
  const xg = shots.reduce((a, s) => a + s.xg, 0);
  const onTarget = shots.filter(
    (s) =>
      s.result === "Goal" ||
      s.result === "SavedShot" ||
      s.result === "ShotOnPost",
  ).length;
  return {
    shots: shots.length,
    goals,
    xg: Math.round(xg * 1000) / 1000,
    on_target: onTarget,
    finishDelta: Math.round((goals - xg) * 100) / 100,
  };
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors sm:text-xs",
        active
          ? "bg-brand-accent text-brand-ink"
          : "border border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Attacking-half shot map (goal at top). Understat X→goal, Y→width.
 * Client filters: result / situation / shot type / recent matches.
 */
export function PlayerShotMap({
  shots,
  totals: _serverTotals,
  labels,
  className,
  variant = "full",
  season = null,
  coverage = null,
}: {
  shots: UnderstatShot[];
  totals: {
    shots: number;
    goals: number;
    xg: number;
    on_target: number;
  };
  labels: PlayerShotMapLabels;
  className?: string;
  /** Modal uses compact (fewer filter rows). */
  variant?: "full" | "compact";
  season?: string | null;
  coverage?: {
    from: string | null;
    to: string | null;
    matches: number;
  } | null;
}) {
  const t = useTranslations("playerPage");
  const locale = useLocale();
  const [result, setResult] = useState<ResultFilter>("all");
  const [situation, setSituation] = useState<SituationFilter>("all");
  const [shotType, setShotType] = useState<ShotTypeFilter>("all");
  const [windowF, setWindowF] = useState<WindowFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const W = 340;
  const H = 280;
  const pad = 14;
  const pitchW = W - pad * 2;
  const pitchH = H - pad * 2;

  const filtered = useMemo(() => {
    const windowed = applyWindow(shots, windowF);
    return windowed.filter(
      (s) =>
        matchesResult(s, result) &&
        matchesSituation(s, situation) &&
        matchesShotType(s, shotType),
    );
  }, [shots, result, situation, shotType, windowF]);

  const totals = useMemo(() => summarize(filtered), [filtered]);

  const coverageLine = useMemo(() => {
    const seasonLabel = formatSeasonLabel(season);
    if (windowF !== "all") {
      const dates = filtered
        .map((s) => s.match_date)
        .filter((d): d is string => Boolean(d))
        .sort();
      const from = formatCoverageDate(dates[0] ?? null, locale);
      const to = formatCoverageDate(dates[dates.length - 1] ?? null, locale);
      const matches = new Set(filtered.map((s) => s.match_id)).size;
      if (!from || !to) {
        return seasonLabel
          ? t("shotMapCoverageSeasonOnly", { season: seasonLabel })
          : null;
      }
      return t("shotMapCoverageFiltered", {
        season: seasonLabel ?? "—",
        from,
        to,
        matches,
      });
    }
    const from = formatCoverageDate(coverage?.from ?? null, locale);
    const to = formatCoverageDate(coverage?.to ?? null, locale);
    const matches = coverage?.matches ?? 0;
    if (seasonLabel && from && to) {
      return t("shotMapCoverage", {
        season: seasonLabel,
        from,
        to,
        matches,
      });
    }
    if (seasonLabel) {
      return t("shotMapCoverageSeasonOnly", { season: seasonLabel });
    }
    return null;
  }, [coverage, filtered, locale, season, t, windowF]);

  const takeaway = useMemo(() => {
    if (totals.shots === 0) return t("shotMapTakeawayEmpty");
    const delta = totals.finishDelta;
    const finish =
      delta > 0.15
        ? t("shotMapFinishOver", { n: delta.toFixed(1) })
        : delta < -0.15
          ? t("shotMapFinishUnder", { n: Math.abs(delta).toFixed(1) })
          : t("shotMapFinishInline");
    return t("shotMapTakeaway", {
      shots: totals.shots,
      goals: totals.goals,
      xg: totals.xg.toFixed(1),
      finish,
    });
  }, [totals, t]);

  const plotted = useMemo(() => {
    return filtered.map((s) => {
      const xAtk = Math.min(1, Math.max(0, s.x));
      const y = Math.min(1, Math.max(0, s.y));
      const xClamped = Math.max(0.45, xAtk);
      const cx = pad + y * pitchW;
      const cy = pad + ((1 - xClamped) / (1 - 0.45)) * pitchH;
      const r = 3.5 + Math.min(1, Math.max(0, s.xg)) * 15;
      return { ...s, cx, cy, r, kind: resultFill(s.result) };
    });
  }, [filtered, pad, pitchW, pitchH]);

  const selected = plotted.find((s) => s.id === selectedId) ?? null;

  const hasData = shots.length > 0;

  return (
    <section
      id="shot-map"
      className={cn(
        "rounded-xl border border-brand-accent/30 bg-card p-4 sm:p-5",
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {labels.title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {labels.subtitle}
          </p>
        </div>
      </div>

      {!hasData ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <p className="rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-sm leading-relaxed text-foreground/90">
              {takeaway}
            </p>
            {coverageLine ? (
              <p className="px-1 text-xs text-muted-foreground">{coverageLine}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <FilterRow label={t("shotMapFilterResult")}>
              {(
                [
                  ["all", t("shotMapFilterAll")],
                  ["goal", t("shotMapFilterGoals")],
                  ["saved", t("shotMapFilterOnTarget")],
                  ["blocked", t("shotMapFilterBlocked")],
                  ["missed", t("shotMapFilterMissed")],
                ] as const
              ).map(([id, lab]) => (
                <Chip
                  key={id}
                  active={result === id}
                  onClick={() => setResult(id)}
                >
                  {lab}
                </Chip>
              ))}
            </FilterRow>

            {variant === "full" ? (
              <>
                <FilterRow label={t("shotMapFilterSituation")}>
                  {(
                    [
                      ["all", t("shotMapFilterAll")],
                      ["open", t("shotMapFilterOpenPlay")],
                      ["setpiece", t("shotMapFilterSetPiece")],
                      ["penalty", t("shotMapFilterPenalty")],
                      ["corner", t("shotMapFilterCorner")],
                    ] as const
                  ).map(([id, lab]) => (
                    <Chip
                      key={id}
                      active={situation === id}
                      onClick={() => setSituation(id)}
                    >
                      {lab}
                    </Chip>
                  ))}
                </FilterRow>

                <FilterRow label={t("shotMapFilterType")}>
                  {(
                    [
                      ["all", t("shotMapFilterAll")],
                      ["right", t("shotMapFilterRight")],
                      ["left", t("shotMapFilterLeft")],
                      ["head", t("shotMapFilterHead")],
                      ["other", t("shotMapFilterOther")],
                    ] as const
                  ).map(([id, lab]) => (
                    <Chip
                      key={id}
                      active={shotType === id}
                      onClick={() => setShotType(id)}
                    >
                      {lab}
                    </Chip>
                  ))}
                </FilterRow>

                <FilterRow label={t("shotMapFilterWindow")}>
                  {(
                    [
                      ["all", t("shotMapFilterAll")],
                      ["10", t("shotMapFilterLast10")],
                      ["6", t("shotMapFilterLast6")],
                    ] as const
                  ).map(([id, lab]) => (
                    <Chip
                      key={id}
                      active={windowF === id}
                      onClick={() => setWindowF(id)}
                    >
                      {lab}
                    </Chip>
                  ))}
                </FilterRow>
              </>
            ) : (
              <FilterRow label={t("shotMapFilterWindow")}>
                {(
                  [
                    ["all", t("shotMapFilterAll")],
                    ["10", t("shotMapFilterLast10")],
                    ["6", t("shotMapFilterLast6")],
                  ] as const
                ).map(([id, lab]) => (
                  <Chip
                    key={id}
                    active={windowF === id}
                    onClick={() => setWindowF(id)}
                  >
                    {lab}
                  </Chip>
                ))}
              </FilterRow>
            )}
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="mx-auto w-full max-w-[340px] shrink-0">
              <div className="overflow-hidden rounded-lg border border-border/80 bg-[#0c1410] p-1">
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="h-auto w-full"
                  role="img"
                  aria-label={labels.title}
                >
                  <rect
                    x={pad}
                    y={pad}
                    width={pitchW}
                    height={pitchH}
                    fill="#14301f"
                    stroke="#2f5a42"
                    strokeWidth={1.5}
                  />
                  <rect
                    x={pad + pitchW * 0.21}
                    y={pad}
                    width={pitchW * 0.58}
                    height={pitchH * 0.42}
                    fill="transparent"
                    stroke="#3d7a58"
                    strokeWidth={1}
                  />
                  <rect
                    x={pad + pitchW * 0.36}
                    y={pad}
                    width={pitchW * 0.28}
                    height={pitchH * 0.16}
                    fill="transparent"
                    stroke="#3d7a58"
                    strokeWidth={1}
                  />
                  <line
                    x1={pad + pitchW * 0.42}
                    y1={pad}
                    x2={pad + pitchW * 0.58}
                    y2={pad}
                    stroke="#e8f5ee"
                    strokeWidth={3}
                  />
                  <circle
                    cx={pad + pitchW * 0.5}
                    cy={pad + pitchH * 0.28}
                    r={2}
                    fill="#6a9a7c"
                  />

                  {plotted.map((s) => {
                    const active = selectedId === s.id;
                    return (
                      <circle
                        key={s.id}
                        cx={s.cx}
                        cy={s.cy}
                        r={active ? s.r + 1.5 : s.r}
                        fill={
                          s.kind === "goal"
                            ? "#5eead4"
                            : s.kind === "saved"
                              ? "#fbbf24"
                              : "#94a3b8"
                        }
                        fillOpacity={active ? 1 : s.kind === "other" ? 0.55 : 0.85}
                        stroke={active ? "#ffffff" : "rgba(255,255,255,0.35)"}
                        strokeWidth={active ? 1.6 : 0.7}
                        className="cursor-pointer"
                        onClick={() =>
                          setSelectedId((id) => (id === s.id ? null : s.id))
                        }
                      >
                        <title>
                          {`${s.result} · xG ${s.xg.toFixed(2)} · ${s.minute ?? "—"}' vs ${s.opponent ?? "—"}`}
                        </title>
                      </circle>
                    );
                  })}
                </svg>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-teal-300" />
                  {labels.legendGoal}
                </span>
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />
                  {labels.legendSaved}
                </span>
                <span>
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-400" />
                  {labels.legendOther}
                </span>
                <span className="w-full sm:w-auto">{labels.legendSize}</span>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                <Stat label={labels.statShots} value={String(totals.shots)} />
                <Stat label={labels.statGoals} value={String(totals.goals)} />
                <Stat label={labels.statXg} value={totals.xg.toFixed(2)} />
                <Stat
                  label={labels.statOnTarget}
                  value={String(totals.on_target)}
                />
              </div>

              {selected ? (
                <div className="rounded-lg border border-brand-accent/30 bg-background/60 px-3 py-2.5 text-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-brand-accent">
                    {t("shotMapSelected")}
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {selected.result} · xG {selected.xg.toFixed(2)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selected.minute != null ? `${selected.minute}'` : "—"}
                    {selected.opponent ? ` · vs ${selected.opponent}` : ""}
                    {selected.situation ? ` · ${selected.situation}` : ""}
                    {selected.shot_type ? ` · ${selected.shot_type}` : ""}
                    {selected.match_date ? ` · ${selected.match_date}` : ""}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("shotMapTapHint")}
                </p>
              )}

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {labels.sourceNote}
              </p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("shotMapFilterEmpty")}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
      <span className="w-16 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:w-20">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
