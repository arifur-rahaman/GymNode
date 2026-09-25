"use client";

import { useEffect, useState, useTransition } from "react";
import { LogIn, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { formatTimeDhaka } from "@gymnode/core";
import { checkInMember } from "@/app/app/checkin-actions";
import { searchPaymentMembers, type PaymentMember } from "@/app/app/payments/actions";
import { MemberAvatar } from "@/components/members/member-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useErrorText } from "@/lib/use-error-text";

export type CheckinRow = {
  id: string;
  at: string;
  name: string;
  method: string;
  result: "allowed" | "blocked";
  reason: string | null;
};

/** Today's check-ins, updated live through Supabase Realtime (RLS applies to the feed). */
export function LiveCheckins({
  gymId,
  initial,
  canCheckIn,
  canOverride,
}: {
  gymId: string;
  initial: CheckinRow[];
  canCheckIn: boolean;
  canOverride: boolean;
}) {
  const t = useTranslations("dashboard");
  const tm = useTranslations("checkinMethods");
  const [rows, setRows] = useState(initial);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // Subscribe only after the login session is loaded and handed to Realtime; otherwise the
      // subscription joins anonymously and RLS (correctly) delivers nothing.
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`checkins-${gymId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "attendance", filter: `gym_id=eq.${gymId}` },
          async (payload) => {
            const id = (payload.new as { id: string }).id;
            const { data: row } = await supabase
              .from("attendance")
              .select("id, checked_in_at, method, result, reason, members(full_name)")
              .eq("id", id)
              .maybeSingle();
            if (!row) return;
            const next: CheckinRow = {
              id: row.id,
              at: row.checked_in_at,
              name: (row.members as { full_name: string } | null)?.full_name ?? "—",
              method: row.method,
              result: row.result,
              reason: row.reason,
            };
            setRows((prev) => [next, ...prev.filter((r) => r.id !== next.id)].slice(0, 8));
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [gymId]);

  return (
    <div className="flex flex-col gap-4" data-testid="live-checkins">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-bold">{t("liveTitle")}</h2>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="size-2 animate-pulse rounded-full bg-success" aria-hidden />{" "}
          {t("liveHint")}
        </span>
      </div>
      {canCheckIn ? <CheckInBox canOverride={canOverride} /> : null}
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">{t("noCheckins")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border" aria-live="polite">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <span className="num w-11 shrink-0 text-sm text-muted">
                {formatTimeDhaka(new Date(r.at))}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{r.name}</span>
                <span className="text-xs text-muted">{tm(r.method as "manual")}</span>
              </span>
              {r.result === "allowed" ? (
                <Badge tone="green">{t("allowed")}</Badge>
              ) : (
                <Badge tone="red">
                  {r.reason ? `${t(`reason_${r.reason}` as "reason_expired")} · ` : ""}
                  {t("blocked")}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CheckInBox({ canOverride }: { canOverride: boolean }) {
  const t = useTranslations("dashboard");
  const errorText = useErrorText();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PaymentMember[]>([]);
  const [blocked, setBlocked] = useState<PaymentMember | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const id = setTimeout(
      () => startTransition(async () => setResults(await searchPaymentMembers(q))),
      300,
    );
    return () => clearTimeout(id);
  }, [q]);

  const doCheckIn = (m: PaymentMember, override = false) =>
    startTransition(async () => {
      const res = await checkInMember(m.id, override);
      if (!res.ok) return void toast.error(errorText(res.formError));
      if (res.data!.result === "allowed") {
        toast.success(t("checkedIn", { name: m.name }));
        setQ("");
        setResults([]);
        setBlocked(null);
      } else {
        toast.error(
          t("checkInBlocked", {
            name: m.name,
            reason: t(`reason_${res.data!.reason}` as "reason_expired"),
          }),
        );
        setBlocked(m);
      }
    });

  return (
    <div className="flex flex-col gap-2">
      <label className="flex h-11 items-center gap-2 rounded-md border border-border bg-bg px-3.5 focus-within:border-accent">
        <Search className="size-[18px] text-muted" aria-hidden />
        <span className="sr-only">{t("checkInSearch")}</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`${t("checkInSearch")}: ${t("checkInPlaceholder")}`}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </label>
      {q.trim().length >= 2 && results.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {results.slice(0, 5).map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2">
              <MemberAvatar name={m.name} size={30} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{m.name}</span>
                <span className="num text-xs text-muted">{m.code}</span>
              </span>
              {blocked?.id === m.id && canOverride ? (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={pending}
                  onClick={() => doCheckIn(m, true)}
                >
                  {t("override")}
                </Button>
              ) : (
                <Button size="sm" disabled={pending} onClick={() => doCheckIn(m)}>
                  <LogIn /> {t("checkIn")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
