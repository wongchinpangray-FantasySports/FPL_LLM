"use client";

import { useEffect, useState } from "react";
import { MiniModal } from "./mini-modal";
import type { MiniPitchPlayer } from "./mini-pitch";

type PlayerHit = MiniPitchPlayer & { team_id?: number | null };

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
            className="mr-auto text-sm text-slate-400 hover:text-white"
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
        className="mb-3 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
      />
      {loading ? (
        <p className="text-xs text-slate-500">{searchingLabel}</p>
      ) : q.trim().length >= 2 && hits.length === 0 ? (
        <p className="text-xs text-slate-500">{noResultsLabel}</p>
      ) : (
        <ul className="max-h-[min(50vh,320px)] divide-y divide-white/10 overflow-y-auto rounded-lg border border-white/10">
          {hits.map((p) => (
            <li key={p.fpl_id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-white/5"
                onClick={() => {
                  onSelect(p);
                  onClose();
                }}
              >
                <span className="text-white">
                  {p.web_name ?? p.name}{" "}
                  <span className="text-slate-500">
                    {p.position} · {p.team}
                  </span>
                </span>
                <span className="shrink-0 text-slate-500">
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
