import type { SharePreview } from "@/lib/share/types";

export function SharePreviewCard({
  preview,
  locked,
  labels,
}: {
  preview: SharePreview;
  locked?: boolean;
  labels: {
    lockedHint: string;
  };
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <div className={locked ? "pointer-events-none select-none blur-[2px] opacity-50" : ""}>
        <div className="border-b border-border px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
            FALEAGUE
          </p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">{preview.title}</h1>
          {preview.subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{preview.subtitle}</p>
          ) : null}
        </div>
        {preview.items.length > 0 ? (
          <ul className="divide-y divide-border/60">
            {preview.items.map((item, i) => (
              <li
                key={`${item.label}-${i}`}
                className="flex items-start justify-between gap-3 px-4 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  {item.hint ? (
                    <p className="text-xs text-muted-foreground">{item.hint}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-sm tabular-nums text-brand-accent">
                  {item.value}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">{labels.lockedHint}</p>
        )}
      </div>
      {locked ? (
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background/90" />
      ) : null}
    </div>
  );
}
