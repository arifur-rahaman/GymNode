"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AddStaffForm } from "@/components/staff/add-staff-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "./actions";

type StaffRow = { id: string; display_name: string; role: string };

export function StaffStep({ gymId, staff }: { gymId: string; staff: StaffRow[] }) {
  const t = useTranslations("onboarding");
  const tr = useTranslations("roles");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[17px] font-bold">{t("staffTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("staffHint")}</p>
      </div>
      {staff.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-semibold">{s.display_name}</span>
              <Badge tone="gray">{tr(s.role as "manager")}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="rounded-lg border border-border bg-bg p-4">
        <AddStaffForm gymId={gymId} />
      </div>
      <div className="flex flex-wrap justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href="/onboarding?step=packages">{t("back")}</Link>
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={pending}
          onClick={() => startTransition(async () => void (await completeOnboarding(gymId)))}
        >
          {t("finish")}
        </Button>
      </div>
    </div>
  );
}
