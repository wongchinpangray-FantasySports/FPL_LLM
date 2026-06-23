import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { Chat } from "@/components/chat";

export default async function ChatPage() {
  const t = await getTranslations("chat");

  return (
    <PageShell
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      width="4xl"
    >
      <Chat />
    </PageShell>
  );
}
