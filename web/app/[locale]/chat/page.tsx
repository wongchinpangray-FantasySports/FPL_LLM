import { redirect } from "@/i18n/navigation";

/** AI chat is not ready for launch — keep route but hide from product UI. */
export default async function ChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/", locale });
}
