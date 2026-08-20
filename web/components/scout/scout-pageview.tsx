"use client";

import { useEffect } from "react";

export function ScoutPageview({
  articleId,
  slug,
}: {
  articleId: string;
  slug: string;
}) {
  useEffect(() => {
    void fetch("/api/scout/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "pageview",
        article_id: articleId,
        slug,
        path: window.location.pathname,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [articleId, slug]);
  return null;
}
