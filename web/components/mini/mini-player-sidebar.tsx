"use client";

import { forwardRef, useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { minPlayerQueryLength } from "@/lib/fpl/player-search";
import type { MiniPlayerDisplay } from "@/lib/mini/player-stats";
import { miniPlayerIdentityKey } from "@/lib/mini/player-identity";
import { formatMiniNextFixture } from "@/lib/mini/fixtures";
import type { NextFixtureOpponent } from "@/lib/xp";

type SortKey = "form" | "points" | "ownership";

export const MiniPlayerSidebar = forwardRef<
  HTMLElement,
  {
    selectedSlot: number | null;
    slotLabel: string | null;
    excludeIdentities?: string[];
    miniOwnedById?: Record<number, number>;
    fixtureFromGw?: number | null;
    disabled?: boolean;
    onSelect: (player: MiniPlayerDisplay) => void;
    onClearSlot?: () => void;
    className?: string;
  }
>(function MiniPlayerSidebar(
  {
    selectedSlot,
    slotLabel,
    excludeIdentities = [],
    miniOwnedById,
    fixtureFromGw = null,
    disabled,
    onSelect,
    onClearSlot,
    className,
  },
  ref,
) {
  const t = useTranslations("mini");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [position, setPosition] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("form");
  const [players, setPlayers] = useState<MiniPlayerDisplay[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fixtureByFplId, setFixtureByFplId] = useState<
    Record<number, string | null>
  >({});

  const excluded = useMemo(() => new Set(excludeIdentities), [excludeIdentities]);

  const playerIdsKey = useMemo(
    () => players.map((p) => p.fpl_id).join(","),
    [players],
  );

  useEffect(() => {
    if (fixtureFromGw == null || players.length === 0) {
      setFixtureByFplId({});
      return;
    }
    const ids = players.map((p) => p.fpl_id).filter((id) => id > 0);
    if (ids.length === 0) {
      setFixtureByFplId({});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/planner/next-fixtures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerIds: ids, fromGw: fixtureFromGw }),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          nextByFplId?: Record<string, NextFixtureOpponent | null>;
        };
        const next: Record<number, string | null> = {};
        for (const id of ids) {
          next[id] = formatMiniNextFixture(data.nextByFplId?.[String(id)]);
        }
        if (!cancelled) setFixtureByFplId(next);
      } catch {
        if (!cancelled) setFixtureByFplId({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fixtureFromGw, playerIdsKey]);

  const effectivePosition = selectedSlot === 0 ? "GKP" : position;

  useEffect(() => {
    if (selectedSlot === 0) setPosition("GKP");
  }, [selectedSlot]);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort,
        limit: "120",
        locale,
      });
      const trimmed = q.trim();
      if (trimmed.length >= minPlayerQueryLength(trimmed)) {
        params.set("q", trimmed);
      }
      if (effectivePosition) params.set("position", effectivePosition);
      const res = await fetch(`/api/mini/players?${params}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        players?: MiniPlayerDisplay[];
        total?: number;
      };
      if (!res.ok) {
        setPlayers([]);
        setTotal(0);
        return;
      }
      const list = (data.players ?? []).filter(
        (p) => !excluded.has(miniPlayerIdentityKey(p)),
      );
      setPlayers(list);
      setTotal(typeof data.total === "number" ? data.total : list.length);
    } catch {
      setPlayers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [q, effectivePosition, sort, locale, excluded]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPlayers(), 200);
    return () => window.clearTimeout(timer);
  }, [loadPlayers]);

  const positions = [
    { value: "", label: t("sidebarPosAll") },
    { value: "GKP", label: t("sidebarPosGk") },
    { value: "DEF", label: t("sidebarPosDef") },
    { value: "MID", label: t("sidebarPosMid") },
    { value: "FWD", label: t("sidebarPosFwd") },
  ];

  return (
    <aside
      ref={ref}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4 lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-6rem)]",
        className,
      )}
    >
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          {t("sidebarTitle")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {selectedSlot != null && slotLabel
            ? t("sidebarSlotActive", { slot: slotLabel })
            : t("sidebarSlotHint")}
        </p>
        {!loading && total > 0 ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {t("sidebarResultCount", {
              shown: players.length,
              total,
            })}
          </p>
        ) : null}
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchPlaceholder")}
        disabled={disabled}
      />

      <div className="flex flex-wrap gap-1.5">
        {positions.map((pos) => (
          <button
            key={pos.value || "all"}
            type="button"
            disabled={disabled || (selectedSlot === 0 && pos.value !== "GKP")}
            onClick={() => setPosition(pos.value)}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
              effectivePosition === pos.value ||
                (pos.value === "" && effectivePosition === "")
                ? "bg-brand-accent/15 text-brand-accent ring-1 ring-brand-accent/35"
                : "bg-muted/50 text-muted-foreground hover:text-foreground",
              selectedSlot === 0 && pos.value !== "GKP" && "opacity-40",
            )}
          >
            {pos.label}
          </button>
        ))}
      </div>

      <select
        className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
        value={sort}
        disabled={disabled}
        onChange={(e) => setSort(e.target.value as SortKey)}
        aria-label={t("sidebarSortLabel")}
      >
        <option value="form">{t("sidebarSortForm")}</option>
        <option value="points">{t("sidebarSortPoints")}</option>
        <option value="ownership">{t("sidebarSortOwnership")}</option>
      </select>

      {selectedSlot != null && onClearSlot ? (
        <button
          type="button"
          className="text-left text-xs text-muted-foreground hover:text-foreground"
          onClick={onClearSlot}
        >
          {t("clearSlot")}
        </button>
      ) : null}

      <div className="scroll-table min-h-[280px] flex-1 rounded-lg border border-border/60 lg:min-h-0">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border text-[9px] uppercase text-muted-foreground">
              <th className="px-2 py-2 text-left">{t("sidebarColName")}</th>
              <th className="px-1 py-2 text-right">{t("cardForm")}</th>
              <th className="px-1 py-2 text-right">{t("cardSeasonPts")}</th>
              <th className="px-1 py-2 text-right">{t("cardMiniOwn")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && players.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-2 py-8 text-center text-muted-foreground"
                >
                  {t("loading")}
                </td>
              </tr>
            ) : players.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-2 py-8 text-center text-muted-foreground"
                >
                  {t("noResults")}
                </td>
              </tr>
            ) : (
              players.map((p) => {
                const miniOwn = miniOwnedById?.[p.fpl_id];
                const fixture = fixtureByFplId[p.fpl_id];
                return (
                  <tr
                    key={p.fpl_id}
                    className={cn(
                      "border-b border-border/40 transition-colors",
                      disabled
                        ? "cursor-not-allowed opacity-40"
                        : "cursor-pointer hover:bg-muted/40",
                    )}
                    onClick={() => {
                      if (!disabled) onSelect(p);
                    }}
                  >
                    <td className="px-2 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {p.web_name ?? `#${p.fpl_id}`}
                        </span>
                        {fixture ? (
                          <span className="shrink-0 text-[10px] font-semibold tabular-nums text-brand-accent/90">
                            {fixture}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {p.team} · {p.position}
                        {p.selected_by_percent != null
                          ? ` · FPL ${Number(p.selected_by_percent).toFixed(1)}%`
                          : ""}
                      </div>
                    </td>
                    <td className="px-1 py-2 text-right tabular-nums text-muted-foreground">
                      {p.form != null ? Number(p.form).toFixed(1) : "–"}
                    </td>
                    <td className="px-1 py-2 text-right tabular-nums">
                      {p.total_points != null ? p.total_points : "–"}
                    </td>
                    <td className="px-1 py-2 text-right tabular-nums text-brand-accent">
                      {miniOwn != null ? `${Math.round(miniOwn)}%` : "–"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </aside>
  );
});
