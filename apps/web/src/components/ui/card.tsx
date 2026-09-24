import * as React from "react";
import { cn } from "@/lib/utils";

// DESIGN_SYSTEM §6 Cards: surface, 1px border, radius 16, padding 18–20, no shadow.
function Card({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="card"
      className={cn("rounded-lg border border-border bg-surface p-5", className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("mb-4 flex items-center justify-between gap-3", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="card-title"
      className={cn("text-[17px] leading-[1.4] font-bold", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle };
