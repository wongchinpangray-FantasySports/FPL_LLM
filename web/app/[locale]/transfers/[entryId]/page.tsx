import { redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy /transfers/{id} → Planner hub with suggestions open. */
export default async function TransfersRedirectPage({
  params,
}: {
  params: { locale: string; entryId: string };
}) {
  const resolved = await Promise.resolve(params);
  const entryId = Number(resolved.entryId);
  if (!Number.isFinite(entryId) || entryId <= 0) notFound();

  redirect({
    href: `/planner/${entryId}?suggest=1`,
    locale: resolved.locale,
  });
}
