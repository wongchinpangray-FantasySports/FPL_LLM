"use client";

import { rewriteHtmlImagesToProxy, sanitizeScoutHtml } from "@/lib/scout/html";

export function ScoutArticleBody({
  html,
  baseUrl,
}: {
  html: string;
  baseUrl: string;
}) {
  const { html: safe } = sanitizeScoutHtml(html, { baseUrl });
  const proxied = rewriteHtmlImagesToProxy(safe);
  return (
    <div
      className="scout-article-body"
      dangerouslySetInnerHTML={{ __html: proxied }}
    />
  );
}
