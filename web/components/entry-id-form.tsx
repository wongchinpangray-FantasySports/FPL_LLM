"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useEntryId } from "./entry-id-context";

export { useEntryId } from "./entry-id-context";

export function EntryIdForm({
  redirectTo = "/chat",
}: {
  /** After save: open this path. Use a function for e.g. `/planner/123` without a query. */
  redirectTo?: string | ((entryId: string) => string);
}) {
  const router = useRouter();
  const { entryId, setEntryId } = useEntryId();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (entryId) setValue(entryId);
  }, [entryId]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return;
    setEntryId(trimmed);
    if (typeof redirectTo === "function") {
      router.push(redirectTo(trimmed));
    } else {
      const sep = redirectTo.includes("?") ? "&" : "?";
      router.push(
        `${redirectTo}${sep}entry=${encodeURIComponent(trimmed)}`,
      );
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[200px] max-w-xs flex-1 flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Entry ID
          </span>
          <Input
            inputMode="numeric"
            pattern="\d*"
            placeholder="e.g. 1234567"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Continue</Button>
          {entryId && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/dashboard/${entryId}`)}
            >
              View dashboard
            </Button>
          )}
          {entryId && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/planner/${entryId}`)}
            >
              Planner
            </Button>
          )}
          {entryId && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEntryId(null);
                setValue("");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
