/**
 * Pentagon radar chart for five 0–100 scores — server or client SVG.
 */

function vertsFromValues(
  values: number[],
  cx: number,
  cy: number,
  rMax: number,
) {
  const n = values.length;
  return values.map((v, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const rr = (Math.min(100, Math.max(0, v)) / 100) * rMax;
    return {
      x: cx + rr * Math.cos(angle),
      y: cy + rr * Math.sin(angle),
      angle,
      lx: cx + (rMax + 28) * Math.cos(angle),
      ly: cy + (rMax + 28) * Math.sin(angle),
    };
  });
}

export function WcRadarChart({
  values,
  labels,
  caption,
  compare,
}: {
  values: number[];
  labels: string[];
  caption: string;
  compare?: { values: number[]; name: string };
}) {
  const n = values.length;
  const cx = 130;
  const cy = 130;
  const rMax = 82;
  const r50 = rMax * 0.5;

  const verts = vertsFromValues(values, cx, cy, rMax);
  const poly = verts.map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(" ");

  const compareVerts = compare
    ? vertsFromValues(compare.values, cx, cy, rMax)
    : null;
  const comparePoly = compareVerts
    ? compareVerts.map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(" ")
    : "";

  const ring = (r: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(" ");

  const aria =
    compare != null ? `${caption} · ${compare.name}` : caption;

  return (
    <figure className="flex flex-col items-center gap-2">
      <svg
        viewBox="0 0 260 260"
        className="h-64 w-full max-w-[280px] text-muted-foreground"
        role="img"
        aria-label={aria}
      >
        <polygon
          points={ring(rMax)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={1}
        />
        <polygon
          points={ring(r50)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
        {verts.map((v, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + rMax * Math.cos(v.angle)}
            y2={cy + rMax * Math.sin(v.angle)}
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={1}
          />
        ))}
        {compareVerts ? (
          <polygon
            points={comparePoly}
            fill="rgba(250, 204, 21, 0.22)"
            stroke="rgb(234, 179, 8)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        ) : null}
        <polygon
          points={poly}
          fill="rgba(0,255,135,0.18)"
          stroke="rgb(0,255,135)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {compareVerts
          ? compareVerts.map((v, i) => (
              <circle
                key={`c2-${i}`}
                cx={v.x}
                cy={v.y}
                r={3}
                fill="rgb(234, 179, 8)"
              />
            ))
          : null}
        {verts.map((v, i) => (
          <circle
            key={`d-${i}`}
            cx={v.x}
            cy={v.y}
            r={3.5}
            className="fill-brand-accent"
          />
        ))}
        {labels.map((label, i) => (
          <text
            key={label}
            x={verts[i]!.lx}
            y={verts[i]!.ly}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-slate-300"
            style={{ fontSize: 10 }}
          >
            {label}
          </text>
        ))}
      </svg>
      <figcaption className="max-w-xs text-center text-[11px] leading-relaxed text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}
