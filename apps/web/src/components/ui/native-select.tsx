import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClasses } from "./input";

/**
 * A styled native <select>. Chosen over a custom dropdown because it is fast,
 * accessible and uses the phone's own picker on cheap Android devices.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(inputClasses, "cursor-pointer appearance-none pr-10", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3.5 size-[18px] -translate-y-1/2 text-muted"
      />
    </div>
  );
}

export { NativeSelect };
