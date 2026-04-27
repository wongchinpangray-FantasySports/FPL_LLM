import { cn } from "@/lib/utils";
import type { PlayerProjection, FixtureProjection } from "@/lib/xp";

/**
 * Map an xP value per fixture to a Tailwind background class.
 * Buckets are tuned to FPL single-fixture xP: 0–1 slate, 1–2 sky, 2–3 teal,
 * 3–4.5 green, 4.5–6 emerald, 6+ lime.
 */
export function xpCellClass(xp: number): string {
  if (xp <= 0.01) return "bg-slate-900/60 text-slate-500";
  if (xp < 1) return "bg-slate-700/70 text-slate-200";
  if (xp < 2) return "bg-sky-900/70 text-sky-100";
  if (xp < 3) return "bg-teal-800/80 text-teal-50";
  if (xp < 4.5) return "bg-emerald-700/85 text-emerald-50";
  if (xp < 6) return "bg-emerald-500/90 text-emerald-950 font-semibold";
  return "bg-lime-300 text-emerald-950 font-bold";
}

function groupByGw(fixtures: FixtureProjection[]): Map<number, FixtureProjection[]> {
  const out = new Map<number, FixtureProjection[]>();
  for (const f of fixtures) {
    if (!out.has(f.gw)) out.set(f.gw, []);
    out.get(f.gw)!.push(f);
  }
  return out;
}

export interface HeatmapRow {
  fpl_id: number;
  team_id: number | null;
  web_name: string | null;
  team: string | null;
  position: string | null;
  is_starter: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
  availability: number;
  availability_note: string | null;
  set_pieces: PlayerProjection["set_pieces"];
  byGw: Map<number, FixtureProjection[]>;
  xp_total: number;
  ownership: number | null;
  price: number | null;
}

export function buildHeatmapRow(
  p: PlayerProjection,
  meta: {
    is_starter: boolean;
    is_captain: boolean;
    is_vice_captain: boolean;
  },
): HeatmapRow {
  return {
    fpl_id: p.fpl_id,
    team_id: p.team_id,
    web_name: p.web_name,
    team: p.team,
    position: p.position,
    is_starter: meta.is_starter,
    is_captain: meta.is_captain,
    is_vice_captain: meta.is_vice_captain,
    availability: p.availability,
    availability_note: p.availability_note,
    set_pieces: p.set_pieces,
    byGw: groupByGw(p.fixtures),
    xp_total: p.xp_total,
    ownership: p.ownership,
    price: p.price,
  };
}

function Cell({
  fixtures,
  gw,
  teamId,
  dgwTeamGw,
}: {
  fixtures: FixtureProjection[] | undefined;
  gw: number;
  teamId: number | null;
  dgwTeamGw?: Set<string>;
}) {
  if (!fixtures || fixtures.length === 0) {
    return (
      <div className="rounded border border-white/5 bg-slate-900/40 px-1 py-0.5 text-center text-[9px] text-slate-600 sm:px-1.5 sm:py-1 sm:text-[10px]">
        —
      </div>
    );
  }
  // DGW: two+ fixture rows for this player in this GW, OR calendar DGW for
  // this team (so we still show after one match is marked finished).
  const total = fixtures.reduce((s, f) => s + f.xp_total, 0);
  const calendarDgw =
    teamId != null && dgwTeamGw?.has(`${teamId}:${gw}`) === true;
  const isDgw = fixtures.length > 1 || calendarDgw;
  return (
    <div
      className={cn(
        "rounded px-1 py-0.5 text-center text-[10px] leading-tight sm:px-1.5 sm:py-1 sm:text-[11px]",
        xpCellClass(total),
        isDgw &&
          "ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-950 shadow-[0_0_0_1px_rgba(250,204,21,0.35)] sm:ring-offset-2",
      )}
      title={fixtures
        .map(
          (f) =>
            `${f.opp_short}${f.home ? "(H)" : "(A)"} · xP ${f.xp_total.toFixed(
              2,
            )}\n` +
            `mins ${f.expected_minutes.toFixed(
              0,
            )} · xG ${f.xG.toFixed(2)} xA ${f.xA.toFixed(2)} pCS ${f.p_clean_sheet.toFixed(
              2,
            )}\n` +
            `def actions λ ${f.exp_defensive_actions.toFixed(
              1,
            )} (need ${f.dc_threshold}) · pDC ${f.p_dc.toFixed(
              2,
            )} · xp_dc ${f.xp_dc.toFixed(2)}\n` +
            `xp decomp: goals ${f.xp_goals.toFixed(
              1,
            )} assists ${f.xp_assists.toFixed(1)} cs ${f.xp_cs.toFixed(
              1,
            )} gc ${f.xp_gc.toFixed(1)} saves ${f.xp_saves.toFixed(
              1,
            )} dc ${f.xp_dc.toFixed(1)} bonus ${f.xp_bonus.toFixed(1)}`,
        )
        .join("\n\n")}
    >
      <div className="font-semibold">{total.toFixed(1)}</div>
      <div className="text-[9px] opacity-80">
        {fixtures
          .map((f) => `${f.opp_short}${f.home ? "" : "·A"}`)
          .join(",")}
      </div>
    </div>
  );
}

