import { addDays, formatDateShort, type IsoDate } from "@gymnode/core";
import { cn } from "@/lib/utils";

/**
 * Last 5 weeks of attendance as a Saturday–Friday grid (MemberProfile.dc.html).
 * Each cell also has a text label, so presence isn't shown by colour alone.
 */
export function AttendanceHeatmap({
  today,
  presentDays,
  weekdayLabels,
  presentLabel,
  absentLabel,
}: {
  today: IsoDate;
  presentDays: Set<string>;
  weekdayLabels: string[];
  presentLabel: string;
  absentLabel: string;
}) {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const thisSaturday = addDays(today, -((weekday + 1) % 7));
  const start = addDays(thisSaturday, -28);
  const cells = Array.from({ length: 35 }, (_, i) => addDays(start, i));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted" aria-hidden>
        {weekdayLabels.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <ul className="grid grid-cols-7 gap-1.5">
        {cells.map((d) => {
          const future = d > today;
          const present = presentDays.has(d);
          return (
            <li
              key={d}
              aria-label={
                future
                  ? undefined
                  : `${formatDateShort(d)}: ${present ? presentLabel : absentLabel}`
              }
              aria-hidden={future || undefined}
              className={cn(
                "aspect-square rounded-xs",
                future ? "bg-transparent" : present ? "bg-chart-income" : "bg-surface-2",
              )}
            />
          );
        })}
      </ul>
    </div>
  );
}
