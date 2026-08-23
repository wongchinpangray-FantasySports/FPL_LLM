import { cn } from "@/lib/utils";
import type { PlayerProjection, FixtureProjection } from "@/lib/xp";

/**
 * Map an xP value per fixture to a Tailwind background class.
 * Buckets are tuned to FPL single-fixture xP: 0–1 slate, 1–2 sky, 2–3 teal,
 * 3–4.5 green, 4.5–6 emerald, 6+ lime.
 */
export function xpCellClass(xp: number): string {
  if (xp <= 0.01) return "bg-popover/60 text-muted-foreground";
  if (xp < 1) return "bg-slate-700/70 text-foreground/90";
  if (xp < 2) return "bg-sky-900/70 text-sky-100";
  if (xp < 3) return "bg-teal-800/80 text-teal-50";
  if (xp < 4.5) return "bg-emerald-700/85 text-emerald-50";
  if (xp < 6) return "bg-emerald-500/90 text-emerald-950 font-semibold";
  return "bg-lime-300 text-emerald-950 font-bold";
}

function n(value: unknown, digits = 1): string {
  const x = typeof value === "number" ? value : Number(value);
  return Number.isFinite(x) ? x.toFixed(digits) : "–";
}

function groupByGw(
  fixtures: FixtureProjection[],
): Record<number, FixtureProjection[]> {
  const out: Record<number, FixtureProjection[]> = {};
  for (const f of fixtures) {
    (out[f.gw] ??= []).push(f);
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
  /** Plain object (not Map) so OpenNext / Workers never drop rows on serialize. */
  byGw: Record<number, FixtureProjection[]>;
  xp_total: number;
  ownership: number | null;
  price: number | null;
}

const EMPTY_SET_PIECES: PlayerProjection["set_pieces"] = {
  penalties: null,
  freekicks: null,
  corners: null,
  score: 0,
};

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
    set_pieces: p.set_pieces ?? EMPTY_SET_PIECES,
    byGw: groupByGw(p.fixtures ?? []),
    xp_total: p.xp_total,
    ownership: p.ownership,
    price: p.price,
  };
}

