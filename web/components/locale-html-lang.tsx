"use client";

import { useEffect } from "react";

/** Syncs <html lang> with the active locale (root layout stays locale-agnostic). */
export function LocaleHtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);
  return null;
}
