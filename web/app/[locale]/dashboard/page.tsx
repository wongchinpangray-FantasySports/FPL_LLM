"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PageShell } from "@/components/page-shell";
import { EntryIdForm } from "@/components/entry-id-form";
import { useEntryId } from "@/components/entry-id-context";

export default function DashboardIndexPage() {
  const t = useTranslations("dashboardIndex");
  const router = useRouter();
  const { entryId } = useEntryId();

  useEffect(() => {
    if (entryId) {
      router.replace(`/dashboard/${entryId}`);
    }
  }, [entryId, router]);

  if (entryId) {
    return (
      <PageShell width="2xl">
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <p className="text-sm">{t("opening")}</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      width="2xl"
    >
      <EntryIdForm redirectTo={(id) => `/dashboard/${id}`} />
    </PageShell>
  );
}
