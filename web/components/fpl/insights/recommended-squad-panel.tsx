"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ExcludeChipPlayer,
  RecommendedSquadOption,
  RecommendedSquadPack,
  SquadGoal,
  SquadStyle,
} from "@/lib/fpl/recommended-squad";

const STORAGE_KEY = "fpl-recommended-squad-constraints-v1";

type StoredConstraints = {
  style: SquadStyle;
  goal: SquadGoal;
  excludeIds: number[];
};

const STYLES: SquadStyle[] = [
  "template",
  "balanced",
  "differential",
  "premium",
  "budget",
];

const GOALS: SquadGoal[] = ["gw1_5", "set_and_forget", "rank_chase"];

function Chip({
  active,
  onClick,
  children,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-brand-accent/50 bg-brand-accent/15 text-brand-accent"
          : "border-border bg-card/60 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground",
        disabled && "opacity-50",
      )}
    >
      {children}
    </button>
  );
}

function styleLabel(
  t: ReturnType<typeof useTranslations<"fplInsights">>,
  style: SquadStyle,
): string {
  switch (style) {
    case "template":
      return t("recommendedSquad.styleTemplate");
    case "differential":
      return t("recommendedSquad.styleDifferential");
    case "premium":
      return t("recommendedSquad.stylePremium");
    case "budget":
      return t("recommendedSquad.styleBudget");
    default:
      return t("recommendedSquad.styleBalanced");
  }
}

function goalLabel(
  t: ReturnType<typeof useTranslations<"fplInsights">>,
  goal: SquadGoal,
): string {
  switch (goal) {
    case "set_and_forget":
      return t("recommendedSquad.goalSetForget");
    case "rank_chase":
      return t("recommendedSquad.goalRankChase");
    default:
      return t("recommendedSquad.goalGw15");
  }
}

function OptionCard({
  option,
  locale,
  maxOwn,
}: {
  option: RecommendedSquadOption;
  locale: string;
  maxOwn: number;
}) {
  const t = useTranslations("fplInsights");
  const title = locale.startsWith("zh") ? option.label_zh : option.label_en;
  const why = locale.startsWith("zh") ? option.why_zh : option.why_en;
  const xi = option.starters;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4">
      <header className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">
          {option.formation} ·{" "}
          {t("recommendedSquad.metaSpend", {
            spend: option.spend_m.toFixed(1),
            bank: option.bank_m.toFixed(1),
          })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("recommendedSquad.metaOwn", {
            own: option.avg_ownership.toFixed(1),
            diffs: option.diff_count,
            maxOwn,
          })}{" "}
          ·{" "}
          {t("recommendedSquad.metaXp", { xp: option.xi_xp.toFixed(1) })} ·{" "}
          {t("recommendedSquad.captain", { name: option.captain.web_name })}
        </p>
      </header>

      <ul className="space-y-0.5 text-xs leading-snug text-foreground/90">
        {xi.map((p) => (
          <li key={p.fpl_id} className="flex justify-between gap-2">
            <span className="min-w-0 truncate">
              <span className="text-muted-foreground">{p.position}</span>{" "}
              {p.web_name}
              {p.is_captain ? " (C)" : p.is_vice ? " (V)" : ""}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              £{p.price.toFixed(1)} · {p.ownership.toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>

      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("recommendedSquad.whyTitle")}
        </p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {why.map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      </div>

      <Link
        href={option.builder_path}
        className={cn(
          buttonVariants({ variant: "primary", size: "sm" }),
          "mt-auto w-full no-underline",
        )}
      >
        {t("recommendedSquad.openBuilder")}
      </Link>
    </article>
  );
}

export function RecommendedSquadPanel({
  excludePlayers,
}: {
  excludePlayers: ExcludeChipPlayer[];
}) {
  const t = useTranslations("fplInsights");
  const locale = useLocale();
  const [style, setStyle] = useState<SquadStyle>("balanced");
  const [goal, setGoal] = useState<SquadGoal>("gw1_5");
  const [excludeIds, setExcludeIds] = useState<number[]>([]);
  const [pack, setPack] = useState<RecommendedSquadPack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as StoredConstraints;
      if (parsed.style) setStyle(parsed.style);
      if (parsed.goal) setGoal(parsed.goal);
      if (Array.isArray(parsed.excludeIds)) {
        setExcludeIds(parsed.excludeIds.filter((n) => Number.isFinite(n)));
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: StoredConstraints = { style, goal, excludeIds };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [style, goal, excludeIds, hydrated]);

  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  const toggleExclude = (id: number) => {
    setExcludeIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, 8),
    );
    setPack(null);
    setError(null);
  };

  const onGenerate = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/fpl/insights/recommended-squad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            style,
            goal,
            excludeIds,
            minDifferentials: style === "differential" ? 6 : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(
            typeof data?.error === "string"
              ? data.error
              : t("recommendedSquad.error"),
          );
          setPack(null);
          return;
        }
        setPack(data as RecommendedSquadPack);
      } catch {
        setError(t("recommendedSquad.error"));
        setPack(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("recommendedSquad.intro")}</p>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">
          {t("recommendedSquad.stepStyle")}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {STYLES.map((s) => (
            <Chip
              key={s}
              active={style === s}
              disabled={pending}
              onClick={() => {
                setStyle(s);
                setPack(null);
                setError(null);
              }}
            >
              {styleLabel(t, s)}
            </Chip>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">
          {t("recommendedSquad.stepExclude")}
        </h2>
        {excludePlayers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("recommendedSquad.emptyExclude")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {excludePlayers.map((p) => (
              <Chip
                key={p.fpl_id}
                active={excludeSet.has(p.fpl_id)}
                disabled={pending}
                onClick={() => toggleExclude(p.fpl_id)}
              >
                {p.web_name}
                <span className="ml-1 text-[10px] opacity-70">
                  {p.ownership.toFixed(0)}%
                </span>
              </Chip>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">
          {t("recommendedSquad.stepGoal")}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {GOALS.map((g) => (
            <Chip
              key={g}
              active={goal === g}
              disabled={pending}
              onClick={() => {
                setGoal(g);
                setPack(null);
                setError(null);
              }}
            >
              {goalLabel(t, g)}
            </Chip>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={pending}
          onClick={onGenerate}
        >
          {pending
            ? t("recommendedSquad.generating")
            : t("recommendedSquad.generate")}
        </Button>
        {pack ? (
          <p className="text-xs text-muted-foreground">
            {t("recommendedSquad.generatedOnce")}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("recommendedSquad.regenHint")}
          </p>
        )}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {pack ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t("recommendedSquad.resultTitle", {
              gw: pack.gw,
              horizon: pack.horizon,
            })}
          </h2>
          <div className="grid gap-4 lg:grid-cols-3">
            {pack.options.map((opt) => (
              <OptionCard
                key={opt.kind}
                option={opt}
                locale={locale}
                maxOwn={pack.differential_max_own}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
