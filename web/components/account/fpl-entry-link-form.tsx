"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useEntryId } from "@/components/entry-id-context";
import { FplEntryConfirmField } from "@/components/fpl/fpl-entry-confirm-field";
import type { FplEntryPreview } from "@/lib/fpl/entry-preview";

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
  const [confirmed, setConfirmed] = useState<FplEntryPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(initialEntryId ?? null);

  const parsed = Number(value.trim());
  const unchangedLinked =
    saved != null &&
    Number.isFinite(parsed) &&
    parsed === saved &&
    confirmed == null;
  const canSave =
    confirmed != null && confirmed.entry_id === parsed && parsed > 0;

  async function save() {
    if (!canSave || confirmed == null) {
      setError(t("fplEntryConfirmRequired"));
      return;
    }
    const n = confirmed.entry_id;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/account/fpl-entry", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fpl_entry_id: n }),
      });
      const data = (await res.json()) as {
        error?: string;
        fpl_entry_id?: number;
      };
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
      <FplEntryConfirmField
        value={value}
        onChange={(next) => {
          setValue(next);
          if (saved != null && next.trim() !== String(saved)) {
            setSaved(null);
          }
        }}
        confirmed={confirmed}
        onConfirmedChange={(preview) => {
          setConfirmed(preview);
          setError(null);
        }}
        labels={{
          label: t("fplEntry"),
          hint: t("fplEntryHint"),
          placeholder: t("fplEntryPlaceholder"),
          lookup: t("fplEntryLookup"),
          lookingUp: t("fplEntryLookingUp"),
          confirmPrompt: t("fplEntryConfirmPrompt"),
          confirmed: t("fplEntryConfirmYes"),
          change: t("fplEntryChange"),
          invalid: t("fplEntryInvalid"),
          notFound: t("fplEntryNotFound"),
          lookupFailed: t("fplEntryLookupFailed"),
          teamLabel: t("fplEntryTeam"),
          managerLabel: t("fplEntryManager"),
        }}
      />
      {unchangedLinked ? (
        <p className="text-xs text-brand-accent">
          {t("fplEntryLinked", { id: saved })}
        </p>
      ) : (
        <Button
          type="button"
          size="sm"
          disabled={saving || !canSave}
          onClick={() => void save()}
        >
          {saving ? t("fplEntrySaving") : t("fplEntrySave")}
        </Button>
      )}
      {saved != null && confirmed?.entry_id === saved ? (
        <p className="text-xs text-brand-accent">
          {t("fplEntryLinked", { id: saved })}
          {confirmed.team_name ? ` · ${confirmed.team_name}` : ""}
        </p>
      ) : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
