"use client";

import type { PlannerPickPayload } from "@/components/planner/types";
import { cn } from "@/lib/utils";
import { isFilledPick } from "@/lib/squad-builder/slots";

type ProjRow = {
  xp_next_gw?: number;
};

export function SquadBuilderListView({
  picks,
  captainId,
  viceId,
  projById,
  selectedSlot,
  onSelectSlot,
  labels,
}: {
  picks: PlannerPickPayload[];
  captainId: number | null;
  viceId: number | null;
  projById: Record<string, ProjRow>;
  selectedSlot: number | null;
  onSelectSlot: (slot: number) => void;
  labels: {
    colName: string;
    colOwn: string;
    colPrice: string;
    colPts: string;
    colXpts: string;
    colXi: string;
    emptyPlayer: string;
  };
}) {
  const rows = [...picks].sort((a, b) => a.slot - b.slot);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/50">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5">{labels.colName}</th>
              <th className="px-2 py-2.5 text-right">{labels.colOwn}</th>
              <th className="px-2 py-2.5 text-right">{labels.colPrice}</th>
              <th className="px-2 py-2.5 text-right">{labels.colPts}</th>
              <th className="px-2 py-2.5 text-right">{labels.colXpts}</th>
              <th className="px-2 py-2.5 text-center">{labels.colXi}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const filled = isFilledPick(p);
              const pr = filled ? projById[String(p.fpl_id)] : undefined;
              const isC = captainId === p.fpl_id;
              const isV = viceId === p.fpl_id;
              return (
                <tr
                  key={p.slot}
                  className={cn(
                    "cursor-pointer border-b border-border/40 transition-colors hover:bg-muted/30",
                    selectedSlot === p.slot && "bg-brand-accent/10",
                  )}
                  onClick={() => onSelectSlot(p.slot)}
                >
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {p.slot}
                      </span>
                      <span className="font-medium text-foreground">
                        {filled ? p.web_name : labels.emptyPlayer}
                      </span>
                      {filled ? (
                        <span className="text-xs text-muted-foreground">
                          {p.team} · {p.position}
                        </span>
                      ) : null}
                      {isC ? <Badge>C</Badge> : null}
                      {isV && !isC ? <Badge>V</Badge> : null}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                    –
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {filled && p.base_price != null
                      ? `£${p.base_price.toFixed(1)}m`
                      : "–"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                    –
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-brand-accent">
                    {pr?.xp_next_gw != null
                      ? pr.xp_next_gw.toFixed(1)
                      : "–"}
                  </td>
                  <td className="px-2 py-2 text-center text-xs">
                    {p.is_starter ? "XI" : "BN"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-brand-accent/20 px-1 text-[10px] font-bold text-brand-accent">
      {children}
    </span>
  );
}
