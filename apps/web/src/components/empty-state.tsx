import * as React from "react";
import { cn } from "@/lib/utils";

/** Empty lists invite action (DESIGN_SYSTEM §7): a message plus the next step. */
function EmptyState({
  icon,
  message,
  action,
  className,
}: {
  icon?: React.ReactNode;
  message: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <p className="max-w-sm text-[15px] text-muted">{message}</p>
      {action}
    </div>
  );
}

export { EmptyState };
