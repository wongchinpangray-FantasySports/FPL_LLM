/** Proxy external news thumbnails through our API (hotlink / referrer blocks). */
export function proxiedNewsImageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return `/api/news/image?url=${encodeURIComponent(url.trim())}`;
}
