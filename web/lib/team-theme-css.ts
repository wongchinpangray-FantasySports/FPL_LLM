import { DEFAULT_THEME, type TeamTheme } from "@/lib/team-themes";

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "0, 255, 135";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function applyTeamThemeToDocument(theme: TeamTheme | null): void {
  if (typeof document === "undefined") return;
  const t = theme ?? DEFAULT_THEME;
  const root = document.documentElement;
  root.style.setProperty("--brand-accent", t.primary);
  root.style.setProperty("--brand-accent-rgb", hexToRgb(t.primary));
  root.style.setProperty("--team-primary", t.primary);
  root.style.setProperty("--team-secondary", t.secondary);
  root.style.setProperty("--team-accent", t.accent);
}

export function clearTeamThemeOnDocument(): void {
  applyTeamThemeToDocument(DEFAULT_THEME);
}
