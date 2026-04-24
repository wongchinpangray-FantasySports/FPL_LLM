"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EntryIdForm } from "@/components/entry-id-form";
import { useEntryId } from "@/components/entry-id-context";
import { PageHeader } from "@/components/page-header";

export default function PlannerIndexPage() {
  const router = useRouter();
  const { entryId } = useEntryId();

  useEffect(() => {
    if (entryId) {
      router.replace(`/planner/${entryId}`);
    }
  }, [entryId, router]);

  if (entryId) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center py-16 text-slate-400">
        <p className="text-sm">Opening your planner…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <PageHeader
        eyebrow="Planner"
        title="Squad planner"
        description="Enter your FPL Entry ID to work with your team in the planner. Each browser and each Vercel URL keeps its own copy — re-enter on a new link if Planner looked missing."
      />
      <EntryIdForm redirectTo={(id) => `/planner/${id}`} />
    </div>
  );
}
