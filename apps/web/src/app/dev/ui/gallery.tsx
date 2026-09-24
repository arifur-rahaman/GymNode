"use client";

import { useState } from "react";
import { Plus, Search, Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  formatDateShort,
  formatTaka,
  formatTakaCompact,
  isValidBdPhone,
  maskBdPhone,
  type MemberDisplayStatus,
} from "@gymnode/core";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { ResponsiveTable, type Column } from "@/components/responsive-table";
import { MemberStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented } from "@/components/ui/segmented";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

// Sample data only (names from the designs). Real data arrives with the seed in M2.
type SampleMember = {
  code: string;
  name: string;
  phone: string;
  pkg: string;
  endDate: string;
  status: MemberDisplayStatus;
  duePaisa: number;
};

const SAMPLE: SampleMember[] = [
  {
    code: "PH-0142",
    name: "রাফি আহমেদ",
    phone: "+8801712345421",
    pkg: "মাসিক",
    endDate: "2026-09-24",
    status: "due",
    duePaisa: 150000,
  },
  {
    code: "PH-0131",
    name: "তানিয়া ইসলাম",
    phone: "+8801812345907",
    pkg: "৩ মাস",
    endDate: "2026-09-26",
    status: "active",
    duePaisa: 0,
  },
  {
    code: "PH-0098",
    name: "সাকিব হাসান",
    phone: "+8801912345118",
    pkg: "মাসিক",
    endDate: "2026-09-12",
    status: "expired",
    duePaisa: 80000,
  },
  {
    code: "PH-0077",
    name: "নুসরাত জাহান",
    phone: "+8801612345352",
    pkg: "৬ মাস",
    endDate: "2026-11-30",
    status: "frozen",
    duePaisa: 0,
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      {children}
    </Card>
  );
}

