"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { wcTeamFlagSrc } from "@/lib/wc/wc-team-flags";

export function WcFlag({
  code,
  size = 20,
  className,
  title,
}: {
  code: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = wcTeamFlagSrc(code, Math.max(20, size * 2));
  const label = title ?? code;

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label}
        width={size}
        height={Math.round(size * 0.75)}
        title={label}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn("inline-block shrink-0 rounded-sm object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm bg-muted text-[9px] font-bold uppercase text-muted-foreground",
        className,
      )}
      style={{ width: size, height: Math.round(size * 0.75) }}
      title={label}
    >
      {code.slice(0, 3)}
    </span>
  );
}
