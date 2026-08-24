import { resolveWechatCardSiteUrl } from "@/lib/fpl/wechat-daily-card";
import type { ShareKind, SharePreview } from "@/lib/share/types";

export function shareSiteOrigin(): string {
  return resolveWechatCardSiteUrl();
}

export function shareKindEyebrow(kind: ShareKind): string {
  switch (kind) {
    case "price_forecast":
      return "PRICE WATCH";
    case "player":
      return "PLAYER CARD";
    case "scout_article":
      return "FFS SCOUT";
    case "mini_leaderboard":
      return "MINI 5";
    case "manager":
      return "FPL RANK";
    default:
      return "FPL INSIGHT";
  }
}

export function shareOgTitle(preview: SharePreview): string {
  const title = preview.title.trim() || "FALEAGUE";
  return title.includes("FALEAGUE") ? title : `${title} · FALEAGUE`;
}

export function shareOgDescription(preview: SharePreview): string {
  const rows = preview.items.slice(0, 4).map((item) => {
    if (preview.kind === "scout_article") return item.value.trim();
    return `${item.label} ${item.value}`.trim();
  });
  const parts = [preview.subtitle, ...rows].filter(Boolean);
  const text = parts.join(" · ").replace(/\s+/g, " ").trim();
  if (!text) return "打开 FALEAGUE 查看完整内容";
  return text.length > 110 ? `${text.slice(0, 107)}…` : text;
}

export function shareCardImagePath(code: string): string {
  return `/api/share/${code}/card.png?v=2`;
}

export function sharePagePath(code: string): string {
  return `/s/${code}?v=og2`;
}
