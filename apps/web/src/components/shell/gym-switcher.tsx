"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setActiveGym } from "@/app/app/_actions/active-gym";
import { NativeSelect } from "@/components/ui/native-select";

/** Shown only when the user works in more than one gym. */
export function GymSwitcher({
  gyms,
  activeGymId,
}: {
  gyms: { id: string; name: string }[];
  activeGymId: string;
}) {
  const t = useTranslations("shell");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (gyms.length < 2) return null;
  return (
    <label className="flex flex-col gap-1">
      <span className="sr-only">{t("switchGym")}</span>
      <NativeSelect
        value={activeGymId}
        disabled={pending}
        className="h-10 text-sm"
        onChange={(e) =>
          startTransition(async () => {
            await setActiveGym(e.target.value);
            router.refresh();
          })
        }
      >
        {gyms.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
