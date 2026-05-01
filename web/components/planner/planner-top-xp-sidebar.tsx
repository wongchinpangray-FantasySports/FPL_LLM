"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type {
  PlannerTopPosition,
  TopXpPlayerRow,
} from "@/lib/planner/top-xp-by-position";
import { cn } from "@/lib/utils";

const ORDER: PlannerTopPosition[] = ["GKP", "DEF", "MID", "FWD"];

function posLabel(
  t: (key: string) => string,
  pos: PlannerTopPosition,
) {
  switch (pos) {
    case "GKP":
      return t("topsPos_GKP");
    case "DEF":
      return t("topsPos_DEF");
    case "MID":
      return t("topsPos_MID");
    case "FWD":
      return t("topsPos_FWD");
    default:
      return pos;
  }
}

export function PlannerTopXpSidebar({
  loading,
  error,
  tops,
  fromGw,
  toGw,
  horizon,
}: {
  loading: boolean;
  error: string | null;
  tops: Record<PlannerTopPosition, TopXpPlayerRow[]> | null;
  fromGw: number | null;
  toGw: number | null;
  horizon: number | null;
}) {
  const t = useTranslations("plannerApp");

  return (
    <aside
      className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4"
      aria-labelledby="planner-tops-heading"
    >
      <h2
        id="planner-tops-heading"
        className="text-xs font-semibold uppercase tracking-wide text-slate-400"
      >
        {t("topsTitle")}
      </h2>
      <p className="mt-1 text-[10px] leading-relaxed text-slate-500 sm:text-[11px]">
        {t("topsHint")}
      </p>
      {fromGw != null && toGw != null && horizon != null ? (
        <p className="mt-1.5 text-[10px] text-slate-600">
          {t("topsGwRange", { from: fromGw, to: toGw, horizon })}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-xs text-slate-500">{t("topsLoading")}</p>
      ) : null}

      {error && !loading ? (
        <p className="mt-3 text-xs text-rose-300/90">{error}</p>
      ) : null}

      {!loading && !error && tops == null ? (
        <p className="mt-4 text-xs text-slate-500">{t("topsEmpty")}</p>
      ) : null}

      {tops != null ? (
        <div className="mt-3 space-y-4">
          {ORDER.map((pos) => (
            <div key={pos}>
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-accent/90">
                {posLabel(t, pos)}
              </h3>
              <ul className="space-y-1.5">
                {tops[pos].length === 0 ? (
                  <li className="text-[10px] text-slate-600">—</li>
                ) : (
                  tops[pos].map((row, i) => (
                    <li key={row.fpl_id}>
                      <Link
                        href={`/player/${row.fpl_id}`}
                        className="group flex items-baseline justify-between gap-2 rounded-md border border-transparent px-1 py-0.5 text-left transition-colors hover:border-white/10 hover:bg-white/[0.04]"
                      >
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "mr-1 inline-block w-3.5 text-[9px] font-bold tabular-nums text-slate-600",
                              i === 0 && "text-brand-accent",
                            )}
                          >
                            {i + 1}.
                          </span>
                          <span className="text-[11px] font-medium text-slate-200 group-hover:text-white">
                            {row.web_name ?? `#${row.fpl_id}`}
                          </span>
                          <span className="mt-0.5 block truncate text-[9px] text-slate-500">
                            {row.team ?? "—"}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-brand-accent/95">
                          {row.xp_total.toFixed(1)}
                        </span>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
