"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { proxiedNewsImageUrl } from "@/lib/news-image";

export function NewsThumb({
  imageUrl,
  outlet,
  className,
  size = 64,
}: {
  imageUrl: string | null | undefined;
  outlet: string;
  className?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const proxied = proxiedNewsImageUrl(imageUrl);
  const show = Boolean(proxied) && !failed;

  if (show) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={proxied!}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn("shrink-0 rounded-lg object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-semibold uppercase text-muted-foreground",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {outlet.slice(0, 3)}
    </div>
  );
}
