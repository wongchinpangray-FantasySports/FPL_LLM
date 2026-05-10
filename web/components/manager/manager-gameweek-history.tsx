"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { FplHistoryCurrentRow } from "@/lib/fpl";

function formatItbTenths(bank: number | undefined): string {
  if (bank == null || Number.isNaN(bank)) return "—";
  return `£${(bank / 10).toFixed(1)}m`;
}

export function ManagerGameweekHistory({
  rows,
}: {
  rows: FplHistoryCurrentRow[];
}) {
  const t = useTranslations("managerPage");
  const dialogRef = useRef<HTMLDialogElement>(null);

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
        className="fixed left-1/2 top-1/2 z-50 max-h-[min(85vh,720px)] w-[min(96vw,560px)] max-w-none -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/[0.12] bg-[rgb(15,12,22)] p-0 text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)] [&::backdrop]:bg-black/75"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="flex max-h-[min(85vh,720px)] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-5">
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
          <div className="min-h-0 flex-1 overflow-auto px-3 pb-4 pt-2 sm:px-5">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[rgb(15,12,22)]">
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">{t("gwHistoryColGw")}</th>
                  <th className="py-2 pr-3 font-medium">{t("gwHistoryColPts")}</th>
                  <th className="py-2 pr-3 font-medium">{t("gwHistoryColOr")}</th>
                  <th className="py-2 font-medium">{t("gwHistoryColItb")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.event}
                    className="border-t border-white/[0.06] text-slate-200"
                  >
                    <td className="py-2 pr-3 tabular-nums text-white">
                      {t("chartAxisGwTick", { gw: String(r.event) })}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{r.points}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {r.overall_rank.toLocaleString()}
                    </td>
                    <td className="py-2 tabular-nums text-slate-300">
                      {formatItbTenths(r.bank)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </dialog>
    </>
  );
}
