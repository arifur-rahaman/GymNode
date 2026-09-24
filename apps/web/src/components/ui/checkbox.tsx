import * as React from "react";
import { cn } from "@/lib/utils";

/** Native checkbox, 18px as in the designs, tinted with the accent colour. */
function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn("size-[18px] cursor-pointer accent-accent", className)}
      {...props}
    />
  );
}

export { Checkbox };
