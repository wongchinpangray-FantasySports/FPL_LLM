/** Authorised FFS Premium promo assets (public/scout/FFS Banners). */
export const FFS_PREMIUM_BANNER_DIR = "FFS Banners";

export const FFS_PREMIUM_BANNER_FILES = [
  "App Refresh.png",
  "Beat Mini League Rivals (5 Former Champs) (2).png",
  "MLM x FFS.png",
  "Rate My Team iPhone Mockup.png",
  "RMT Points Projections App.png",
  "RMT Points Projections.png",
  "RMT Projection Planner Mockup.png",
  "RMT Transfers.png",
  "Stats Centre (1).png",
  "Ultimate Guide (1080x1080).png",
  "Win at FPL with FFScout (1).png",
  "£50 Annual Promo.png",
] as const;

export type FfsPremiumBannerFile = (typeof FFS_PREMIUM_BANNER_FILES)[number];

export function ffsPremiumBannerSrc(filename: FfsPremiumBannerFile): string {
  return `/scout/${encodeURIComponent(FFS_PREMIUM_BANNER_DIR)}/${encodeURIComponent(filename)}`;
}

/** Stable index from pathname so each route keeps one banner while the set rotates evenly. */
export function ffsPremiumBannerIndex(pathname: string): number {
  const key = pathname.replace(/\/+$/, "") || "/";
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % FFS_PREMIUM_BANNER_FILES.length;
}

export function ffsPremiumBannerForPath(pathname: string): {
  filename: FfsPremiumBannerFile;
  src: string;
} {
  const filename = FFS_PREMIUM_BANNER_FILES[ffsPremiumBannerIndex(pathname)]!;
  return { filename, src: ffsPremiumBannerSrc(filename) };
}
