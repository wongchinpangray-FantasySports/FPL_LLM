"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

type ClubOption = { id: number; name: string; short_name: string };

type Props = {
  initialShort?: string | null;
  onSaved?: (club: ClubOption) => void;
};

export function FplClubSelectForm({ initialShort, onSaved }: Props) {
  const t = useTranslations("account");
  const { refresh } = useAuth();
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [selected, setSelected] = useState(initialShort ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/account/onboarding-options")
      .then((r) => r.json())
      .then((d: { fpl_teams?: ClubOption[] }) => setClubs(d.fpl_teams ?? []))
      .catch(() => setError(t("fplClubLoadError")));
  }, [t]);

  useEffect(() => {
    setSelected(initialShort ?? "");
  }, [initialShort]);

  async function save() {
    if (!selected) {
      setError(t("fplClubRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/account/fpl-club", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fpl_team_short_name: selected }),
      });
      const data = (await res.json()) as {
        error?: string;
        fpl_club?: ClubOption;
      };
      if (!res.ok) throw new Error(data.error ?? t("fplClubSaveFailed"));
      if (data.fpl_club) onSaved?.(data.fpl_club);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("fplClubSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-foreground">
        {t("fplClub")}
      </label>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("fplClubHint")}
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="min-w-[12rem] flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="">{t("notSet")}</option>
          {clubs.map((club) => (
            <option key={club.short_name} value={club.short_name}>
              {club.name}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" disabled={saving || !selected} onClick={() => void save()}>
          {saving ? t("fplClubSaving") : t("fplClubSave")}
        </Button>
      </div>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
