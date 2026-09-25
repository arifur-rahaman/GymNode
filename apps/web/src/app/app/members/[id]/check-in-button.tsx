"use client";

import { useState, useTransition } from "react";
import { LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { checkInMember } from "@/app/app/checkin-actions";
import { Button } from "@/components/ui/button";
import { useErrorText } from "@/lib/use-error-text";

/** Manual check-in from the profile; owner/manager may let a blocked member in (audited). */
export function CheckInButton({
  memberId,
  name,
  canOverride,
}: {
  memberId: string;
  name: string;
  canOverride: boolean;
}) {
  const t = useTranslations("dashboard");
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const [blocked, setBlocked] = useState(false);

  const run = (override: boolean) =>
    startTransition(async () => {
      const res = await checkInMember(memberId, override);
      if (!res.ok) return void toast.error(errorText(res.formError));
      if (res.data!.result === "allowed") {
        toast.success(t("checkedIn", { name }));
        setBlocked(false);
      } else {
        toast.error(
          t("checkInBlocked", {
            name,
            reason: t(`reason_${res.data!.reason}` as "reason_expired"),
          }),
        );
        setBlocked(true);
      }
    });

  return blocked && canOverride ? (
    <Button variant="danger" disabled={pending} onClick={() => run(true)}>
      {t("override")}
    </Button>
  ) : (
    <Button variant="secondary" disabled={pending} onClick={() => run(false)}>
      <LogIn /> {t("checkIn")}
    </Button>
  );
}
