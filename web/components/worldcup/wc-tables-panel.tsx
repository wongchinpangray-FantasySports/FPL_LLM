"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { WcSectionIntro } from "@/components/worldcup/wc-shared";
import type {
  GroupTable,
  LeaderboardRow,
  TeamDetail,
} from "@/lib/wc/standings";

type TablesPayload = {
  groups: GroupTable[];
  scorers: LeaderboardRow[];
  assists: LeaderboardRow[];
  teams: Record<string, TeamDetail>;
  disclaimer?: string;
  error?: string;
};

function StandingTable({
  group,
  labels,
  onSelectTeam,
  selectedCode,
}: {
  group: GroupTable;
  labels: {
    group: string;
    team: string;
    p: string;
    w: string;
    d: string;
    l: string;
    gf: string;
    ga: string;
    gd: string;
    pts: string;
  };
  onSelectTeam: (code: string) => void;
  selectedCode: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <div className="border-b border-white/[0.06] bg-white/[0.03] px-3 py-2">
        <h3 className="text-sm font-semibold text-white">
          {labels.group} {group.group_letter}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] text-left text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="px-2 py-1.5 font-medium">#</th>
              <th className="px-2 py-1.5 font-medium">{labels.team}</th>
              <th className="px-1.5 py-1.5 text-center font-medium">{labels.p}</th>
              <th className="px-1.5 py-1.5 text-center font-medium">{labels.w}</th>
              <th className="px-1.5 py-1.5 text-center font-medium">{labels.d}</th>
              <th className="px-1.5 py-1.5 text-center font-medium">{labels.l}</th>
              <th className="hidden px-1.5 py-1.5 text-center font-medium sm:table-cell">
                {labels.gf}
              </th>
              <th className="hidden px-1.5 py-1.5 text-center font-medium sm:table-cell">
                {labels.ga}
              </th>
              <th className="px-1.5 py-1.5 text-center font-medium">{labels.gd}</th>
              <th className="px-2 py-1.5 text-center font-medium">{labels.pts}</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row) => (
              <tr
                key={row.code}
                className={cn(
                  "cursor-pointer border-t border-white/[0.04] transition-colors hover:bg-white/[0.04]",
                  selectedCode === row.code && "bg-brand-accent/10",
                  row.rank <= 2 && "text-white",
                )}
                onClick={() => onSelectTeam(row.code)}
              >
                <td className="px-2 py-1.5 tabular-nums text-slate-500">{row.rank}</td>
                <td className="max-w-[5.5rem] truncate px-2 py-1.5 font-medium text-white sm:max-w-none">
                  {row.short_name}
                </td>
                <td className="px-1.5 py-1.5 text-center tabular-nums">{row.played}</td>
                <td className="px-1.5 py-1.5 text-center tabular-nums">{row.won}</td>
                <td className="px-1.5 py-1.5 text-center tabular-nums">{row.drawn}</td>
                <td className="px-1.5 py-1.5 text-center tabular-nums">{row.lost}</td>
                <td className="hidden px-1.5 py-1.5 text-center tabular-nums sm:table-cell">
                  {row.gf}
                </td>
                <td className="hidden px-1.5 py-1.5 text-center tabular-nums sm:table-cell">
                  {row.ga}
                </td>
                <td className="px-1.5 py-1.5 text-center tabular-nums">{row.gd}</td>
                <td className="px-2 py-1.5 text-center font-semibold tabular-nums text-brand-accent">
                  {row.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaderboardTable({
  rows,
  stat,
  labels,
  onSelectTeam,
}: {
  rows: LeaderboardRow[];
  stat: "goals" | "assists";
  labels: {
    rank: string;
    player: string;
    team: string;
    goals: string;
    assists: string;
    empty: string;
  };
  onSelectTeam: (code: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">{labels.empty}</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-white/[0.06] text-slate-500">
            <th className="px-3 py-2 font-medium">{labels.rank}</th>
            <th className="px-3 py-2 font-medium">{labels.player}</th>
            <th className="px-3 py-2 font-medium">{labels.team}</th>
            <th className="px-3 py-2 text-center font-medium">{labels.goals}</th>
            <th className="px-3 py-2 text-center font-medium">{labels.assists}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.player_id}
              className="border-t border-white/[0.04] hover:bg-white/[0.03]"
            >
              <td className="px-3 py-2 tabular-nums text-slate-500">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-white">{row.name}</td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onSelectTeam(row.team_code)}
                  className="text-brand-accent hover:underline"
                >
                  {row.team_name}
                </button>
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-center tabular-nums",
                  stat === "goals" && row.goals > 0 && "font-semibold text-white",
                )}
              >
                {row.goals}
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-center tabular-nums",
                  stat === "assists" && row.assists > 0 && "font-semibold text-white",
                )}
              >
                {row.assists}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamDetailPanel({
  team,
  labels,
  onClose,
}: {
  team: TeamDetail;
  labels: {
    close: string;
    group: string;
    record: string;
    results: string;
    md: string;
    home: string;
    away: string;
    atk: string;
    def: string;
    noResults: string;
  };
  onClose: () => void;
}) {
  const s = team.standing;

  return (
    <aside className="rounded-xl border border-brand-accent/25 bg-brand-accent/5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-white">{team.name}</h3>
          <p className="text-sm text-slate-400">
            {labels.group} {team.group_letter} · {team.code}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-white"
        >
          {labels.close}
        </button>
      </div>

      {s ? (
        <p className="mt-3 text-sm text-slate-300">
          {labels.record}: {s.won}W {s.drawn}D {s.lost}L · {s.gf}–{s.ga} ({s.gd >= 0 ? "+" : ""}
          {s.gd}) · <span className="font-semibold text-brand-accent">{s.points} pts</span>
        </p>
      ) : null}

      <p className="mt-2 text-xs text-slate-500">
        {labels.atk} {team.attack_strength} · {labels.def} {team.defence_strength}
      </p>

      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {labels.results}
      </h4>
      {team.results.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">{labels.noResults}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {team.results.map((r) => (
            <li key={`${r.matchday}-${r.opponent_code}`} className="flex justify-between gap-2">
              <span className="text-slate-400">
                {labels.md}
                {r.matchday} · {r.home ? labels.home : labels.away} {r.opponent_name}
              </span>
              <span className="tabular-nums text-white">
                {r.score ?? "—"}
                {r.points != null ? (
                  <span className="ml-1 text-brand-accent">({r.points}p)</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export function WcTablesPanel({
  title,
  summary,
  detail,
  moreLabel,
  labels,
}: {
  title: string;
  summary: string;
  detail?: string;
  moreLabel: string;
  labels: {
    loading: string;
    empty: string;
    group: string;
    team: string;
    p: string;
    w: string;
    d: string;
    l: string;
    gf: string;
    ga: string;
    gd: string;
    pts: string;
    scorersTitle: string;
    assistsTitle: string;
    rank: string;
    player: string;
    goals: string;
    assists: string;
    leaderboardEmpty: string;
    selectTeamHint: string;
    close: string;
    record: string;
    results: string;
    md: string;
    home: string;
    away: string;
    atk: string;
    def: string;
    noResults: string;
  };
}) {
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TablesPayload | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/worldcup/tables?locale=${encodeURIComponent(locale)}`,
      );
      const json = (await res.json()) as TablesPayload;
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedTeam =
    selectedCode && data?.teams[selectedCode] ? data.teams[selectedCode] : null;

  return (
    <section className="flex flex-col gap-5">
      <WcSectionIntro
        title={title}
        summary={summary}
        detail={detail}
        moreLabel={moreLabel}
      />

      {loading ? <p className="text-sm text-slate-400">{labels.loading}</p> : null}
      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {data && !loading && !error ? (
        <>
          <p className="text-xs text-slate-500">{labels.selectTeamHint}</p>

          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(16rem,22rem)]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.groups.map((g) => (
                <StandingTable
                  key={g.group_letter}
                  group={g}
                  labels={labels}
                  selectedCode={selectedCode}
                  onSelectTeam={setSelectedCode}
                />
              ))}
            </div>

            {selectedTeam ? (
              <TeamDetailPanel
                team={selectedTeam}
                labels={labels}
                onClose={() => setSelectedCode(null)}
              />
            ) : (
              <div className="hidden rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500 lg:block">
                {labels.selectTeamHint}
              </div>
            )}
          </div>

          {selectedTeam ? (
            <div className="lg:hidden">
              <TeamDetailPanel
                team={selectedTeam}
                labels={labels}
                onClose={() => setSelectedCode(null)}
              />
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-white">
                {labels.scorersTitle}
              </h3>
              <LeaderboardTable
                rows={data.scorers}
                stat="goals"
                labels={{
                  rank: labels.rank,
                  player: labels.player,
                  team: labels.team,
                  goals: labels.goals,
                  assists: labels.assists,
                  empty: labels.leaderboardEmpty,
                }}
                onSelectTeam={setSelectedCode}
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-white">
                {labels.assistsTitle}
              </h3>
              <LeaderboardTable
                rows={data.assists}
                stat="assists"
                labels={{
                  rank: labels.rank,
                  player: labels.player,
                  team: labels.team,
                  goals: labels.goals,
                  assists: labels.assists,
                  empty: labels.leaderboardEmpty,
                }}
                onSelectTeam={setSelectedCode}
              />
            </div>
          </div>

          {data.disclaimer ? (
            <p className="text-xs leading-relaxed text-slate-600">{data.disclaimer}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
