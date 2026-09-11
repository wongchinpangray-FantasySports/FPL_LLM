"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type {
  ProSubProgress,
  ProSubSku,
  ProSubStatus,
  ProSubscriptionRow,
} from "@/lib/billing/pro-subscriptions-shared";
import {
  PRO_SUB_STATUSES,
  skuLabelZh,
} from "@/lib/billing/pro-subscriptions-shared";
import type { ProSampleFunnel } from "@/lib/billing/pro-sample-funnel";

function fmtWhen(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const STATUS_STYLE: Record<ProSubStatus, string> = {
  lead: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  contacted: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  paid: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  fulfilled: "border-brand-accent/40 bg-brand-accent/10 text-brand-accent",
  lost: "border-border bg-muted text-muted-foreground",
};

export function AdminProSubscriptionsPanel({ locale }: { locale: string }) {
  const t = useTranslations("adminPro");
  const [rows, setRows] = useState<ProSubscriptionRow[]>([]);
  const [progress, setProgress] = useState<ProSubProgress | null>(null);
  const [sampleFunnel, setSampleFunnel] = useState<ProSampleFunnel | null>(
    null,
  );
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProSubStatus | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const [addOpen, setAddOpen] = useState(false);
  const [addWechat, setAddWechat] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addSku, setAddSku] = useState<ProSubSku>("founder_pack");
  const [addSaving, setAddSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pro-subscriptions");
      const data = (await res.json()) as {
        rows?: ProSubscriptionRow[];
        progress?: ProSubProgress;
        sampleFunnel?: ProSampleFunnel;
        tableMissing?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("loadError"));
      setRows(data.rows ?? []);
      setProgress(data.progress ?? null);
      setSampleFunnel(data.sampleFunnel ?? null);
      setTableMissing(Boolean(data.tableMissing));
      const drafts: Record<string, string> = {};
      for (const r of data.rows ?? []) {
        drafts[r.id] = r.notes ?? "";
      }
      setNoteDraft(drafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  async function patchRow(
    id: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pro-subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        row?: ProSubscriptionRow;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("saveError"));
      if (data.row) {
        setRows((prev) => prev.map((r) => (r.id === id ? data.row! : r)));
        setNoteDraft((d) => ({ ...d, [id]: data.row!.notes ?? "" }));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveError"));
    } finally {
      setBusyId(null);
    }
  }

  async function addManual(): Promise<void> {
    setAddSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pro-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wechatId: addWechat,
          email: addEmail,
          sku: addSku,
          source: "manual",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("saveError"));
      setAddOpen(false);
      setAddWechat("");
      setAddEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveError"));
    } finally {
      setAddSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{t("summary")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("pipelineHint")}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            {t("addManual")}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            {t("refresh")}
          </button>
        </div>
      </div>

      {tableMissing ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {t("needMigration")}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {progress ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label={t("kpiYen")} value={`¥${progress.yenCollected}`} hint={t("kpiYenHint", { n: progress.payers })} />
          <Kpi label={t("kpiPipeline")} value={`¥${progress.yenPipeline}`} hint={t("kpiPipelineHint")} />
          <Kpi label={t("kpiLeads7d")} value={String(progress.leads7d)} hint={t("kpiPaid7d", { n: progress.paid7d })} />
          <Kpi
            label={t("kpiOpen")}
            value={String(progress.byStatus.lead + progress.byStatus.contacted)}
            hint={t("kpiOpenHint", {
              lead: progress.byStatus.lead,
              contacted: progress.byStatus.contacted,
            })}
          />
        </div>
      ) : null}

      {sampleFunnel?.tableMissing ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {t("sampleNeedMigration")}
        </p>
      ) : null}

      {sampleFunnel && !sampleFunnel.tableMissing ? (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("sampleFunnelTitle")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t("sampleFunnelHint")}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label={t("kpiSampleClicks")}
              value={String(sampleFunnel.clicks)}
              hint={t("kpiSampleClicksHint", {
                html: sampleFunnel.htmlClicks,
                pdf: sampleFunnel.pdfClicks,
              })}
            />
            <Kpi
              label={t("kpiSampleVisitors")}
              value={String(sampleFunnel.uniqueVisitors)}
              hint={t("kpiSampleSkuHint", {
                a: sampleFunnel.aClicks,
                b: sampleFunnel.bClicks,
              })}
            />
            <Kpi
              label={t("kpiSampleToLead")}
              value={
                sampleFunnel.sampleToLeadRate == null
                  ? "—"
                  : `${sampleFunnel.sampleToLeadRate}%`
              }
              hint={t("kpiSampleToLeadHint")}
            />
            <Kpi
              label={t("kpiSampleToPaid")}
              value={
                sampleFunnel.sampleToPaidRate == null
                  ? "—"
                  : `${sampleFunnel.sampleToPaidRate}%`
              }
              hint={t("kpiSampleToPaidHint")}
            />
          </div>
          <div className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {sampleFunnel.bySample.map((b) => (
              <div
                key={b.key}
                className="rounded-lg border border-border/80 bg-background/60 px-2.5 py-2"
              >
                <p className="text-[11px] font-medium text-foreground">{b.label}</p>
                <p className="mt-0.5 text-sm tabular-nums text-foreground">
                  {b.clicks}
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    {t("sampleClickUnit")}
                  </span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {t("sampleVisitorUnit", { n: b.visitors })}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="mb-2 text-xs font-medium text-foreground">{t("addTitle")}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              placeholder={t("colWechat")}
              value={addWechat}
              onChange={(e) => setAddWechat(e.target.value)}
            />
            <input
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              placeholder={t("colEmail")}
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
            />
            <select
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              value={addSku}
              onChange={(e) => setAddSku(e.target.value as ProSubSku)}
            >
              <option value="gw_note">{skuLabelZh("gw_note")}</option>
              <option value="founder_pack">{skuLabelZh("founder_pack")}</option>
              <option value="addon">{skuLabelZh("addon")}</option>
              <option value="other">{skuLabelZh("other")}</option>
            </select>
          </div>
          <button
            type="button"
            disabled={addSaving}
            onClick={() => void addManual()}
            className="mt-2 rounded-lg bg-brand-accent px-3 py-1.5 text-xs font-semibold text-brand-ink disabled:opacity-50"
          >
            {addSaving ? t("saving") : t("saveAdd")}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label={t("filterAll", { n: rows.length })}
        />
        {PRO_SUB_STATUSES.map((s) => (
          <FilterChip
            key={s}
            active={filter === s}
            onClick={() => setFilter(s)}
            label={`${t(`status.${s}`)} ${progress?.byStatus[s] ?? 0}`}
          />
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">{t("colWhen")}</th>
                <th className="px-3 py-2">{t("colWechat")}</th>
                <th className="px-3 py-2">{t("colEmail")}</th>
                <th className="px-3 py-2">{t("colSku")}</th>
                <th className="px-3 py-2">{t("colStatus")}</th>
                <th className="px-3 py-2">{t("colNotes")}</th>
                <th className="px-3 py-2">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const busy = busyId === row.id;
                return (
                  <tr key={row.id} className="border-b border-border/70 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {fmtWhen(row.created_at, locale)}
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {row.wechat_id}
                      {row.needs_signup ? (
                        <span className="mt-0.5 block text-[10px] text-amber-300">
                          {t("needsSignup")}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.email}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div>{skuLabelZh(row.sku)}</div>
                      <div className="text-xs text-muted-foreground">
                        ¥{row.amount_collected_cny ?? row.price_cny}
                        {row.notes_delivered > 0
                          ? ` · ${t("delivered", { n: row.notes_delivered })}`
                          : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                          STATUS_STYLE[row.status],
                        )}
                      >
                        {t(`status.${row.status}`)}
                      </span>
                    </td>
                    <td className="min-w-[12rem] px-3 py-2">
                      <textarea
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                        rows={2}
                        value={noteDraft[row.id] ?? ""}
                        onChange={(e) =>
                          setNoteDraft((d) => ({ ...d, [row.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        disabled={busy}
                        className="mt-1 text-[10px] text-brand-accent hover:underline disabled:opacity-50"
                        onClick={() =>
                          void patchRow(row.id, {
                            notes: noteDraft[row.id] ?? "",
                          })
                        }
                      >
                        {t("saveNotes")}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        {row.status === "lead" ? (
                          <ActionBtn
                            disabled={busy}
                            onClick={() =>
                              void patchRow(row.id, { status: "contacted" })
                            }
                            label={t("markContacted")}
                          />
                        ) : null}
                        {row.status === "lead" || row.status === "contacted" ? (
                          <ActionBtn
                            disabled={busy}
                            onClick={() =>
                              void patchRow(row.id, { status: "paid" })
                            }
                            label={t("markPaid")}
                          />
                        ) : null}
                        {row.status !== "fulfilled" && row.status !== "lost" ? (
                          <ActionBtn
                            disabled={busy}
                            onClick={() =>
                              void patchRow(row.id, {
                                status: "fulfilled",
                                grantPremium: row.sku === "founder_pack",
                                notes_delivered:
                                  row.notes_delivered > 0
                                    ? row.notes_delivered
                                    : 1,
                              })
                            }
                            label={t("markFulfilled")}
                          />
                        ) : null}
                        {row.status === "fulfilled" &&
                        row.sku === "founder_pack" ? (
                          <ActionBtn
                            disabled={busy}
                            onClick={() =>
                              void patchRow(row.id, {
                                notes_delivered: row.notes_delivered + 1,
                              })
                            }
                            label={t("incDelivered")}
                          />
                        ) : null}
                        {row.status !== "lost" && row.status !== "fulfilled" ? (
                          <ActionBtn
                            disabled={busy}
                            tone="muted"
                            onClick={() =>
                              void patchRow(row.id, { status: "lost" })
                            }
                            label={t("markLost")}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium",
        active
          ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "muted";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-[10px] font-medium disabled:opacity-50",
        tone === "muted"
          ? "border-border text-muted-foreground hover:bg-muted"
          : "border-brand-accent/30 text-brand-accent hover:bg-brand-accent/10",
      )}
    >
      {label}
    </button>
  );
}
