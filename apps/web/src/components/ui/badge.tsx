import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// DESIGN_SYSTEM §2 Status badges: pill, 12px semibold. Colour is never the only
// signal — every badge carries a text label.
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold",
  {
    variants: {
      tone: {
        green: "bg-badge-green-bg text-badge-green-fg",
        amber: "bg-badge-amber-bg text-badge-amber-fg",
        red: "bg-badge-red-bg text-badge-red-fg",
        blue: "bg-badge-blue-bg text-badge-blue-fg",
        gray: "bg-badge-gray-bg text-badge-gray-fg",
      },
    },
    defaultVariants: { tone: "gray" },
  },
);

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