export function Gallery({ idPrefix }: { idPrefix: string }) {
  const t = useTranslations("devUi");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const te = useTranslations("empty");
  const [tab, setTab] = useState("all");
  const [autoLock, setAutoLock] = useState(true);
  const [override, setOverride] = useState(false);
  const [phone, setPhone] = useState("0171234");

  const columns: Column<SampleMember>[] = [
    {
      key: "member",
      header: t("colMember"),
      width: "2.2fr",
      primary: true,
      cell: (m) => (
        <span className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 font-bold">
            {m.name.charAt(0)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{m.name}</span>
            <span className="num text-xs text-muted">{maskBdPhone(m.phone)}</span>
          </span>
        </span>
      ),
    },
    {
      key: "id",
      header: t("colId"),
      cell: (m) => <span className="num text-muted">{m.code}</span>,
    },
    { key: "pkg", header: t("colPackage"), cell: (m) => m.pkg },
    {
      key: "exp",
      header: t("colExpiry"),
      width: "1.2fr",
      cell: (m) => <span className="num whitespace-nowrap">{formatDateShort(m.endDate)}</span>,
    },
    { key: "status", header: t("colStatus"), cell: (m) => <MemberStatusBadge status={m.status} /> },
    {
      key: "due",
      header: t("colDue"),
      align: "end",
      cell: (m) => (
        <span className={m.duePaisa > 0 ? "num font-semibold text-warning" : "num text-muted"}>
          {formatTaka(m.duePaisa)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Section title={t("buttons")}>
        <div className="flex flex-wrap items-center gap-3">
          <Button>{tc("confirmPayment")}</Button>
          <Button variant="secondary">{tc("excelExport")}</Button>
          <Button variant="danger">{tc("suspend")}</Button>
          <Button variant="ghost">{tc("cancel")}</Button>
          <Button size="icon" variant="secondary" aria-label={tc("search")}>
            <Search />
          </Button>
          <Button size="icon-sm" variant="secondary" aria-label={tc("cancel")}>
            <Trash2 />
          </Button>
          <Button disabled>{tc("save")}</Button>
          <Button size="lg" className="w-full">
            {tc("confirmPayment")}
          </Button>
        </div>
      </Section>

      <Section title={t("inputs")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${idPrefix}-name`} label={t("memberName")}>
            <Input placeholder="রাফি আহমেদ" autoComplete="off" />
          </Field>
          <Field
            id={`${idPrefix}-phone`}
            label={t("phone")}
            error={isValidBdPhone(phone) ? undefined : t("phoneError")}
          >
            <Input
              type="tel"
              inputMode="tel"
              className="num"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field id={`${idPrefix}-pkg`} label={t("package")}>
            <NativeSelect defaultValue="monthly">
              <option value="monthly">মাসিক · ৳1,500</option>
              <option value="3m">৩ মাস · ৳4,000</option>
              <option value="6m">৬ মাস · ৳7,500</option>
            </NativeSelect>
          </Field>
          <label className="flex min-h-11 items-center gap-2.5 self-end text-sm">
            <Checkbox defaultChecked />
            মেম্বারকে SMS ও হোয়াটসঅ্যাপে রিসিট পাঠান
          </label>
        </div>
      </Section>

      <Section title={t("badges")}>
        <div className="flex flex-wrap gap-2">
          <Badge tone="green">{ts("active")}</Badge>
          <Badge tone="amber">{ts("due")}</Badge>
          <Badge tone="amber">{ts("pendingVerification")}</Badge>
          <Badge tone="red">{ts("expired")}</Badge>
          <Badge tone="red">{ts("blocked")}</Badge>
          <Badge tone="blue">{ts("trial")}</Badge>
          <Badge tone="gray">{ts("frozen")}</Badge>
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label={t("todayCollection")}
          value={formatTaka(1850000)}
          sub={t("vsYesterday")}
          tone="accent"
          subTone="positive"
        />
        <KpiCard label={t("monthIncome")} value={formatTakaCompact(34200000)} sub={t("ofTarget")} />
        <KpiCard label={t("activeMembers")} value="312" sub={t("thisMonth")} subTone="positive" />
        <KpiCard
          label={t("totalDue")}
          value={formatTaka(4680000)}
          sub={t("dueMembers")}
          tone="warning"
        />
      </div>

      <Section title={t("tabs")}>
        <Segmented
          aria-label={t("tabs")}
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "all", label: t("tabAll"), count: 348 },
            { value: "active", label: ts("active"), count: 312 },
            { value: "due", label: ts("due"), count: 12 },
            { value: "expired", label: ts("expired"), count: 24 },
            { value: "frozen", label: ts("frozen"), count: 12 },
          ]}
        />
      </Section>

      <Section title={t("toggles")}>
        <div className="flex flex-col divide-y divide-border">
          {[
            {
              id: "lock",
              title: t("autoLock"),
              desc: t("autoLockDesc"),
              on: autoLock,
              set: setAutoLock,
            },
            {
              id: "override",
              title: t("staffOverride"),
              desc: t("staffOverrideDesc"),
              on: override,
              set: setOverride,
            },
          ].map((r) => (
            <div key={r.id} className="flex min-h-14 items-center justify-between gap-4 py-2">
              <label htmlFor={`${idPrefix}-${r.id}`} className="flex cursor-pointer flex-col">
                <span className="font-semibold">{r.title}</span>
                <span className="text-[13px] text-muted">{r.desc}</span>
              </label>
              <Switch id={`${idPrefix}-${r.id}`} checked={r.on} onCheckedChange={r.set} />
            </div>
          ))}
        </div>
      </Section>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold">{t("list")}</h2>
          <Badge tone="gray">{t("sampleData")}</Badge>
        </div>
        <ResponsiveTable
          caption={t("list")}
          columns={columns}
          rows={SAMPLE}
          rowKey={(m) => m.code}
        />
      </div>

      <Section title={t("sheet")}>
        <div className="flex flex-wrap gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button>{tc("takePayment")}</Button>
            </SheetTrigger>
            <SheetContent closeLabel={tc("close")} aria-describedby={undefined}>
              <SheetTitle>{tc("takePayment")}</SheetTitle>
              <SheetDescription className="mt-1">রাফি আহমেদ · PH-0142</SheetDescription>
              <div className="mt-5 flex flex-1 flex-col gap-4">
                <Field id={`${idPrefix}-amount`} label="পরিমাণ">
                  <Input inputMode="numeric" className="num" defaultValue="1500" />
                </Field>
                <div className="mt-auto flex items-center justify-between rounded-md bg-surface-2 p-4">
                  <span className="text-muted">মোট</span>
                  <span className="num text-2xl font-bold text-accent-text">
                    {formatTaka(150000)}
                  </span>
                </div>
                <Button size="lg">{tc("confirmPayment")}</Button>
              </div>
            </SheetContent>
          </Sheet>
          <Button variant="secondary" onClick={() => toast.success(t("toastMessage"))}>
            {t("toast")}
          </Button>
        </div>
      </Section>

      <Section title={t("emptyState")}>
        <EmptyState
          icon={<Users />}
          message={te("members")}
          action={
            <Button>
              <Plus /> {tc("newMember").replace(/^\+\s*/, "")}
            </Button>
          }
        />
      </Section>

      <Section title={t("skeleton")}>
        <div className="flex flex-col gap-2" aria-busy="true" aria-label={tc("loading")}>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Section>
    </div>
  );
}
