"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EntryIdForm } from "@/components/entry-id-form";
import { useEntryId } from "@/components/entry-id-context";
import { PageHeader } from "@/components/page-header";

export default function DashboardIndexPage() {
  const router = useRouter();
  const { entryId } = useEntryId();

  useEffect(() => {
    if (entryId) {
      router.replace(`/dashboard/${entryId}`);
    }
  }, [entryId, router]);

  if (entryId) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center py-16 text-slate-400">
        <p className="text-sm">Opening your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <PageHeader
        eyebrow="Dashboard"
        title="Your FPL dashboard"
        description="Enter your FPL Entry ID to see squad stats for your team."
      />
      <EntryIdForm redirectTo={(id) => `/dashboard/${id}`} />
    </div>
  );
}
