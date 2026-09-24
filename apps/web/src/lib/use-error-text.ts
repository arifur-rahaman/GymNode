"use client";

import { useTranslations } from "next-intl";

/** Turns an error code from @gymnode/core schemas or Server Actions into text. */
export function useErrorText() {
  const t = useTranslations("errors");
  return (code?: string | null) => {
    if (!code) return undefined;
    return t.has(code) ? t(code) : t("unknown");
  };
}
