"use client";

import { Suspense } from "react";
import { EntryIdProvider } from "./entry-id-context";
import { EntryIdQuerySync } from "./entry-id-query-sync";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <EntryIdProvider>
      <Suspense fallback={null}>
        <EntryIdQuerySync />
      </Suspense>
      {children}
    </EntryIdProvider>
  );
}
