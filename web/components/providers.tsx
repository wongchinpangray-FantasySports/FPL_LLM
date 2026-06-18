"use client";

import { Suspense } from "react";
import { EntryIdProvider } from "./entry-id-context";
import { EntryIdQuerySync } from "./entry-id-query-sync";
import { AuthProvider } from "./auth/auth-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <EntryIdProvider>
      <AuthProvider>
        <Suspense fallback={null}>
          <EntryIdQuerySync />
        </Suspense>
        {children}
      </AuthProvider>
    </EntryIdProvider>
  );
}
