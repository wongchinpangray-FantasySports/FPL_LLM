"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import type { MiniLeagueManagerHistory } from "@/lib/fpl/mini-league/types";

function chipShort(name: string): string {
  const id = name.trim().toLowerCase().replace(/[\s_]/g, "");
  if (id === "wildcard" || id === "wc") return "WC";
  if (id === "freehit" || id === "ff") return "FH";
  if (id === "bboost" || id === "benchboost" || (id.includes("bench") && id.includes("boost"))) {
    return "BB";
  }
  if (id === "3xc" || id.includes("triplecaptain")) return "TC";
  return name.trim() || name;
}

export function ManagerHistoryDialog({
  open,
  data,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  data: MiniLeagueManagerHistory | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("miniLeague");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const chipsByEvent = new Map<number, string[]>();
  for (const chip of data?.chips ?? []) {
    const list = chipsByEvent.get(chip.event) ?? [];
    list.push(chipShort(chip.name));
    chipsByEvent.set(chip.event, list);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manager-history-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label={t("historyClose")}
        onClick={onClose}
      />
      <div className="relative z-[101] max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-xl border border-border bg-background p-5 shadow-2xl sm:rounded-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-brand-accent">
              {t("historyEyebrow")}
            </p>
            <h2 id="manager-history-title" className="text-base font-semibold text-foreground sm:text-lg">
              {data?.managerName || data?.teamName || t("historyLoading")}
            </h2>
            {data ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.teamName}
                {data.overallPoints != null ? ` · ${data.overallPoints} pts` : ""}
                {data.overallRank != null
                  ? ` · ${t("historyOverall", { n: data.overallRank.toLocaleString() })}`
                  : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {t("historyClose")}
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("historyLoading")}</p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        {data && !loading ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("historyGw")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("historyPts")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("historyTotal")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("historyRank")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("historyTransfers")}</th>
                    <th className="px-3 py-2 font-medium">{t("historyChip")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.current.length ? (
                    [...data.current].reverse().map((row) => (
                      <tr key={row.event} className="border-t border-border/60">
                        <td className="px-3 py-2 tabular-nums">GW{row.event}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.points}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.total}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.overallRank != null ? row.overallRank.toLocaleString() : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {row.transfers != null ? row.transfers : "—"}
                          {row.hits != null && row.hits > 0 ? ` (−${row.hits})` : ""}
                        </td>
                        <td className="px-3 py-2 text-xs text-brand-accent">
                          {(chipsByEvent.get(row.event) ?? []).join(" · ") || "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-sm text-muted-foreground">
                        {t("historyEmpty")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {data.past.length ? (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("historyPast")}
                </h3>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                  {data.past.map((season) => (
                    <li key={season.season} className="flex justify-between gap-3">
                      <span>{season.season}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {season.points} pts · #{season.rank.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
