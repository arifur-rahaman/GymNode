import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

const TONE = {
  trial: "blue",
  active: "green",
  past_due: "amber",
  suspended: "gray",
  cancelled: "red",
} as const;

/** Gym subscription status (SA-Gyms.dc.html): ট্রায়াল / সক্রিয় / বিল বকেয়া / স্থগিত / বাতিল. */
export function GymStatusBadge({ status }: { status: string }) {
  const t = useTranslations("gymStatus");
  const key = (status in TONE ? status : "active") as keyof typeof TONE;
  return <Badge tone={TONE[key]}>{t(key)}</Badge>;
}
