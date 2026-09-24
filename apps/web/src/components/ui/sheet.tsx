"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Side panel on tablet/desktop, full-screen sheet on mobile (DESIGN_SYSTEM §5).
// Opens in 200ms ease-out (§8); reduced-motion users get no animation (globals.css).

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

function SheetContent({
  className,
  children,
  closeLabel,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { closeLabel: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-[fade-in_200ms_ease-out]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-0 z-50 flex flex-col overflow-y-auto bg-surface p-5 text-text outline-none md:inset-y-0 md:right-0 md:left-auto md:w-[440px] md:border-l md:border-border",
          "data-[state=open]:animate-[sheet-in_200ms_var(--ease)]",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="absolute top-3 right-3 inline-flex size-11 cursor-pointer items-center justify-center rounded-sm text-muted hover:bg-surface-2 hover:text-text"
        >
          <X className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("pr-12 text-[17px] leading-[1.4] font-bold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-muted", className)} {...props} />;
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
