import { cn } from "@/lib/utils";

/**
 * Label + value + horizontal bar (expense categories, peak hours in Reports.dc.html).
 * The value is always printed, so the bar is decoration and needs no colour meaning.
 */
export function BarList({
  items,
  barClassName = "bg-chart-expense",
  labelWidth,
}: {
  items: { key: string; label: React.ReactNode; value: number; display: React.ReactNode }[];
  barClassName?: string;
  /** Put the label left of the bar (peak hours) instead of above it. */
  labelWidth?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const bar = (
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <span
              className={cn("block h-full rounded-full", barClassName)}
              style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0)}%` }}
            />
          </span>
        );
        return labelWidth ? (
          <li key={item.key} className="flex items-center gap-2.5 text-sm">
            <span className="num shrink-0 text-muted" style={{ width: labelWidth }}>
              {item.label}
            </span>
            {bar}
            <span className="num shrink-0 font-semibold">{item.display}</span>
          </li>
        ) : (
          <li key={item.key} className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{item.label}</span>
              <span className="num shrink-0 font-semibold">{item.display}</span>
            </span>
            <span className="flex">{bar}</span>
          </li>
        );
      })}
    </ul>
  );
}