/** Row when projection is missing — still show the player on the dashboard. */
export function buildHeatmapRowFromPick(meta: {
  fpl_id: number;
  team_id: number | null;
  web_name: string | null;
  team: string | null;
  position: string | null;
  is_starter: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
  price?: number | null;
}): HeatmapRow {
  return {
    fpl_id: meta.fpl_id,
    team_id: meta.team_id,
    web_name: meta.web_name,
    team: meta.team,
    position: meta.position,
    is_starter: meta.is_starter,
    is_captain: meta.is_captain,
    is_vice_captain: meta.is_vice_captain,
    availability: 1,
    availability_note: null,
    set_pieces: EMPTY_SET_PIECES,
    byGw: {},
    xp_total: 0,
    ownership: null,
    price: meta.price ?? null,
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
  dgwTeamGw?: ReadonlySet<string> | Iterable<string>;
}) {
  if (!fixtures || fixtures.length === 0) {
    return (
      <div className="rounded border border-border/60 bg-popover/40 px-1 py-0.5 text-center text-[9px] text-muted-foreground/80 sm:px-1.5 sm:py-1 sm:text-[10px]">
        —
      </div>
    );
  }
  const total = fixtures.reduce((s, f) => s + (Number(f.xp_total) || 0), 0);
  const dgwHas =
    teamId != null &&
    dgwTeamGw != null &&
    (dgwTeamGw instanceof Set
      ? dgwTeamGw.has(`${teamId}:${gw}`)
      : [...dgwTeamGw].includes(`${teamId}:${gw}`));
  const isDgw = fixtures.length > 1 || dgwHas;
  const title = fixtures
    .map((f) => {
      const side = f.home ? "H" : "A";
      return `${f.opp_short ?? "?"}(${side}) xP ${n(f.xp_total, 2)} · mins ${n(f.expected_minutes, 0)}`;
    })
    .join(" | ");
  return (
    <div
      className={cn(
        "rounded px-1 py-0.5 text-center text-[10px] leading-tight sm:px-1.5 sm:py-1 sm:text-[11px]",
        xpCellClass(total),
        isDgw &&
          "ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-950 shadow-[0_0_0_1px_rgba(250,204,21,0.35)] sm:ring-offset-2",
      )}
      title={title}
    >
      <div className="font-semibold">{n(total, 1)}</div>
      <div className="text-[9px] opacity-80">
        {fixtures
          .map((f) => `${f.opp_short ?? "?"}${f.home ? "" : "·A"}`)
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
  dgwTeamGw?: ReadonlySet<string> | Iterable<string>;
  /** Shown next to title (right side) */
  legendHint?: string;
  columnHeaders?: { player: string; team: string; pos: string; total: string };
  gwTotalLabel?: string;
  benchLabel?: string;
}) {
  if (rows.length === 0) return null;

  const colTotals = gws.map((g) =>
    rows.reduce((s, r) => {
      const fxs = r.byGw?.[g];
      if (!fxs) return s;
      return s + fxs.reduce((ss, f) => ss + (Number(f.xp_total) || 0), 0);
    }, 0),
  );

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2">
      {title && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 sm:gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
            {title}
          </h2>
          <span className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            {legendHint}
          </span>
        </div>
      )}
      <div className="scroll-table scroll-table--bordered scroll-table--viewport bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] sm:rounded-2xl">
        <table className="w-full text-[11px] sm:text-xs">
          <thead>
            <tr className="text-left text-[9px] uppercase text-muted-foreground sm:text-[10px]">
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
              const sp = r.set_pieces ?? EMPTY_SET_PIECES;
              return (
                <tr
                  key={r.fpl_id}
                  className={cn(
                    "border-t border-border/60 hover:bg-muted",
                    showDivider && "border-t-2 border-border",
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
                        <span className="rounded bg-muted px-1 text-[9px] text-foreground/70">
                          V
                        </span>
                      )}
                      {sp.penalties === 1 && (
                        <span
                          title="Primary penalty taker"
                          className="rounded bg-amber-400/25 px-1 text-[9px] font-semibold text-amber-200"
                        >
                          PEN
                        </span>
                      )}
                      {sp.freekicks === 1 && (
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
                      <div className="text-[9px] uppercase text-muted-foreground">
                        {benchLabel}
                      </div>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 text-foreground/70 sm:px-2 sm:py-2">
                    {r.team ?? "–"}
                  </td>
                  <td className="px-1.5 py-1.5 text-muted-foreground sm:px-2 sm:py-2">
                    {r.position ?? "–"}
                  </td>
                  {gws.map((g) => (
                    <td key={g} className="px-0.5 py-0.5 align-middle sm:px-1 sm:py-1">
                      <Cell
                        fixtures={r.byGw?.[g]}
                        gw={g}
                        teamId={r.team_id}
                        dgwTeamGw={dgwTeamGw}
                      />
                    </td>
                  ))}
                  <td className="px-1.5 py-1.5 text-right font-semibold sm:px-2 sm:py-2">
                    {n(r.xp_total, 1)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-border bg-muted">
              <td className="px-3 py-2 text-xs font-semibold uppercase text-foreground/70">
                {gwTotalLabel}
              </td>
              <td />
              <td />
              {colTotals.map((t, i) => (
                <td
                  key={gws[i]}
                  className="px-1 py-1.5 text-center text-[11px] sm:px-2 sm:py-2 sm:text-xs"
                >
                  <span
                    className={cn(
                      "inline-block rounded px-2 py-0.5 font-semibold",
                      xpCellClass(t / Math.max(rows.length, 1)),
                    )}
                  >
                    {n(t, 1)}
                  </span>
                </td>
              ))}
              <td className="px-1.5 py-1.5 text-right font-semibold sm:px-2 sm:py-2">
                {n(
                  colTotals.reduce((a, b) => a + b, 0),
                  1,
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
