"use client";

import { NextIntlClientProvider } from "next-intl";
import zh from "../../messages/zh.json";

/**
 * Import messages as a static client chunk instead of serializing 90KB+ JSON
 * into every HTML RSC payload. On Workers Free, that payload was exceeding
 * CPU while streaming — homepage timed out at 45s with a few hundred bytes.
 */
export function LocaleMessagesProvider({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={zh}>
      {children}
    </NextIntlClientProvider>
  );
}
