"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useEntryId } from "@/components/entry-id-context";

type Props = {
  initialEntryId?: number | null;
  onSaved?: (entryId: number) => void;
};

export function FplEntryLinkForm({ initialEntryId, onSaved }: Props) {
  const t = useTranslations("account");
  const router = useRouter();
  const { setEntryId } = useEntryId();
  const [value, setValue] = useState(
    initialEntryId != null ? String(initialEntryId) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(initialEntryId ?? null);

  async function save() {
    const n = Number(value.trim());
    if (!Number.isFinite(n) || n <= 0) {
      setError(t("fplEntryInvalid"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/account/fpl-entry", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fpl_entry_id: n }),
      });
      const data = (await res.json()) as { error?: string; fpl_entry_id?: number };
      if (!res.ok) throw new Error(data.error ?? t("fplEntrySaveFailed"));
      setSaved(n);
      setEntryId(String(n));
      onSaved?.(n);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("fplEntrySaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-foreground">
        {t("fplEntry")}
      </label>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("fplEntryHint")}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("fplEntryPlaceholder")}
          className="min-w-[10rem] flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        />
        <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? t("fplEntrySaving") : t("fplEntrySave")}
        </Button>
      </div>
      {saved != null ? (
        <p className="text-xs text-brand-accent">{t("fplEntryLinked", { id: saved })}</p>
      ) : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
