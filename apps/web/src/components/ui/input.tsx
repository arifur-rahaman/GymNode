import * as React from "react";
import { cn } from "@/lib/utils";

// DESIGN_SYSTEM §6 Inputs: height 44–48, radius 12, bg --bg inside panels,
// focus = accent border + visible ring. Always pair with a visible <Label>.
export const inputClasses =
  "h-12 w-full min-w-0 rounded-md border border-border bg-bg px-3.5 text-[15px] text-text placeholder:text-muted outline-none transition-colors duration-150 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(inputClasses, className)} {...props} />;
}

export { Input };
