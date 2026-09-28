export type FplTenure = "new" | "mid" | "vet";
export type FplIntent = "guide" | "stats" | "planner" | "mini" | "pro";

export type FplScreen = {
  tenure: FplTenure;
  intent: FplIntent;
};

export const FPL_SCREEN_KEY = "faleague_fpl_screen_v1";
export const FPL_SCREEN_DISMISS_KEY = "faleague_fpl_screen_v1_dismissed";

export function isFplNewbie(tenure: FplTenure): boolean {
  return tenure === "new";
}

export function defaultIntentFor(tenure: FplTenure): FplIntent {
  return tenure === "new" ? "guide" : "planner";
}

export function destinationFor(screen: FplScreen): {
  href: string;
  needsAuth: boolean;
} {
  switch (screen.intent) {
    case "guide":
      return { href: "/fpl/guide", needsAuth: false };
    case "stats":
      return { href: "/fpl/insights", needsAuth: false };
    case "planner":
      return { href: "/planner", needsAuth: true };
    case "mini":
      return { href: "/fpl/mini-league", needsAuth: true };
    case "pro":
      return { href: "/pro", needsAuth: false };
  }
}

export function menuPathKey(intent: FplIntent): string {
  switch (intent) {
    case "guide":
      return "pathGuide";
    case "stats":
      return "pathStats";
    case "planner":
      return "pathPlanner";
    case "mini":
      return "pathMini";
    case "pro":
      return "pathPro";
  }
}

export function readFplScreen(): FplScreen | null {
  try {
    const raw = localStorage.getItem(FPL_SCREEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FplScreen>;
    if (
      parsed.tenure !== "new" &&
      parsed.tenure !== "mid" &&
      parsed.tenure !== "vet"
    ) {
      return null;
    }
    if (
      parsed.intent !== "guide" &&
      parsed.intent !== "stats" &&
      parsed.intent !== "planner" &&
      parsed.intent !== "mini" &&
      parsed.intent !== "pro"
    ) {
      return null;
    }
    return { tenure: parsed.tenure, intent: parsed.intent };
  } catch {
    return null;
  }
}

export function writeFplScreen(screen: FplScreen): void {
  try {
    localStorage.setItem(FPL_SCREEN_KEY, JSON.stringify(screen));
  } catch {
    /* private browsing */
  }
}

export function isFplScreenDismissed(): boolean {
  try {
    return localStorage.getItem(FPL_SCREEN_DISMISS_KEY) === "1";
  } catch {
    return true;
  }
}

export function dismissFplScreen(): void {
  try {
    localStorage.setItem(FPL_SCREEN_DISMISS_KEY, "1");
  } catch {
    /* private browsing */
  }
}
