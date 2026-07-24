import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InboxPanel } from "@/components/inbox/inbox-panel";

export default async function InboxPage() {
  const t = await getTranslations("inbox");
  const common = await getTranslations("common");

  return (
    <PageShell
      backHref="/"
      backLabel={common("backHome")}
      title={t("title")}
      width="4xl"
    >
      <InboxPanel />
    </PageShell>
  );
}
