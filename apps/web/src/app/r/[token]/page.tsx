import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { formatDateShort, formatTaka, formatTimeDhaka } from "@gymnode/core";
import { GymLogo } from "@/components/shell/gym-logo";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Receipt = {
  gym_name: string;
  gym_logo_path: string | null;
  gym_phone: string | null;
  gym_address: string;
  branch_name: string;
  invoice_no: string;
  paid_at: string;
  amount_paisa: number;
  method: string;
  transaction_id: string | null;
  status: string;
  kind: string;
  member_name: string | null;
  member_code: string | null;
  package_name: string | null;
  start_date: string | null;
  end_date: string | null;
  received_by: string;
};

/** Public receipt: anyone with the secret link can see it (e.g. sent on WhatsApp). */
export default async function ReceiptPage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const t = await getTranslations("receipt");
  const tm = await getTranslations("methods");
  const ts = await getTranslations("status");
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_receipt", { p_token: token });
  const r = data as Receipt | null;

  if (!r) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center px-4">
        <p className="text-muted">{t("notFound")}</p>
      </main>
    );
  }

  const paidAt = new Date(r.paid_at);
  const rows: [string, React.ReactNode][] = [
    [
      t("invoice"),
      <span key="i" className="num">
        {r.invoice_no}
      </span>,
    ],
    [
      t("date"),
      <span
        key="d"
        className="num"
      >{`${formatDateShort(paidAt)} · ${formatTimeDhaka(paidAt)}`}</span>,
    ],
    [t("member"), `${r.member_name ?? "—"}${r.member_code ? ` · ${r.member_code}` : ""}`],
    [t("package"), r.kind === "due" ? t("dueKind") : (r.package_name ?? "—")],
    ...(r.start_date && r.end_date
      ? ([
          [
            t("period"),
            <span
              key="p"
              className="num"
            >{`${formatDateShort(r.start_date)} – ${formatDateShort(r.end_date)}`}</span>,
          ],
        ] as [string, React.ReactNode][])
      : []),
    [t("method"), tm(r.method as "cash")],
    ...(r.transaction_id
      ? ([
          [
            t("txn"),
            <span key="x" className="num">
              {r.transaction_id}
            </span>,
          ],
        ] as [string, React.ReactNode][])
      : []),
    [t("receivedBy"), r.received_by || "—"],
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8 print:py-0">
      <article className="rounded-xl border border-border bg-surface p-6 print:border-0">
        <header className="flex items-center gap-3 border-b border-border pb-4">
          <GymLogo name={r.gym_name} logoPath={r.gym_logo_path} />
          <div className="min-w-0">
            <p className="text-lg font-bold">{r.gym_name}</p>
            <p className="text-xs text-muted">
              {r.branch_name}
              {r.gym_phone ? (
                <span className="num"> · {r.gym_phone.replace(/^\+88/, "")}</span>
              ) : null}
            </p>
          </div>
        </header>
        <div className="flex items-center justify-between gap-3 py-4">
          <h1 className="text-[17px] font-bold">{t("title")}</h1>
          {r.status === "completed" ? (
            <Badge tone="green">{ts("completed")}</Badge>
          ) : r.status === "pending_verification" ? (
            <Badge tone="amber">{ts("pendingVerification")}</Badge>
          ) : (
            <Badge tone="red">{ts("cancelled")}</Badge>
          )}
        </div>
        <dl className="flex flex-col divide-y divide-border text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-center justify-between rounded-md bg-surface-2 p-4">
          <span className="text-muted">{t("amount")}</span>
          <span
            className={`num text-2xl font-bold ${r.status === "cancelled" ? "text-muted line-through" : "text-accent-text"}`}
          >
            {formatTaka(r.amount_paisa)}
          </span>
        </div>
        {r.status === "cancelled" ? (
          <p className="mt-3 text-sm font-semibold text-danger">{t("cancelledNote")}</p>
        ) : null}
        <p className="mt-4 text-center text-sm text-muted">{t("thanks")}</p>
      </article>
      <PrintButton label={t("print")} />
    </main>
  );
}
