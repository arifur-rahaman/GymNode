import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// DESIGN_SYSTEM §6 Buttons: primary = accent fill, height 44 (52 for main form submit),
// radius 12. Minimum 44×44 touch target (§1.4).
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent font-semibold hover:brightness-95",
        secondary: "border border-border bg-surface text-text hover:bg-surface-2",
        danger: "border border-border bg-surface text-danger hover:bg-surface-2",
        ghost: "text-text hover:bg-surface-2",
      },
      size: {
        default: "h-11 px-4",
        lg: "h-[52px] px-6 text-[15px]",
        sm: "h-9 rounded-sm px-3 text-[13px]",
        icon: "size-11",
        "icon-sm": "size-9 rounded-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a <Link>) with button styles. */
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
