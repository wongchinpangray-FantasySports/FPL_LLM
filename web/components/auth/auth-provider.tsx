"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { UserProfile } from "@/lib/auth/session";
import { useEntryId } from "@/components/entry-id-context";

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setEntryId } = useEntryId();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/account/me");
      if (!res.ok) {
        setUser(null);
        setProfile(null);
        setUnreadCount(0);
        return;
      }
      const data = (await res.json()) as {
        user: User | null;
        profile: UserProfile | null;
        unread_count: number;
      };
      setUser(data.user);
      setProfile(data.profile);
      setUnreadCount(data.unread_count ?? 0);
      if (data.profile?.fpl_entry_id != null) {
        setEntryId(String(data.profile.fpl_entry_id));
      }
    } catch {
      setUser(null);
      setProfile(null);
      setUnreadCount(0);
    }
  }, [setEntryId]);

  useEffect(() => {
    const supa = createSupabaseBrowserClient();
    void refresh().finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supa.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => subscription.unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    const supa = createSupabaseBrowserClient();
    await supa.auth.signOut();
    setUser(null);
    setProfile(null);
    setUnreadCount(0);
  }, []);

  const value = useMemo(
    () => ({ user, profile, unreadCount, loading, refresh, signOut }),
    [user, profile, unreadCount, loading, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
