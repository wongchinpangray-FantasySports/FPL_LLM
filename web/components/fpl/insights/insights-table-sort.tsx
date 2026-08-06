"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

export function useInsightsTableSort<K extends string>(
  defaultKey: K,
  defaultDir: SortDir = "desc",
) {
  const [sortKey, setSortKey] = useState<K>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const toggle = useCallback((key: K, preferredDir?: SortDir) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(preferredDir ?? "desc");
      return key;
    });
  }, []);

  const setSort = useCallback((key: K, dir: SortDir) => {
    setSortKey(key);
    setSortDir(dir);
  }, []);

  return { sortKey, sortDir, toggle, setSort };
}

function isEmptySortValue(v: string | number | null | undefined): boolean {
  if (v == null || v === "") return true;
  if (typeof v === "number" && !Number.isFinite(v)) return true;
  return false;
}

function comparePrimitive(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): number {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

export function sortInsightRows<T>(
  rows: T[],
  getValue: (row: T) => string | number | null | undefined,
  dir: SortDir,
): T[] {
  return [...rows].sort((a, b) => {
    const av = getValue(a);
    const bv = getValue(b);
    const aEmpty = isEmptySortValue(av);
    const bEmpty = isEmptySortValue(bv);
    // Always park "—" / missing values at the bottom (asc or desc).
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    const cmp = comparePrimitive(av, bv);
    return dir === "asc" ? cmp : -cmp;
  });
}

export function InsightsSortableTh({
  label,
  active,
  dir,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onSort: () => void;
  align?: "left" | "right";
  className?: string;
}) {
  const t = useTranslations("fplInsights");
  const aria = active
    ? dir === "asc"
      ? t("table.sortedAsc")
      : t("table.sortedDesc")
    : t("table.sortColumn", { column: label });

  return (
    <th
      className={cn(
        "px-3 py-2",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      <button
        type="button"
        onClick={onSort}
        aria-label={aria}
        className={cn(
          "group inline-flex max-w-full items-center gap-1 rounded-md px-0.5 py-0.5 text-xs font-semibold uppercase tracking-wider transition-colors",
          align === "right" ? "ml-auto flex-row-reverse" : "",
          active
            ? "text-brand-accent"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="truncate">{label}</span>
        <span
          className={cn(
            "shrink-0 text-[10px] tabular-nums leading-none",
            active
              ? "text-brand-accent"
              : "text-muted-foreground/50 group-hover:text-muted-foreground",
          )}
          aria-hidden
        >
          {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    </th>
  );
}
