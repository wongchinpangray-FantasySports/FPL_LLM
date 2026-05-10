"use client";

import { useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { FplChipPlay, FplHistoryCurrentRow } from "@/lib/fpl";

function formatItbTenths(bank: number | undefined): string {
  if (bank == null || Number.isNaN(bank)) return "—";
  return `£${(bank / 10).toFixed(1)}m`;
}

function chipDisplayLabel(
  raw: string,
  t: ReturnType<typeof useTranslations<"managerPage">>,
): string {
  const id = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
  if (id === "wildcard" || id === "wc") return t("gwHistoryChipWildcard");
  if (id === "freehit" || id === "ff") return t("gwHistoryChipFreeHit");
  if (
    id === "bboost" ||
    id === "benchboost" ||
    (id.includes("bench") && id.includes("boost"))
  ) {
    return t("gwHistoryChipBenchBoost");
  }
  if (id === "3xc" || id.includes("triplecaptain")) {
    return t("gwHistoryChipTripleCaptain");
  }
  return t("gwHistoryChipOther", { name: raw.trim() || raw });
}

function chipsByEventMap(
  chips: Pick<FplChipPlay, "event" | "name">[],
): Map<number, string[]> {
  const m = new Map<number, string[]>();
  for (const c of chips) {
    const list = m.get(c.event) ?? [];
    list.push(c.name);
    m.set(c.event, list);
  }
  return m;
}

export function ManagerGameweekHistory({
  rows,
  chipsPlayed,
}: {
  rows: FplHistoryCurrentRow[];
  chipsPlayed: Pick<FplChipPlay, "event" | "name">[];
}) {
  const t = useTranslations("managerPage");
  const dialogRef = useRef<HTMLDialogElement>(null);

  const chipNamesByEvent = useMemo(
    () => chipsByEventMap(chipsPlayed),
    [chipsPlayed],
  );

  if (rows.length === 0) return null;

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="shrink-0 border-white/15"
        onClick={() => dialogRef.current?.showModal()}
      >
        {t("gwHistoryButton")}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="manager-gw-history-title"
        className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none bg-transparent p-3 sm:p-4 [&::backdrop]:bg-black/75 [&:not([open])]:hidden [&[open]]:flex [&[open]]:items-center [&[open]]:justify-center"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div
          className="flex max-h-[min(85vh,720px)] w-[min(96vw,640px)] flex-col overflow-hidden rounded-xl border border-white/[0.12] bg-[rgb(15,12,22)] text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative z-30 flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] bg-[rgb(15,12,22)] px-4 py-3 sm:px-5">
            <h3 id="manager-gw-history-title" className="text-sm font-semibold text-white">
              {t("gwHistoryTitle")}
            </h3>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              onClick={() => dialogRef.current?.close()}
            >
              {t("gwHistoryClose")}
            </button>
          </div>
          <div className="relative isolate min-h-0 flex-1 overflow-auto px-3 pb-4 pt-2 sm:px-5">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-20">
                <tr className="border-b border-white/10 bg-[rgb(15,12,22)] text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="bg-[rgb(15,12,22)] py-2 pr-3 font-medium">{t("gwHistoryColGw")}</th>
                  <th className="bg-[rgb(15,12,22)] py-2 pr-3 font-medium">{t("gwHistoryColPts")}</th>
                  <th className="bg-[rgb(15,12,22)] py-2 pr-3 font-medium">{t("gwHistoryColOr")}</th>
                  <th className="bg-[rgb(15,12,22)] py-2 pr-3 font-medium">{t("gwHistoryColItb")}</th>
                  <th className="bg-[rgb(15,12,22)] py-2 font-medium">{t("gwHistoryColChips")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const prev = i > 0 ? rows[i - 1]!.overall_rank : null;
                  const cur = r.overall_rank;
                  const improved = prev != null && cur < prev;
                  const dropped = prev != null && cur > prev;

                  const rawChips = chipNamesByEvent.get(r.event) ?? [];
                  const chipsLabel =
                    rawChips.length === 0
                      ? "—"
                      : rawChips.map((name) => chipDisplayLabel(name, t)).join(", ");

                  return (
                    <tr
                      key={r.event}
                      className="border-t border-white/[0.06] text-slate-200"
                    >
                      <td className="py-2 pr-3 tabular-nums text-white">
                        {t("chartAxisGwTick", { gw: String(r.event) })}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{r.points}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          {cur.toLocaleString()}
                          {improved ? (
                            <span
                              className="text-emerald-400"
                              title={t("gwHistoryRankUp")}
                              aria-label={t("gwHistoryRankUp")}
                            >
                              ↑
                            </span>
                          ) : null}
                          {dropped ? (
                            <span
                              className="text-rose-400"
                              title={t("gwHistoryRankDown")}
                              aria-label={t("gwHistoryRankDown")}
                            >
                              ↓
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-slate-300">
                        {formatItbTenths(r.bank)}
                      </td>
                      <td className="max-w-[140px] py-2 text-xs leading-snug text-slate-300 sm:max-w-[180px]">
                        {chipsLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </dialog>
    </>
  );
}
