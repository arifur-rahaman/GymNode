"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

/** Password field with a show/hide button (typing on a phone keyboard is error-prone). */
export function PasswordInput(props: Omit<React.ComponentProps<"input">, "type">) {
  const t = useTranslations("auth");
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-12" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 inline-flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-muted hover:text-text"
      >
        {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}
