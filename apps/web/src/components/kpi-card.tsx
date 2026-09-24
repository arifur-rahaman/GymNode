import * as React from "react";
import { cn } from "@/lib/utils";

// DESIGN_SYSTEM §6 KPI card: label (small, muted) → value (kpi size, numeric font,
// optionally tinted) → sub-line (green for positive change, muted otherwise).
type Tone = "default" | "accent" | "success" | "warning" | "danger" | "info";

const valueTone: Record<Tone, string> = {
  default: "text-text",
  accent: "text-accent-text",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

type KpiCardProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  subTone?: "positive" | "muted";
  className?: string;
};

function KpiCard({
  label,
  value,
  sub,
  tone = "default",
  subTone = "muted",
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-surface p-5",
        className,
      )}
    >
      <span className="text-[13px] text-muted">{label}</span>
      <span
        className={cn("num text-[28px] leading-none font-bold md:text-[30px]", valueTone[tone])}
      >
        {value}
      </span>
      {sub ? (
        <span className={cn("text-[13px]", subTone === "positive" ? "text-success" : "text-muted")}>
          {sub}
        </span>
      ) : null}
    </div>
  );
}

export { KpiCard };