export function XpHeatmap({
  rows,
  gws,
  title,
  dgwTeamGw,
  legendHint = "Colours = xP/fixture. Yellow ring = 2+ games that GW (DGW).",
  columnHeaders = {
    player: "Player",
    team: "Team",
    pos: "Pos",
    total: "Total",
  },
  gwTotalLabel = "GW total",
  benchLabel = "bench",
}: {
  rows: HeatmapRow[];
  gws: number[];
  title?: string;
  /** `${teamId}:${gw}` for any team with 2+ fixtures that gameweek */
  dgwTeamGw?: Set<string>;
  /** Shown next to title (right side) */
  legendHint?: string;
  columnHeaders?: { player: string; team: string; pos: string; total: string };
  gwTotalLabel?: string;
  benchLabel?: string;
}) {
  if (rows.length === 0) return null;

  const colTotals = gws.map((g) =>
    rows.reduce((s, r) => {
      const fxs = r.byGw.get(g);
      if (!fxs) return s;
      return s + fxs.reduce((ss, f) => ss + f.xp_total, 0);
    }, 0),
  );

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2">
      {title && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 sm:gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-white md:text-xl">
            {title}
          </h2>
          <span className="max-w-xl text-xs leading-relaxed text-slate-400">
            {legendHint}
          </span>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03] shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] sm:rounded-2xl">
        <table className="w-full text-[11px] sm:text-xs">
          <thead>
            <tr className="text-left text-[9px] uppercase text-slate-400 sm:text-[10px]">
              <th className="px-2 py-1.5 sm:px-3 sm:py-2">{columnHeaders.player}</th>
              <th className="px-1.5 py-1.5 sm:px-2 sm:py-2">{columnHeaders.team}</th>
              <th className="px-1.5 py-1.5 sm:px-2 sm:py-2">{columnHeaders.pos}</th>
              {gws.map((g) => (
                <th key={g} className="px-1 py-1.5 text-center sm:px-2 sm:py-2">
                  GW{g}
                </th>
              ))}
              <th className="px-1.5 py-1.5 text-right sm:px-2 sm:py-2">{columnHeaders.total}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const showDivider =
                idx > 0 && rows[idx - 1].is_starter && !r.is_starter;
              return (
                <tr
                  key={r.fpl_id}
                  className={cn(
                    "border-t border-white/5 hover:bg-white/5",
                    showDivider && "border-t-2 border-white/20",
                  )}
                >
                  <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">
                        {r.web_name ?? `#${r.fpl_id}`}
                      </span>
                      {r.is_captain && (
                        <span className="rounded bg-brand-accent/20 px-1 text-[9px] font-bold text-brand-accent">
                          C
                        </span>
                      )}
                      {r.is_vice_captain && (
                        <span className="rounded bg-white/10 px-1 text-[9px] text-slate-300">
                          V
                        </span>
                      )}
                      {r.set_pieces.penalties === 1 && (
                        <span
                          title="Primary penalty taker"
                          className="rounded bg-amber-400/25 px-1 text-[9px] font-semibold text-amber-200"
                        >
                          PEN
                        </span>
                      )}
                      {r.set_pieces.freekicks === 1 && (
                        <span
                          title="Primary direct free-kick taker"
                          className="rounded bg-purple-400/20 px-1 text-[9px] font-semibold text-purple-200"
                        >
                          FK
                        </span>
                      )}
                      {r.availability < 1 && (
                        <span
                          title={r.availability_note ?? undefined}
                          className="rounded bg-rose-500/25 px-1 text-[9px] font-semibold text-rose-200"
                        >
                          {Math.round(r.availability * 100)}%
                        </span>
                      )}
                    </div>
                    {!r.is_starter && (
                      <div className="text-[9px] uppercase text-slate-500">
                        {benchLabel}
                      </div>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 text-slate-300 sm:px-2 sm:py-2">{r.team ?? "–"}</td>
                  <td className="px-1.5 py-1.5 text-slate-400 sm:px-2 sm:py-2">
                    {r.position ?? "–"}
                  </td>
                  {gws.map((g) => (
                    <td key={g} className="px-0.5 py-0.5 align-middle sm:px-1 sm:py-1">
                      <Cell
                        fixtures={r.byGw.get(g)}
                        gw={g}
                        teamId={r.team_id}
                        dgwTeamGw={dgwTeamGw}
                      />
                    </td>
                  ))}
                  <td className="px-1.5 py-1.5 text-right font-semibold sm:px-2 sm:py-2">
                    {r.xp_total.toFixed(1)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-white/20 bg-white/5">
              <td className="px-3 py-2 text-xs font-semibold uppercase text-slate-300">
                {gwTotalLabel}
              </td>
              <td />
              <td />
              {colTotals.map((t, i) => (
                <td key={gws[i]} className="px-1 py-1.5 text-center text-[11px] sm:px-2 sm:py-2 sm:text-xs">
                  <span
                    className={cn(
                      "inline-block rounded px-2 py-0.5 font-semibold",
                      xpCellClass(t / Math.max(rows.length, 1)),
                    )}
                  >
                    {t.toFixed(1)}
                  </span>
                </td>
              ))}
              <td className="px-1.5 py-1.5 text-right font-semibold sm:px-2 sm:py-2">
                {colTotals.reduce((a, b) => a + b, 0).toFixed(1)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
