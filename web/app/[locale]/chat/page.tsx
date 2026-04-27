import { getTranslations } from "next-intl/server";
import { Chat } from "@/components/chat";
import { PageHeader } from "@/components/page-header";

export default async function ChatPage() {
  const t = await getTranslations("chat");

  return (
    <div className="mx-auto flex max-w-4xl flex-col">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <Chat />
    </div>
  );
}
