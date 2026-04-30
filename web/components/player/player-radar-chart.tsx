/**
 * Hexagon (radar) chart for six 0–100 scores — server-rendered SVG.
 */
export function PlayerRadarChart({
  values,
  labels,
  caption,
}: {
  values: [number, number, number, number, number, number];
  labels: [string, string, string, string, string, string];
  caption: string;
}) {
  const n = 6;
  const cx = 130;
  const cy = 130;
  const rMax = 82;
  const r50 = rMax * 0.5;

  const verts = values.map((v, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const rr = (Math.min(100, Math.max(0, v)) / 100) * rMax;
    return {
      x: cx + rr * Math.cos(angle),
      y: cy + rr * Math.sin(angle),
      angle,
      lx: cx + (rMax + 26) * Math.cos(angle),
      ly: cy + (rMax + 26) * Math.sin(angle),
    };
  });

  const poly = verts.map((v) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(" ");

  const ring = (r: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(" ");

  return (
    <figure className="flex flex-col items-center gap-2">
      <svg
        viewBox="0 0 260 260"
        className="h-64 w-full max-w-[280px] text-slate-400"
        role="img"
        aria-label={caption}
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
        <polygon
          points={poly}
          fill="rgba(0,255,135,0.18)"
          stroke="rgb(0,255,135)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
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
      <figcaption className="max-w-xs text-center text-[11px] leading-relaxed text-slate-500">
        {caption}
      </figcaption>
    </figure>
  );
}
