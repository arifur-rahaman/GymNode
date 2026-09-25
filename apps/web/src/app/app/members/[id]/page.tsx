import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, MessageCircle, Pencil, Scale } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  addDays,
  daysBetween,
  formatDateShort,
  formatTaka,
  maskBdPhone,
  toLocalBdPhone,
  todayInDhaka,
  type MemberDisplayStatus,
} from "@gymnode/core";
import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/components/members/member-avatar";
import { whatsappUrl } from "@/components/members/whatsapp-link";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { MemberStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FRONT_DESK,
  MANAGEMENT,
  gymPackages,
  hasRole,
  requireGym,
  signedPhotoUrls,
} from "@/lib/gym-context";
import { createClient } from "@/lib/supabase/server";
import { PaymentRowActions } from "@/app/app/payments/row-actions";
import { getUserId } from "@/lib/auth";
import { AttendanceHeatmap } from "@/components/members/attendance-heatmap";
import { CheckInButton } from "./check-in-button";
import { DeleteMemberButton, FreezeControls, RenewSheet } from "./member-actions";

export async function generateMetadata({
  params,
}: PageProps<"/app/members/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("members").select("full_name").eq("id", id).maybeSingle();
  return { title: data?.full_name ?? "—" };
}

type PaymentRow = {
  id: string;
  date: string;
  invoice: string;
  amount: number;
  method: string;
  status: string;
  token: string;
  byMe: boolean;
};

