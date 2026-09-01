"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  DiagnoseResult,
  DiagnosisItem,
  TransferSuggestion,
} from "@/lib/transfers/diagnose";

function fmtMoney(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}£${Math.abs(n).toFixed(1)}m`;
}

export function DiagnosisRow({
  item,
  onSelect,
}: {
  item: DiagnosisItem;
  onSelect?: (fplId: number) => void;
}) {
  const t = useTranslations("transfers");
  const tone =
    item.severity === "alert"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
      : item.severity === "watch"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
        : "border-border bg-card/40 text-foreground";

  return (
    <li
      className={cn(
        "flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm",
        tone,
        onSelect ? "cursor-pointer transition-colors hover:border-brand-accent/40" : null,
      )}
      onClick={onSelect ? () => onSelect(item.fpl_id) : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(item.fpl_id);
              }
            }
          : undefined
      }
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className="min-w-0">
        <p className="font-medium">
          <Link
            href={`/player/${item.fpl_id}`}
            className="text-inherit no-underline hover:text-brand-accent"
            onClick={(e) => e.stopPropagation()}
          >
            {item.web_name}
          </Link>
          <span className="ml-1.5 text-xs font-normal opacity-70">
            {item.team}
            {item.position ? ` · ${item.position}` : ""}
            {item.is_starter ? "" : ` · ${t("bench")}`}
          </span>
        </p>
        <p className="mt-0.5 text-xs opacity-90">
          {t(`kind_${item.kind}`)}
          {item.note ? ` · ${item.note}` : ""}
        </p>
      </div>
      {item.xp_horizon != null ? (
        <span className="shrink-0 tabular-nums text-xs opacity-80">
          xP {item.xp_horizon.toFixed(1)}
        </span>
      ) : null}
    </li>
  );
}

export function SuggestionCard({
  item,
  onApply,
  applyLabel,
}: {
  item: TransferSuggestion;
  onApply?: (item: TransferSuggestion) => void;
  applyLabel?: string;
}) {
  const t = useTranslations("transfers");
  const hit = item.hit_cost > 0;

  return (
    <article className="rounded-xl border border-border bg-card/40 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-400">
            {t("transferOut")}
          </p>
          <Link
            href={`/player/${item.out.fpl_id}`}
            className="mt-1 block text-base font-semibold text-foreground no-underline hover:text-brand-accent"
          >
            {item.out.web_name}
          </Link>
          <p className="text-xs text-muted-foreground">
            {item.out.team}
            {item.out.position ? ` · ${item.out.position}` : ""}
            {item.out.price != null ? ` · £${item.out.price.toFixed(1)}m` : ""}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {item.out_reasons.map((r) => t(`kind_${r}`)).join(" · ")}
          </p>
        </div>

        <div className="hidden text-center text-muted-foreground sm:block">→</div>

        <div className="sm:text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400">
            {t("transferIn")}
          </p>
          <Link
            href={`/player/${item.in.fpl_id}`}
            className="mt-1 block text-base font-semibold text-foreground no-underline hover:text-brand-accent"
          >
            {item.in.web_name}
          </Link>
          <p className="text-xs text-muted-foreground">
            {item.in.team}
            {item.in.position ? ` · ${item.in.position}` : ""}
            {item.in.price != null ? ` · £${item.in.price.toFixed(1)}m` : ""}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t(`inReason_${item.in_reason}`)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-xs">
        <span className="tabular-nums text-emerald-400">
          {t("xpDelta", { n: item.xp_delta.toFixed(1) })}
        </span>
        {hit ? (
          <span className="tabular-nums text-amber-300">
            {t("hitCost", { n: item.hit_cost })} ·{" "}
            {t("xpDeltaNet", { n: item.xp_delta_net.toFixed(1) })}
          </span>
        ) : (
          <span className="text-muted-foreground">{t("freeTransfer")}</span>
        )}
        <span className="tabular-nums text-muted-foreground">
          {t("spend", { n: fmtMoney(item.spend_m) })} ·{" "}
          {t("bankAfter", { n: item.bank_after.toFixed(1) })}
        </span>
        {onApply ? (
          <Button
            type="button"
            size="sm"
            className="ml-auto h-7 px-3 text-xs"
            onClick={() => onApply(item)}
          >
            {applyLabel ?? t("applyInPlanner")}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export type PlannerDiagnosePanelProps = {
  entryId: number;
  horizon: number;
  /** Suggestions target long-term (revert) 15 while viewing temp FH */
  viewingFreeHitSquad?: boolean;
  defaultExpanded?: boolean;
  onFocusPlayer?: (fplId: number) => void;
  onApplySuggestion?: (item: TransferSuggestion) => void;
  /** Auto-apply this pair once after diagnose loads */
  pendingApply?: { outId: number; inId: number } | null;
  onPendingApplyConsumed?: () => void;
  onDataLoaded?: (data: DiagnoseResult) => void;
};

export function PlannerDiagnosePanel({
  entryId,
  horizon,
  viewingFreeHitSquad = false,
  defaultExpanded = false,
  onFocusPlayer,
  onApplySuggestion,
  pendingApply = null,
  onPendingApplyConsumed,
  onDataLoaded,
}: PlannerDiagnosePanelProps) {
  const t = useTranslations("transfers");
  const [data, setData] = useState<DiagnoseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/transfers/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryId,
            horizon: Math.max(1, Math.min(8, horizon)),
            refresh,
          }),
        });
        const json = (await res.json()) as DiagnoseResult & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "failed");
        setData(json);
        onDataLoaded?.(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "failed");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [entryId, horizon, onDataLoaded],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (defaultExpanded) setExpanded(true);
  }, [defaultExpanded]);

  useEffect(() => {
    if (!data || !pendingApply || !onApplySuggestion) return;
    const match = data.suggestions.find(
      (s) =>
        s.out.fpl_id === pendingApply.outId &&
        s.in.fpl_id === pendingApply.inId,
    );
    if (match) {
      onApplySuggestion(match);
    }
    onPendingApplyConsumed?.();
    // Only react when diagnose payload / pending pair identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply handlers intentionally unstable
  }, [data, pendingApply?.outId, pendingApply?.inId]);

  return (
    <section className="rounded-xl border border-border bg-card/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            {t("diagnosisTitle")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {expanded ? t("suggestionsHint") : t("pitchMarkersHint")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={() => void load(true)}
          >
            {loading ? t("refreshing") : t("refresh")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? t("collapsePanel") : t("expandPanel")}
          </Button>
        </div>
      </div>

      {viewingFreeHitSquad ? (
        <p
          className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90"
          role="status"
        >
          {t("fhSuggestNote")}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg border border-border bg-muted/40"
            />
          ))}
        </div>
      ) : error ? (
        <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : data ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-md border border-border px-2 py-0.5">
              {t("metaGw", { gw: data.from_gw, to: data.to_gw })}
            </span>
            <span className="rounded-md border border-border px-2 py-0.5">
              {t("metaBank", { bank: data.bank.toFixed(1) })}
            </span>
            <span className="rounded-md border border-border px-2 py-0.5">
              {t("metaFt", { n: data.free_transfers })}
            </span>
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 font-medium",
                data.health_status === "alert"
                  ? "border-rose-500/40 text-rose-300"
                  : data.health_status === "watch"
                    ? "border-amber-500/40 text-amber-300"
                    : "border-emerald-500/40 text-emerald-300",
              )}
            >
              {t(`health_${data.health_status}`)}
            </span>
          </div>

          {expanded ? (
            <div className="mt-4 flex flex-col gap-5">
              <div>
                {data.diagnosis.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("diagnosisEmpty")}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.diagnosis.map((item, idx) => (
                      <DiagnosisRow
                        key={`${item.fpl_id}-${item.kind}-${idx}`}
                        item={item}
                        onSelect={onFocusPlayer}
                      />
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  {t("suggestionsTitle")}
                </h3>
                {data.suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("suggestionsEmpty")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {data.suggestions.map((s) => (
                      <SuggestionCard
                        key={`${s.out.fpl_id}-${s.in.fpl_id}`}
                        item={s}
                        onApply={onApplySuggestion}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : data.suggestions.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2">
              {data.suggestions.slice(0, 2).map((s) => (
                <SuggestionCard
                  key={`${s.out.fpl_id}-${s.in.fpl_id}`}
                  item={s}
                  onApply={onApplySuggestion}
                />
              ))}
              {data.suggestions.length > 2 ? (
                <button
                  type="button"
                  className="text-left text-xs font-medium text-brand-accent hover:underline"
                  onClick={() => setExpanded(true)}
                >
                  {t("showAllSuggestions", { n: data.suggestions.length })}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("suggestionsEmpty")}
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
