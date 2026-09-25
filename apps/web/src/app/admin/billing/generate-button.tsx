"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { generateInvoices } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/lib/use-error-text";

/** Creates this month's invoice for every paying gym that doesn't have one yet. */
export function GenerateInvoices({ month }: { month: string }) {
  const t = useTranslations("billing");
  const errorText = useErrorText();
  const [value, setValue] = useState(month);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="gen-month">
        {t("month")}
      </label>
      <Input
        id="gen-month"
        type="month"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="num h-11 w-40"
      />
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await generateInvoices(value);
            if (res.ok) toast.success(t("generated", { count: String(res.data?.count ?? 0) }));
            else toast.error(errorText(res.formError));
          })
        }
      >
        {t("generate")}
      </Button>
    </div>
  );
}
