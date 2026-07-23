"use client";

import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useSignupPrompt } from "@/components/auth/signup-prompt-context";
import { isFplNewsPath } from "@/lib/auth/fpl-news-gate";
import { useTranslations } from "next-intl";

type GatedLinkProps = ComponentProps<typeof Link>;

export function GatedLink({ href, onClick, ...props }: GatedLinkProps) {
  const path = typeof href === "string" ? href : (href.pathname ?? "");
  const { user, loading } = useAuth();
  const { openSignupPrompt } = useSignupPrompt();
  const t = useTranslations("signupPrompt");

  if (!isFplNewsPath(path)) {
    return <Link href={href} onClick={onClick} {...props} />;
  }

  return (
    <Link
      href={href}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || loading || user) return;
        event.preventDefault();
        openSignupPrompt({
          title: t("fplNewsTitle"),
          body: t("fplNewsBody"),
        });
      }}
    />
  );
}
