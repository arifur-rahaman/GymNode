import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { formatDateShort, toLocalBdPhone } from "@gymnode/core";
import { getActiveMembership } from "@/lib/auth";
import { FRONT_DESK } from "@/lib/gym-context";
import { memberQuery, parseMemberListParams } from "@/lib/member-list";

function csvCell(value: string | number) {
  const s = String(value);
  // Quote everything; also stop spreadsheet formula injection (=, +, -, @ at the start).
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Member list as a CSV file with the current filters. Excel opens it directly; the UTF-8
 * byte-order mark makes Excel show Bangla correctly.
 */
export async function GET(request: NextRequest) {
  const membership = await getActiveMembership();
  if (!membership || !FRONT_DESK.includes(membership.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const params = parseMemberListParams(Object.fromEntries(request.nextUrl.searchParams));
  const { data, error } = await memberQuery(membership.gymId, params, { limit: 5000 });
  if (error) return NextResponse.json({ error: "failed" }, { status: 500 });

  const t = await getTranslations("members");
  const ts = await getTranslations("status");
  const header = [
    t("colId"),
    t("colMember"),
    "Phone",
    t("colPackage"),
    t("colExpiry"),
    t("colStatus"),
    `${t("colDue")} (৳)`,
  ];
  const lines = (data ?? []).map((m) =>
    [
      m.member_code ?? "",
      m.full_name ?? "",
      m.phone ? toLocalBdPhone(m.phone) : "",
      m.package_name ?? "",
      m.end_date ? formatDateShort(m.end_date) : "",
      m.status === "pending" ? ts("pending") : ts((m.display_status ?? "expired") as "active"),
      Number(m.due_paisa ?? 0) / 100,
    ]
      .map(csvCell)
      .join(","),
  );
  const body = "﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="members-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
