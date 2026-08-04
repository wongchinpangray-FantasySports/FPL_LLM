import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { withIsolateCache } from "@/lib/worker-isolate-cache";

async function loadMessages(locale: string) {
  return withIsolateCache(`intl-messages:${locale}`, 3_600_000, async () => {
    return (await import(`../messages/${locale}.json`)).default;
  });
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale =
    requested &&
    (routing.locales as readonly string[]).includes(requested)
      ? requested
      : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
