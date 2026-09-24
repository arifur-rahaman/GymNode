import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { toLocalBdPhone, todayInDhaka } from "@gymnode/core";
import { MemberForm } from "@/components/members/member-form";
import { FRONT_DESK, gymTrainers, hasRole, requireGym, signedPhotoUrls } from "@/lib/gym-context";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("memberForm");
  return { title: t("editTitle") };
}

export default async function EditMemberPage({ params }: PageProps<"/app/members/[id]/edit">) {
  const { id } = await params;
  const t = await getTranslations("memberForm");
  const te = await getTranslations("errors");
  const membership = await requireGym();
  if (!hasRole(membership, FRONT_DESK)) return <p className="text-muted">{te("forbidden")}</p>;

  const supabase = await createClient();
  const { data: m } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!m) notFound();
  const [trainers, photos] = await Promise.all([
    gymTrainers(membership.gymId),
    signedPhotoUrls([m.photo_path]),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">{t("editTitle")}</h1>
      <MemberForm
        mode="edit"
        gymId={membership.gymId}
        memberId={m.id}
        photoUrl={m.photo_path ? photos.get(m.photo_path) : null}
        trainers={trainers}
        today={todayInDhaka()}
        initial={{
          fullName: m.full_name,
          phone: toLocalBdPhone(m.phone),
          gender: m.gender ?? "",
          dob: m.dob ?? "",
          address: m.address,
          emergencyName: m.emergency_contact_name,
          emergencyPhone: m.emergency_contact_phone
            ? toLocalBdPhone(m.emergency_contact_phone)
            : "",
          trainerId: m.assigned_trainer_id ?? "",
          notes: m.notes,
        }}
      />
    </div>
  );
}
