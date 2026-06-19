import { getTranslations } from "next-intl/server";
import { InboxPanel } from "@/components/inbox/inbox-panel";

export default async function InboxPage() {
  const t = await getTranslations("inbox");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
      <InboxPanel />
    </div>
  );
}
