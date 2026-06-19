"use client";

import { useEffect, useState } from "react";
import { MiniModal } from "./mini-modal";
import type { MiniPlayerDisplay } from "@/lib/mini/player-stats";

type PlayerHit = MiniPlayerDisplay;

export function MiniPlayerPicker({
  open,
  title,
  positionFilter,
  searchPlaceholder,
  searchingLabel,
  noResultsLabel,
  clearSlotLabel,
  onClose,
  onSelect,
  onClearSlot,
  showClear,
}: {
  open: boolean;
  title: string;
  positionFilter?: "GKP" | null;
  searchPlaceholder: string;
  searchingLabel: string;
  noResultsLabel: string;
  clearSlotLabel: string;
  onClose: () => void;
  onSelect: (player: PlayerHit) => void;
  onClearSlot?: () => void;
  showClear?: boolean;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQ("");
      setHits([]);
      return;
    }
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setHits([]);
      return;
    }
    const id = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const params = new URLSearchParams({ q: trimmed });
          if (positionFilter) params.set("position", positionFilter);
          const res = await fetch(`/api/planner/players?${params}`);
          const data = (await res.json()) as { players?: PlayerHit[] };
          setHits(data.players ?? []);
        } catch {
          setHits([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 220);
    return () => window.clearTimeout(id);
  }, [q, open, positionFilter]);

  return (
    <MiniModal
      open={open}
      title={title}
      onClose={onClose}
      actions={
        showClear && onClearSlot ? (
          <button
            type="button"
            className="mr-auto text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              onClearSlot();
              onClose();
            }}
          >
            {clearSlotLabel}
          </button>
        ) : undefined
      }
    >
      <input
        type="search"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={searchPlaceholder}
        className="mb-3 w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
      />
      {loading ? (
        <p className="text-xs text-muted-foreground">{searchingLabel}</p>
      ) : q.trim().length >= 2 && hits.length === 0 ? (
        <p className="text-xs text-muted-foreground">{noResultsLabel}</p>
      ) : (
        <ul className="max-h-[min(50vh,320px)] divide-y divide-white/10 overflow-y-auto rounded-lg border border-border">
          {hits.map((p) => (
            <li key={p.fpl_id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onSelect(p);
                  onClose();
                }}
              >
                <span className="text-foreground">
                  {p.web_name ?? `#${p.fpl_id}`}{" "}
                  <span className="text-muted-foreground">
                    {p.position} · {p.team}
                  </span>
                </span>
                <span className="shrink-0 text-muted-foreground">
                  £{p.base_price != null ? p.base_price.toFixed(1) : "—"}m
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </MiniModal>
  );
}
