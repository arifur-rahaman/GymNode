"use client";

import * as React from "react";
import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils";

// DESIGN_SYSTEM §6 Segmented tabs/filters: surface container + border, radius 12,
// padding 4; active item accent fill; counts next to labels. Arrow keys move focus.
type SegmentedItem = { value: string; label: React.ReactNode; count?: React.ReactNode };

type SegmentedProps = {
  items: SegmentedItem[];
  value: string;
  onValueChange: (value: string) => void;
  "aria-label": string;
  className?: string;
};

function Segmented({ items, value, onValueChange, className, ...rest }: SegmentedProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Radix sends "" when the active item is clicked again; keep one item selected.
      onValueChange={(next) => next && onValueChange(next)}
      aria-label={rest["aria-label"]}
      className={cn(
        "inline-flex max-w-full gap-1.5 overflow-x-auto rounded-md border border-border bg-surface p-1",
        className,
      )}
    >
      {items.map((item) => (
        <ToggleGroup.Item
          key={item.value}
          value={item.value}
          className="flex h-[38px] shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] px-3.5 text-sm text-muted transition-colors duration-150 hover:text-text data-[state=on]:bg-accent data-[state=on]:font-semibold data-[state=on]:text-on-accent"
        >
          {item.label}
          {item.count !== undefined ? (
            <span className="num text-xs opacity-80">{item.count}</span>
          ) : null}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

export { Segmented, type SegmentedItem };
