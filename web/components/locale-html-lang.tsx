"use client";

import { useEffect } from "react";

/** Syncs <html lang> with the active locale (root layout stays locale-agnostic). */
export function LocaleHtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = "zh-CN";
  }, [locale]);
  return null;
}
