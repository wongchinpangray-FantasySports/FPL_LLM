"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { EntryIdForm } from "@/components/entry-id-form";
import { useEntryId } from "@/components/entry-id-context";
import { PageHeader } from "@/components/page-header";

export default function ManagerIndexPage() {
  const t = useTranslations("managerIndex");
  const router = useRouter();
  const { entryId } = useEntryId();

  useEffect(() => {
    if (entryId) {
      router.replace(`/manager/${entryId}`);
    }
  }, [entryId, router]);

  if (entryId) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center py-16 text-slate-400">
        <p className="text-sm">{t("opening")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <EntryIdForm redirectTo={(id) => `/manager/${id}`} />
    </div>
  );
}
