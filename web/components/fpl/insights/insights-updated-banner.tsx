import type { InsightsMeta } from "@/lib/fpl/insights/types";

function formatWhen(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(locale === "zh" ? "zh-CN" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function InsightsUpdatedBanner({
  meta,
  locale,
  labels,
}: {
  meta: InsightsMeta;
  locale: string;
  labels: {
    gwOpen: string;
    gwClosed: string;
    synced: string;
  };
}) {
  const gw = meta.nextGw ?? meta.currentGw;
  const status =
    meta.submissionOpen && gw != null
      ? labels.gwOpen
          .replace("{gw}", String(gw))
          .replace("{deadline}", formatWhen(meta.deadlineTime, locale))
      : labels.gwClosed.replace("{gw}", gw != null ? String(gw) : "—");

  return (
    <div className="rounded-xl border border-border bg-card/50 px-4 py-3 text-sm text-foreground/80">
      <p>{status}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {labels.synced
          .replace("{season}", meta.seasonLabel)
          .replace("{time}", formatWhen(meta.updatedAt, locale))}
      </p>
    </div>
  );
}
