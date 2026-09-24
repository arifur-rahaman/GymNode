import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { todayInDhaka } from "@gymnode/core";
import { MemberForm } from "@/components/members/member-form";
import { FRONT_DESK, gymPackages, gymTrainers, hasRole, requireGym } from "@/lib/gym-context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("memberForm");
  return { title: t("newTitle") };
}

export default async function NewMemberPage() {
  const t = await getTranslations("memberForm");
  const te = await getTranslations("errors");
  const membership = await requireGym();
  if (!hasRole(membership, FRONT_DESK)) return <p className="text-muted">{te("forbidden")}</p>;
  const [packages, trainers] = await Promise.all([
    gymPackages(membership.gymId),
    gymTrainers(membership.gymId),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("newTitle")}</h1>
      <MemberForm
        mode="create"
        gymId={membership.gymId}
        trainers={trainers}
        packages={packages}
        today={todayInDhaka()}
      />
    </div>
  );
}
