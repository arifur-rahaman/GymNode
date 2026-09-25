import Link from "next/link";
import { cn } from "@/lib/utils";

/** Segmented tabs that are links (the filter state lives in the URL, so it survives refresh and sharing). */
export function LinkTabs({
  label,
  items,
  className,
}: {
  label: string;
  items: { href: string; label: React.ReactNode; active: boolean; count?: React.ReactNode }[];
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "inline-flex max-w-full gap-1.5 self-start overflow-x-auto rounded-md border border-border bg-surface p-1",
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex h-[38px] shrink-0 items-center gap-1.5 rounded-[9px] px-3.5 text-sm",
            item.active ? "bg-accent font-semibold text-on-accent" : "text-muted hover:text-text",
          )}
        >
          {item.label}
          {item.count !== undefined ? (
            <span className="num text-xs opacity-80">{item.count}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
