"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

// DESIGN_SYSTEM §6 Toggles: 46×26 track, 20px white knob, on = accent.
// Wrapped in a 44px-tall hit area by the caller (whole row is clickable via <label>).
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer items-center rounded-full bg-chart-muted transition-colors duration-200 ease-volt data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-[3px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-volt data-[state=checked]:translate-x-[23px]" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
