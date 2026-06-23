"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

function HubTile({
  href,
  title,
  description,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl border p-4 no-underline transition-colors",
        accent
          ? "border-brand-accent/30 bg-brand-accent/5 hover:bg-brand-accent/10"
          : "border-border bg-card hover:border-brand-accent/25 hover:bg-muted/50",
      )}
    >
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

export function PlayHub() {
  const t = useTranslations("playHub");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <HubTile
        href="/play/mini"
        title={t("miniFplTitle")}
        description={t("miniFplBody")}
        accent
      />
      <HubTile
        href="/play/wc-mini"
        title={t("miniWcTitle")}
        description={t("miniWcBody")}
        accent
      />
    </div>
  );
}
