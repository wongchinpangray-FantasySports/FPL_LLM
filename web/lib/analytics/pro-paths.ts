/**
 * Lean navigation footscape: reconstruct sessions from site_events and
 * rank paths that reach /pro or a PRO sample open.
 */

export type JourneyEvent = {
  created_at: string;
  path: string;
  feature: string;
  visitor_id: string | null;
  event_type?: "pageview" | "pro_sample" | string;
};

export type ProNavPathStat = {
  /** Display string, e.g. "home → planner → pro" */
  path: string;
  sessions: number;
  visitors: number;
};

export type ProNavStepStat = {
  step: string;
  sessions: number;
};

export type ProNavStats = {
  sessions_to_pro: number;
  visitors_to_pro: number;
  top_paths: ProNavPathStat[];
  top_entries: ProNavStepStat[];
  top_before_pro: ProNavStepStat[];
};

const SESSION_GAP_MS = 30 * 60 * 1000;
const MAX_PATHS = 12;
const MAX_STEPS_SHOWN = 6;

export function emptyProNavStats(): ProNavStats {
  return {
    sessions_to_pro: 0,
    visitors_to_pro: 0,
    top_paths: [],
    top_entries: [],
    top_before_pro: [],
  };
}

/** Collapse noisy paths into short step labels for journey display. */
export function journeyStepLabel(row: JourneyEvent): string {
  const path = (row.path || "/").split("?")[0] || "/";
  if (row.event_type === "pro_sample" || path.startsWith("/pro/samples/")) {
    if (path.includes("-a-19") && path.endsWith(".html")) return "sample A · H5";
    if (path.includes("-a-19") && path.endsWith(".pdf")) return "sample A · PDF";
    if (path.includes("-b-49") && path.endsWith(".html")) return "sample B · H5";
    if (path.includes("-b-49") && path.endsWith(".pdf")) return "sample B · PDF";
    return "sample";
  }
  if (path === "/pro" || path.startsWith("/pro/")) return "pro";
  if (path === "/" || path === "") return "home";
  if (path.startsWith("/auth/")) return "auth";
  if (path.startsWith("/admin")) return "admin";

  const feature = row.feature || "other";
  if (feature === "home") return "home";
  if (feature === "pro") return "pro";
  if (feature === "other") {
    const short = path.length > 28 ? `${path.slice(0, 26)}…` : path;
    return short;
  }
  return feature.replace(/_/g, " ");
}

export function isProJourneyGoal(step: string): boolean {
  return step === "pro" || step.startsWith("sample");
}

function collapseSteps(steps: string[]): string[] {
  const out: string[] = [];
  for (const s of steps) {
    if (!s) continue;
    if (out.length === 0 || out[out.length - 1] !== s) out.push(s);
  }
  return out;
}

function shortenSteps(steps: string[]): string[] {
  if (steps.length <= MAX_STEPS_SHOWN) return steps;
  return [...steps.slice(0, 2), "…", ...steps.slice(-(MAX_STEPS_SHOWN - 3))];
}

function topN(
  counts: Map<string, { sessions: number; visitors: Set<string> }>,
  n: number,
): ProNavPathStat[] {
  return [...counts.entries()]
    .map(([path, v]) => ({
      path,
      sessions: v.sessions,
      visitors: v.visitors.size,
    }))
    .sort(
      (a, b) =>
        b.sessions - a.sessions ||
        b.visitors - a.visitors ||
        a.path.localeCompare(b.path),
    )
    .slice(0, n);
}

function topSteps(
  counts: Map<string, number>,
  n: number,
): ProNavStepStat[] {
  return [...counts.entries()]
    .map(([step, sessions]) => ({ step, sessions }))
    .sort(
      (a, b) => b.sessions - a.sessions || a.step.localeCompare(b.step),
    )
    .slice(0, n);
}

/**
 * Build PRO-oriented path stats from pageviews + pro_sample events.
 * Sessions split after 30 minutes idle; consecutive duplicate steps collapsed.
 */
export function computeProNavStats(events: JourneyEvent[]): ProNavStats {
  const byVisitor = new Map<string, JourneyEvent[]>();
  for (const row of events) {
    const vid = row.visitor_id?.trim();
    if (!vid) continue;
    const list = byVisitor.get(vid);
    if (list) list.push(row);
    else byVisitor.set(vid, [row]);
  }

  const pathCounts = new Map<
    string,
    { sessions: number; visitors: Set<string> }
  >();
  const entryCounts = new Map<string, number>();
  const beforeCounts = new Map<string, number>();
  const visitorsToPro = new Set<string>();
  let sessionsToPro = 0;

  for (const [visitorId, rows] of byVisitor) {
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at));

    let session: JourneyEvent[] = [];
    let lastTs = 0;

    const flush = () => {
      if (session.length === 0) return;
      const steps = collapseSteps(session.map(journeyStepLabel));
      const goalIdx = steps.findIndex(isProJourneyGoal);
      if (goalIdx < 0) {
        session = [];
        return;
      }
      sessionsToPro += 1;
      visitorsToPro.add(visitorId);

      const trimmed = shortenSteps(steps.slice(0, goalIdx + 1));
      const key = trimmed.join(" → ");
      let bucket = pathCounts.get(key);
      if (!bucket) {
        bucket = { sessions: 0, visitors: new Set() };
        pathCounts.set(key, bucket);
      }
      bucket.sessions += 1;
      bucket.visitors.add(visitorId);

      const entry = trimmed[0];
      if (entry && entry !== "…") {
        entryCounts.set(entry, (entryCounts.get(entry) ?? 0) + 1);
      }

      if (goalIdx > 0) {
        const before = steps[goalIdx - 1];
        if (before) {
          beforeCounts.set(before, (beforeCounts.get(before) ?? 0) + 1);
        }
      } else {
        beforeCounts.set("(direct)", (beforeCounts.get("(direct)") ?? 0) + 1);
      }
      session = [];
    };

    for (const row of rows) {
      const ts = Date.parse(row.created_at);
      if (
        session.length > 0 &&
        Number.isFinite(ts) &&
        Number.isFinite(lastTs) &&
        ts - lastTs > SESSION_GAP_MS
      ) {
        flush();
      }
      session.push(row);
      if (Number.isFinite(ts)) lastTs = ts;
    }
    flush();
  }

  return {
    sessions_to_pro: sessionsToPro,
    visitors_to_pro: visitorsToPro.size,
    top_paths: topN(pathCounts, MAX_PATHS),
    top_entries: topSteps(entryCounts, 8),
    top_before_pro: topSteps(beforeCounts, 8),
  };
}
