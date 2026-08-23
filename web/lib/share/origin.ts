import { resolveWechatCardSiteUrl } from "@/lib/fpl/wechat-daily-card";

/** Public origin for short links / QR — request host in local/preview, production site otherwise. */
export function sharePublicOrigin(req: Request): string {
  const hostHeader = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const host = hostHeader?.split(",")[0]?.trim();
  if (!host) return resolveWechatCardSiteUrl();
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto =
    req.headers.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}
