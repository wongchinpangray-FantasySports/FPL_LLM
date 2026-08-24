"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type {
  MiniLeagueRivalCompare,
  MiniLeagueSquadPick,
} from "@/lib/fpl/mini-league/types";

function PlayerName({
  fplId,
  name,
  onInspect,
}: {
  fplId: number;
  name: string;
  onInspect?: (fplId: number) => void;
}) {
  if (!onInspect) {
    return <span className="font-medium text-foreground">{name}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onInspect(fplId)}
      className="font-medium text-foreground hover:text-brand-accent"
    >
      {name}
    </button>
  );
}

function PickRow({
  pick,
  labels,
  onInspect,
}: {
  pick: MiniLeagueSquadPick;
  labels: { c: string; v: string };
  onInspect?: (fplId: number) => void;
}) {
  const meta = [pick.team, pick.position, pick.fixture].filter(Boolean).join(" · ");
  return (
    <li className="flex items-baseline justify-between gap-2 text-sm">
      <span className="min-w-0">
        <PlayerName fplId={pick.fplId} name={pick.webName} onInspect={onInspect} />
        {pick.captain ? (
          <span className="ml-1 text-[10px] font-semibold text-brand-accent">{labels.c}</span>
        ) : null}
        {pick.vice ? (
          <span className="ml-1 text-[10px] font-semibold text-muted-foreground">{labels.v}</span>
        ) : null}
        {meta ? (
          <span className="ml-1.5 text-xs text-muted-foreground"> {meta}</span>
        ) : null}
      </span>
      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
        {pick.xp != null ? `${pick.xp.toFixed(1)} xP` : "—"}
      </span>
    </li>
  );
}

export function RivalSquadDialog({
  open,
  data,
  loading,
  error,
  onClose,
  onInspectPlayer,
}: {
  open: boolean;
  data: MiniLeagueRivalCompare | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onInspectPlayer?: (fplId: number) => void;
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

  const starters = data?.rival.picks.filter((p) => p.starter) ?? [];
  const bench = data?.rival.picks.filter((p) => !p.starter) ?? [];
  const isYou = data != null && data.you.entry === data.rival.entry;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rival-squad-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label={t("rivalClose")}
        onClick={onClose}
      />
      <div className="relative z-[101] max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-xl border border-border bg-background p-5 shadow-2xl sm:rounded-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-brand-accent">
              {t("rivalEyebrow", { gw: data?.gw ?? "—" })}
            </p>
            <h2 id="rival-squad-title" className="text-base font-semibold text-foreground sm:text-lg">
              {data?.rival.teamName ?? t("rivalLoading")}
            </h2>
            {data ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.rival.managerName}
                {data.rival.points != null ? ` · ${data.rival.points} pts` : ""}
                {data.pointsGap != null && !isYou
                  ? ` · ${t("rivalGap", { n: data.pointsGap })}`
                  : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {t("rivalClose")}
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("rivalLoading")}</p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        {data && !loading ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("rivalStarters")}
                </h3>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {starters.map((pick) => (
                    <PickRow
                      key={pick.fplId}
                      pick={pick}
                      labels={{ c: t("rivalCap"), v: t("rivalVice") }}
                      onInspect={onInspectPlayer}
                    />
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("rivalBench")}
                </h3>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {bench.map((pick) => (
                    <PickRow
                      key={pick.fplId}
                      pick={pick}
                      labels={{ c: t("rivalCap"), v: t("rivalVice") }}
                      onInspect={onInspectPlayer}
                    />
                  ))}
                </ul>
              </section>
            </div>

            {!isYou ? (
              <section>
                <h3 className="text-sm font-semibold">{t("rivalDiffTitle")}</h3>
                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/70 bg-card/40 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {t("rivalDiffTheirs")}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {data.theyHaveYouDont.length ? (
                        data.theyHaveYouDont.map((p) => (
                          <li key={p.fplId} className="flex justify-between gap-2 text-sm">
                            <span className="min-w-0">
                              <PlayerName
                                fplId={p.fplId}
                                name={p.webName}
                                onInspect={onInspectPlayer}
                              />
                              {p.fixture ? (
                                <span className="ml-1.5 text-xs text-muted-foreground">{p.fixture}</span>
                              ) : null}
                            </span>
                            <span className="tabular-nums text-xs text-muted-foreground">
                              {p.xp != null ? `${p.xp.toFixed(1)} xP` : "—"}
                            </span>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-muted-foreground">{t("rivalTheyHaveEmpty")}</li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-card/40 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {t("rivalDiffYours")}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {data.youHaveTheyDont.length ? (
                        data.youHaveTheyDont.map((p) => (
                          <li key={p.fplId} className="flex justify-between gap-2 text-sm">
                            <span className="min-w-0">
                              <PlayerName
                                fplId={p.fplId}
                                name={p.webName}
                                onInspect={onInspectPlayer}
                              />
                              {p.fixture ? (
                                <span className="ml-1.5 text-xs text-muted-foreground">{p.fixture}</span>
                              ) : null}
                            </span>
                            <span className="tabular-nums text-xs text-muted-foreground">
                              {p.xp != null ? `${p.xp.toFixed(1)} xP` : "—"}
                            </span>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-muted-foreground">{t("rivalYouHaveEmpty")}</li>
                      )}
                    </ul>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function RivalNameButton({
  name,
  onClick,
  className,
}: {
  name: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left font-medium text-foreground underline decoration-border underline-offset-2 hover:text-brand-accent hover:decoration-brand-accent",
        className,
      )}
    >
      {name}
    </button>
  );
}
