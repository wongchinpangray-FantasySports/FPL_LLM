const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

export function randomShareCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += ALPHABET[b % ALPHABET.length];
  }
  return out;
}

export function isShareCode(value: string): boolean {
  return /^[a-z0-9]{6,16}$/.test(value);
}

const INSIGHT_PREFIX = "/fpl/insights";

export function inferShareKind(
  targetPath: string,
): import("./types").ShareKind | null {
  const path = targetPath.split("?")[0] ?? targetPath;
  if (path === `${INSIGHT_PREFIX}/price-forecast`) return "price_forecast";
  if (path === INSIGHT_PREFIX || path.startsWith(`${INSIGHT_PREFIX}/`)) {
    return "insight";
  }
  if (path === "/fpl/historical" || path.startsWith("/fpl/historical/")) {
    return "insight";
  }
  if (/^\/player\/\d+$/.test(path)) return "player";
  if (/^\/scout\/[a-z0-9-]+$/i.test(path)) return "scout_article";
  if (path === "/play/mini" || path.startsWith("/play/mini")) {
    return "mini_leaderboard";
  }
  return null;
}

export function isAllowedSharePath(targetPath: string): boolean {
  return inferShareKind(targetPath) != null;
}

export function normalizeSharePath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  const noHash = trimmed.split("#")[0] ?? trimmed;
  const url = new URL(noHash, "https://share.local");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (!isAllowedSharePath(path)) return null;
  return path;
}
