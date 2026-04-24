"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

const KEY = "fpl_entry_id";
/** Same-tab: `storage` does not fire for own `setItem` updates. */
const LOCAL_EVENT = "fpl-entry-id-changed";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) onStoreChange();
  };
  const onLocal = () => onStoreChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(LOCAL_EVENT, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOCAL_EVENT, onLocal);
  };
}

function getSnapshot() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot() {
  return null;
}

const EntryIdContext = createContext<{
  entryId: string | null;
  setEntryId: (v: string | null) => void;
} | null>(null);

export function EntryIdProvider({ children }: { children: React.ReactNode }) {
  const entryId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setEntryId = useCallback((v: string | null) => {
    if (typeof window === "undefined") return;
    try {
      if (v) window.localStorage.setItem(KEY, v);
      else window.localStorage.removeItem(KEY);
    } catch {
      /* empty */
    }
    try {
      window.dispatchEvent(new Event(LOCAL_EVENT));
    } catch {
      /* empty */
    }
  }, []);

  const value = useMemo(
    () => ({ entryId, setEntryId }),
    [entryId, setEntryId],
  );

  return (
    <EntryIdContext.Provider value={value}>{children}</EntryIdContext.Provider>
  );
}

export function useEntryId() {
  const ctx = useContext(EntryIdContext);
  if (!ctx) {
    throw new Error("useEntryId must be used within EntryIdProvider");
  }
  return ctx;
}