export default async function MemberProfilePage({ params }: PageProps<"/app/members/[id]">) {
  const { id } = await params;
  const t = await getTranslations("profile");
  const tm = await getTranslations("methods");
  const tg = await getTranslations("genders");
  const ts = await getTranslations("status");
  const tc = await getTranslations("common");
  const tp = await getTranslations("payments");
  const membership = await requireGym();
  const frontDesk = hasRole(membership, FRONT_DESK);
  const supabase = await createClient();
  const today = todayInDhaka();
  const userId = await getUserId();
  const canManage = hasRole(membership, MANAGEMENT);

  const [{ data: ov }, { data: m }] = await Promise.all([
    supabase.from("member_overview").select("*").eq("id", id).maybeSingle(),
    supabase.from("members").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
  ]);
  if (!ov || !m) notFound();

  const [packages, photos, trainer, locker, payments, memberships, visits] = await Promise.all([
    frontDesk ? gymPackages(membership.gymId) : Promise.resolve([]),
    signedPhotoUrls([m.photo_path]),
    m.assigned_trainer_id
      ? supabase
          .from("gym_users")
          .select("display_name")
          .eq("id", m.assigned_trainer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    m.locker_id
      ? supabase.from("lockers").select("code").eq("id", m.locker_id).maybeSingle()
      : Promise.resolve({ data: null }),
    frontDesk
      ? supabase
          .from("payments")
          .select(
            "id, paid_at, invoice_no, amount_paisa, method, status, receipt_token, received_by",
          )
          .eq("member_id", id)
          .order("paid_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    supabase
      .from("memberships")
      .select("id, start_date, end_date, status, packages(name)")
      .eq("member_id", id)
      .neq("status", "cancelled")
      .order("end_date", { ascending: false })
      .limit(24),
    supabase
      .from("attendance")
      .select("checked_in_at")
      .eq("member_id", id)
      .eq("result", "allowed")
      .gte("checked_in_at", new Date(`${addDays(today, -40)}T00:00:00+06:00`).toISOString()),
  ]);
  const presentDays = new Set(
    (visits.data ?? []).map((v) => todayInDhaka(new Date(v.checked_in_at))),
  );
  const monthPrefix = today.slice(0, 8);
  const presentThisMonth = [...presentDays].filter((d) => d.startsWith(monthPrefix)).length;

  const status = (m.status === "pending" ? "expired" : ov.display_status) as MemberDisplayStatus;
  const duePaisa = Number(ov.due_paisa ?? 0);
  const hasMembership = !!ov.membership_id && !!ov.start_date && !!ov.end_date;
  const totalDays = hasMembership ? daysBetween(ov.start_date!, ov.end_date!) + 1 : 0;
  const usedDays = hasMembership
    ? Math.min(Math.max(daysBetween(ov.start_date!, today) + 1, 0), totalDays)
    : 0;
  const phone = frontDesk ? toLocalBdPhone(m.phone) : maskBdPhone(m.phone);
  const currentPkg = packages.find((p) => p.id === ov.package_id);

  const paymentRows: PaymentRow[] = (payments.data ?? []).map((p) => ({
    id: p.id,
    date: formatDateShort(new Date(p.paid_at)),
    invoice: p.invoice_no,
    amount: p.amount_paisa,
    method: p.method,
    status: p.status,
    token: p.receipt_token,
    byMe: p.received_by === userId,
  }));
  const paymentColumns: Column<PaymentRow>[] = [
    {
      key: "date",
      header: t("colDate"),
      primary: true,
      cell: (r) => <span className="num whitespace-nowrap">{r.date}</span>,
    },
    {
      key: "inv",
      header: t("colInvoice"),
      width: "1.4fr",
      cell: (r) => <span className="num text-muted">{r.invoice}</span>,
    },
    {
      key: "amt",
      header: t("colAmount"),
      cell: (r) => <span className="num font-semibold">{formatTaka(r.amount)}</span>,
    },
    { key: "method", header: t("colMethod"), cell: (r) => tm(r.method as "cash") },
    {
      key: "status",
      header: t("colStatus"),
      cell: (r) =>
        r.status === "completed" ? (
          <Badge tone="green">{ts("completed")}</Badge>
        ) : r.status === "pending_verification" ? (
          <Badge tone="amber">{ts("pendingVerification")}</Badge>
        ) : (
          <Badge tone="gray">{ts("cancelled")}</Badge>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("colStatus")}</span>,
      width: "150px",
      align: "end",
      mobileFooter: true,
      cell: (r) => (
        <PaymentRowActions
          paymentId={r.id}
          receiptToken={r.token}
          label={`${r.invoice} · ${formatTaka(r.amount)}`}
          canVerify={canManage && r.status === "pending_verification"}
          canCancel={
            r.status !== "cancelled" &&
            (canManage || (r.status === "pending_verification" && r.byMe))
          }
        />
      ),
    },
  ];

  const info: [string, string][] = [
    [t("joined"), formatDateShort(m.joined_at)],
    [t("trainer"), trainer.data?.display_name ?? tc("none")],
    [t("locker"), locker.data?.code ?? tc("none")],
    [t("faceId"), ov.face_enrolled ? t("enrolled") : t("notEnrolled")],
    [t("fingerprint"), ov.fingerprint_enrolled ? t("enrolled") : t("notEnrolled")],
    [t("gender"), m.gender ? tg(m.gender) : tc("none")],
    ...(frontDesk
      ? ([
          [t("dob"), m.dob ? formatDateShort(m.dob) : tc("none")],
          [t("address"), m.address || tc("none")],
          [
            t("emergency"),
            m.emergency_contact_name || m.emergency_contact_phone
              ? `${m.emergency_contact_name} ${m.emergency_contact_phone ? toLocalBdPhone(m.emergency_contact_phone) : ""}`.trim()
              : tc("none"),
          ],
        ] as [string, string][])
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="breadcrumb" className="text-sm text-muted">
        <Link href="/app/members" className="hover:underline">
          {(await getTranslations("members"))("title")}
        </Link>{" "}
        / <span className="text-text">{m.full_name}</span>
      </nav>

      <div className="grid gap-5 desk:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Header + package */}
          <Card className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-4">
              <MemberAvatar
                name={m.full_name}
                photoUrl={m.photo_path ? photos.get(m.photo_path) : null}
                size={64}
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-[22px] leading-[1.3] font-bold md:text-[26px]">
                  {m.full_name}
                </h1>
                <p className="num text-sm text-muted">
                  {m.member_code ?? ts("pending")} · {phone}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <MemberStatusBadge status={status} />
                {duePaisa > 0 ? (
                  <Badge tone="amber">{t("due", { amount: formatTaka(duePaisa) })}</Badge>
                ) : null}
                {ov.has_pending_payment ? (
                  <Badge tone="amber">{ts("pendingVerification")}</Badge>
                ) : null}
              </div>
            </div>

            {hasMembership ? (
              <div className="grid gap-4 rounded-md bg-surface-2 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-[13px] text-muted">{t("package")}</p>
                  <p className="font-semibold">
                    {ov.package_name}
                    {currentPkg ? (
                      <span className="num text-muted">
                        {" "}
                        · {formatTaka(currentPkg.price_paisa)}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div>
                  <p className="text-[13px] text-muted">{t("expires")}</p>
                  <p className="num font-semibold">
                    {ov.end_date === today ? `${tc("today")} · ` : ""}
                    {formatDateShort(ov.end_date!)}
                  </p>
                  {ov.is_frozen && ov.frozen_until ? (
                    <p className="text-xs text-muted">
                      {t("frozenUntil", { date: formatDateShort(ov.frozen_until) })}
                    </p>
                  ) : null}
                </div>
                <div className="sm:col-span-2">
                  <div
                    className="h-2 overflow-hidden rounded-full bg-bg"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={totalDays}
                    aria-valuenow={usedDays}
                    aria-label={t("daysUsed", { used: String(usedDays), total: String(totalDays) })}
                  >
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${totalDays ? (usedDays / totalDays) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="num mt-1.5 text-xs text-muted">
                    {t("daysUsed", { used: String(usedDays), total: String(totalDays) })}
                  </p>
                </div>
              </div>
            ) : (
              <p className="rounded-md bg-surface-2 p-4 text-muted">{t("noMembership")}</p>
            )}

            {frontDesk && m.status !== "pending" ? (
              <div className="flex flex-wrap gap-2.5">
                <CheckInButton memberId={m.id} name={m.full_name} canOverride={canManage} />
                <RenewSheet
                  memberId={m.id}
                  memberLabel={`${m.full_name} · ${m.member_code ?? ""}`}
                  packages={packages}
                  today={today}
                  currentEndDate={ov.end_date}
                  currentPackageId={ov.package_id}
                  isFirstMembership={!hasMembership}
                  duePaisa={duePaisa}
                />
                {duePaisa > 0 ? (
                  <Button asChild variant="secondary">
                    <Link href={`/app/payments?view=dues&member=${m.id}`}>{tp("payDue")}</Link>
                  </Button>
                ) : null}
                <Button asChild variant="secondary">
                  <a href={whatsappUrl(m.phone)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="text-success" /> {t("whatsapp")}
                  </a>
                </Button>
                {hasMembership && ov.end_date! >= today ? (
                  <FreezeControls
                    memberId={m.id}
                    membershipId={ov.membership_id!}
                    isFrozen={!!ov.is_frozen}
                    today={today}
                  />
                ) : null}
                <Button asChild variant="ghost">
                  <Link href={`/app/members/${m.id}/edit`}>
                    <Pencil /> {t("editInfo")}
                  </Link>
                </Button>
              </div>
            ) : null}
          </Card>

          {/* Attendance and weight: data arrives with the door devices (M8) and member app. */}
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("attendance")}</CardTitle>
              </CardHeader>
              {presentDays.size ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted">
                    {t("attendanceMonth")}:{" "}
                    <span className="num font-semibold text-text">{presentThisMonth}</span> ·{" "}
                    {t("attendanceWeeks", { count: String(presentDays.size) })}
                  </p>
                  <AttendanceHeatmap
                    today={today}
                    presentDays={presentDays}
                    weekdayLabels={t("weekdays").split(",")}
                    presentLabel={t("present")}
                    absentLabel={t("absent")}
                  />
                </div>
              ) : (
                <EmptyState
                  icon={<CalendarCheck />}
                  message={t("attendanceSoon")}
                  className="py-6"
                />
              )}
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("weight")}</CardTitle>
              </CardHeader>
              <EmptyState icon={<Scale />} message={t("weightSoon")} className="py-6" />
            </Card>
          </div>

          {frontDesk ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-[17px] font-bold">{t("payments")}</h2>
              {paymentRows.length ? (
                <ResponsiveTable
                  caption={t("payments")}
                  columns={paymentColumns}
                  rows={paymentRows}
                  rowKey={(r) => r.id}
                />
              ) : (
                <EmptyState message={t("noPayments")} />
              )}
            </section>
          ) : null}
        </div>

        {/* Side column */}
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>{t("info")}</CardTitle>
            </CardHeader>
            <dl className="flex flex-col divide-y divide-border text-sm">
              {info.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {(memberships.data ?? []).length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("memberships")}</CardTitle>
              </CardHeader>
              <ul className="flex flex-col divide-y divide-border text-sm">
                {(memberships.data ?? []).map((ms) => (
                  <li key={ms.id} className="flex justify-between gap-3 py-2.5">
                    <span>{(ms.packages as { name: string } | null)?.name ?? "—"}</span>
                    <span className="num text-muted">
                      {formatDateShort(ms.start_date)} – {formatDateShort(ms.end_date)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {hasRole(membership, MANAGEMENT) ? (
            <DeleteMemberButton memberId={m.id} name={m.full_name} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
