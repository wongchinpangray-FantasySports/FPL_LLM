import { DEFAULT_THEME, type TeamTheme } from "@/lib/team-themes";

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "0, 255, 135";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 0;
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** UI accent — legible on dark app chrome when kit primary is white/yellow. */
function uiAccentColor(theme: TeamTheme): string {
  if (relativeLuminance(theme.primary) > 0.62) {
    if (relativeLuminance(theme.secondary) < 0.62) return theme.secondary;
    return theme.accent === theme.primary ? theme.secondary : theme.accent;
  }
  return theme.primary;
}

function hexToHslTriplet(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "152 100% 50%";
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return `0 0% ${Math.round(l * 100)}%`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = 0;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return `${Math.round(hue * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function isCustomTeamTheme(theme: TeamTheme): boolean {
  return theme.label !== DEFAULT_THEME.label;
}

export function applyTeamThemeToDocument(theme: TeamTheme | null): void {
  if (typeof document === "undefined") return;
  const t = theme ?? DEFAULT_THEME;
  const accent = uiAccentColor(t);
  const root = document.documentElement;
  const custom = isCustomTeamTheme(t);

  root.classList.toggle("team-themed", custom);
  if (custom) {
    root.dataset.teamLabel = t.label;
  } else {
    delete root.dataset.teamLabel;
  }

  root.style.setProperty("--brand-accent", accent);
  root.style.setProperty("--brand-accent-rgb", hexToRgb(accent));
  root.style.setProperty("--brand-accent-fg", t.accent);
  root.style.setProperty("--team-primary", t.primary);
  root.style.setProperty("--team-primary-rgb", hexToRgb(t.primary));
  root.style.setProperty("--team-secondary", t.secondary);
  root.style.setProperty("--team-secondary-rgb", hexToRgb(t.secondary));
  root.style.setProperty("--team-accent", t.accent);
  root.style.setProperty("--ring", hexToHslTriplet(accent));
}

export function clearTeamThemeOnDocument(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("team-themed");
  delete root.dataset.teamLabel;
  applyTeamThemeToDocument(DEFAULT_THEME);
}
