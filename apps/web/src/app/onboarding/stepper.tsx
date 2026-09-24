import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Progress dots for the wizard; text labels so progress is not shown by colour alone. */
export function Stepper({ current, labels }: { current: number; labels: string[] }) {
  return (
    <ol className="grid grid-cols-4 gap-2">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const now = n === current;
        return (
          <li key={label} aria-current={now ? "step" : undefined} className="flex flex-col gap-1.5">
            <span
              className={cn("h-1.5 rounded-full", done || now ? "bg-accent" : "bg-surface-2")}
            />
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                now ? "font-semibold text-text" : "text-muted",
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : null}
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
